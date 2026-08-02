require('dotenv').config();
const fs = require('fs');
const { execSync } = require('child_process');
const mysql = require('mysql2/promise');
(async () => {
  console.log('---ProductDetail files---');
  try { console.log(execSync('find client/src -maxdepth 6 -iname "*ProductDetail*" -type f -print', { encoding: 'utf8' })); } catch(e) { console.error(e.message); }
  for (const f of execSync('find client/src -maxdepth 6 -iname "*ProductDetail*" -type f -print', { encoding: 'utf8' }).trim().split('\n').filter(Boolean)) {
    const s = fs.readFileSync(f, 'utf8');
    console.log('FILE', f, 'len', s.length, 'variantPriority', /getSelectorImageForValue|variantMedia|product_variant/.test(s), 'toggle', /isSameSelection|selectedAttributes\[attributeName\] === value/.test(s), 'useEffect', /useEffect/.test(s));
  }
  const c = await mysql.createConnection(process.env.DATABASE_URL);
  const [p] = await c.query('select id,name,slug from products where slug=?', ['roshina-mubkhar-black']);
  console.log('---Roshina product---'); console.log(p);
  if (p[0]) {
    const [v] = await c.query('select id,name,attributes,image,galleryImages from product_variants where productId=? and isActive=1 limit 20', [p[0].id]);
    console.log('---Roshina variants---'); console.log(JSON.stringify(v, null, 2));
    const [pa] = await c.query(`SELECT pa.activeValueIds,a.id attrId,a.name attrName,a.displayType,av.id valueId,av.labelEn,av.swatch,av.image,av.galleryImages
      FROM product_attributes pa JOIN attributes a ON a.id=pa.attributeId LEFT JOIN attribute_values av ON av.attributeId=a.id WHERE pa.productId=? ORDER BY a.id,av.id`, [p[0].id]);
    console.log('---Roshina attrs---'); console.log(JSON.stringify(pa, null, 2));
  }
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
