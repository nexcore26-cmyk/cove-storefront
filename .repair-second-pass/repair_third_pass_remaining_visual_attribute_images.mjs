import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envCandidates = ['.env', '/var/www/cove/.env', '/opt/cove/.env', '/home/ubuntu/cove_work/cove-storefront/.env'];
  for (const envPath of envCandidates) {
    if (!fs.existsSync(envPath)) continue;
    const envText = fs.readFileSync(envPath, 'utf8');
    const match = envText.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/m);
    if (match) return match[1].replace(/^[\'\"]|[\'\"]$/g, '');
  }
  return '';
}

function asJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeIdArray(value) {
  return asJsonArray(value).map(Number).filter(Number.isFinite);
}

function uniqueTableName(prefix) {
  const suffix = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `${prefix}_${suffix}`;
}

function placeholders(n) {
  return Array.from({ length: n }, () => '?').join(',');
}

const dryRun = process.argv.includes('--dry-run');
const planArg = process.argv.find(a => a.startsWith('--plan='));
const planPath = planArg ? planArg.split('=').slice(1).join('=') : path.resolve('second_pass_all_product_attribute_image_plan.json');

if (!fs.existsSync(planPath)) throw new Error(`Plan file not found: ${planPath}`);
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const globalUpdates = plan.globalUpdates || [];
const cloneAssignments = plan.cloneAssignments || [];

const dbUrl = readDatabaseUrl();
if (!dbUrl) throw new Error('DATABASE_URL not found. Run on the deployed Node droplet or provide DATABASE_URL securely.');
const db = await mysql.createConnection(dbUrl);

const targetValueIds = [...new Set(globalUpdates.map(u => Number(u.valueId)).filter(Number.isFinite))];
const sourceValueIds = [...new Set(cloneAssignments.map(u => Number(u.sourceValueId)).filter(Number.isFinite))];
const allRelevantValueIds = [...new Set([...targetValueIds, ...sourceValueIds])];
const targetAttributeIds = [...new Set([...globalUpdates, ...cloneAssignments].map(u => Number(u.attributeId)).filter(Number.isFinite))];
const productSlugs = [...new Set(cloneAssignments.map(a => String(a.productSlug)).filter(Boolean))];

const [sourceValues] = allRelevantValueIds.length
  ? await db.query(`SELECT * FROM attribute_values WHERE id IN (${placeholders(allRelevantValueIds.length)})`, allRelevantValueIds)
  : [[]];
const valueById = new Map(sourceValues.map(v => [Number(v.id), v]));

const [products] = productSlugs.length
  ? await db.query(`SELECT id, slug, name, status, type FROM products WHERE slug IN (${placeholders(productSlugs.length)})`, productSlugs)
  : [[]];
const productBySlug = new Map(products.map(p => [String(p.slug), p]));

const productIds = products.map(p => Number(p.id)).filter(Number.isFinite);
const [productAttributes] = productIds.length && targetAttributeIds.length
  ? await db.query(
      `SELECT * FROM product_attributes WHERE productId IN (${placeholders(productIds.length)}) AND attributeId IN (${placeholders(targetAttributeIds.length)})`,
      [...productIds, ...targetAttributeIds]
    )
  : [[]];
const paByProductAttr = new Map(productAttributes.map(pa => [`${Number(pa.productId)}:${Number(pa.attributeId)}`, pa]));

const missing = [];
const plannedGlobalUpdates = [];
for (const update of globalUpdates) {
  const row = valueById.get(Number(update.valueId));
  if (!row) {
    missing.push({ type: 'global_value_missing', update });
    continue;
  }
  const currentGallery = asJsonArray(row.galleryImages);
  const targetGallery = Array.isArray(update.galleryImages) && update.galleryImages.length ? update.galleryImages : [update.image];
  const needs = String(row.swatch || '') !== update.image || String(row.image || '') !== update.image || JSON.stringify(currentGallery) !== JSON.stringify(targetGallery);
  plannedGlobalUpdates.push({ ...update, current: { swatch: row.swatch || null, image: row.image || null, galleryImages: currentGallery }, target: { swatch: update.image, image: update.image, galleryImages: targetGallery }, needs });
}

const plannedClones = [];
for (const assignment of cloneAssignments) {
  const product = productBySlug.get(String(assignment.productSlug));
  const source = valueById.get(Number(assignment.sourceValueId));
  if (!product || !source) {
    missing.push({ type: !product ? 'product_missing' : 'source_value_missing', assignment });
    continue;
  }
  const pa = paByProductAttr.get(`${Number(product.id)}:${Number(assignment.attributeId)}`);
  if (!pa) {
    missing.push({ type: 'product_attribute_missing', productId: product.id, assignment });
    continue;
  }
  const activeValueIds = normalizeIdArray(pa.activeValueIds);
  if (!activeValueIds.includes(Number(assignment.sourceValueId))) {
    missing.push({ type: 'source_value_not_active_for_product', productId: product.id, activeValueIds, assignment });
    continue;
  }
  plannedClones.push({ assignment, product, productAttribute: pa, activeValueIds });
}

const attrUpdates = [];
if (targetAttributeIds.length) {
  const [attrs] = await db.query(`SELECT id, name, displayType FROM attributes WHERE id IN (${placeholders(targetAttributeIds.length)})`, targetAttributeIds);
  for (const attr of attrs) {
    if (attr.displayType !== 'image') attrUpdates.push({ attributeId: Number(attr.id), name: attr.name, currentDisplayType: attr.displayType, targetDisplayType: 'image' });
  }
}

const backupTables = dryRun ? null : {
  attribute_values: uniqueTableName('attribute_values_backup_second_img'),
  product_attributes: uniqueTableName('product_attributes_backup_second_img'),
  attributes: uniqueTableName('attributes_backup_second_img'),
  attribute_value_stock: uniqueTableName('attribute_value_stock_backup_second_img'),
  attribute_value_bundle_items: uniqueTableName('attribute_value_bundle_items_backup_second_img'),
};

const result = {
  dryRun,
  planSummary: plan.summary || null,
  backupTables,
  plannedGlobalUpdates,
  plannedProductSpecificClones: plannedClones.map(c => ({
    productId: Number(c.product.id),
    productSlug: c.assignment.productSlug,
    productName: c.product.name,
    productStatus: c.product.status,
    productType: c.product.type,
    productAttributeId: Number(c.productAttribute.id),
    attributeId: Number(c.assignment.attributeId),
    attributeName: c.assignment.attributeName,
    sourceValueId: Number(c.assignment.sourceValueId),
    label: c.assignment.label,
    image: c.assignment.image,
    activeValueIdsBefore: c.activeValueIds,
  })),
  attributeDisplayTypeUpdates: attrUpdates,
  missing,
  applied: { globalValueUpdates: 0, clonedValues: 0, productAttributeRewrites: 0, attributeDisplayTypeUpdates: 0, copiedStockRows: 0, copiedBundleRows: 0 },
};

if (!dryRun && missing.length === 0 && (plannedGlobalUpdates.length || plannedClones.length || attrUpdates.length)) {
  await db.beginTransaction();
  try {
    if (allRelevantValueIds.length) {
      await db.query(`CREATE TABLE ${backupTables.attribute_values} AS SELECT * FROM attribute_values WHERE id IN (${placeholders(allRelevantValueIds.length)})`, allRelevantValueIds);
      await db.query(`CREATE TABLE ${backupTables.attribute_value_stock} AS SELECT * FROM attribute_value_stock WHERE attributeValueId IN (${placeholders(allRelevantValueIds.length)})`, allRelevantValueIds);
      await db.query(`CREATE TABLE ${backupTables.attribute_value_bundle_items} AS SELECT * FROM attribute_value_bundle_items WHERE attributeValueId IN (${placeholders(allRelevantValueIds.length)})`, allRelevantValueIds);
    }
    if (productAttributes.length) {
      const paIds = productAttributes.map(pa => Number(pa.id));
      await db.query(`CREATE TABLE ${backupTables.product_attributes} AS SELECT * FROM product_attributes WHERE id IN (${placeholders(paIds.length)})`, paIds);
    }
    if (targetAttributeIds.length) {
      await db.query(`CREATE TABLE ${backupTables.attributes} AS SELECT * FROM attributes WHERE id IN (${placeholders(targetAttributeIds.length)})`, targetAttributeIds);
    }

    for (const update of plannedGlobalUpdates) {
      const targetGallery = Array.isArray(update.galleryImages) && update.galleryImages.length ? update.galleryImages : [update.image];
      await db.query(
        `UPDATE attribute_values SET swatch = ?, image = ?, galleryImages = CAST(? AS JSON), updatedAt = NOW() WHERE id = ?`,
        [update.image, update.image, JSON.stringify(targetGallery), Number(update.valueId)]
      );
      result.applied.globalValueUpdates++;
    }

    for (const item of plannedClones) {
      const { assignment, productAttribute, activeValueIds } = item;
      const source = valueById.get(Number(assignment.sourceValueId));
      const targetGallery = Array.isArray(assignment.galleryImages) && assignment.galleryImages.length ? assignment.galleryImages : [assignment.image];

      // Reuse an already-created equivalent cloned value when the same product/attribute was processed earlier.
      const [existingCandidates] = await db.query(
        `SELECT av.id FROM attribute_values av WHERE av.attributeId = ? AND av.labelEn = ? AND av.image = ? ORDER BY av.id DESC LIMIT 1`,
        [Number(assignment.attributeId), source.labelEn, assignment.image]
      );
      let newValueId = existingCandidates[0]?.id ? Number(existingCandidates[0].id) : null;

      if (!newValueId) {
        const [insertResult] = await db.query(
          `INSERT INTO attribute_values
             (attributeId, labelEn, labelAr, swatch, image, galleryImages, price, salePrice, cog, shippingClass, shippingClassId, weight, dimL, dimW, dimH, isBundle, manageStock, isEnabled, sortOrder, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            Number(source.attributeId), source.labelEn, source.labelAr, assignment.image, assignment.image, JSON.stringify(targetGallery),
            source.price, source.salePrice, source.cog, source.shippingClass, source.shippingClassId, source.weight, source.dimL, source.dimW, source.dimH,
            source.isBundle, source.manageStock, source.isEnabled, source.sortOrder,
          ]
        );
        newValueId = Number(insertResult.insertId);
        result.applied.clonedValues++;

        const [stockRows] = await db.query(`SELECT warehouseId, quantity FROM attribute_value_stock WHERE attributeValueId = ?`, [Number(assignment.sourceValueId)]);
        for (const stock of stockRows) {
          await db.query(`INSERT INTO attribute_value_stock (attributeValueId, warehouseId, quantity, updatedAt) VALUES (?, ?, ?, NOW())`, [newValueId, stock.warehouseId, stock.quantity]);
          result.applied.copiedStockRows++;
        }
        const [bundleRows] = await db.query(`SELECT productId, qty FROM attribute_value_bundle_items WHERE attributeValueId = ?`, [Number(assignment.sourceValueId)]);
        for (const bundle of bundleRows) {
          await db.query(`INSERT INTO attribute_value_bundle_items (attributeValueId, productId, qty, createdAt) VALUES (?, ?, ?, NOW())`, [newValueId, bundle.productId, bundle.qty]);
          result.applied.copiedBundleRows++;
        }
      }

      const nextActive = activeValueIds.map(id => id === Number(assignment.sourceValueId) ? newValueId : id);
      await db.query(
        `UPDATE product_attributes SET activeValueIds = CAST(? AS JSON) WHERE id = ?`,
        [JSON.stringify(nextActive), Number(productAttribute.id)]
      );
      result.applied.productAttributeRewrites++;
      item.newValueId = newValueId;
      item.activeValueIdsAfter = nextActive;
    }

    for (const attr of attrUpdates) {
      await db.query(`UPDATE attributes SET displayType = 'image', updatedAt = NOW() WHERE id = ?`, [attr.attributeId]);
      result.applied.attributeDisplayTypeUpdates++;
    }

    await db.commit();
  } catch (err) {
    await db.rollback();
    throw err;
  }
}

result.plannedProductSpecificClones = plannedClones.map(c => ({
  productId: Number(c.product.id),
  productSlug: c.assignment.productSlug,
  productName: c.product.name,
  productStatus: c.product.status,
  productType: c.product.type,
  productAttributeId: Number(c.productAttribute.id),
  attributeId: Number(c.assignment.attributeId),
  attributeName: c.assignment.attributeName,
  sourceValueId: Number(c.assignment.sourceValueId),
  newValueId: c.newValueId ?? null,
  label: c.assignment.label,
  image: c.assignment.image,
  activeValueIdsBefore: c.activeValueIds,
  activeValueIdsAfter: c.activeValueIdsAfter ?? null,
}));

console.log(JSON.stringify(result, null, 2));
await db.end();
