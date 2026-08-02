import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const appRoot = process.env.COVE_APP_ROOT || process.cwd();
const require = createRequire(path.join(appRoot, 'package.json'));
const mysql = require('mysql2/promise');

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const dryRun = !apply || args.has('--dry-run');
const updateImages = args.has('--update-images');
const onlyActive = !args.has('--include-non-active');
const evidencePath = process.env.WP_VARIANT_GALLERY_EVIDENCE || path.join(appRoot, 'scripts', 'wp_variation_gallery_evidence.json');
const publicRoot = path.join(appRoot, 'public');
const reportRoot = path.join(appRoot, 'reports');
const runId = `variant-gallery-migration-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const reportDir = path.join(reportRoot, runId);

function loadEnv() {
  const envPath = path.join(appRoot, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!rawLine || rawLine.trim().startsWith('#') || !rawLine.includes('=')) continue;
    const idx = rawLine.indexOf('=');
    const key = rawLine.slice(0, idx).trim();
    let val = rawLine.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseJson(value, fallback = null) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  if (value == null || value === '') return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeSlug(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function nodeAttributeValues(attributes) {
  const parsed = parseJson(attributes, null);
  if (!parsed) return [];
  if (Array.isArray(parsed)) {
    return parsed.map(item => item?.option ?? item?.value ?? item?.label ?? '').filter(Boolean);
  }
  if (typeof parsed === 'object') return Object.values(parsed).filter(Boolean);
  return [];
}

function nodeSignature(attributes) {
  return nodeAttributeValues(attributes).map(normalizeText).filter(Boolean).sort().join('|');
}

function buildOptionMaps(selects = []) {
  const maps = new Map();
  for (const select of selects || []) {
    const name = select?.name;
    const map = new Map();
    for (const option of select?.options || []) {
      if (!option?.value) continue;
      map.set(option.value, option.label || option.value);
      map.set(normalizeSlug(option.value), option.label || option.value);
    }
    if (name) maps.set(name, map);
  }
  return maps;
}

function wpVariationSignature(variation, optionMaps) {
  const values = [];
  for (const [attributeName, rawValue] of Object.entries(variation?.attributes || {})) {
    if (!rawValue) continue;
    const map = optionMaps.get(attributeName);
    const label = map?.get(rawValue) || map?.get(normalizeSlug(rawValue)) || rawValue;
    values.push(normalizeText(label));
  }
  return values.filter(Boolean).sort().join('|');
}

function wpUrlToLocal(url) {
  if (!url) return '';
  const match = String(url).match(/\/wp-content\/uploads\/(.+)$/i);
  if (!match) return '';
  const rel = decodeURIComponent(match[1].split('?')[0]);
  if (rel.includes('..') || rel.startsWith('/')) throw new Error(`Unsafe WordPress media URL: ${url}`);
  return `/media/wordpress-migration/${rel}`;
}

function mediaUrlToPublicPath(url) {
  if (!url || !url.startsWith('/media/wordpress-migration/')) throw new Error(`Unsafe local media URL: ${url}`);
  const rel = url.replace(/^\//, '');
  if (rel.includes('..') || path.isAbsolute(rel)) throw new Error(`Unsafe media path: ${url}`);
  return path.join(publicRoot, rel);
}

function uniqueNonEmpty(values) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function sameJsonArray(a, b) {
  const aa = Array.isArray(a) ? a : [];
  const bb = Array.isArray(b) ? b : [];
  return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (value instanceof Date) value = value.toISOString().slice(0, 19).replace('T', ' ');
  if (typeof value === 'object') value = JSON.stringify(value);
  return mysql.escape(String(value));
}

function restoreSql(rows) {
  if (!rows.length) return '-- No rows changed.\n';
  return rows.map(row => {
    const sets = [];
    if (row.galleryChanged) sets.push(`\`galleryImages\` = ${sqlLiteral(row.beforeGalleryRaw)}`);
    if (row.imageChanged) sets.push(`\`image\` = ${sqlLiteral(row.beforeImage)}`);
    return `UPDATE \`product_variants\` SET ${sets.join(', ')} WHERE \`id\` = ${mysql.escape(row.variantId)};`;
  }).join('\n') + '\n';
}

loadEnv();
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
if (!fs.existsSync(evidencePath)) throw new Error(`Evidence file not found: ${evidencePath}`);
fs.mkdirSync(reportDir, { recursive: true });

const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const warnings = [];
const blockers = [];
const planned = [];
const coverage = [];

try {
  const [columnRows] = await conn.execute('SHOW COLUMNS FROM product_variants');
  const variantColumns = new Set(columnRows.map(row => row.Field));
  for (const required of ['id', 'productId', 'attributes', 'image', 'galleryImages']) {
    if (!variantColumns.has(required)) blockers.push({ type: 'missing_product_variants_column', column: required });
  }

  for (const [slug, record] of Object.entries(evidence)) {
    const gallery = uniqueNonEmpty((record.gallery || []).map(item => wpUrlToLocal(item.href || item.full_src || item.url)).filter(Boolean));
    const fileChecks = gallery.map(url => ({ url, exists: fs.existsSync(mediaUrlToPublicPath(url)) }));
    const missingFiles = fileChecks.filter(item => !item.exists);
    if (!gallery.length) {
      warnings.push({ type: 'no_gallery_urls_in_evidence', slug });
      continue;
    }
    if (missingFiles.length) blockers.push({ type: 'gallery_file_missing_on_server', slug, missingFiles });

    const optionMaps = buildOptionMaps(record.selects || []);
    const variationBySignature = new Map();
    for (const variation of record.variations || []) {
      const signature = wpVariationSignature(variation, optionMaps);
      const localImage = wpUrlToLocal(variation.image || '');
      if (signature && localImage) {
        const exists = fs.existsSync(mediaUrlToPublicPath(localImage));
        if (!exists) blockers.push({ type: 'variation_image_file_missing_on_server', slug, signature, localImage });
        variationBySignature.set(signature, { localImage, source: variation });
      }
    }

    const [products] = await conn.execute(`
      SELECT id, slug, name, status, type
      FROM products
      WHERE slug = ? ${onlyActive ? "AND status = 'active'" : ''}
    `, [slug]);

    if (!products.length) {
      warnings.push({ type: 'product_not_found_or_not_in_scope', slug, onlyActive });
      coverage.push({ slug, foundProduct: false, productId: null, variants: 0, plannedVariantUpdates: 0, galleryCount: gallery.length, variationImageMappings: variationBySignature.size });
      continue;
    }

    for (const product of products) {
      const [variants] = await conn.execute(`
        SELECT id, productId, sku, name, attributes, image, galleryImages
        FROM product_variants
        WHERE productId = ? AND isActive = 1
        ORDER BY id
      `, [product.id]);

      let plannedVariantUpdates = 0;
      for (const variant of variants) {
        const currentGallery = parseJson(variant.galleryImages, []);
        const signature = nodeSignature(variant.attributes);
        const mappedVariation = variationBySignature.get(signature);
        const targetImage = updateImages && mappedVariation ? mappedVariation.localImage : variant.image;
        const galleryChanged = !sameJsonArray(currentGallery, gallery);
        const imageChanged = Boolean(updateImages && mappedVariation && targetImage && targetImage !== variant.image);
        if (!galleryChanged && !imageChanged) continue;
        plannedVariantUpdates++;
        planned.push({
          slug,
          productId: product.id,
          productName: product.name,
          variantId: variant.id,
          variantName: variant.name,
          sku: variant.sku,
          signature,
          attributes: parseJson(variant.attributes, variant.attributes),
          beforeGallery: currentGallery,
          beforeGalleryRaw: variant.galleryImages,
          afterGallery: gallery,
          beforeImage: variant.image,
          afterImage: targetImage,
          galleryChanged,
          imageChanged,
          matchedVariationImage: Boolean(mappedVariation),
        });
      }
      coverage.push({
        slug,
        foundProduct: true,
        productId: product.id,
        status: product.status,
        type: product.type,
        variants: variants.length,
        plannedVariantUpdates,
        galleryCount: gallery.length,
        variationImageMappings: variationBySignature.size,
      });
    }
  }

  fs.writeFileSync(path.join(reportDir, 'coverage.json'), JSON.stringify(coverage, null, 2));
  fs.writeFileSync(path.join(reportDir, 'planned_updates.json'), JSON.stringify(planned, null, 2));
  fs.writeFileSync(path.join(reportDir, 'warnings.json'), JSON.stringify(warnings, null, 2));
  fs.writeFileSync(path.join(reportDir, 'blockers.json'), JSON.stringify(blockers, null, 2));

  const summary = {
    runId,
    generatedAt: new Date().toISOString(),
    mode: apply ? 'apply' : 'dry-run',
    evidencePath,
    onlyActive,
    updateImages,
    evidenceProducts: Object.keys(evidence).length,
    productsFound: coverage.filter(r => r.foundProduct).length,
    totalActiveVariantsInEvidenceProducts: coverage.reduce((sum, row) => sum + (row.variants || 0), 0),
    plannedUpdates: planned.length,
    plannedGalleryUpdates: planned.filter(row => row.galleryChanged).length,
    plannedImageUpdates: planned.filter(row => row.imageChanged).length,
    blockers: blockers.length,
    warnings: warnings.length,
    reportDir,
    safeguards: [
      'Evidence is read from downloaded WooCommerce product pages, not from product attributes.',
      'All media URLs are converted to /media/wordpress-migration/... and checked against the local public media directory before apply.',
      'Only active products and active variants are updated by default.',
      'Affected product_variants rows are backed up to JSON and SQL restore files before database writes.',
      'Database writes run inside a single transaction and update only product_variants.galleryImages plus image when explicitly requested.'
    ]
  };

  if (blockers.length) {
    summary.applied = false;
    summary.reason = `blocked_by_${blockers.length}_preflight_issue(s)`;
    fs.writeFileSync(path.join(reportDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    throw new Error(`Refusing migration because preflight found ${blockers.length} blocker(s). See ${reportDir}/blockers.json`);
  }

  if (dryRun) {
    summary.applied = false;
    summary.reason = 'dry_run_mode';
    fs.writeFileSync(path.join(reportDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
  } else {
    const rollbackDir = path.join(reportDir, 'rollback');
    fs.mkdirSync(rollbackDir, { recursive: true });
    fs.writeFileSync(path.join(rollbackDir, 'product_variants_before_update.json'), JSON.stringify(planned, null, 2));
    fs.writeFileSync(path.join(rollbackDir, 'restore_product_variant_updates.sql'), restoreSql(planned));

    const appliedRows = [];
    await conn.beginTransaction();
    try {
      for (const row of planned) {
        const setParts = [];
        const values = [];
        if (row.galleryChanged) {
          setParts.push('`galleryImages` = ?');
          values.push(JSON.stringify(row.afterGallery));
        }
        if (row.imageChanged) {
          setParts.push('`image` = ?');
          values.push(row.afterImage);
        }
        values.push(row.variantId);
        const [result] = await conn.execute(`UPDATE product_variants SET ${setParts.join(', ')} WHERE id = ?`, values);
        if (result.affectedRows !== 1) throw new Error(`Unexpected affectedRows=${result.affectedRows} for variant ${row.variantId}`);
        appliedRows.push({ variantId: row.variantId, slug: row.slug, affectedRows: result.affectedRows, galleryChanged: row.galleryChanged, imageChanged: row.imageChanged });
      }
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    }
    fs.writeFileSync(path.join(reportDir, 'applied_rows.json'), JSON.stringify(appliedRows, null, 2));
    summary.applied = true;
    summary.appliedRows = appliedRows.length;
    fs.writeFileSync(path.join(reportDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
  }
} finally {
  await conn.end();
}
