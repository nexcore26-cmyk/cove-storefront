const mysql = require('mysql2/promise');
require('dotenv').config();
(async () => {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [stockCols] = await conn.query('SHOW COLUMNS FROM attribute_value_stock');
  const [products] = await conn.query(`
    SELECT id, wcId, name, slug, sku, status, type, images
    FROM products
    WHERE slug LIKE '%mini-roshina%' OR name LIKE '%Mini Roshina%'
    ORDER BY name, id
  `);
  const productIds = products.map(p => p.id);
  let attrs = [];
  let values = [];
  let stock = [];
  if (productIds.length) {
    [attrs] = await conn.query(`
      SELECT pa.id AS productAttributeId, pa.productId, p.name AS productName, p.slug,
             pa.attributeId, a.name AS attributeName, a.displayType, pa.activeValueIds,
             pa.galleryControlling, pa.isImageMaster, pa.stockControlling, pa.sortOrder
      FROM product_attributes pa
      JOIN products p ON p.id = pa.productId
      JOIN attributes a ON a.id = pa.attributeId
      WHERE pa.productId IN (${productIds.map(() => '?').join(',')})
      ORDER BY p.name, pa.sortOrder, pa.id
    `, productIds);
    const attributeIds = [...new Set(attrs.map(a => a.attributeId))];
    if (attributeIds.length) {
      [values] = await conn.query(`
        SELECT av.id, av.attributeId, a.name AS attributeName, av.labelEn, av.labelAr, av.image, av.galleryImages,
               av.price, av.salePrice, av.isBundle, av.manageStock, av.isEnabled, av.sortOrder, av.updatedAt
        FROM attribute_values av
        JOIN attributes a ON a.id = av.attributeId
        WHERE av.attributeId IN (${attributeIds.map(() => '?').join(',')})
        ORDER BY a.name, av.sortOrder, av.id
      `, attributeIds);
    }
    [stock] = await conn.query(`
      SELECT avs.*, p.name AS productName, p.slug, av.labelEn, av.attributeId, a.name AS attributeName
      FROM attribute_value_stock avs
      JOIN products p ON p.id = avs.productId
      JOIN attribute_values av ON av.id = avs.attributeValueId
      JOIN attributes a ON a.id = av.attributeId
      WHERE avs.productId IN (${productIds.map(() => '?').join(',')})
      ORDER BY p.name, a.name, av.sortOrder, av.id
    `, productIds);
  }
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    stockColumns: stockCols.map(c => c.Field),
    products,
    productAttributes: attrs,
    attributeValues: values,
    productAttributeValueStockRows: stock
  }, null, 2));
  await conn.end();
})().catch(e => { console.error(e); process.exit(1); });
