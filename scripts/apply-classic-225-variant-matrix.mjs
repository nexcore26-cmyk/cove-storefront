#!/usr/bin/env node
import mysql from 'mysql2/promise';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const APPLY = process.argv.includes('--apply');
const DEACTIVATE_LEGACY = process.argv.includes('--deactivate-legacy');
const ROOT = process.cwd();

const COLOR_IMAGES = {
  '225 Classic Gold': 'https://coveinterior.com/wp-content/uploads/2022/07/classic-225-gold.jpg',
  '225 Classic Gray / White': 'https://coveinterior.com/wp-content/uploads/2022/07/classic-225-gray-gold-1.jpg',
  '225 Classic Marble / Gray': 'https://coveinterior.com/wp-content/uploads/2022/07/classic-225-marble-gold.jpg',
};

const ATTRIBUTE_PLAN = [
  {
    name: 'Size',
    displayType: 'default',
    galleryControlling: false,
    values: [{ label: 'Width 225cm, Depth 53cm, Height 86cm', sortOrder: 0 }],
  },
  {
    name: 'Color',
    displayType: 'image',
    galleryControlling: true,
    values: [
      { label: '225 Classic Gold', sortOrder: 0, image: COLOR_IMAGES['225 Classic Gold'] },
      { label: '225 Classic Gray / White', sortOrder: 1, image: COLOR_IMAGES['225 Classic Gray / White'] },
      { label: '225 Classic Marble / Gray', sortOrder: 2, image: COLOR_IMAGES['225 Classic Marble / Gray'] },
    ],
  },
  {
    name: 'Steel',
    displayType: 'button',
    galleryControlling: false,
    values: [{ label: 'Gold', sortOrder: 0 }, { label: 'Silver', sortOrder: 1 }],
  },
  {
    name: 'Top Surface',
    displayType: 'button',
    galleryControlling: false,
    values: [{ label: 'Clear glass', sortOrder: 0 }, { label: 'Solid top', sortOrder: 1 }],
  },
  {
    name: 'Coffee Capsule Size',
    displayType: 'button',
    galleryControlling: false,
    values: [{ label: 'Big capsule', sortOrder: 0 }, { label: 'Small capsule', sortOrder: 1 }],
  },
];

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
}

function normalize(value) {
  return String(value ?? '').toLowerCase().replace(/^attribute-pa-/, '').replace(/^pa-/, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function cartesian(groups) {
  return groups.reduce((acc, group) => acc.flatMap(prefix => group.map(item => [...prefix, item])), [[]]);
}

function parseAttrs(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return Object.fromEntries(parsed.map((a) => [a.name, a.option]));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function sameAttributeSet(existing, expected) {
  const normalizedExisting = Object.entries(parseAttrs(existing)).map(([k, v]) => `${normalize(k)}=${normalize(v)}`).sort().join('|');
  const normalizedExpected = Object.entries(expected).map(([k, v]) => `${normalize(k)}=${normalize(v)}`).sort().join('|');
  return normalizedExisting === normalizedExpected;
}

async function ensureColumn(conn, table, column, ddl) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (Number(rows[0].count) > 0) return { skipped: true, sql: null };
  const sql = `ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`;
  if (APPLY) await conn.query(sql);
  return { skipped: false, sql };
}

async function ensureDisplayTypeEnum(conn) {
  const sql = "ALTER TABLE `attributes` MODIFY COLUMN `displayType` enum('button','color','image','radio','default') NOT NULL DEFAULT 'button'";
  if (APPLY) {
    try { await conn.query(sql); } catch (error) { if (!/Data truncated|Incorrect/.test(String(error?.message))) throw error; }
  }
  return sql;
}

async function downloadToLocal(url, baseName) {
  const relativeDir = path.join('media', 'wordpress-migration', 'classic-225');
  const sourcePublicDir = path.join(ROOT, 'client', 'public', relativeDir);
  const buildPublicDir = path.join(ROOT, 'dist', 'public', relativeDir);
  await fs.mkdir(sourcePublicDir, { recursive: true });
  const ext = path.extname(new URL(url).pathname) || '.jpg';
  const fileName = `${baseName}${ext}`;
  const sourcePath = path.join(sourcePublicDir, fileName);
  try {
    await fs.access(sourcePath);
  } catch {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not download ${url}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(sourcePath, buf);
  }
  try {
    await fs.mkdir(buildPublicDir, { recursive: true });
    await fs.copyFile(sourcePath, path.join(buildPublicDir, fileName));
  } catch {
    // Build output may not exist yet. The next Vite build will copy client/public automatically.
  }
  return `/media/wordpress-migration/classic-225/${fileName}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. Run with the target database environment loaded.');
  }
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const report = { mode: APPLY ? 'apply' : 'dry-run', schema: [], product: null, attributes: [], variants: { expected: 0, created: 0, updated: 0, unchanged: 0, legacyDeactivated: 0 }, warnings: [] };
  try {
    report.schema.push(await ensureDisplayTypeEnum(conn));
    report.schema.push(await ensureColumn(conn, 'product_attributes', 'galleryControlling', '`galleryControlling` boolean NOT NULL DEFAULT false AFTER `activeValueIds`'));
    report.schema.push(await ensureColumn(conn, 'product_attributes', 'isImageMaster', '`isImageMaster` boolean NOT NULL DEFAULT false AFTER `galleryControlling`'));

    const [products] = await conn.query("SELECT * FROM products WHERE slug = 'classic-225' OR name LIKE '%Classic 225%' ORDER BY slug = 'classic-225' DESC, id LIMIT 1");
    if (!products.length) throw new Error('Classic 225 product not found by slug/name.');
    const product = products[0];
    report.product = { id: product.id, slug: product.slug, name: product.name, sku: product.sku, price: product.price, salePrice: product.salePrice };

    const mediaByColor = {};
    for (const [label, url] of Object.entries(COLOR_IMAGES)) {
      mediaByColor[label] = APPLY ? await downloadToLocal(url, slugify(label)) : url;
    }

    const valueIdsByAttribute = new Map();
    for (const attrPlan of ATTRIBUTE_PLAN) {
      let [attrRows] = await conn.query('SELECT * FROM attributes WHERE LOWER(name) = LOWER(?) LIMIT 1', [attrPlan.name]);
      let attr = attrRows[0];
      if (!attr) {
        if (!APPLY) {
          attr = { id: `new:${attrPlan.name}` };
        } else {
          const [res] = await conn.query('INSERT INTO attributes (name, displayType, type, sortOrder) VALUES (?, ?, ?, ?)', [attrPlan.name, attrPlan.displayType, 'global', ATTRIBUTE_PLAN.indexOf(attrPlan)]);
          const [rows] = await conn.query('SELECT * FROM attributes WHERE id = ?', [res.insertId]);
          attr = rows[0];
        }
      } else if (APPLY) {
        await conn.query('UPDATE attributes SET displayType = ?, type = COALESCE(type, ?) WHERE id = ?', [attrPlan.displayType, 'global', attr.id]);
      }

      const valueIds = [];
      for (const valuePlan of attrPlan.values) {
        let [valueRows] = await conn.query('SELECT * FROM attribute_values WHERE attributeId = ? AND LOWER(labelEn) = LOWER(?) LIMIT 1', [attr.id, valuePlan.label]);
        let value = valueRows[0];
        const image = valuePlan.image ? mediaByColor[valuePlan.label] : null;
        if (!value) {
          if (!APPLY) {
            value = { id: `new:${attrPlan.name}:${valuePlan.label}` };
          } else {
            const [res] = await conn.query(
              'INSERT INTO attribute_values (attributeId, labelEn, swatch, image, galleryImages, isEnabled, sortOrder) VALUES (?, ?, ?, ?, ?, true, ?)',
              [attr.id, valuePlan.label, image, image, image ? JSON.stringify([image]) : JSON.stringify([]), valuePlan.sortOrder]
            );
            const [rows] = await conn.query('SELECT * FROM attribute_values WHERE id = ?', [res.insertId]);
            value = rows[0];
          }
        } else if (APPLY) {
          await conn.query('UPDATE attribute_values SET image = COALESCE(?, image), swatch = COALESCE(?, swatch), galleryImages = CASE WHEN ? IS NULL THEN galleryImages ELSE ? END, isEnabled = true, sortOrder = ? WHERE id = ?', [image, image, image, image ? JSON.stringify([image]) : null, valuePlan.sortOrder, value.id]);
        }
        valueIds.push(value.id);
      }
      valueIdsByAttribute.set(attrPlan.name, valueIds);
      report.attributes.push({ attribute: attrPlan.name, attributeId: attr.id, valueCount: valueIds.length, galleryControlling: attrPlan.galleryControlling });

      if (APPLY) {
        const activeValueIds = JSON.stringify(valueIds);
        await conn.query('DELETE FROM product_attributes WHERE productId = ? AND attributeId = ?', [product.id, attr.id]);
        await conn.query('INSERT INTO product_attributes (productId, attributeId, activeValueIds, galleryControlling, isImageMaster, sortOrder) VALUES (?, ?, ?, ?, ?, ?)', [product.id, attr.id, activeValueIds, attrPlan.galleryControlling, attrPlan.galleryControlling, ATTRIBUTE_PLAN.indexOf(attrPlan)]);
      }
    }

    const combos = cartesian(ATTRIBUTE_PLAN.map((attr) => attr.values.map((value) => ({ attr: attr.name, value: value.label }))));
    report.variants.expected = combos.length;
    const [existingVariants] = await conn.query('SELECT * FROM product_variants WHERE productId = ?', [product.id]);
    const matchedExistingIds = new Set();

    for (const combo of combos) {
      const attrs = Object.fromEntries(combo.map(({ attr, value }) => [attr, value]));
      const color = attrs.Color;
      const image = mediaByColor[color] ?? null;
      const name = `${product.name} - ${Object.values(attrs).join(' / ')}`.slice(0, 255);
      const skuBase = [product.sku || 'CLASSIC-225', ...Object.values(attrs).map(slugify)].join('-').toUpperCase().slice(0, 118);
      const sku = `${skuBase}-${crypto.createHash('sha1').update(JSON.stringify(attrs)).digest('hex').slice(0, 8).toUpperCase()}`.slice(0, 128);
      const existing = existingVariants.find((variant) => sameAttributeSet(variant.attributes, attrs));
      if (existing) {
        matchedExistingIds.add(existing.id);
        const needsUpdate = existing.image !== image || JSON.stringify(parseAttrs(existing.attributes)) !== JSON.stringify(attrs) || existing.isActive === 0 || existing.isActive === false;
        if (needsUpdate && APPLY) {
          await conn.query('UPDATE product_variants SET sku = ?, name = ?, attributes = ?, price = ?, salePrice = ?, image = ?, galleryImages = ?, isActive = true WHERE id = ?', [sku, name, JSON.stringify(attrs), product.price ?? '0.000', product.salePrice ?? null, image, JSON.stringify(image ? [image] : []), existing.id]);
        }
        report.variants[needsUpdate ? 'updated' : 'unchanged'] += 1;
      } else {
        if (APPLY) {
          await conn.query('INSERT INTO product_variants (productId, sku, name, attributes, price, salePrice, image, galleryImages, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, true)', [product.id, sku, name, JSON.stringify(attrs), product.price ?? '0.000', product.salePrice ?? null, image, JSON.stringify(image ? [image] : [])]);
        }
        report.variants.created += 1;
      }
    }

    if (DEACTIVATE_LEGACY && APPLY) {
      const idsToDeactivate = existingVariants.filter((v) => !matchedExistingIds.has(v.id)).map((v) => v.id);
      if (idsToDeactivate.length) {
        await conn.query(`UPDATE product_variants SET isActive = false WHERE productId = ? AND id IN (${idsToDeactivate.map(() => '?').join(',')})`, [product.id, ...idsToDeactivate]);
        report.variants.legacyDeactivated = idsToDeactivate.length;
      }
    } else if (!DEACTIVATE_LEGACY) {
      const legacyCount = existingVariants.filter((v) => !matchedExistingIds.has(v.id)).length;
      if (legacyCount) report.warnings.push(`${legacyCount} existing non-matching variants were preserved. Re-run with --apply --deactivate-legacy to disable them after review.`);
    }

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
