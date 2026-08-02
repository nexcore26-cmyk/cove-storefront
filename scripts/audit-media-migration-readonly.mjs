import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const root = process.cwd();
dotenv.config({ path: path.join(root, '.env') });

const OUT_DIR = process.env.MEDIA_AUDIT_OUT_DIR || '/tmp/cove-media-audit';
const SOURCES = (process.env.MEDIA_AUDIT_SOURCES || 'main').split(',').map(s => s.trim()).filter(Boolean);
const FORCE_SYNC_FALLBACK = process.env.MEDIA_AUDIT_USE_SYNC_FALLBACK === '1';
const wcValue = (envName, fallback) => FORCE_SYNC_FALLBACK ? fallback : (process.env[envName] || fallback);

const WC_CONFIG = {
  main: {
    label: 'Cove main WordPress',
    url: process.env.WC_MAIN_URL || 'https://coveinterior.com',
    key: wcValue('WC_MAIN_KEY', 'ck_6fa18cdd12cc966233075314818a70183857b0c0'),
    secret: wcValue('WC_MAIN_SECRET', 'cs_993948466557deae24f0183a7f4cd88ffd4fb3ef'),
  },
  brass: {
    label: 'Brass WordPress',
    url: process.env.WC_BRASS_URL || 'https://brass.coveinterior.com',
    key: wcValue('WC_BRASS_KEY', 'ck_c1359c4bf656e993085fd9290a69fd1281b39555'),
    secret: wcValue('WC_BRASS_SECRET', 'cs_3b29bbaf4ba73012a2207d878521e142c766fc7a'),
  },
};

function normalizeUrl(u) {
  if (!u || typeof u !== 'string') return '';
  return u.trim().replace(/\?.*$/, '').replace(/#.*$/, '');
}

function basenameFromUrl(u) {
  const clean = normalizeUrl(u);
  if (!clean) return '';
  try {
    return decodeURIComponent(new URL(clean, 'https://placeholder.local').pathname.split('/').pop() || '').toLowerCase();
  } catch {
    return clean.split('/').pop()?.toLowerCase() || '';
  }
}

function isLikelyMediaString(value) {
  if (typeof value !== 'string') return false;
  return /(\/media\/|\/manus-storage\/|\/wp-content\/uploads\/|https?:\/\/)/i.test(value) && /\.(jpe?g|png|gif|webp|svg|avif|mp4|mov|webm|pdf)(\?|#|$)/i.test(value);
}

function extractMediaStrings(value, found = new Set()) {
  if (value == null) return found;
  if (typeof value === 'string') {
    if (isLikelyMediaString(value)) found.add(value);
    const regex = /(https?:\/\/[^\s"'<>]+\.(?:jpe?g|png|gif|webp|svg|avif|mp4|mov|webm|pdf)(?:\?[^\s"'<>]*)?)/gi;
    for (const m of value.matchAll(regex)) found.add(m[1]);
    return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) extractMediaStrings(item, found);
    return found;
  }
  if (typeof value === 'object') {
    for (const item of Object.values(value)) extractMediaStrings(item, found);
  }
  return found;
}

function safeJson(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return v; }
}

async function wcFetch(source, endpoint, params = {}, retries = 3) {
  const cfg = WC_CONFIG[source];
  const url = new URL(`${cfg.url.replace(/\/$/, '')}/wp-json/wc/v3/${endpoint}`);
  if (cfg.key) url.searchParams.set('consumer_key', cfg.key);
  if (cfg.secret) url.searchParams.set('consumer_secret', cfg.secret);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(90000) });
    if (res.ok) return await res.json();
    const text = await res.text().catch(() => '');
    if (attempt === retries) throw new Error(`${source} ${endpoint} ${res.status}: ${text.slice(0, 250)}`);
    await new Promise(r => setTimeout(r, 1500 * attempt));
  }
}

async function wcFetchAll(source, endpoint, params = {}) {
  const out = [];
  let page = 1;
  while (true) {
    const rows = await wcFetch(source, endpoint, { ...params, per_page: 100, page });
    if (!Array.isArray(rows) || rows.length === 0) break;
    out.push(...rows);
    console.log(`[WP:${source}] ${endpoint} page ${page}: ${rows.length}, total ${out.length}`);
    if (rows.length < 100) break;
    page += 1;
  }
  return out;
}

async function wpRestFetch(source, restPath, params = {}, retries = 3) {
  const cfg = WC_CONFIG[source];
  const cleanPath = restPath.replace(/^\/+/, '');
  const url = new URL(`${cfg.url.replace(/\/$/, '')}/wp-json/wp/v2/${cleanPath}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(90000) });
    if (res.ok) return await res.json();
    const text = await res.text().catch(() => '');
    if (attempt === retries) throw new Error(`${source} wp/v2/${restPath} ${res.status}: ${text.slice(0, 250)}`);
    await new Promise(r => setTimeout(r, 1500 * attempt));
  }
}

async function wpRestFetchAll(source, restPath, params = {}) {
  const out = [];
  let page = 1;
  while (true) {
    const rows = await wpRestFetch(source, restPath, { ...params, per_page: 100, page });
    if (!Array.isArray(rows) || rows.length === 0) break;
    out.push(...rows);
    console.log(`[WP-REST:${source}] ${restPath} page ${page}: ${rows.length}, total ${out.length}`);
    if (rows.length < 100) break;
    page += 1;
  }
  return out;
}

function textFromWpRendered(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value.rendered || value.raw || JSON.stringify(value);
  return String(value);
}

function collectWordPressMediaIds(value, found = new Set()) {
  if (value == null) return found;
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  const patterns = [
    /wp-image-(\d+)/gi,
    /(?:image|images|ids|img_id|media|media_id|bg_image|background_image|poster|video|gallery|attach(?:ment)?_id)=["']([0-9,\s]+)["']/gi,
    /(?:image|images|ids|img_id|media|media_id|bg_image|background_image|poster|video|gallery|attach(?:ment)?_id)\s*:\s*["']([0-9,\s]+)["']/gi,
    /(?:image|images|ids|img_id|media|media_id|bg_image|background_image|poster|video|gallery|attach(?:ment)?_id)\s*:\s*(\d+)/gi,
  ];
  for (const pattern of patterns) {
    for (const m of raw.matchAll(pattern)) {
      String(m[1]).split(',').map(x => x.trim()).filter(Boolean).forEach(x => found.add(Number(x)));
    }
  }
  found.delete(NaN);
  return found;
}

function embeddedFeaturedMedia(post) {
  return post?._embedded?.['wp:featuredmedia']?.[0] || null;
}

async function auditWordPressRestContent(source, used) {
  const cfg = WC_CONFIG[source];
  const mediaCache = new Map();
  const contentRows = [];
  const restBases = [
    { restBase: 'pages', type: 'page' },
    { restBase: 'portfolio', type: 'portfolio' },
    { restBase: 'cms_block', type: 'cms_block' },
    { restBase: 'woodmart_layout', type: 'woodmart_layout' },
    { restBase: 'wd_popup', type: 'wd_popup' },
    { restBase: 'wd_floating_block', type: 'wd_floating_block' },
    { restBase: 'navigation', type: 'wp_navigation' },
  ];

  async function getMediaById(id) {
    if (!id || Number.isNaN(Number(id))) return null;
    const key = Number(id);
    if (mediaCache.has(key)) return mediaCache.get(key);
    try {
      const media = await wpRestFetch(source, `media/${key}`);
      mediaCache.set(key, media);
      return media;
    } catch (e) {
      mediaCache.set(key, null);
      return null;
    }
  }

  const projectTerms = [];
  try {
    const terms = await wpRestFetchAll(source, 'project-cat', { hide_empty: true });
    for (const t of terms) projectTerms.push({ id: t.id, name: t.name, slug: t.slug, count: t.count });
  } catch (e) {
    contentRows.push({ source, type: 'project-cat', status: 'skipped', reason: e.message });
  }

  for (const item of restBases) {
    let rows = [];
    try {
      rows = await wpRestFetchAll(source, item.restBase, { _embed: 1, status: 'publish' });
    } catch (e) {
      contentRows.push({ source, type: item.type, status: 'skipped', reason: e.message });
      continue;
    }
    for (const post of rows) {
      const title = textFromWpRendered(post.title).replace(/<[^>]*>/g, '').trim();
      const label = `${item.type}:${post.id}:${post.slug || ''}:${title}`;
      const featured = embeddedFeaturedMedia(post);
      if (featured?.source_url) addUsedMedia(used, {
        source,
        attachmentId: featured.id || post.featured_media,
        url: featured.source_url,
        name: featured.title?.rendered || featured.slug || null,
        alt: featured.alt_text || null,
        usage: { type: `${item.type}_featured_image`, postType: item.type, wpPostId: post.id, slug: post.slug || '', title },
      });
      const contentBlob = [post.content, post.excerpt, post.yoast_head_json, post.meta, post.acf].map(textFromWpRendered).join('\n');
      for (const url of extractMediaStrings(contentBlob)) addUsedMedia(used, {
        source,
        attachmentId: null,
        url,
        usage: { type: `${item.type}_embedded_media_url`, postType: item.type, wpPostId: post.id, slug: post.slug || '', title },
      });
      for (const mediaId of collectWordPressMediaIds(contentBlob)) {
        const media = await getMediaById(mediaId);
        if (media?.source_url) addUsedMedia(used, {
          source,
          attachmentId: media.id,
          url: media.source_url,
          name: media.title?.rendered || media.slug || null,
          alt: media.alt_text || null,
          usage: { type: `${item.type}_embedded_media_id`, postType: item.type, wpPostId: post.id, slug: post.slug || '', title, mediaId },
        });
      }
      contentRows.push({ source, type: item.type, wpPostId: post.id, slug: post.slug || '', title, featuredMediaId: post.featured_media || '', extractedMediaIdCount: collectWordPressMediaIds(contentBlob).size, extractedMediaUrlCount: extractMediaStrings(contentBlob).size });
    }
  }

  return { source, label: cfg.label, projectTerms, contentRows };
}

function addUsedMedia(map, item) {
  if (!item?.url) return;
  const url = normalizeUrl(item.url);
  const key = item.attachmentId ? `${item.source}:id:${item.attachmentId}` : `${item.source}:url:${url}`;
  const existing = map.get(key) || {
    source: item.source,
    attachmentId: item.attachmentId || null,
    url,
    filename: basenameFromUrl(url),
    name: item.name || null,
    alt: item.alt || null,
    usages: [],
  };
  existing.usages.push(item.usage);
  map.set(key, existing);
}

async function auditWordPress() {
  const used = new Map();
  const sourceSummaries = [];
  const skuMap = [];
  const variationMap = [];
  const activeContentSummaries = [];

  for (const source of SOURCES) {
    const cfg = WC_CONFIG[source];
    if (!cfg?.url || !cfg?.key || !cfg?.secret) {
      sourceSummaries.push({ source, skipped: true, reason: 'Missing WooCommerce API configuration' });
      continue;
    }

    const categories = await wcFetchAll(source, 'products/categories', { hide_empty: 1 });
    for (const cat of categories) {
      if (cat.image?.src) addUsedMedia(used, {
        source,
        attachmentId: cat.image.id,
        url: cat.image.src,
        name: cat.image.name,
        alt: cat.image.alt,
        usage: { type: 'category_image', wcCategoryId: cat.id, name: cat.name, slug: cat.slug },
      });
    }

    const products = await wcFetchAll(source, 'products', { status: 'publish' });
    let variationsTotal = 0;
    for (const p of products) {
      skuMap.push({ source, wcProductId: p.id, sku: p.sku || '', name: p.name, type: p.type, imageCount: p.images?.length || 0 });
      for (let i = 0; i < (p.images || []).length; i++) {
        const img = p.images[i];
        addUsedMedia(used, {
          source,
          attachmentId: img.id,
          url: img.src,
          name: img.name,
          alt: img.alt,
          usage: { type: i === 0 ? 'product_featured_image' : 'product_gallery_image', wcProductId: p.id, sku: p.sku || '', productName: p.name, position: i },
        });
      }
      if (p.type === 'variable') {
        const vars = await wcFetchAll(source, `products/${p.id}/variations`, { status: 'publish' });
        variationsTotal += vars.length;
        for (const v of vars) {
          variationMap.push({ source, wcProductId: p.id, parentSku: p.sku || '', wcVariantId: v.id, sku: v.sku || '', attributes: v.attributes || [], image: v.image?.src || '' });
          if (v.image?.src) addUsedMedia(used, {
            source,
            attachmentId: v.image.id,
            url: v.image.src,
            name: v.image.name,
            alt: v.image.alt,
            usage: { type: 'variation_image', wcProductId: p.id, parentSku: p.sku || '', wcVariantId: v.id, sku: v.sku || '', attributes: v.attributes || [] },
          });
        }
      }
    }
    sourceSummaries.push({ source, label: cfg.label, categoryCount: categories.length, productCount: products.length, variationCount: variationsTotal });

    if (source === 'main') {
      try {
        activeContentSummaries.push(await auditWordPressRestContent(source, used));
      } catch (e) {
        activeContentSummaries.push({ source, skipped: true, reason: e.message });
      }
    }
  }

  return { usedMedia: [...used.values()], sourceSummaries, activeContentSummaries, skuMap, variationMap };
}

async function queryMaybe(conn, sql) {
  try { const [rows] = await conn.execute(sql); return rows; }
  catch (e) { return { error: e.message, sql }; }
}

async function auditNode() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const tables = (await queryMaybe(conn, 'SHOW TABLES'));
  const tableNames = Array.isArray(tables) ? tables.map(r => Object.values(r)[0]) : [];
  const has = t => tableNames.includes(t);

  const mediaAssets = has('media_assets') ? await queryMaybe(conn, 'SELECT id, tenantId, `key`, url, sourceSystem, mimeType, sizeBytes, sha256, originalFilename, altText, entityType, entityId, isActive, createdAt, updatedAt FROM media_assets ORDER BY id') : [];
  const products = has('products') ? await queryMaybe(conn, 'SELECT id, wcId, wcSource, name, sku, type, status, images, ogImage FROM products ORDER BY id') : [];
  const variants = has('product_variants') ? await queryMaybe(conn, 'SELECT id, productId, wcVariantId, sku, name, attributes, image, galleryImages, isActive FROM product_variants ORDER BY id') : [];
  const categories = has('categories') ? await queryMaybe(conn, 'SELECT id, wcId, wcSource, name, slug, image, isActive FROM categories ORDER BY id') : [];
  const homepageSections = has('homepage_sections') ? await queryMaybe(conn, 'SELECT id, sectionKey, title, imageUrl, isActive FROM homepage_sections ORDER BY id') : [];
  const pages = has('pages') ? await queryMaybe(conn, 'SELECT id, slug, title, isPublished, puckData FROM pages ORDER BY id') : [];
  const pageBlocks = has('page_blocks') ? await queryMaybe(conn, 'SELECT id, pageId, blockType, isVisible, config FROM page_blocks ORDER BY id') : [];
  const attributeValues = has('attribute_values') ? await queryMaybe(conn, 'SELECT id, productId, value, swatch, image, galleryImages FROM attribute_values ORDER BY id') : [];

  await conn.end();

  const references = [];
  function addRef(entityType, entityId, label, field, value) {
    const parsed = safeJson(value);
    const urls = [...extractMediaStrings(parsed)];
    for (const url of urls) references.push({ entityType, entityId, label, field, url: normalizeUrl(url), filename: basenameFromUrl(url) });
  }

  if (Array.isArray(products)) for (const p of products) { addRef('product', p.id, `${p.sku || ''} ${p.name}`, 'images', p.images); addRef('product', p.id, `${p.sku || ''} ${p.name}`, 'ogImage', p.ogImage); }
  if (Array.isArray(variants)) for (const v of variants) { addRef('variant', v.id, `${v.sku || ''} ${v.name}`, 'image', v.image); addRef('variant', v.id, `${v.sku || ''} ${v.name}`, 'galleryImages', v.galleryImages); }
  if (Array.isArray(categories)) for (const c of categories) addRef('category', c.id, c.name, 'image', c.image);
  if (Array.isArray(homepageSections)) for (const h of homepageSections) addRef('homepage_section', h.id, h.sectionKey, 'imageUrl', h.imageUrl);
  if (Array.isArray(pages)) for (const p of pages) addRef('page', p.id, p.slug, 'puckData', p.puckData);
  if (Array.isArray(pageBlocks)) for (const b of pageBlocks) addRef('page_block', b.id, b.blockType, 'config', b.config);
  if (Array.isArray(attributeValues)) for (const a of attributeValues) { addRef('attribute_value', a.id, String(a.value || ''), 'swatch', a.swatch); addRef('attribute_value', a.id, String(a.value || ''), 'image', a.image); addRef('attribute_value', a.id, String(a.value || ''), 'galleryImages', a.galleryImages); }

  const fileList = [];
  async function walk(dir) {
    let entries = [];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile()) {
        const st = await fs.stat(full);
        fileList.push({ path: full.replace(root + '/', ''), filename: e.name.toLowerCase(), sizeBytes: st.size, mtime: st.mtime.toISOString() });
      }
    }
  }
  await walk(path.join(root, 'public', 'media'));

  return { tableNames, mediaAssets, products, variants, categories, homepageSections, pages, pageBlocks, attributeValues, references, localMediaFiles: fileList };
}

function analyze(wp, node) {
  const wpByFilename = new Map();
  for (const m of wp.usedMedia) {
    if (!wpByFilename.has(m.filename)) wpByFilename.set(m.filename, []);
    wpByFilename.get(m.filename).push(m);
  }
  const nodeMedia = Array.isArray(node.mediaAssets) ? node.mediaAssets : [];
  const refs = node.references || [];
  const files = node.localMediaFiles || [];
  const fileByFilename = new Map(files.map(f => [f.filename, f]));
  const refUrlSet = new Set(refs.map(r => r.url));
  const refFilenameSet = new Set(refs.map(r => r.filename).filter(Boolean));

  const mediaAssetAnalysis = nodeMedia.map(a => {
    const filename = basenameFromUrl(a.url || a.key || a.originalFilename || '');
    return {
      id: a.id,
      url: a.url,
      key: a.key,
      filename,
      originalFilename: a.originalFilename,
      isActive: !!a.isActive,
      sourceSystem: a.sourceSystem,
      localFileExistsByFilename: fileByFilename.has(filename),
      referencedByNodeExactUrl: refUrlSet.has(normalizeUrl(a.url)),
      referencedByNodeFilename: refFilenameSet.has(filename),
      matchesUsedWpFilename: wpByFilename.has(filename),
      recommendedStatus: !a.isActive ? 'inactive' : (refUrlSet.has(normalizeUrl(a.url)) || refFilenameSet.has(filename) || wpByFilename.has(filename) ? 'review_keep_or_replace' : 'candidate_unused_or_test'),
    };
  });

  const wpImportCandidates = wp.usedMedia.map(m => {
    const local = fileByFilename.get(m.filename);
    const assetMatches = mediaAssetAnalysis.filter(a => a.filename === m.filename);
    return {
      source: m.source,
      attachmentId: m.attachmentId,
      filename: m.filename,
      url: m.url,
      usageCount: m.usages.length,
      usageTypes: [...new Set(m.usages.map(u => u.type))].join(','),
      nodeLocalFileExistsByFilename: !!local,
      nodeMediaAssetCountByFilename: assetMatches.length,
      action: local && assetMatches.length ? 'verify_and_reuse_or_replace' : 'import_required',
    };
  });

  const wpSkuSet = new Set(wp.skuMap.map(p => `${p.source}:${(p.sku || '').toLowerCase()}`).filter(s => !s.endsWith(':')));
  const nodeSkuRows = Array.isArray(node.products) ? node.products.map(p => ({ id: p.id, wcId: p.wcId, wcSource: p.wcSource, sku: p.sku || '', name: p.name, status: p.status, hasWpSkuMatch: wpSkuSet.has(`${p.wcSource || 'main'}:${(p.sku || '').toLowerCase()}`) })) : [];
  const matchedNodeSkuCount = nodeSkuRows.filter(r => r.sku && r.hasWpSkuMatch).length;

  return {
    summary: {
      wpSources: wp.sourceSummaries,
      wpUsedUniqueMedia: wp.usedMedia.length,
      wpProductSkuRows: wp.skuMap.length,
      wpVariationRows: wp.variationMap.length,
      wpActiveContentRows: (wp.activeContentSummaries || []).reduce((sum, s) => sum + (s.contentRows?.length || 0), 0),
      wpProjectTermRows: (wp.activeContentSummaries || []).reduce((sum, s) => sum + (s.projectTerms?.length || 0), 0),
      nodeProducts: Array.isArray(node.products) ? node.products.length : 0,
      nodeVariants: Array.isArray(node.variants) ? node.variants.length : 0,
      nodeMediaAssets: nodeMedia.length,
      nodeLocalMediaFiles: files.length,
      nodeMediaReferences: refs.length,
      nodeMatchedProductSkus: matchedNodeSkuCount,
      nodeProductSkuMatchRate: nodeSkuRows.length ? Number((matchedNodeSkuCount / nodeSkuRows.filter(r => r.sku).length * 100).toFixed(2)) : 0,
      mediaAssetsWithLocalFileByFilename: mediaAssetAnalysis.filter(a => a.localFileExistsByFilename).length,
      mediaAssetsCandidateUnusedOrTest: mediaAssetAnalysis.filter(a => a.recommendedStatus === 'candidate_unused_or_test').length,
      wpImportRequiredCount: wpImportCandidates.filter(c => c.action === 'import_required').length,
    },
    mediaAssetAnalysis,
    wpImportCandidates,
    nodeSkuRows,
  };
}

function toCsv(rows) {
  if (!rows?.length) return '';
  const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const esc = v => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n') + '\n';
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log(`Writing read-only audit to ${OUT_DIR}`);
  const wp = await auditWordPress();
  const node = await auditNode();
  const analysis = analyze(wp, node);
  const result = { generatedAt: new Date().toISOString(), sources: SOURCES, wordpress: wp, node, analysis };
  await fs.writeFile(path.join(OUT_DIR, 'media_audit_full.json'), JSON.stringify(result, null, 2));
  await fs.writeFile(path.join(OUT_DIR, 'wp_used_media_import_candidates.csv'), toCsv(analysis.wpImportCandidates));
  await fs.writeFile(path.join(OUT_DIR, 'wp_active_content_rows.csv'), toCsv((wp.activeContentSummaries || []).flatMap(s => s.contentRows || [])));
  await fs.writeFile(path.join(OUT_DIR, 'wp_project_terms.csv'), toCsv((wp.activeContentSummaries || []).flatMap(s => (s.projectTerms || []).map(t => ({ source: s.source, ...t })))));
  await fs.writeFile(path.join(OUT_DIR, 'node_media_asset_analysis.csv'), toCsv(analysis.mediaAssetAnalysis));
  await fs.writeFile(path.join(OUT_DIR, 'node_product_sku_match.csv'), toCsv(analysis.nodeSkuRows));
  await fs.writeFile(path.join(OUT_DIR, 'summary.json'), JSON.stringify(analysis.summary, null, 2));
  console.log(JSON.stringify(analysis.summary, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
