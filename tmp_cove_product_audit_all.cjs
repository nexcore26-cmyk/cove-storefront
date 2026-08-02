#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });
const mysql = require('mysql2/promise');

const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const parseJson = (v, fallback) => {
  if (v == null) return fallback;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return fallback; }
};
const isUrlish = (v) => typeof v === 'string' && /^(https?:\/\/|\/uploads\/|\/assets\/|data:image\/)/i.test(v.trim());
const firstMedia = (...vals) => {
  for (const v of vals) {
    if (Array.isArray(v)) {
      const found = v.find(isUrlish);
      if (found) return found;
    } else if (isUrlish(v)) return v;
  }
  return null;
};
const fileHint = (url) => {
  if (!url) return '';
  try { return decodeURIComponent(String(url).split('?')[0].split('/').pop() || '').toLowerCase(); }
  catch { return String(url).toLowerCase(); }
};
const variantMatchesValue = (variant, attrName, labelEn, labelAr, valueId) => {
  const attrs = parseJson(variant.attributes, {});
  const labels = [labelEn, labelAr, String(valueId)].filter(Boolean).map(norm);
  for (const [k, v] of Object.entries(attrs || {})) {
    const key = norm(k);
    const val = norm(v);
    if (key === norm(attrName) && labels.includes(val)) return true;
    if (labels.includes(val)) return true;
  }
  return false;
};

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not loaded');
  const conn = await mysql.createConnection(dbUrl);
  const q = async (sql, params=[]) => (await conn.query(sql, params))[0];

  const now = new Date().toISOString();
  const [settings] = await q('SELECT * FROM store_settings ORDER BY id LIMIT 1');
  const warehouses = await q('SELECT id,name,code,type,isActive FROM warehouses ORDER BY id');
  const onlineWarehouseId = settings?.onlineWarehouseId || warehouses.find(w => w.type === 'online')?.id || null;

  const products = await q('SELECT id,wcId,name,slug,sku,status,type,price,salePrice,images,color,categoryId,shippingClass,shippingClassId,updatedAt FROM products WHERE status = "active" ORDER BY id');
  const variants = await q('SELECT id,productId,wcVariantId,sku,name,attributes,price,salePrice,image,galleryImages,isActive,updatedAt FROM product_variants WHERE isActive = 1 ORDER BY productId,id');
  const attrRows = await q(`SELECT pa.productId, pa.attributeId, pa.activeValueIds, pa.sortOrder AS productAttrSortOrder,
      a.name AS attrName, a.displayType, a.type AS attrType,
      av.id AS valueId, av.labelEn, av.labelAr, av.swatch, av.image, av.galleryImages, av.isEnabled, av.sortOrder AS valueSortOrder
    FROM product_attributes pa
    JOIN attributes a ON a.id = pa.attributeId
    LEFT JOIN attribute_values av ON av.attributeId = a.id
    ORDER BY pa.productId, pa.sortOrder, a.id, av.sortOrder, av.id`);
  const stockRows = await q('SELECT warehouseId,productId,variantId,quantity,reservedQty,outOfStockThresholdEnabled,outOfStockThreshold FROM warehouse_stock ORDER BY productId,variantId,warehouseId');
  const vendorRows = await q('SELECT id,name,email,phone,isActive,commissionPercent FROM vendors ORDER BY id');
  const productVendorRows = await q('SELECT pv.productId,pv.vendorId,pv.ownershipType,pv.commissionPercent,v.name AS vendorName,v.isActive AS vendorActive FROM product_vendors pv LEFT JOIN vendors v ON v.id=pv.vendorId ORDER BY pv.productId,pv.vendorId');
  const roleRows = await q('SELECT role, COUNT(*) AS count FROM users GROUP BY role ORDER BY role');

  const byProductVariants = new Map();
  for (const v of variants) {
    if (!byProductVariants.has(v.productId)) byProductVariants.set(v.productId, []);
    byProductVariants.get(v.productId).push(v);
  }
  const byProductAttrs = new Map();
  for (const r of attrRows) {
    if (!byProductAttrs.has(r.productId)) byProductAttrs.set(r.productId, []);
    byProductAttrs.get(r.productId).push(r);
  }
  const byProductStock = new Map();
  for (const s of stockRows) {
    if (!byProductStock.has(s.productId)) byProductStock.set(s.productId, []);
    byProductStock.get(s.productId).push(s);
  }
  const productVendorMap = new Map();
  for (const pv of productVendorRows) {
    if (!productVendorMap.has(pv.productId)) productVendorMap.set(pv.productId, []);
    productVendorMap.get(pv.productId).push(pv);
  }

  const issues = [];
  const productSummaries = [];
  let imageAttributeGroups = 0, activeImageValues = 0, activeImageValuesWithSource = 0, productSpecificImageValues = 0;
  let activeAttrValueCount = 0, activeAttrValuesWithNoSource = 0;

  for (const p of products) {
    const pVars = byProductVariants.get(p.id) || [];
    const pAttrsAll = byProductAttrs.get(p.id) || [];
    const pStock = byProductStock.get(p.id) || [];
    const pVendors = productVendorMap.get(p.id) || [];
    const images = parseJson(p.images, []);
    const onlineRows = onlineWarehouseId ? pStock.filter(s => Number(s.warehouseId) === Number(onlineWarehouseId)) : [];
    const onlineTotal = onlineRows.reduce((sum, s) => sum + Number(s.quantity || 0), 0);
    const onlineAvailable = onlineRows.reduce((sum, s) => sum + Math.max(0, Number(s.quantity || 0) - Number(s.reservedQty || 0)), 0);
    const shopVisibleByStock = onlineRows.some(s => {
      const qty = Number(s.quantity || 0) - Number(s.reservedQty || 0);
      const threshold = s.outOfStockThresholdEnabled ? Number(s.outOfStockThreshold || 0) : 0;
      return qty > threshold;
    });

    if (pStock.some(s => Number(s.quantity) < 0)) {
      issues.push({ severity: 'high', type: 'negative_stock', productId: p.id, slug: p.slug, name: p.name, details: pStock.filter(s => Number(s.quantity) < 0) });
    }
    if (p.type === 'variable' && pVars.length === 0) {
      issues.push({ severity: 'high', type: 'variable_product_no_active_variants', productId: p.id, slug: p.slug, name: p.name });
    }
    if (p.type !== 'variable' && pVars.length > 0) {
      issues.push({ severity: 'medium', type: 'non_variable_product_has_active_variants', productId: p.id, slug: p.slug, name: p.name, variantCount: pVars.length });
    }
    if ((p.type === 'variable' || pAttrsAll.length) && pAttrsAll.length === 0) {
      issues.push({ severity: 'high', type: 'product_has_no_attribute_assignments', productId: p.id, slug: p.slug, name: p.name, variantCount: pVars.length });
    }

    const attrGroups = new Map();
    for (const r of pAttrsAll) {
      if (!attrGroups.has(r.attributeId)) attrGroups.set(r.attributeId, { attributeId: r.attributeId, attrName: r.attrName, displayType: r.displayType, attrType: r.attrType, activeValueIds: parseJson(r.activeValueIds, []), rows: [] });
      attrGroups.get(r.attributeId).rows.push(r);
    }
    const selectorChecks = [];
    for (const g of attrGroups.values()) {
      const activeSet = new Set((Array.isArray(g.activeValueIds) ? g.activeValueIds : []).map(Number));
      if (activeSet.size === 0) {
        issues.push({ severity: 'medium', type: 'attribute_assignment_no_active_values', productId: p.id, slug: p.slug, name: p.name, attributeId: g.attributeId, attribute: g.attrName });
      }
      if (g.displayType === 'image') imageAttributeGroups++;
      for (const r of g.rows) {
        if (!activeSet.has(Number(r.valueId))) continue;
        activeAttrValueCount++;
        const galleries = parseJson(r.galleryImages, []);
        const attrMedia = firstMedia(r.swatch, r.image, galleries);
        const matchingVars = pVars.filter(v => variantMatchesValue(v, g.attrName, r.labelEn, r.labelAr, r.valueId));
        const variantMedia = firstMedia(...matchingVars.flatMap(v => [v.image, parseJson(v.galleryImages, [])]));
        const selectorMedia = firstMedia(variantMedia, attrMedia);
        const sourceType = variantMedia ? 'product_variant' : (attrMedia ? 'product_attribute' : 'missing');
        if (!selectorMedia && g.displayType !== 'button') activeAttrValuesWithNoSource++;
        if (g.displayType === 'image') {
          activeImageValues++;
          if (selectorMedia) activeImageValuesWithSource++;
          if (variantMedia) productSpecificImageValues++;
          if (!selectorMedia) {
            issues.push({ severity: 'high', type: 'image_attribute_active_value_no_renderable_source', productId: p.id, slug: p.slug, name: p.name, attributeId: g.attributeId, attribute: g.attrName, valueId: r.valueId, value: r.labelEn });
          }
          if (matchingVars.length > 0 && !variantMedia && attrMedia) {
            issues.push({ severity: 'low', type: 'image_attribute_uses_global_media_no_variant_media', productId: p.id, slug: p.slug, name: p.name, attribute: g.attrName, valueId: r.valueId, value: r.labelEn, source: attrMedia, matchingVariantCount: matchingVars.length });
          }
          const hint = fileHint(selectorMedia);
          const productHintTerms = norm(p.name).split(/[^a-z0-9]+/).filter(t => t.length >= 4);
          const valueHintTerms = norm(r.labelEn).split(/[^a-z0-9]+/).filter(t => t.length >= 4);
          const unrelatedCarnaval = /(carnaval|petrol)/i.test(hint) && !/(carnaval|petrol)/i.test(`${p.name} ${r.labelEn}`);
          if (unrelatedCarnaval) {
            issues.push({ severity: 'high', type: 'suspicious_selector_media_filename', productId: p.id, slug: p.slug, name: p.name, attribute: g.attrName, value: r.labelEn, sourceType, source: selectorMedia, hint });
          }
        }
        if (!r.isEnabled) {
          issues.push({ severity: 'medium', type: 'assigned_active_value_is_disabled', productId: p.id, slug: p.slug, name: p.name, attribute: g.attrName, valueId: r.valueId, value: r.labelEn });
        }
        selectorChecks.push({ attribute: g.attrName, displayType: g.displayType, valueId: r.valueId, value: r.labelEn, sourceType, selectorMedia, matchingVariantCount: matchingVars.length });
      }
    }

    productSummaries.push({
      id: p.id, slug: p.slug, name: p.name, type: p.type, sku: p.sku,
      imageCount: Array.isArray(images) ? images.length : 0,
      variantCount: pVars.length,
      attributeGroupCount: attrGroups.size,
      imageAttributeGroupCount: [...attrGroups.values()].filter(g => g.displayType === 'image').length,
      onlineWarehouseId, onlineTotal, onlineAvailable, shopVisibleByStock,
      vendorCount: pVendors.length,
      selectorChecks
    });
  }

  const passageMatches = productSummaries.filter(p => /passage|lamparfum|cachemire/i.test(`${p.name} ${p.slug} ${p.sku || ''}`));
  const zeroStockActiveProducts = productSummaries.filter(p => p.onlineAvailable <= 0);
  const shopVisibleZeroStock = productSummaries.filter(p => p.onlineAvailable <= 0 && p.shopVisibleByStock);
  const productsWithNoVendor = productSummaries.filter(p => p.vendorCount === 0);

  const codeAudit = {
    productDetailContainsVariantPriorityHelper: false,
    productDetailContainsToggleDeselect: false,
    productDetailContainsColorGallerySyncState: false,
  };
  try {
    const pd = fs.readFileSync('client/src/components/ProductDetail.tsx', 'utf8');
    codeAudit.productDetailContainsVariantPriorityHelper = /getSelectorImageForValue|matching product variant/i.test(pd) && /product_variant|variantMedia/.test(pd);
    codeAudit.productDetailContainsToggleDeselect = /selectedAttributes\[attributeName\] === value/.test(pd) || /isSameSelection/.test(pd);
    codeAudit.productDetailContainsColorGallerySyncState = /setSelectedImage\(|colorControlled|selectedColor/i.test(pd) && /useEffect/.test(pd);
  } catch {}

  const moduleReadiness = {
    orderEmailFiles: fs.existsSync('server/email.ts') || fs.existsSync('server/email/index.ts'),
    adminEmailCustomizerFiles: fs.readdirSync('client/src/pages/admin').filter(f => /email|mail|template/i.test(f)),
    adminUserRoleFiles: fs.readdirSync('client/src/pages/admin').filter(f => /user|role|permission|staff/i.test(f)),
    adminVendorFiles: fs.readdirSync('client/src/pages/admin').filter(f => /vendor/i.test(f)),
  };

  const summary = {
    generatedAt: now,
    activeProductCount: products.length,
    activeVariantCount: variants.length,
    warehouseCount: warehouses.length,
    onlineWarehouseId,
    imageAttributeGroups,
    activeImageValues,
    activeImageValuesWithSource,
    productSpecificImageValues,
    activeAttrValueCount,
    activeAttrValuesWithNoSource,
    zeroStockActiveProductCount: zeroStockActiveProducts.length,
    shopVisibleZeroStockCount: shopVisibleZeroStock.length,
    vendorCount: vendorRows.length,
    activeVendorCount: vendorRows.filter(v => v.isActive).length,
    productsWithNoVendorCount: productsWithNoVendor.length,
    issueCount: issues.length,
    highIssueCount: issues.filter(i => i.severity === 'high').length,
    mediumIssueCount: issues.filter(i => i.severity === 'medium').length,
    lowIssueCount: issues.filter(i => i.severity === 'low').length,
    codeAudit,
    moduleReadiness,
    roleRows,
  };

  const audit = { summary, warehouses, settings: { id: settings?.id, onlineWarehouseId, posWarehouseId: settings?.posWarehouseId, mainWarehouseId: settings?.mainWarehouseId }, issues, passageMatches, zeroStockActiveProducts: zeroStockActiveProducts.slice(0, 250), shopVisibleZeroStock, productsWithNoVendor: productsWithNoVendor.slice(0, 250), vendors: vendorRows, productSummaries };
  fs.writeFileSync('/tmp/cove_all_product_audit.json', JSON.stringify(audit, null, 2));

  const byType = issues.reduce((acc, i) => { acc[i.type] = (acc[i.type] || 0) + 1; return acc; }, {});
  const md = [`# Cove Product System All-Product Audit`, `Generated: ${now}`, ``, `## Summary`, ``, `| Metric | Value |`, `|---|---:|`,
    `| Active products scanned | ${summary.activeProductCount} |`,
    `| Active variants scanned | ${summary.activeVariantCount} |`,
    `| Image attribute active values | ${summary.activeImageValues} |`,
    `| Image attribute active values with renderable selector source | ${summary.activeImageValuesWithSource} |`,
    `| Image values using product-specific variation media | ${summary.productSpecificImageValues} |`,
    `| Zero/negative online-available active products | ${summary.zeroStockActiveProductCount} |`,
    `| Active products with no vendor assignment | ${summary.productsWithNoVendorCount} |`,
    `| Total issues flagged | ${summary.issueCount} |`,
    `| High issues | ${summary.highIssueCount} |`,
    `| Medium issues | ${summary.mediumIssueCount} |`,
    `| Low issues | ${summary.lowIssueCount} |`,
    ``, `## Issue counts by type`, ``, `| Issue type | Count |`, `|---|---:|`,
    ...Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `| ${k} | ${v} |`),
    ``, `## Passage / Lamparfum / Cachemire matches`, ``, `| ID | Product | Slug | Online Available | Shop Visible By Stock |`, `|---:|---|---|---:|---|`,
    ...passageMatches.map(p => `| ${p.id} | ${String(p.name).replace(/\|/g,'/')} | ${p.slug} | ${p.onlineAvailable} | ${p.shopVisibleByStock} |`),
    ``, `## High issues`, ``, `| Type | Product | Slug | Detail |`, `|---|---|---|---|`,
    ...issues.filter(i=>i.severity==='high').slice(0,100).map(i => `| ${i.type} | ${String(i.name||'').replace(/\|/g,'/')} | ${i.slug||''} | ${String(i.attribute || i.value || i.hint || JSON.stringify(i.details||'')).replace(/\|/g,'/').slice(0,160)} |`),
    ``, `## Code/readiness checks`, ``, `| Check | Status |`, `|---|---|`,
    ...Object.entries(codeAudit).map(([k,v]) => `| ${k} | ${v ? 'present' : 'missing'} |`),
    `| orderEmailFiles | ${moduleReadiness.orderEmailFiles ? 'present' : 'missing'} |`,
    `| adminEmailCustomizerFiles | ${moduleReadiness.adminEmailCustomizerFiles.join(', ') || 'none found'} |`,
    `| adminUserRoleFiles | ${moduleReadiness.adminUserRoleFiles.join(', ') || 'none found'} |`,
    `| adminVendorFiles | ${moduleReadiness.adminVendorFiles.join(', ') || 'none found'} |`,
    ``, `Full JSON evidence is saved at /tmp/cove_all_product_audit.json on the production droplet.`
  ].join('\n');
  fs.writeFileSync('/tmp/cove_all_product_audit.md', md);
  console.log(JSON.stringify(summary, null, 2));
  await conn.end();
}
main().catch(err => { console.error(err); process.exit(1); });
