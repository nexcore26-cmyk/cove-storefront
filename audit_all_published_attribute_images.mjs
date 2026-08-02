import mysql from 'mysql2/promise';
import fs from 'node:fs';

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const candidates = ['.env', '/var/www/cove/.env', '/opt/cove/.env'];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, 'utf8');
    const m = text.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/m);
    if (m) return m[1].replace(/^["']|["']$/g, '').trim();
  }
  throw new Error('DATABASE_URL not found');
}

function parseJsonArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function hasImage(v) {
  return Boolean((v.swatch && String(v.swatch).trim()) || (v.image && String(v.image).trim()) || parseJsonArray(v.galleryImages).length);
}

const db = await mysql.createConnection(readDatabaseUrl());

const [products] = await db.query(`
  SELECT p.id, p.name, p.slug, p.status, p.type, p.categoryId, c.name AS categoryName, c.slug AS categorySlug
  FROM products p
  LEFT JOIN categories c ON c.id = p.categoryId
  WHERE p.status = 'active' AND p.type <> 'simple'
  ORDER BY COALESCE(c.name, ''), p.name
`);

const [rows] = await db.query(`
  SELECT
    p.id AS productId,
    p.name AS productName,
    p.slug AS productSlug,
    p.type AS productType,
    p.status AS productStatus,
    c.name AS categoryName,
    c.slug AS categorySlug,
    pa.id AS productAttributeId,
    pa.activeValueIds,
    pa.sortOrder AS productAttributeSortOrder,
    a.id AS attributeId,
    a.name AS attributeName,
    a.displayType,
    a.type AS attributeType,
    av.id AS valueId,
    av.labelEn,
    av.swatch,
    av.image,
    av.galleryImages,
    av.isEnabled,
    av.sortOrder AS valueSortOrder
  FROM products p
  JOIN product_attributes pa ON pa.productId = p.id
  JOIN attributes a ON a.id = pa.attributeId
  LEFT JOIN categories c ON c.id = p.categoryId
  LEFT JOIN attribute_values av ON av.attributeId = a.id AND av.isEnabled = 1
  WHERE p.status = 'active' AND p.type <> 'simple'
  ORDER BY COALESCE(c.name, ''), p.name, pa.sortOrder, a.name, av.sortOrder, av.labelEn
`);

const byProduct = new Map(products.map(p => [p.id, {
  productId: p.id,
  name: p.name,
  slug: p.slug,
  type: p.type,
  category: p.categoryName,
  categorySlug: p.categorySlug,
  attributes: [],
  totals: { activeValues: 0, activeValuesWithImage: 0, activeValuesMissingImage: 0, imageDisplayAttributes: 0, nonImageDisplayAttributesWithImages: 0 }
}]));

const attrGroups = new Map();
for (const r of rows) {
  const activeIds = parseJsonArray(r.activeValueIds).map(Number).filter(Number.isFinite);
  const isActiveForProduct = activeIds.includes(Number(r.valueId));
  if (!isActiveForProduct) continue;
  const key = `${r.productId}:${r.attributeId}`;
  if (!attrGroups.has(key)) {
    attrGroups.set(key, {
      productId: r.productId,
      productAttributeId: r.productAttributeId,
      attributeId: r.attributeId,
      attributeName: r.attributeName,
      displayType: r.displayType,
      attributeType: r.attributeType,
      activeValueIds: activeIds,
      activeValues: []
    });
  }
  attrGroups.get(key).activeValues.push({
    id: r.valueId,
    label: r.labelEn,
    swatch: r.swatch,
    image: r.image,
    galleryImages: parseJsonArray(r.galleryImages),
    hasImage: hasImage(r)
  });
}

for (const group of attrGroups.values()) {
  const p = byProduct.get(group.productId);
  if (!p) continue;
  group.activeValueCount = group.activeValues.length;
  group.activeValuesWithImage = group.activeValues.filter(v => v.hasImage).length;
  group.activeValuesMissingImage = group.activeValues.filter(v => !v.hasImage).map(v => ({ id: v.id, label: v.label }));
  p.attributes.push(group);
  p.totals.activeValues += group.activeValueCount;
  p.totals.activeValuesWithImage += group.activeValuesWithImage;
  p.totals.activeValuesMissingImage += group.activeValuesMissingImage.length;
  if (group.displayType === 'image') p.totals.imageDisplayAttributes += 1;
  if (group.displayType !== 'image' && group.activeValuesWithImage > 0) p.totals.nonImageDisplayAttributesWithImages += 1;
}

const productSummaries = [...byProduct.values()].filter(p => p.attributes.length > 0);
const byAttribute = {};
for (const p of productSummaries) {
  for (const a of p.attributes) {
    byAttribute[a.attributeName] ||= { displayTypes: {}, products: 0, activeValues: 0, withImages: 0, missingImages: 0, missingLabels: [] };
    const s = byAttribute[a.attributeName];
    s.displayTypes[a.displayType] = (s.displayTypes[a.displayType] || 0) + 1;
    s.products += 1;
    s.activeValues += a.activeValueCount;
    s.withImages += a.activeValuesWithImage;
    s.missingImages += a.activeValuesMissingImage.length;
    for (const mv of a.activeValuesMissingImage) s.missingLabels.push({ productSlug: p.slug, valueId: mv.id, label: mv.label });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  scope: {
    productStatus: 'active',
    excludedType: 'simple',
    scopedProductCount: products.length,
    scopedProductsWithProductAttributes: productSummaries.length
  },
  summary: {
    productsWithAnyMissingActiveValueImages: productSummaries.filter(p => p.totals.activeValuesMissingImage > 0).length,
    productsWithImageDataButNonImageDisplayType: productSummaries.filter(p => p.totals.nonImageDisplayAttributesWithImages > 0).length,
    attributeCount: Object.keys(byAttribute).length
  },
  byAttribute,
  products: productSummaries
};

console.log(JSON.stringify(report, null, 2));
await db.end();
