import { getDb, getProducts } from "./server/db.ts";
import { products, warehouses, warehouseStock, productVariants } from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";
const db = await getDb();
const [p] = await db.select().from(products).where(eq(products.sku, "12774")).limit(1);
if (!p) { console.log(JSON.stringify({ found:false }, null, 2)); process.exit(0); }
const wh = await db.select().from(warehouses);
const variants = await db.select().from(productVariants).where(eq(productVariants.productId, p.id));
const stockRows = await db.select().from(warehouseStock).where(eq(warehouseStock.productId, p.id));
const onlineWh = wh.find(w => w.type === "online" || /online/i.test(w.name || ""));
const publicAll = await getProducts({ status:"active", limit:500, warehouseId: onlineWh?.id });
const appears = publicAll.items.some(x => x.sku === "12774" || x.id === p.id);
console.log(JSON.stringify({
  product: { id:p.id, name:p.name, sku:p.sku, status:p.status, type:p.type, stockStatus:p.stockStatus, manageStock:p.manageStock, stockQuantity:p.stockQuantity },
  onlineWarehouse: onlineWh ? { id: onlineWh.id, name: onlineWh.name, type: onlineWh.type } : null,
  warehouses: wh.map(w => ({ id:w.id, name:w.name, type:w.type })),
  variants: variants.map(v => ({ id:v.id, sku:v.sku, attributes:v.attributes, stockQuantity:v.stockQuantity, stockStatus:v.stockStatus, manageStock:v.manageStock })),
  stockRows: stockRows.map(s => ({ id:s.id, productId:s.productId, variantId:s.variantId, warehouseId:s.warehouseId, quantity:s.quantity, reservedQuantity:s.reservedQuantity, availableQuantity:s.availableQuantity })),
  appearsInOnlineFilteredList: appears,
  onlineFilteredTotal: publicAll.total,
  matchingOnlineFilteredItems: publicAll.items.filter(x => x.sku === "12774" || x.id === p.id).map(x => ({id:x.id,name:x.name,sku:x.sku}))
}, null, 2));
