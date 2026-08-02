/**
 * One-time full migration from coveinterior.com WordPress/WooCommerce
 * Source: root@209.38.207.144, DB: coveinterior
 * 
 * Migrates: categories (EN+AR), attributes + values, products (EN+AR), stock, Extra Product Options
 * 
 * Run: node scripts/migrate-from-cove.mjs
 */

import mysql from 'mysql2/promise';
import { execSync, spawnSync } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const REMOTE_HOST = '209.38.207.144';
const REMOTE_DB = 'coveinterior';
const SSH_KEY = `${process.env.HOME}/.ssh/id_rsa`;

// Warehouse IDs (confirmed from DB: MAIN=1, ONLINE=2, POS=3)
const ONLINE_WAREHOUSE_ID = 2;
const POS_WAREHOUSE_ID = 3;

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }
function logErr(msg) { console.error(`[${new Date().toISOString()}] ERROR: ${msg}`); }

// ─── PHP Unserialize ──────────────────────────────────────────────────────────
function phpUnserialize(data) {
  if (!data || typeof data !== 'string') return null;
  let i = 0;

  function readValue() {
    const type = data[i];
    i += 2; // skip type and ':'
    if (type === 'N') { i++; return null; } // N;
    if (type === 'b') { const v = data[i] === '1'; i += 2; return v; }
    if (type === 'i') {
      const end = data.indexOf(';', i);
      const v = parseInt(data.slice(i, end));
      i = end + 1; return v;
    }
    if (type === 'd') {
      const end = data.indexOf(';', i);
      const v = parseFloat(data.slice(i, end));
      i = end + 1; return v;
    }
    if (type === 's') {
      const lenEnd = data.indexOf(':', i);
      const len = parseInt(data.slice(i, lenEnd));
      i = lenEnd + 2; // skip :"
      const v = data.slice(i, i + len);
      i += len + 2; // skip ";
      return v;
    }
    if (type === 'a') {
      const countEnd = data.indexOf(':', i);
      const count = parseInt(data.slice(i, countEnd));
      i = countEnd + 2; // skip :{
      const obj = {};
      for (let k = 0; k < count; k++) {
        const key = readValue();
        const val = readValue();
        obj[key] = val;
      }
      i++; // skip }
      return obj;
    }
    if (type === 'O') {
      // Object: read class name then properties
      const classLenEnd = data.indexOf(':', i);
      const classLen = parseInt(data.slice(i, classLenEnd));
      i = classLenEnd + 2 + classLen + 2; // skip :"ClassName":{
      const countEnd = data.indexOf(':', i);
      const count = parseInt(data.slice(i, countEnd));
      i = countEnd + 2;
      const obj = {};
      for (let k = 0; k < count; k++) {
        const key = readValue();
        const val = readValue();
        obj[key] = val;
      }
      i++;
      return obj;
    }
    return null;
  }

  try { return readValue(); } catch (e) { return null; }
}

function slugify(text) {
  if (!text) return '';
  return text.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── SSH Tunnel ───────────────────────────────────────────────────────────────
function startTunnel() {
  // Check if tunnel is already running on port 3307
  try {
    const existing = execSync('netstat -tlnp 2>/dev/null | grep :3307 || ss -tlnp | grep :3307', { encoding: 'utf8' });
    if (existing.includes('3307')) {
      log('SSH tunnel already running on port 3307, reusing it');
      return;
    }
  } catch {}

  log('Starting SSH tunnel to coveinterior.com on port 3307...');
  try { execSync(`pkill -f "ssh.*3307.*${REMOTE_HOST}" 2>/dev/null`); } catch {}
  execSync('sleep 1');

  // Use shell background process to avoid execSync timeout
  execSync(
    `nohup ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no -o ConnectTimeout=10 -f -N -L 3307:127.0.0.1:3306 root@${REMOTE_HOST} &`,
    { stdio: 'ignore', timeout: 5000, shell: true }
  );
  execSync('sleep 3');
  log('SSH tunnel established on port 3307');
}

function stopTunnel() {
  try { execSync(`pkill -f "ssh.*3307.*${REMOTE_HOST}" 2>/dev/null`); } catch {}
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  startTunnel();
  let srcDb, tgtDb;
  try {
    srcDb = await mysql.createConnection({
      host: '127.0.0.1', port: 3307,
      user: 'wordpress', password: 'Abo@Geo@lebanon@kuwait',
      database: REMOTE_DB,
      charset: 'utf8mb4',
    });
    log('Connected to source DB (coveinterior.com)');

    tgtDb = await mysql.createConnection({
      uri: process.env.DATABASE_URL,
      charset: 'utf8mb4',
    });
    log('Connected to target DB');

    log('\n=== STEP 1: Migrating Categories ===');
    const termIdToCatId = await migrateCategories(srcDb, tgtDb);

    log('\n=== STEP 2: Migrating Attributes ===');
    const { attrTaxToId, termSlugToAvId } = await migrateAttributes(srcDb, tgtDb);

    log('\n=== STEP 3: Migrating Products ===');
    const productIdMap = await migrateProducts(srcDb, tgtDb, termIdToCatId, attrTaxToId, termSlugToAvId);

    log('\n=== STEP 4: Migrating Extra Product Options ===');
    await migrateExtraProductOptions(srcDb, tgtDb, productIdMap, termSlugToAvId);

    log('\n=== VERIFICATION ===');
    const [[{ c: catC }]] = await tgtDb.execute('SELECT COUNT(*) as c FROM categories');
    const [[{ c: prodC }]] = await tgtDb.execute('SELECT COUNT(*) as c FROM products');
    const [[{ c: stockC }]] = await tgtDb.execute('SELECT COUNT(*) as c FROM warehouse_stock');
    const [[{ c: attrC }]] = await tgtDb.execute('SELECT COUNT(*) as c FROM attributes');
    const [[{ c: avC }]] = await tgtDb.execute('SELECT COUNT(*) as c FROM attribute_values');
    const [[{ c: paC }]] = await tgtDb.execute('SELECT COUNT(*) as c FROM product_attributes');
    const [[{ c: biC }]] = await tgtDb.execute('SELECT COUNT(*) as c FROM attribute_value_bundle_items');
    log(`Categories: ${catC}`);
    log(`Products: ${prodC}`);
    log(`Warehouse stock entries: ${stockC}`);
    log(`Attributes: ${attrC}`);
    log(`Attribute values: ${avC}`);
    log(`Product attributes: ${paC}`);
    log(`Bundle items: ${biC}`);
    log('\n=== MIGRATION COMPLETE ===');
  } finally {
    if (srcDb) try { await srcDb.end(); } catch {}
    if (tgtDb) try { await tgtDb.end(); } catch {}
    // Note: not stopping tunnel here — it was started externally
  }
}

// ─── Step 1: Categories ───────────────────────────────────────────────────────
async function migrateCategories(srcDb, tgtDb) {
  const [rows] = await srcDb.execute(`
    SELECT 
      t.term_id,
      t.name as name_en,
      t.slug,
      tt.parent as parent_term_id,
      ar_t.name as name_ar,
      (SELECT meta_value FROM wp_termmeta WHERE term_id = t.term_id AND meta_key = 'thumbnail_id' LIMIT 1) as thumbnail_id
    FROM wp_terms t
    JOIN wp_term_taxonomy tt ON tt.term_id = t.term_id AND tt.taxonomy = 'product_cat'
    JOIN wp_icl_translations en_tr ON en_tr.element_id = tt.term_taxonomy_id 
      AND en_tr.element_type = 'tax_product_cat' AND en_tr.language_code = 'en'
    LEFT JOIN wp_icl_translations ar_tr ON ar_tr.trid = en_tr.trid AND ar_tr.language_code = 'ar'
    LEFT JOIN wp_term_taxonomy ar_tt ON ar_tt.term_taxonomy_id = ar_tr.element_id AND ar_tt.taxonomy = 'product_cat'
    LEFT JOIN wp_terms ar_t ON ar_t.term_id = ar_tt.term_id
    ORDER BY tt.parent ASC, t.term_id ASC
  `);
  log(`Found ${rows.length} EN categories`);

  await tgtDb.execute('DELETE FROM categories WHERE 1=1');
  log('Cleared existing categories');

  const termIdToCatId = {};
  const sorted = [...rows].sort((a, b) => (a.parent_term_id || 0) - (b.parent_term_id || 0));

  for (const row of sorted) {
    const nameEn = (row.name_en || '').replace(/\s*\(web\)|\s*\(store\)/gi, '').trim();
    const nameAr = (row.name_ar || nameEn).trim();
    const slug = row.slug || slugify(nameEn);
    const parentNewId = (row.parent_term_id && termIdToCatId[row.parent_term_id]) || null;

    let imageUrl = null;
    if (row.thumbnail_id) {
      try {
        const [imgRows] = await srcDb.execute(
          'SELECT meta_value FROM wp_postmeta WHERE post_id = ? AND meta_key = "_wp_attached_file" LIMIT 1',
          [row.thumbnail_id]
        );
        if (imgRows.length > 0) imageUrl = `https://coveinterior.com/wp-content/uploads/${imgRows[0].meta_value}`;
      } catch {}
    }

    try {
      const [result] = await tgtDb.execute(
        `INSERT INTO categories (name, nameAr, slug, parentId, image, channel, isActive, displayOrder, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 'both', 1, 0, NOW(), NOW())`,
        [nameEn, nameAr, slug, parentNewId, imageUrl]
      );
      termIdToCatId[row.term_id] = result.insertId;
    } catch (e) {
      try {
        const [result] = await tgtDb.execute(
          `INSERT INTO categories (name, nameAr, slug, parentId, image, channel, isActive, displayOrder, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, 'both', 1, 0, NOW(), NOW())`,
          [nameEn, nameAr, `${slug}-${row.term_id}`, parentNewId, imageUrl]
        );
        termIdToCatId[row.term_id] = result.insertId;
      } catch (e2) {
        logErr(`Category "${nameEn}": ${e2.message}`);
      }
    }
  }

  log(`Migrated ${Object.keys(termIdToCatId).length} categories`);
  return termIdToCatId;
}

// ─── Step 2: Attributes ───────────────────────────────────────────────────────
async function migrateAttributes(srcDb, tgtDb) {
  const [attrs] = await srcDb.execute(`
    SELECT attribute_id, attribute_name, attribute_label, attribute_type
    FROM wp_woocommerce_attribute_taxonomies ORDER BY attribute_id
  `);
  log(`Found ${attrs.length} WooCommerce attributes`);

  await tgtDb.execute('DELETE FROM attribute_value_bundle_items WHERE 1=1');
  await tgtDb.execute('DELETE FROM attribute_value_stock WHERE 1=1');
  await tgtDb.execute('DELETE FROM product_attributes WHERE 1=1');
  await tgtDb.execute('DELETE FROM attribute_values WHERE 1=1');
  await tgtDb.execute('DELETE FROM attributes WHERE 1=1');
  log('Cleared existing attribute data');

  const attrTaxToId = {};    // "pa_color" → new attr id
  const termSlugToAvId = {}; // "attrId:slug" → new av id

  for (const attr of attrs) {
    const taxonomy = `pa_${attr.attribute_name}`;
    let displayType = 'button';
    if (attr.attribute_type === 'color') displayType = 'color';
    else if (attr.attribute_type === 'image') displayType = 'image';

    const [result] = await tgtDb.execute(
      `INSERT INTO attributes (name, displayType, descriptionEn, descriptionAr, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, '', '', 0, NOW(), NOW())`,
      [attr.attribute_label || attr.attribute_name, displayType]
    );
    const newAttrId = result.insertId;
    attrTaxToId[taxonomy] = newAttrId;
    attrTaxToId[attr.attribute_name] = newAttrId;

    // Get EN terms with AR translations
    const [terms] = await srcDb.execute(`
      SELECT 
        t.term_id, t.name as name_en, t.slug,
        MAX(ar_t.name) as name_ar,
        (SELECT meta_value FROM wp_termmeta WHERE term_id = t.term_id AND meta_key = 'product_attribute_color' LIMIT 1) as color_swatch
      FROM wp_terms t
      JOIN wp_term_taxonomy tt ON tt.term_id = t.term_id AND tt.taxonomy = ?
      LEFT JOIN wp_icl_translations en_tr ON en_tr.element_id = tt.term_taxonomy_id 
        AND en_tr.element_type LIKE 'tax_%' AND en_tr.language_code = 'en'
      LEFT JOIN wp_icl_translations ar_tr ON ar_tr.trid = en_tr.trid AND ar_tr.language_code = 'ar'
      LEFT JOIN wp_term_taxonomy ar_tt ON ar_tt.term_taxonomy_id = ar_tr.element_id
      LEFT JOIN wp_terms ar_t ON ar_t.term_id = ar_tt.term_id
      GROUP BY t.term_id, t.name, t.slug ORDER BY t.term_id
    `, [taxonomy]);

    let sortOrder = 0;
    for (const term of terms) {
      const labelEn = term.name_en || '';
      const labelAr = term.name_ar || labelEn;
      const swatch = term.color_swatch || null;
      try {
        const [avResult] = await tgtDb.execute(
          `INSERT INTO attribute_values (attributeId, labelEn, labelAr, swatch, isEnabled, sortOrder, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, 1, ?, NOW(), NOW())`,
          [newAttrId, labelEn, labelAr, swatch, sortOrder++]
        );
        const avId = avResult.insertId;
        termSlugToAvId[`${newAttrId}:${term.slug}`] = avId;
        termSlugToAvId[`${taxonomy}:${term.slug}`] = avId;
        termSlugToAvId[`${newAttrId}:${labelEn.toLowerCase()}`] = avId;
      } catch (e) {
        logErr(`Attribute value "${labelEn}" for ${taxonomy}: ${e.message}`);
      }
    }
    log(`  Attribute "${attr.attribute_label}": ${terms.length} values`);
  }

  log(`Migrated ${attrs.length} attributes`);
  return { attrTaxToId, termSlugToAvId };
}

// ─── Step 3: Products ─────────────────────────────────────────────────────────
async function migrateProducts(srcDb, tgtDb, termIdToCatId, attrTaxToId, termSlugToAvId) {
  const [products] = await srcDb.execute(`
    SELECT 
      en_p.ID as en_id,
      en_p.post_title as name_en,
      en_p.post_name as slug,
      en_p.post_content as description_en,
      en_p.post_excerpt as short_description_en,
      en_p.post_status,
      ar_p.ID as ar_id,
      ar_p.post_title as name_ar,
      ar_p.post_content as description_ar,
      ar_p.post_excerpt as short_description_ar
    FROM wp_icl_translations en_tr
    JOIN wp_posts en_p ON en_p.ID = en_tr.element_id 
      AND en_p.post_type = 'product' 
      AND en_p.post_status IN ('publish', 'draft', 'private')
    LEFT JOIN wp_icl_translations ar_tr ON ar_tr.trid = en_tr.trid AND ar_tr.language_code = 'ar'
    LEFT JOIN wp_posts ar_p ON ar_p.ID = ar_tr.element_id
    WHERE en_tr.element_type = 'post_product' AND en_tr.language_code = 'en'
    ORDER BY en_p.ID
  `);
  log(`Found ${products.length} EN products`);

  await tgtDb.execute('DELETE FROM warehouse_stock WHERE 1=1');
  await tgtDb.execute('DELETE FROM products WHERE 1=1');
  log('Cleared existing products and warehouse stock');

  const productIdMap = {};
  let migrated = 0;
  let errors = 0;

  for (const prod of products) {
    try {
      const [metaRows] = await srcDb.execute(
        'SELECT meta_key, meta_value FROM wp_postmeta WHERE post_id = ?',
        [prod.en_id]
      );
      const meta = {};
      for (const m of metaRows) {
        if (meta[m.meta_key] === undefined) meta[m.meta_key] = m.meta_value;
      }

      const regularPrice = parseFloat(meta['_regular_price'] || '0') || 0;
      const price = parseFloat(meta['_price'] || meta['_regular_price'] || '0') || 0;
      const rawSalePrice = parseFloat(meta['_sale_price'] || '0') || null;
      const salePrice = (rawSalePrice && rawSalePrice > 0 && rawSalePrice < regularPrice) ? rawSalePrice : null;
      const sku = (meta['_sku'] || '').trim().substring(0, 127);
      const weight = parseFloat(meta['_weight'] || '0') || null;
      const stock = parseInt(meta['_stock'] || '0') || 0;
      const stockStatus = meta['_stock_status'] || 'instock';
      const manageStock = meta['_manage_stock'] === 'yes';
      const cog = parseFloat(meta['_wc_cog_cost'] || meta['_alg_wc_cog_cost'] || '0') || null;
      const isFeatured = meta['_featured'] === 'yes' ? 1 : 0;
      const status = prod.post_status === 'publish' ? 'active' : 'draft';

      const dimL = parseFloat(meta['_length'] || '0') || null;
      const dimW = parseFloat(meta['_width'] || '0') || null;
      const dimH = parseFloat(meta['_height'] || '0') || null;
      const dimensionsJson = (dimL || dimW || dimH)
        ? JSON.stringify({ length: String(dimL || ''), width: String(dimW || ''), height: String(dimH || '') })
        : null;

      // Images
      const allImages = [];
      const thumbnailId = meta['_thumbnail_id'];
      if (thumbnailId) {
        try {
          const [imgRows] = await srcDb.execute(
            'SELECT meta_value FROM wp_postmeta WHERE post_id = ? AND meta_key = "_wp_attached_file" LIMIT 1',
            [thumbnailId]
          );
          if (imgRows.length > 0) allImages.push(`https://coveinterior.com/wp-content/uploads/${imgRows[0].meta_value}`);
        } catch {}
      }
      const galleryIds = (meta['_product_image_gallery'] || '').split(',').filter(Boolean);
      for (const gid of galleryIds.slice(0, 9)) {
        try {
          const [gRows] = await srcDb.execute(
            'SELECT meta_value FROM wp_postmeta WHERE post_id = ? AND meta_key = "_wp_attached_file" LIMIT 1',
            [gid.trim()]
          );
          if (gRows.length > 0) {
            const url = `https://coveinterior.com/wp-content/uploads/${gRows[0].meta_value}`;
            if (!allImages.includes(url)) allImages.push(url);
          }
        } catch {}
      }

      // Shipping class
      let shippingClass = null;
      try {
        const [scRows] = await srcDb.execute(`
          SELECT t.slug FROM wp_terms t
          JOIN wp_term_taxonomy tt ON tt.term_id = t.term_id AND tt.taxonomy = 'product_shipping_class'
          JOIN wp_term_relationships tr ON tr.term_taxonomy_id = tt.term_taxonomy_id AND tr.object_id = ?
          LIMIT 1
        `, [prod.en_id]);
        shippingClass = scRows[0]?.slug || null;
      } catch {}

      // Primary category
      let categoryId = null;
      try {
        const [catTerms] = await srcDb.execute(`
          SELECT t.term_id FROM wp_terms t
          JOIN wp_term_taxonomy tt ON tt.term_id = t.term_id AND tt.taxonomy = 'product_cat'
          JOIN wp_term_relationships tr ON tr.term_taxonomy_id = tt.term_taxonomy_id AND tr.object_id = ?
          ORDER BY tr.term_order ASC LIMIT 1
        `, [prod.en_id]);
        if (catTerms.length > 0) categoryId = termIdToCatId[catTerms[0].term_id] || null;
      } catch {}

      // Tags
      let tags = [];
      try {
        const [tagRows] = await srcDb.execute(`
          SELECT t.name FROM wp_terms t
          JOIN wp_term_taxonomy tt ON tt.term_id = t.term_id AND tt.taxonomy = 'product_tag'
          JOIN wp_term_relationships tr ON tr.term_taxonomy_id = tt.term_taxonomy_id AND tr.object_id = ?
        `, [prod.en_id]);
        tags = tagRows.map(r => r.name);
      } catch {}

      // Product type
      let productType = 'simple';
      try {
        const [typeRows] = await srcDb.execute(`
          SELECT t.slug FROM wp_terms t
          JOIN wp_term_taxonomy tt ON tt.term_id = t.term_id AND tt.taxonomy = 'product_type'
          JOIN wp_term_relationships tr ON tr.term_taxonomy_id = tt.term_taxonomy_id AND tr.object_id = ?
          LIMIT 1
        `, [prod.en_id]);
        const wcType = typeRows[0]?.slug || 'simple';
        if (['variable', 'grouped', 'bundle'].includes(wcType)) productType = wcType;
      } catch {}

      let slug = prod.slug || slugify(prod.name_en || `product-${prod.en_id}`);
      if (!slug) slug = `product-${prod.en_id}`;

      const [result] = await tgtDb.execute(
        `INSERT INTO products (
          name, nameAr, slug, description, descriptionAr, shortDescription, shortDescriptionAr,
          sku, price, salePrice, cog, weight, dimensionsJson, images,
          categoryId, tags, status, isFeatured, isNew, type, shippingClass,
          measurementType, wcId, wcSource, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'unit', ?, 'main', NOW(), NOW())`,
        [
          (prod.name_en || '').substring(0, 499),
          (prod.name_ar || prod.name_en || '').substring(0, 499),
          slug,
          prod.description_en || '',
          prod.description_ar || '',
          prod.short_description_en || '',
          prod.short_description_ar || '',
          sku,
          price,
          salePrice,
          (cog && cog > 0) ? cog : null,
          weight,
          dimensionsJson,
          JSON.stringify(allImages),
          categoryId,
          JSON.stringify(tags),
          status,
          isFeatured,
          productType,
          shippingClass,
          prod.en_id,
        ]
      );
      const newProductId = result.insertId;
      productIdMap[prod.en_id] = newProductId;
      if (prod.ar_id) productIdMap[prod.ar_id] = newProductId;

      // Stock (warehouse_stock has no createdAt, only updatedAt)
      const onlineQty = manageStock ? Math.max(0, stock) : (stockStatus === 'instock' ? 10 : 0);
      await tgtDb.execute(
        `INSERT INTO warehouse_stock (warehouseId, productId, quantity, updatedAt)
         VALUES (?, ?, ?, NOW())`,
        [ONLINE_WAREHOUSE_ID, newProductId, onlineQty]
      );
      await tgtDb.execute(
        `INSERT INTO warehouse_stock (warehouseId, productId, quantity, updatedAt)
         VALUES (?, ?, 50, NOW())`,
        [POS_WAREHOUSE_ID, newProductId]
      );

      // Product attributes
      const productAttrsRaw = meta['_product_attributes'] || '';
      if (productAttrsRaw) {
        const productAttrs = phpUnserialize(productAttrsRaw);
        if (productAttrs && typeof productAttrs === 'object') {
          let sortOrder = 0;
          for (const [taxName, attrData] of Object.entries(productAttrs)) {
            if (!taxName.startsWith('pa_')) continue;
            const attrId = attrTaxToId[taxName];
            if (!attrId) continue;

            const valueStr = (attrData && attrData.value) ? String(attrData.value) : '';
            const valueSlugs = valueStr.split('|').map(s => s.trim()).filter(Boolean);
            const activeValueIds = [];
            for (const vSlug of valueSlugs) {
              const avId = termSlugToAvId[`${attrId}:${vSlug}`] || termSlugToAvId[`${taxName}:${vSlug}`];
              if (avId) activeValueIds.push(avId);
            }

            try {
              await tgtDb.execute(
                `INSERT IGNORE INTO product_attributes (productId, attributeId, activeValueIds, sortOrder, createdAt)
                 VALUES (?, ?, ?, ?, NOW())`,
                [newProductId, attrId, JSON.stringify(activeValueIds), sortOrder++]
              );
            } catch {}
          }
        }
      }

      migrated++;
      if (migrated % 25 === 0) log(`  Migrated ${migrated}/${products.length} products...`);
    } catch (e) {
      errors++;
      logErr(`Product ${prod.en_id} "${prod.name_en}": ${e.message}`);
    }
  }

  log(`Migrated ${migrated} products (${errors} errors)`);
  return productIdMap;
}

// ─── Step 4: Extra Product Options (tm_meta) ──────────────────────────────────
async function migrateExtraProductOptions(srcDb, tgtDb, productIdMap, termSlugToAvId) {
  const [rows] = await srcDb.execute(`
    SELECT pm.post_id, pm.meta_value
    FROM wp_postmeta pm
    JOIN wp_icl_translations tr ON tr.element_id = pm.post_id 
      AND tr.element_type = 'post_product' AND tr.language_code = 'en'
    WHERE pm.meta_key = 'tm_meta' AND pm.meta_value LIKE '%product_productids%'
  `);
  log(`Found ${rows.length} products with Extra Product Options`);

  let migrated = 0;
  let skipped = 0;

  for (const row of rows) {
    const newProductId = productIdMap[row.post_id];
    if (!newProductId) { skipped++; continue; }

    const tmMeta = phpUnserialize(row.meta_value);
    if (!tmMeta || !tmMeta.tmfbuilder) { skipped++; continue; }

    const builder = tmMeta.tmfbuilder;
    const elementTypes = builder.element_type || {};
    const productIds = builder.product_productids || {};
    const productQtyMin = builder.product_quantity_min || {};
    const productEnabled = builder.product_enabled || {};
    const productLogic = builder.product_logicrules || {};

    for (const [idx, type] of Object.entries(elementTypes)) {
      if (type !== 'product') continue;
      if (productEnabled[idx] === '0') continue;

      const linkedWcIds = productIds[idx];
      if (!linkedWcIds) continue;

      const wcIds = Array.isArray(linkedWcIds)
        ? linkedWcIds
        : Object.values(linkedWcIds).filter(v => v && v !== '0');
      if (wcIds.length === 0) continue;

      const qty = parseInt(productQtyMin[idx] || '1') || 1;

      // Parse logic rule to find trigger attribute value slug
      let triggerSlug = null;
      const logicRuleStr = productLogic[idx];
      if (logicRuleStr) {
        try {
          const logicRule = typeof logicRuleStr === 'string' ? JSON.parse(logicRuleStr) : logicRuleStr;
          const rules = logicRule.rules || (Array.isArray(logicRule) ? logicRule : []);
          const flatRules = Array.isArray(rules[0]) ? rules[0] : rules;
          for (const rule of flatRules) {
            if (rule && rule.operator === 'is' && rule.value && rule.value !== 'undefined' && rule.value !== '') {
              triggerSlug = rule.value;
              break;
            }
          }
        } catch {}
      }

      if (!triggerSlug) continue;

      // Find attribute value ID for this trigger slug
      let attributeValueId = null;

      // First: look among attribute values assigned to this product
      const [paRows] = await tgtDb.execute(
        'SELECT attributeId FROM product_attributes WHERE productId = ?',
        [newProductId]
      );
      for (const pa of paRows) {
        const avId = termSlugToAvId[`${pa.attributeId}:${triggerSlug}`];
        if (avId) { attributeValueId = avId; break; }
      }

      // Fallback: search globally
      if (!attributeValueId) {
        for (const [key, avId] of Object.entries(termSlugToAvId)) {
          if (key.endsWith(`:${triggerSlug}`)) { attributeValueId = avId; break; }
        }
      }

      if (!attributeValueId) continue;

      // Insert bundle items
      for (const wcId of wcIds) {
        const linkedNewId = productIdMap[parseInt(wcId)];
        if (!linkedNewId) continue;
        try {
          await tgtDb.execute(
            `INSERT INTO attribute_value_bundle_items (attributeValueId, productId, qty, createdAt)
             VALUES (?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE qty = VALUES(qty)`,
            [attributeValueId, linkedNewId, qty]
          );
        } catch {}
      }
    }
    migrated++;
  }

  log(`Processed Extra Product Options for ${migrated} products (${skipped} skipped)`);
}

// ─── Run ──────────────────────────────────────────────────────────────────────
main().catch(e => {
  console.error('Migration failed:', e);
  stopTunnel();
  process.exit(1);
});
