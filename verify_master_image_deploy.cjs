const mysql = require('mysql2/promise');
require('dotenv').config();
async function main(){
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [attrCols] = await conn.query(`SHOW COLUMNS FROM attributes`);
  const attrNames = attrCols.map(c => c.Field);
  const displayCol = attrNames.includes('displayType') ? 'displayType' : (attrNames.includes('display_type') ? 'display_type' : null);
  const displayExpr = displayCol ? `${displayCol} AS displayType` : `'unknown' AS displayType`;
  const [paCols] = await conn.query(`SHOW COLUMNS FROM product_attributes`);
  const paNames = paCols.map(c => c.Field);
  const masterCol = paNames.includes('isImageMaster') ? 'isImageMaster' : (paNames.includes('is_image_master') ? 'is_image_master' : null);
  const productCol = paNames.includes('productId') ? 'productId' : 'product_id';
  const attributeCol = paNames.includes('attributeId') ? 'attributeId' : 'attribute_id';
  const [attrs] = await conn.query(`SELECT id, name, ${displayExpr} FROM attributes WHERE name IN ('Size','Select color','Select steel','Select top surface','Select coffee capsule tray size (for interior of drawer)','Select Mini Roshina box set','Select Roshina set','Select Tissue Box Set','Select Trash Bin Set') ORDER BY name`);
  let masters = [];
  if (masterCol) {
    [masters] = await conn.query(`SELECT p.slug, a.name AS attributeName, pa.${masterCol} AS isImageMaster FROM product_attributes pa JOIN products p ON p.id=pa.${productCol} JOIN attributes a ON a.id=pa.${attributeCol} WHERE p.slug IN ('classic-225','mini-roshina-black','roshina-mubkhar-petrol') ORDER BY p.slug, pa.${masterCol} DESC, a.name`);
  }
  await conn.end();
  console.log(JSON.stringify({attributeColumns: attrNames, productAttributeColumns: paNames, detected:{displayCol, masterCol, productCol, attributeCol}, attrs, masters}, null, 2));
}
main().catch(e=>{console.error(e); process.exit(1)});
