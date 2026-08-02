import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envCandidates = ['.env', '/var/www/cove/.env', '/opt/cove/.env'];
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

function normalizeUrl(value) {
  if (!value || typeof value !== 'string') return '';
  return value.trim();
}

const dryRun = process.argv.includes('--dry-run');
const candidatesArg = process.argv.find(a => a.startsWith('--candidates='));
const candidatesPath = candidatesArg
  ? candidatesArg.split('=').slice(1).join('=')
  : path.resolve('catalog_attribute_image_repair_candidates.json');

if (!fs.existsSync(candidatesPath)) {
  throw new Error(`Candidate file not found: ${candidatesPath}`);
}

const candidateData = JSON.parse(fs.readFileSync(candidatesPath, 'utf8'));
const safeAssignments = candidateData.safeAssignments || [];
const conflicts = candidateData.conflicts || [];

const dbUrl = readDatabaseUrl();
if (!dbUrl) throw new Error('DATABASE_URL not found');
const db = await mysql.createConnection(dbUrl);

const valueIds = safeAssignments.map(a => Number(a.valueId)).filter(Number.isFinite);
const uniqueValueIds = [...new Set(valueIds)];

let currentRows = [];
if (uniqueValueIds.length) {
  const [rows] = await db.query(
    `SELECT av.id, av.attributeId, av.labelEn, av.swatch, av.image, av.galleryImages,
            a.name AS attributeName, a.displayType
     FROM attribute_values av
     JOIN attributes a ON a.id = av.attributeId
     WHERE av.id IN (${uniqueValueIds.map(() => '?').join(',')})
     ORDER BY a.name, av.sortOrder, av.id`,
    uniqueValueIds
  );
  currentRows = rows;
}

const byId = new Map(currentRows.map(r => [Number(r.id), r]));
const missingValueRows = [];
const valueUpdates = [];

for (const assignment of safeAssignments) {
  const valueId = Number(assignment.valueId);
  const row = byId.get(valueId);
  const imageUrl = normalizeUrl(assignment.image);
  if (!row || !imageUrl) {
    missingValueRows.push({ valueId, label: assignment.label, image: assignment.image, reason: row ? 'missing image URL' : 'missing attribute_values row' });
    continue;
  }

  const currentGallery = asJsonArray(row.galleryImages);
  const targetGallery = currentGallery.length ? currentGallery : [imageUrl];
  const needsSwatch = normalizeUrl(row.swatch) !== imageUrl;
  const needsImage = normalizeUrl(row.image) !== imageUrl;
  const needsGallery = JSON.stringify(currentGallery) !== JSON.stringify(targetGallery);

  if (needsSwatch || needsImage || needsGallery) {
    valueUpdates.push({
      valueId,
      attributeId: Number(row.attributeId),
      attributeName: row.attributeName,
      label: row.labelEn,
      current: {
        swatch: row.swatch || null,
        image: row.image || null,
        galleryImages: currentGallery,
      },
      target: {
        swatch: imageUrl,
        image: imageUrl,
        galleryImages: targetGallery,
      },
      evidence: {
        products: assignment.products || [],
        sources: assignment.sources || [],
        evidenceCount: assignment.evidenceCount || 0,
      },
    });
  }
}

// Only visual attributes with at least one safe image assignment are converted to image display.
// Plain Size remains a text/button selector even when variation images exist, because WooCommerce
// variation images often represent the selected product image rather than an option swatch.
// Conflicting values are not assigned globally here because their correct image depends on product context.
const textOnlyAttributeNames = new Set(['Size']);
const attributeIdsToImage = [...new Set(valueUpdates
  .filter(u => !textOnlyAttributeNames.has(u.attributeName))
  .map(u => u.attributeId))];
let currentAttributes = [];
if (attributeIdsToImage.length) {
  const [attrs] = await db.query(
    `SELECT id, name, displayType FROM attributes WHERE id IN (${attributeIdsToImage.map(() => '?').join(',')}) ORDER BY name`,
    attributeIdsToImage
  );
  currentAttributes = attrs;
}

const attributeUpdates = currentAttributes
  .filter(a => a.displayType !== 'image')
  .map(a => ({ attributeId: Number(a.id), name: a.name, currentDisplayType: a.displayType, targetDisplayType: 'image' }));

const backupSuffix = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const valueBackupTable = `attribute_values_backup_img_${backupSuffix}`;
const attrBackupTable = `attributes_backup_img_${backupSuffix}`;

const result = {
  dryRun,
  sourceCandidateSummary: candidateData.summary || null,
  backupTables: dryRun ? null : { attribute_values: valueBackupTable, attributes: attrBackupTable },
  valueUpdates,
  attributeUpdates,
  skippedConflictingAssignments: conflicts.map(c => ({
    valueId: c.valueId,
    labels: c.labels,
    attributeNames: c.attributeNames,
    products: [...new Set((c.records || []).map(r => r.productSlug))].sort(),
    imageEvidenceCount: Array.isArray(c.imageEvidence) ? c.imageEvidence.length : 0,
  })),
  missingValueRows,
};

if (!dryRun && (valueUpdates.length || attributeUpdates.length)) {
  await db.beginTransaction();
  try {
    if (valueUpdates.length) {
      await db.query(
        `CREATE TABLE ${valueBackupTable} AS SELECT * FROM attribute_values WHERE id IN (${valueUpdates.map(() => '?').join(',')})`,
        valueUpdates.map(u => u.valueId)
      );
      for (const u of valueUpdates) {
        await db.query(
          `UPDATE attribute_values SET swatch = ?, image = ?, galleryImages = CAST(? AS JSON) WHERE id = ?`,
          [u.target.swatch, u.target.image, JSON.stringify(u.target.galleryImages), u.valueId]
        );
      }
    }

    if (attributeUpdates.length) {
      await db.query(
        `CREATE TABLE ${attrBackupTable} AS SELECT * FROM attributes WHERE id IN (${attributeUpdates.map(() => '?').join(',')})`,
        attributeUpdates.map(u => u.attributeId)
      );
      for (const u of attributeUpdates) {
        await db.query(`UPDATE attributes SET displayType = 'image' WHERE id = ?`, [u.attributeId]);
      }
    }

    await db.commit();
  } catch (err) {
    await db.rollback();
    throw err;
  }
}

console.log(JSON.stringify(result, null, 2));
await db.end();
