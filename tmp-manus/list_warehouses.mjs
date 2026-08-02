import { getDb } from "../server/db.js";
import { warehouses } from "../drizzle/schema.js";

async function listWarehouses() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    return;
  }

  const allWarehouses = await db.select().from(warehouses);
  console.log("Warehouses:", allWarehouses);
  process.exit(0);
}

listWarehouses();
