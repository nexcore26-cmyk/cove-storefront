import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const appRoot = process.cwd();
const require = createRequire(path.join(appRoot, 'package.json'));
const mysql = require('mysql2/promise');

function loadEnv() {
  const envPath = path.join(appRoot, '.env');
  const txt = fs.readFileSync(envPath, 'utf8');
  const match = txt.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/m);
  if (!match) throw new Error('DATABASE_URL missing');
  return match[1].trim().replace(/^["']|["']$/g, '');
}

function parseArray(value) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

const evidence = JSON.parse(fs.readFileSync(path.join(appRoot, 'scripts', 'wp_variation_gallery_evidence.json'), 'utf8'));
const slugs = Object.keys(evidence);
const db = await mysql.createConnection(loadEnv());

try {
  const [agg] = await db.query(`
    SELECT
      COUNT(*) variants,
      SUM(CASE WHEN JSON_LENGTH(COALESCE(pv.galleryImages, JSON_ARRAY())) > 0 THEN 1 ELSE 0 END) variantsWithGallery,
      MIN(JSON_LENGTH(COALESCE(pv.galleryImages, JSON_ARRAY()))) minGallery,
      MAX(JSON_LENGTH(COALESCE(pv.galleryImages, JSON_ARRAY()))) maxGallery
    FROM product_variants pv
    JOIN products p ON p.id = pv.productId
    WHERE p.status = ? AND pv.isActive = 1 AND p.slug IN (?)
  `, ['active', slugs]);

  const [missing] = await db.query(`
    SELECT p.slug, pv.id, pv.sku, pv.name, pv.galleryImages
    FROM product_variants pv
    JOIN products p ON p.id = pv.productId
    WHERE p.status = ? AND pv.isActive = 1 AND p.slug IN (?)
      AND JSON_LENGTH(COALESCE(pv.galleryImages, JSON_ARRAY())) = 0
    LIMIT 20
  `, ['active', slugs]);

  const [sample] = await db.query(`
    SELECT p.slug, pv.id, pv.sku, pv.name, pv.image, pv.galleryImages
    FROM product_variants pv
    JOIN products p ON p.id = pv.productId
    WHERE p.status = ? AND pv.isActive = 1 AND p.slug IN (?)
    ORDER BY p.slug, pv.id
    LIMIT 12
  `, ['active', slugs]);

  const [attr] = await db.query('SELECT isImageMaster, COUNT(*) count FROM product_attributes GROUP BY isImageMaster ORDER BY isImageMaster');

  const badFiles = [];
  for (const row of sample) {
    for (const url of parseArray(row.galleryImages).slice(0, 3)) {
      const pth = path.join(appRoot, 'public', url.replace(/^\//, ''));
      if (!fs.existsSync(pth)) badFiles.push({ variantId: row.id, url, path: pth });
    }
  }

  const result = {
    generatedAt: new Date().toISOString(),
    evidenceProducts: slugs.length,
    variantGalleryAggregate: agg[0],
    missingGallerySamples: missing,
    attributeImageMasterAggregate: attr,
    sampleGalleryMissingFiles: badFiles,
    sampledRows: sample.map(row => ({
      ...row,
      galleryImages: parseArray(row.galleryImages),
      galleryCount: parseArray(row.galleryImages).length,
    })),
  };
  console.log(JSON.stringify(result, null, 2));
} finally {
  await db.end();
}
