/**
 * Inspect a single WooCommerce variation to see image, gallery, and COG fields
 */
import 'dotenv/config';

const WC_URL = process.env.WC_MAIN_URL || 'https://coveinterior.com';
const WC_KEY = process.env.WC_MAIN_KEY;
const WC_SECRET = process.env.WC_MAIN_SECRET;

async function wcGet(path) {
  const url = new URL(`/wp-json/wc/v3/${path}`, WC_URL);
  const creds = Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString('base64');
  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Basic ${creds}` }
  });
  if (!resp.ok) throw new Error(`WC API error ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

// Curve 180 product ID = 12425
const variations = await wcGet('products/12425/variations?per_page=2');
for (const v of variations) {
  console.log('\n=== Variation', v.id, '===');
  console.log('Keys:', Object.keys(v).join(', '));
  console.log('image:', JSON.stringify(v.image?.src || null));
  console.log('meta_data count:', v.meta_data?.length);
  // Print all meta keys
  if (v.meta_data) {
    for (const m of v.meta_data) {
      console.log(`  meta [${m.key}]:`, JSON.stringify(m.value)?.slice(0, 200));
    }
  }
}
