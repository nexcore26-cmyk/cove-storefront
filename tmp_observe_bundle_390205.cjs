const mysql = require("mysql2/promise");
function norm(v){ if(typeof v==="bigint") return Number(v); if(Array.isArray(v)) return v.map(norm); if(v && typeof v==="object") return Object.fromEntries(Object.entries(v).map(([k,val])=>[k,norm(val)])); return v; }
(async()=>{
 const c = await mysql.createConnection(process.env.DATABASE_URL);
 try {
  const productIds = [390147,390205];
  const [products] = await c.query("SELECT id, name, sku, type, status, stockStatus FROM products WHERE id IN (?, ?) ORDER BY id", productIds);
  const [vars] = await c.query("SELECT id, productId, wcVariantId, name, sku, stockStatus, manageStock FROM product_variants WHERE productId IN (?, ?) ORDER BY productId, wcVariantId, id", productIds);
  const [bundleItems] = await c.query(`
    SELECT bi.*, bv.productId AS parentProductId, bv.wcVariantId AS parentWcVariantId, bv.name AS parentVariantName,
           bp.name AS parentProductName, cp.name AS componentProductName, cv.productId AS componentVariantProductId,
           cv.wcVariantId AS componentWcVariantId, cv.name AS componentVariantName
    FROM bundle_items bi
    LEFT JOIN product_variants bv ON bv.id = bi.bundleVariantId
    LEFT JOIN products bp ON bp.id = bv.productId
    LEFT JOIN products cp ON cp.id = bi.componentProductId
    LEFT JOIN product_variants cv ON cv.id = bi.componentVariantId
    WHERE bv.productId IN (?, ?) OR bi.componentProductId IN (?, ?) OR cv.productId IN (?, ?)
    ORDER BY COALESCE(bv.productId,0), COALESCE(bv.wcVariantId,0), bi.id
  `, [...productIds, ...productIds, ...productIds]);
  console.log(JSON.stringify(norm({products, variants: vars, bundleItems}), null, 2));
 } finally { await c.end(); }
})().catch(e=>{ console.error(e); process.exit(1); });
