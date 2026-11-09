// 需求单明细（1 需求 N 零部件/材料）迁移脚本
// 运行：node db/migrate-demand-items.mjs（幂等，可重复执行）
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: 'localhost', user: 'root', password: '', database: 'dispatch_app', charset: 'utf8mb4',
});

await conn.query(`
CREATE TABLE IF NOT EXISTS demand_item (
  item_id     VARCHAR(40) PRIMARY KEY,
  demand_id   VARCHAR(32) NOT NULL,
  seq         TINYINT NOT NULL DEFAULT 1,
  part_id     VARCHAR(32) NOT NULL,
  material_id VARCHAR(32) NOT NULL,
  quantity    INT NOT NULL DEFAULT 1,
  note        VARCHAR(255) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_item_demand (demand_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
console.log('✓ demand_item 表就绪');

// dispatch_order 增加 item_id（保留订单→明细的追溯关系）
const [cols] = await conn.query(
  `SELECT COLUMN_NAME FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA='dispatch_app' AND TABLE_NAME='dispatch_order' AND COLUMN_NAME='item_id'`);
if (!cols.length) {
  await conn.query('ALTER TABLE dispatch_order ADD COLUMN item_id VARCHAR(40) NULL AFTER demand_id');
  console.log('✓ dispatch_order.item_id 已新增');
} else {
  console.log('· dispatch_order.item_id 已存在');
}

// 存量回填：每个已有订单生成一条明细（若该需求尚无明细）
const [orders] = await conn.query(
  `SELECT o.order_id, o.demand_id, o.part_id, o.material_id, o.quantity
   FROM dispatch_order o
   WHERE NOT EXISTS (SELECT 1 FROM demand_item i WHERE i.demand_id = o.demand_id)`);
for (const o of orders) {
  const itemId = `DIT-${o.order_id.split('-').pop()}-1`;
  await conn.query(
    `INSERT IGNORE INTO demand_item (item_id, demand_id, seq, part_id, material_id, quantity, note, created_at)
     VALUES (?,?,1,?,?,?, '', NOW())`,
    [itemId, o.demand_id, o.part_id, o.material_id, o.quantity]);
  await conn.query('UPDATE dispatch_order SET item_id = ? WHERE order_id = ?', [itemId, o.order_id]);
}
console.log(`✓ 存量回填：${orders.length} 条订单 → 明细`);

const [[stat]] = await conn.query('SELECT COUNT(*) c FROM demand_item');
console.log(`✓ demand_item 总数：${stat.c}`);

await conn.end();
