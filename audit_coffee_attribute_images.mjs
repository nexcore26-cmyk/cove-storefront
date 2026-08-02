import mysql from 'mysql2/promise';
import fs from 'node:fs';

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

function parseIds(value) {
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  if (value == null || value === '') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

function hasImageLike(v) {
  return Boolean((v.swatch && String(v.swatch).trim()) || (v.image && String(v.image).trim()) || (v.galleryImages && String(v.galleryImages).replace(/[\[\]"\s]/g, '').trim()));
}

const dbUrl = readDatabaseUrl();
if (!dbUrl) throw new Error('DATABASE_URL not found');
const db = await mysql.createConnection(dbUrl);

const coffeeSlugs = [
  'classic-157','classic-157-bohemian','classic-157-gold','classic-157-gray-white','classic-225','classic-225-bohemian','classic-225-brown','classic-225-gold',
  'country-112','country-167','country-62','curve-120','curve-180','decaf','mini-caf'
];

const [rows] = await db.query(`
SELECT
  p.id AS productId, p.slug, p.name AS productName,
  pa.id AS productAttributeId, pa.attributeId, pa.activeValueIds,
  a.name AS attributeName, a.displayType,
  av.id AS valueId, av.labelEn, av.swatch, av.image, av.galleryImages, av.isEnabled, av.sortOrder
FROM products p
JOIN product_attributes pa ON pa.productId = p.id
JOIN attributes a ON a.id = pa.attributeId
LEFT JOIN attribute_values av ON av.attributeId = pa.attributeId
WHERE p.slug IN (${coffeeSlugs.map(() => '?').join(',')})
ORDER BY p.slug, pa.sortOrder, a.id, av.sortOrder, av.id
`, coffeeSlugs);

const valueById = new Map();
for (const r of rows) {
  if (r.valueId) valueById.set(Number(r.valueId), {
    id: Number(r.valueId),
    labelEn: r.labelEn,
    swatch: r.swatch,
    image: r.image,
    galleryImages: r.galleryImages,
    isEnabled: r.isEnabled,
    sortOrder: r.sortOrder,
  });
}

const attrRows = new Map();
for (const r of rows) {
  const key = `${r.productAttributeId}`;
  if (!attrRows.has(key)) {
    attrRows.set(key, {
      slug: r.slug,
      productName: r.productName,
      productAttributeId: r.productAttributeId,
      attributeId: r.attributeId,
      attributeName: r.attributeName,
      displayType: r.displayType,
      activeValueIds: parseIds(r.activeValueIds),
      activeValues: [],
    });
  }
}

for (const group of attrRows.values()) {
  group.activeValues = group.activeValueIds.map(id => valueById.get(Number(id))).filter(Boolean).map(v => ({
    ...v,
    hasAnyImage: hasImageLike(v),
    hasSwatch: Boolean(v.swatch && String(v.swatch).trim()),
    hasMainImage: Boolean(v.image && String(v.image).trim()),
    hasGallery: Boolean(v.galleryImages && String(v.galleryImages).replace(/[\[\]"\s]/g, '').trim()),
  }));
  group.activeValueImageMissingCount = group.activeValues.filter(v => !v.hasAnyImage).length;
}

const groups = [...attrRows.values()];
const problemGroups = groups.filter(g => ['Select color','Select steel','Select top surface','Select coffee capsule tray size (for interior of drawer)'].includes(g.attributeName) && g.activeValues.length && g.activeValueImageMissingCount > 0);
const summary = {
  checkedAt: new Date().toISOString(),
  productCount: new Set(groups.map(g => g.slug)).size,
  groupCount: groups.length,
  activeOptionCount: groups.reduce((sum, g) => sum + g.activeValues.length, 0),
  missingImageOptionCount: groups.reduce((sum, g) => sum + g.activeValueImageMissingCount, 0),
  problemGroupCount: problemGroups.length,
};
console.log(JSON.stringify({ summary, problemGroups, groups }, null, 2));
await db.end();
