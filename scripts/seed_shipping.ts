import 'dotenv/config';
import mysql from 'mysql2/promise';

// Shipping classes from WooCommerce DB
// Kuwait cost = flat per order, GCC cost = per unit × qty
const SHIPPING_CLASSES = [
  { name: 'Coffee Consoles KW', slug: 'coffee-consoles-kw', description: 'Coffee consoles - Kuwait delivery only, free shipping', kuwaitCost: '0.000', gccCostPerUnit: '0.000', kuwaitOnly: true },
  { name: 'R1 Shipping GCC', slug: 'r1-shipping-gcc', description: 'R1 size items', kuwaitCost: '2.000', gccCostPerUnit: '10.000', kuwaitOnly: false },
  { name: 'R2 Shipping GCC', slug: 'r2-shipping-gcc', description: 'R2 size items', kuwaitCost: '2.000', gccCostPerUnit: '13.000', kuwaitOnly: false },
  { name: 'R3 Shipping GCC', slug: 'r3-shipping-gcc', description: 'R3 size items', kuwaitCost: '2.000', gccCostPerUnit: '17.000', kuwaitOnly: false },
  { name: 'MR Shipping GCC', slug: 'mr-shipping-gcc', description: 'MR size items', kuwaitCost: '2.000', gccCostPerUnit: '9.000', kuwaitOnly: false },
  { name: 'TB Shipping GCC', slug: 'tb-shipping-gcc', description: 'TB size items', kuwaitCost: '2.000', gccCostPerUnit: '6.000', kuwaitOnly: false },
  { name: 'Trays', slug: 'trays', description: 'Trays', kuwaitCost: '2.000', gccCostPerUnit: '9.000', kuwaitOnly: false },
  { name: 'Mubkhar GCC', slug: 'mubkhar-gcc', description: 'Mubkhar items', kuwaitCost: '2.000', gccCostPerUnit: '7.000', kuwaitOnly: false },
  { name: 'Mubkhar N MR GCC', slug: 'mubkhar-n-mr-gcc', description: 'Mubkhar N MR items', kuwaitCost: '2.000', gccCostPerUnit: '9.000', kuwaitOnly: false },
  { name: 'Mubkhar N R1 GCC', slug: 'mubkhar-n-r1-gcc', description: 'Mubkhar N R1 items', kuwaitCost: '2.000', gccCostPerUnit: '14.000', kuwaitOnly: false },
  { name: 'Trash Bin Set GCC', slug: 'trash-bin-set-gcc', description: 'Trash bin sets', kuwaitCost: '2.000', gccCostPerUnit: '11.000', kuwaitOnly: false },
  { name: 'Trash Bin Single GCC', slug: 'trash-bin-single-gcc', description: 'Single trash bins', kuwaitCost: '2.000', gccCostPerUnit: '12.000', kuwaitOnly: false },
];

// Kuwait cities with surcharges (from WooCommerce checkout field editor)
// surcharge: 0 = no extra charge, 1 = +1 KWD on top of base 2 KWD
const KUWAIT_CITIES = [
  { cityName: 'Abbasiya', surcharge: '0.000', sortOrder: 1 },
  { cityName: 'Abdullah Al Mubarak', surcharge: '0.000', sortOrder: 2 },
  { cityName: 'Abdullah Al salim', surcharge: '0.000', sortOrder: 3 },
  { cityName: 'Abo hasanya', surcharge: '0.000', sortOrder: 4 },
  { cityName: 'Abu Fatira', surcharge: '0.000', sortOrder: 5 },
  { cityName: 'Abu Halifa', surcharge: '0.000', sortOrder: 6 },
  { cityName: 'Adailiya', surcharge: '0.000', sortOrder: 7 },
  { cityName: 'Al Bida\'a', surcharge: '0.000', sortOrder: 8 },
  { cityName: 'Al Nahda', surcharge: '0.000', sortOrder: 9 },
  { cityName: 'Al Rabia', surcharge: '0.000', sortOrder: 10 },
  { cityName: 'Al Rai', surcharge: '0.000', sortOrder: 11 },
  { cityName: 'Al Shadadiya', surcharge: '0.000', sortOrder: 12 },
  { cityName: 'Al Shuhada', surcharge: '0.000', sortOrder: 13 },
  { cityName: 'Al-Adan', surcharge: '0.000', sortOrder: 14 },
  { cityName: 'Al-Ahmadi', surcharge: '0.000', sortOrder: 15 },
  { cityName: 'Al-Daher', surcharge: '0.000', sortOrder: 16 },
  { cityName: 'Al-Dubaiya', surcharge: '0.000', sortOrder: 17 },
  { cityName: 'Al-Masayel', surcharge: '0.000', sortOrder: 18 },
  { cityName: 'Al-Mutlaa', surcharge: '1.000', sortOrder: 19 },
  { cityName: 'Al-Nuwaiseeb', surcharge: '0.000', sortOrder: 20 },
  { cityName: 'Al-Sabahiya', surcharge: '0.000', sortOrder: 21 },
  { cityName: 'Al-Siddeeq', surcharge: '0.000', sortOrder: 22 },
  { cityName: 'Al-Zoor', surcharge: '0.000', sortOrder: 23 },
  { cityName: 'Ali Subah Al-Salem', surcharge: '0.000', sortOrder: 24 },
  { cityName: 'Alrihab', surcharge: '0.000', sortOrder: 25 },
  { cityName: 'Andalous', surcharge: '0.000', sortOrder: 26 },
  { cityName: 'Anjafa', surcharge: '0.000', sortOrder: 27 },
  { cityName: 'Ardhiya', surcharge: '0.000', sortOrder: 28 },
  { cityName: 'Ashbeliah', surcharge: '0.000', sortOrder: 29 },
  { cityName: 'Bayan', surcharge: '0.000', sortOrder: 30 },
  { cityName: 'Bneid Al Qar', surcharge: '0.000', sortOrder: 31 },
  { cityName: 'Daiya', surcharge: '0.000', sortOrder: 32 },
  { cityName: 'Dajeej', surcharge: '0.000', sortOrder: 33 },
  { cityName: 'Dasma', surcharge: '0.000', sortOrder: 34 },
  { cityName: 'Dasman', surcharge: '0.000', sortOrder: 35 },
  { cityName: 'Doha', surcharge: '0.000', sortOrder: 36 },
  { cityName: 'East Ahmadi', surcharge: '0.000', sortOrder: 37 },
  { cityName: 'Eqaila', surcharge: '0.000', sortOrder: 38 },
  { cityName: 'Fahad Al-Ahmad', surcharge: '0.000', sortOrder: 39 },
  { cityName: 'Fahaheel', surcharge: '0.000', sortOrder: 40 },
  { cityName: 'Faiha', surcharge: '0.000', sortOrder: 41 },
  { cityName: 'Farwaniya', surcharge: '0.000', sortOrder: 42 },
  { cityName: 'Ferdous', surcharge: '0.000', sortOrder: 43 },
  { cityName: 'Fintas', surcharge: '0.000', sortOrder: 44 },
  { cityName: 'Fnaitees', surcharge: '0.000', sortOrder: 45 },
  { cityName: 'Ghornata', surcharge: '0.000', sortOrder: 46 },
  { cityName: 'Hadiya', surcharge: '0.000', sortOrder: 47 },
  { cityName: 'Hateen', surcharge: '0.000', sortOrder: 48 },
  { cityName: 'Hawally', surcharge: '0.000', sortOrder: 49 },
  { cityName: 'International Airport', surcharge: '0.000', sortOrder: 50 },
  { cityName: 'Ishbiliya', surcharge: '0.000', sortOrder: 51 },
  { cityName: 'Jaber Al Ahmad', surcharge: '0.000', sortOrder: 52 },
  { cityName: 'Jaber Al Ali', surcharge: '0.000', sortOrder: 53 },
  { cityName: 'Jabriya', surcharge: '0.000', sortOrder: 54 },
  { cityName: 'Jahra', surcharge: '1.000', sortOrder: 55 },
  { cityName: 'Jleeb Al Shyoukh', surcharge: '0.000', sortOrder: 56 },
  { cityName: 'Julaia', surcharge: '0.000', sortOrder: 57 },
  { cityName: 'Kabd', surcharge: '1.000', sortOrder: 58 },
  { cityName: 'Kaifan', surcharge: '0.000', sortOrder: 59 },
  { cityName: 'Khairan', surcharge: '1.000', sortOrder: 60 },
  { cityName: 'Khaitan', surcharge: '0.000', sortOrder: 61 },
  { cityName: 'Khaldiya', surcharge: '0.000', sortOrder: 62 },
  { cityName: 'Kuwait City', surcharge: '0.000', sortOrder: 63 },
  { cityName: 'Mahboula', surcharge: '0.000', sortOrder: 64 },
  { cityName: 'Maidan Hawally', surcharge: '0.000', sortOrder: 65 },
  { cityName: 'Mangaf', surcharge: '0.000', sortOrder: 66 },
  { cityName: 'Mansouriya', surcharge: '0.000', sortOrder: 67 },
  { cityName: 'Messila', surcharge: '0.000', sortOrder: 68 },
  { cityName: 'Middle of Ahmadi', surcharge: '0.000', sortOrder: 69 },
  { cityName: 'Mina Al-Ahmadi', surcharge: '0.000', sortOrder: 70 },
  { cityName: 'Mina Doha', surcharge: '0.000', sortOrder: 71 },
  { cityName: 'Mirgab', surcharge: '0.000', sortOrder: 72 },
  { cityName: 'Mishref', surcharge: '0.000', sortOrder: 73 },
  { cityName: 'Mubarak Al Kabeer', surcharge: '0.000', sortOrder: 74 },
  { cityName: 'Mubarak Al-Abdullah (West Mishref)', surcharge: '0.000', sortOrder: 75 },
  { cityName: 'Mubarakiya', surcharge: '0.000', sortOrder: 76 },
  { cityName: 'Naeem', surcharge: '1.000', sortOrder: 77 },
  { cityName: 'Naseem', surcharge: '1.000', sortOrder: 78 },
  { cityName: 'New Wafra', surcharge: '0.000', sortOrder: 79 },
  { cityName: 'North Ahmadi', surcharge: '0.000', sortOrder: 80 },
  { cityName: 'Nugra', surcharge: '0.000', sortOrder: 81 },
  { cityName: 'Nuzha', surcharge: '0.000', sortOrder: 82 },
  { cityName: 'Omariah', surcharge: '0.000', sortOrder: 83 },
  { cityName: 'Oyoun', surcharge: '1.000', sortOrder: 84 },
  { cityName: 'Port of Shuaiba', surcharge: '0.000', sortOrder: 85 },
  { cityName: 'Qadsiya', surcharge: '0.000', sortOrder: 86 },
  { cityName: 'Qairawan', surcharge: '0.000', sortOrder: 87 },
  { cityName: 'Qasr', surcharge: '1.000', sortOrder: 88 },
  { cityName: 'Qibla', surcharge: '0.000', sortOrder: 89 },
  { cityName: 'Qortuba', surcharge: '0.000', sortOrder: 90 },
  { cityName: 'Qosour', surcharge: '0.000', sortOrder: 91 },
  { cityName: 'Qurain', surcharge: '0.000', sortOrder: 92 },
  { cityName: 'Rawda', surcharge: '0.000', sortOrder: 93 },
  { cityName: 'Riggae', surcharge: '0.000', sortOrder: 94 },
  { cityName: 'Riqqah', surcharge: '0.000', sortOrder: 95 },
  { cityName: 'Rumaithiya', surcharge: '0.000', sortOrder: 96 },
  { cityName: 'Saad AlAdullah', surcharge: '1.000', sortOrder: 97 },
  { cityName: 'Sabah Al Nasser', surcharge: '0.000', sortOrder: 98 },
  { cityName: 'Sabah Al Salem', surcharge: '0.000', sortOrder: 99 },
  { cityName: 'Sabah Al-Ahmad', surcharge: '1.000', sortOrder: 100 },
  { cityName: 'Sabah Al-Ahmad City', surcharge: '1.000', sortOrder: 101 },
  { cityName: 'Sabah Health Region', surcharge: '0.000', sortOrder: 102 },
  { cityName: 'Sabhan', surcharge: '0.000', sortOrder: 103 },
  { cityName: 'Sabhan Industrial Area', surcharge: '0.000', sortOrder: 104 },
  { cityName: 'Salam', surcharge: '0.000', sortOrder: 105 },
  { cityName: 'Salhiya', surcharge: '0.000', sortOrder: 106 },
  { cityName: 'Salmiya', surcharge: '0.000', sortOrder: 107 },
  { cityName: 'Salwa', surcharge: '0.000', sortOrder: 108 },
  { cityName: 'Sawabir', surcharge: '0.000', sortOrder: 109 },
  { cityName: 'Shaab', surcharge: '0.000', sortOrder: 110 },
  { cityName: 'Shalayhat Al Dubaiya', surcharge: '0.000', sortOrder: 111 },
  { cityName: 'Shalehat Bneder', surcharge: '1.000', sortOrder: 112 },
  { cityName: 'Shalehat Mina Abdullah', surcharge: '0.000', sortOrder: 113 },
  { cityName: 'Shamiya', surcharge: '0.000', sortOrder: 114 },
  { cityName: 'Sharq', surcharge: '0.000', sortOrder: 115 },
  { cityName: 'Sheikh Saad Airport', surcharge: '0.000', sortOrder: 116 },
  { cityName: 'Shuwaikh', surcharge: '0.000', sortOrder: 117 },
  { cityName: 'Shuwaikh Administrative', surcharge: '0.000', sortOrder: 118 },
  { cityName: 'Shuwaikh Residential', surcharge: '0.000', sortOrder: 119 },
  { cityName: 'Souq Qurain', surcharge: '0.000', sortOrder: 120 },
  { cityName: 'South Ahmadi', surcharge: '0.000', sortOrder: 121 },
  { cityName: 'Sulaibikhat', surcharge: '0.000', sortOrder: 122 },
  { cityName: 'Sulaibiya', surcharge: '1.000', sortOrder: 123 },
  { cityName: 'Surra', surcharge: '0.000', sortOrder: 124 },
  { cityName: 'Taima', surcharge: '1.000', sortOrder: 125 },
  { cityName: 'Um Al Hayman', surcharge: '1.000', sortOrder: 126 },
  { cityName: 'Wafra', surcharge: '1.000', sortOrder: 127 },
  { cityName: 'Waha', surcharge: '1.000', sortOrder: 128 },
  { cityName: 'West Abdullah Al Mubarak', surcharge: '0.000', sortOrder: 129 },
  { cityName: 'West Abu Ftirah Hirafyia', surcharge: '0.000', sortOrder: 130 },
  { cityName: 'Yarmouk', surcharge: '0.000', sortOrder: 131 },
  { cityName: 'Zahra', surcharge: '0.000', sortOrder: 132 },
];

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  
  // Insert shipping classes
  console.log('Inserting shipping classes...');
  for (const sc of SHIPPING_CLASSES) {
    await conn.query(
      `INSERT INTO shipping_classes (name, slug, description, kuwaitCost, gccCostPerUnit, kuwaitOnly, isActive)
       VALUES (?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE name=VALUES(name), kuwaitCost=VALUES(kuwaitCost), gccCostPerUnit=VALUES(gccCostPerUnit), kuwaitOnly=VALUES(kuwaitOnly)`,
      [sc.name, sc.slug, sc.description, sc.kuwaitCost, sc.gccCostPerUnit, sc.kuwaitOnly ? 1 : 0]
    );
    console.log(`  [OK] ${sc.name}`);
  }
  
  // Insert Kuwait city surcharges
  console.log('\nInserting Kuwait city surcharges...');
  for (const city of KUWAIT_CITIES) {
    await conn.query(
      `INSERT INTO kuwait_city_surcharges (cityName, surcharge, isActive, sortOrder)
       VALUES (?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE surcharge=VALUES(surcharge), sortOrder=VALUES(sortOrder)`,
      [city.cityName, city.surcharge, city.sortOrder]
    );
  }
  console.log(`  [OK] ${KUWAIT_CITIES.length} cities inserted`);
  
  // Update product shippingClassId based on shippingClass slug
  console.log('\nLinking products to shipping classes...');
  const [classes]: any = await conn.query("SELECT id, slug FROM shipping_classes");
  const classMap: Record<string, number> = {};
  for (const c of classes) classMap[c.slug] = c.id;
  
  for (const [slug, id] of Object.entries(classMap)) {
    const [result]: any = await conn.query(
      "UPDATE products SET shippingClassId = ? WHERE shippingClass = ? AND shippingClassId IS NULL",
      [id, slug]
    );
    if (result.affectedRows > 0) {
      console.log(`  [OK] Linked ${result.affectedRows} products to "${slug}"`);
    }
  }
  
  // Check final counts
  const [scCount]: any = await conn.query("SELECT COUNT(*) as cnt FROM shipping_classes");
  const [cityCount]: any = await conn.query("SELECT COUNT(*) as cnt FROM kuwait_city_surcharges");
  const [linkedCount]: any = await conn.query("SELECT COUNT(*) as cnt FROM products WHERE shippingClassId IS NOT NULL");
  const [totalProducts]: any = await conn.query("SELECT COUNT(*) as cnt FROM products");
  
  console.log(`\nSummary:`);
  console.log(`  Shipping classes: ${scCount[0].cnt}`);
  console.log(`  Kuwait cities: ${cityCount[0].cnt}`);
  console.log(`  Products with shipping class: ${linkedCount[0].cnt} / ${totalProducts[0].cnt}`);
  
  await conn.end();
}

main().catch(console.error);
