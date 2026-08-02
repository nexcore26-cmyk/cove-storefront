import 'dotenv/config';

const WC_URL = process.env.WC_MAIN_URL;
const WC_KEY = process.env.WC_MAIN_KEY;
const WC_SECRET = process.env.WC_MAIN_SECRET;

// Curve 180 WC product ID — find it first
const auth = Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString('base64');

// Search for Curve 180
const searchRes = await fetch(`${WC_URL}/wp-json/wc/v3/products?search=Curve+180&per_page=5`, {
  headers: { Authorization: `Basic ${auth}` }
});
const products = await searchRes.json();
console.log('Found products:', products.map(p => ({ id: p.id, name: p.name, variations: p.variations?.length })));

if (products.length === 0) process.exit(0);

// Get the main Curve 180 (not variants)
const mainProduct = products.find(p => p.name === 'Curve 180') || products[0];
console.log('\nMain product ID:', mainProduct.id, 'name:', mainProduct.name);
console.log('Attributes:', mainProduct.attributes?.map(a => ({ name: a.name, options: a.options })));

// Fetch all variations
let page = 1;
let allVariations = [];
while (true) {
  const res = await fetch(`${WC_URL}/wp-json/wc/v3/products/${mainProduct.id}/variations?per_page=100&page=${page}`, {
    headers: { Authorization: `Basic ${auth}` }
  });
  const vars = await res.json();
  if (!vars.length) break;
  allVariations = [...allVariations, ...vars];
  if (vars.length < 100) break;
  page++;
}

console.log('\nTotal variations from WC API:', allVariations.length);

// Show attribute groups
const attrValues = {};
allVariations.forEach(v => {
  v.attributes?.forEach(a => {
    if (!attrValues[a.name]) attrValues[a.name] = new Set();
    attrValues[a.name].add(a.option);
  });
});
console.log('\nAttribute groups:');
Object.entries(attrValues).forEach(([k, v]) => {
  console.log(`  ${k} (${v.size} values):`, [...v]);
});
