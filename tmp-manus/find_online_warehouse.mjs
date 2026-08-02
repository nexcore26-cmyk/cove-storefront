import { getDb } from "../server/db.js";
import { warehouses } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";

async function findOnlineWarehouse() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    return;
  }

  const [onlineWarehouse] = await db.select().from(warehouses).where(eq(warehouses.type, "online_store")).limit(1);

  if (onlineWarehouse) {
    console.log("Online Store Warehouse ID:", onlineWarehouse.id);
  } else {
    console.log("Online Store Warehouse not found.");
  }
  process.exit(0);
}

findOnlineWarehouse();
