import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

function parseEnvFile(filePath) {
  const env = {};
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

function safeJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function urlToLocalCandidates(appDir, row) {
  const candidates = [];
  const add = (p) => {
    if (!p) return;
    const normalized = path.normalize(p);
    if (!candidates.includes(normalized)) candidates.push(normalized);
  };
  const publicDir = path.join(appDir, 'public');
  const mediaDir = path.join(publicDir, 'media');
  const url = String(row.url || '');
  const key = String(row.key || '');
  if (key && !key.startsWith('http')) add(path.join(mediaDir, key));
  if (url.startsWith('/media/')) add(path.join(publicDir, url));
  const marker = '/media/';
  const pos = url.indexOf(marker);
  if (pos >= 0) add(path.join(mediaDir, url.slice(pos + marker.length)));
  return candidates;
}

function firstExisting(paths) {
  for (const p of paths) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    } catch {}
  }
  return null;
}

function mediaRefsFromRow(row, fieldName, value) {
  const refs = [];
  const add = (url) => {
    if (typeof url === 'string' && (url.includes('/media/') || url.startsWith('/media/'))) refs.push({ table: row.__table, id: row.id, slug: row.slug || null, name: row.name || null, field: fieldName, url });
  };
  const parsed = safeJson(value, value);
  if (Array.isArray(parsed)) parsed.forEach(add);
  else add(parsed);
  return refs;
}

async function main() {
  const appDir = process.argv[2] || process.cwd();
  const outputDir = process.argv[3] || path.join(appDir, 'reports', 'media_variation_diagnostic');
  fs.mkdirSync(outputDir, { recursive: true });
  const env = parseEnvFile(path.join(appDir, '.env'));
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is missing');
  const dbUrl = new URL(env.DATABASE_URL);
  const conn = await mysql.createConnection({
    host: dbUrl.hostname,
    port: Number(dbUrl.port || 3306),
    user: decodeURIComponent(dbUrl.username),
    password: decodeURIComponent(dbUrl.password),
    database: dbUrl.pathname.replace(/^\//, ''),
    multipleStatements: false,
  });

  const [mediaRows] = await conn.query('SELECT id, tenantId, `key`, url, sourceSystem, mimeType, sizeBytes, sha256, originalFilename, altText, entityType, entityId, isActive, createdAt FROM media_assets WHERE isActive = 1 ORDER BY createdAt DESC');
  const mediaChecks = mediaRows.map((row) => {
    const candidates = urlToLocalCandidates(appDir, row);
    const existing = firstExisting(candidates);
    return { ...row, exists: Boolean(existing), existingPath: existing, localCandidates: candidates };
  });
  const brokenMedia = mediaChecks.filter((r) => !r.exists && String(r.url || '').includes('/media/'));
  const nonLocalMedia = mediaChecks.filter((r) => !String(r.url || '').includes('/media/'));

  const [products] = await conn.query('SELECT p.id, p.name, p.slug, p.sku, p.type, p.status, p.categoryId, c.name AS categoryName, c.slug AS categorySlug, p.images FROM products p LEFT JOIN categories c ON c.id=p.categoryId WHERE p.status = \'active\'');
  const [variants] = await conn.query('SELECT id, productId, wcVariantId, sku, name, attributes, price, salePrice, image, galleryImages, isActive FROM product_variants WHERE isActive = 1');
  const [categories] = await conn.query('SELECT id, name, slug, parentId, isActive FROM categories');
  const [productAttrs] = await conn.query('SELECT pa.productId, pa.attributeId, pa.activeValueIds, a.name AS attributeName, a.displayType, a.type AS attributeType FROM product_attributes pa LEFT JOIN attributes a ON a.id=pa.attributeId');
  const [attributeValues] = await conn.query('SELECT id, attributeId, labelEn, labelAr, swatch, image, galleryImages, price, salePrice, isEnabled FROM attribute_values');

  const catsById = new Map(categories.map((c) => [c.id, c]));
  const childrenByParent = new Map();
  for (const c of categories) {
    const parent = c.parentId == null ? null : c.parentId;
    if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
    childrenByParent.get(parent).push(c.id);
  }
  const coffeeRootIds = categories.filter((c) => /coffee/i.test(`${c.name} ${c.slug}`)).map((c) => c.id);
  const coffeeIds = new Set();
  const stack = [...coffeeRootIds];
  while (stack.length) {
    const id = stack.pop();
    if (!id || coffeeIds.has(id)) continue;
    coffeeIds.add(id);
    for (const child of (childrenByParent.get(id) || [])) stack.push(child);
  }
  const variantsByProduct = new Map();
  for (const v of variants) {
    if (!variantsByProduct.has(v.productId)) variantsByProduct.set(v.productId, []);
    variantsByProduct.get(v.productId).push(v);
  }
  const valuesByAttr = new Map();
  for (const v of attributeValues) {
    if (!valuesByAttr.has(v.attributeId)) valuesByAttr.set(v.attributeId, []);
    valuesByAttr.get(v.attributeId).push(v);
  }
  const productAttrsByProduct = new Map();
  for (const pa of productAttrs) {
    const valueIds = safeJson(pa.activeValueIds, []);
    const values = (valuesByAttr.get(pa.attributeId) || []).filter((v) => Array.isArray(valueIds) ? valueIds.includes(v.id) : true);
    if (!productAttrsByProduct.has(pa.productId)) productAttrsByProduct.set(pa.productId, []);
    productAttrsByProduct.get(pa.productId).push({ ...pa, parsedValueIds: valueIds, values });
  }

  const targetSlugs = new Set(['classic-157-bohemian', 'mini-roshina-beige']);
  const targetProducts = products.filter((p) => targetSlugs.has(p.slug));
  const coffeeProducts = products.filter((p) => coffeeIds.has(p.categoryId));
  const summarizeProduct = (p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    sku: p.sku,
    type: p.type,
    categoryId: p.categoryId,
    categoryName: p.categoryName,
    categorySlug: p.categorySlug,
    images: safeJson(p.images, []),
    productAttributes: productAttrsByProduct.get(p.id) || [],
    variants: (variantsByProduct.get(p.id) || []).map((v) => ({
      id: v.id,
      wcVariantId: v.wcVariantId,
      sku: v.sku,
      name: v.name,
      attributes: safeJson(v.attributes, v.attributes),
      price: v.price,
      salePrice: v.salePrice,
      image: v.image,
      galleryImages: safeJson(v.galleryImages, []),
      imageExists: firstExisting(urlToLocalCandidates(appDir, { url: v.image, key: '' })) !== null,
      galleryExistence: safeJson(v.galleryImages, []).map((url) => ({ url, exists: firstExisting(urlToLocalCandidates(appDir, { url, key: '' })) !== null })),
    })),
  });

  const activeRefs = [];
  for (const p of products) {
    p.__table = 'products';
    activeRefs.push(...mediaRefsFromRow(p, 'images', p.images));
  }
  for (const v of variants) {
    v.__table = 'product_variants';
    activeRefs.push(...mediaRefsFromRow(v, 'image', v.image));
    activeRefs.push(...mediaRefsFromRow(v, 'galleryImages', v.galleryImages));
  }
  for (const c of categories) {
    c.__table = 'categories';
    activeRefs.push(...mediaRefsFromRow(c, 'image', c.image));
  }
  const activeRefChecks = activeRefs.map((ref) => ({ ...ref, exists: firstExisting(urlToLocalCandidates(appDir, { url: ref.url, key: '' })) !== null }));

  const summary = {
    generatedAt: new Date().toISOString(),
    appDir,
    mediaAssets: {
      activeCount: mediaRows.length,
      brokenLocalUrlCount: brokenMedia.length,
      nonLocalUrlCount: nonLocalMedia.length,
      brokenSamples: brokenMedia.slice(0, 50).map(({ id, tenantId, key, url, mimeType, originalFilename, entityType, entityId, createdAt, localCandidates }) => ({ id, tenantId, key, url, mimeType, originalFilename, entityType, entityId, createdAt, localCandidates })),
      nonLocalSamples: nonLocalMedia.slice(0, 20).map(({ id, url, key, mimeType, originalFilename }) => ({ id, url, key, mimeType, originalFilename })),
    },
    activeMediaReferences: {
      checkedCount: activeRefChecks.length,
      missingCount: activeRefChecks.filter((r) => !r.exists).length,
      missingSamples: activeRefChecks.filter((r) => !r.exists).slice(0, 80),
    },
    categories: {
      coffeeRootIds,
      coffeeCategoryIds: Array.from(coffeeIds),
      coffeeCategories: Array.from(coffeeIds).map((id) => catsById.get(id)),
      activeCoffeeProductCount: coffeeProducts.length,
    },
    targetProducts: targetProducts.map(summarizeProduct),
    coffeeProducts: coffeeProducts.map(summarizeProduct),
  };

  fs.writeFileSync(path.join(outputDir, 'readonly_media_variation_summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(outputDir, 'broken_media_assets.json'), JSON.stringify(brokenMedia, null, 2));
  fs.writeFileSync(path.join(outputDir, 'active_reference_checks.json'), JSON.stringify(activeRefChecks, null, 2));

  console.log(JSON.stringify({
    outputDir,
    activeMediaAssets: summary.mediaAssets.activeCount,
    brokenLocalMediaAssets: summary.mediaAssets.brokenLocalUrlCount,
    activeReferenceMissingCount: summary.activeMediaReferences.missingCount,
    coffeeCategories: summary.categories.coffeeCategories.map((c) => c && `${c.id}:${c.slug}:${c.name}`),
    activeCoffeeProductCount: summary.categories.activeCoffeeProductCount,
    targetProductVariantCounts: Object.fromEntries(summary.targetProducts.map((p) => [p.slug, p.variants.length])),
  }, null, 2));

  await conn.end();
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
