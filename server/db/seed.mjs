// 种子数据：直接 import 前端 src/mock/ 下的 TS Mock，保证与原型数据完全一致
// 运行：npm run seed（通过 tsx 支持 TS 导入）
import { materials, parts, equipment, inspections, standards } from '../../src/mock/mockData.ts';
import { orders } from '../../src/mock/mockOrders.ts';
import { pool, getEntityConfig } from '../src/db.js';

async function insertEntity(name, list) {
  const cfg = getEntityConfig(name);
  // 清空后重灌，保证幂等
  await pool.query(`DELETE FROM ${cfg.table}`);
  for (const item of list) {
    await pool.query(cfg.insertSql, cfg.toRow(item));
  }
  console.log(`✓ ${name}: ${list.length} 条`);
}

async function main() {
  // 先清订单（有外键依赖 materials/parts）
  await pool.query('DELETE FROM orders');
  await insertEntity('materials', materials);
  await insertEntity('parts', parts);
  await insertEntity('equipment', equipment);
  await insertEntity('inspection', inspections);
  await insertEntity('standards', standards);
  await insertEntity('orders', orders);
  console.log('种子数据导入完成');
  await pool.end();
}

main().catch((err) => {
  console.error('种子数据导入失败：', err);
  process.exit(1);
});
