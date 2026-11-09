// 数据迁移：am_database（旧平台，含种子+测试数据）→ dispatch_app（订单派发应用）
// 转换规则见《任务二拆解 V2.1》与首页 PRD 第 6 章
// 运行：node db/migrate-dispatch.mjs
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import crypto from 'node:crypto';

dotenv.config();

const src = await mysql.createConnection({ // 源库
  host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
  database: 'am_database', charset: 'utf8mb4', dateStrings: true,
});
const dst = await mysql.createConnection({ // 目标库（多重试，等 schema 建好）
  host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
  database: 'dispatch_app', charset: 'utf8mb4', multipleStatements: true, dateStrings: true,
});

const hash = (s) => '0x' + crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 40);
const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];
const dayOffset = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const fmt = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

// ---------- 1. 读取源数据 ----------
const [equipRows] = await src.query('SELECT * FROM equipment');
const [orderRows] = await src.query('SELECT * FROM orders');
const [matRows] = await src.query('SELECT id, material_code FROM materials');
const matByCode = Object.fromEntries(matRows.map((m) => [m.material_code, m.id]));
console.log(`源数据：设备 ${equipRows.length} 台，订单 ${orderRows.length} 单，材料 ${matRows.length} 种`);

// ---------- 2. 节点：按 nodeLocation 聚合设备 ----------
const locScene = (loc) => (loc.includes('舰') ? '舰' : loc.includes('岛礁') ? '岛' : '岸');
const byLoc = new Map();
for (const e of equipRows) {
  const loc = (e.node_location || '上海基地').trim();
  if (!byLoc.has(loc)) byLoc.set(loc, []);
  byLoc.get(loc).push(e);
}
const nodeRows = [];
const nodeMeta = []; // { nodeId, load }
const equipOfNode = new Map(); // equip_id -> node_id
let ni = 1;
for (const [loc, equips] of byLoc) {
  const nodeId = `NOD-${String(ni).padStart(3, '0')}`;
  const online = equips.filter((e) => e.equipment_status !== '维护中').length;
  const load = Math.min(95, 25 + equips.length * 12 + (ni * 7) % 20);
  nodeMeta.push({ nodeId, load });
  const cleanLoc = loc.replace(/生产基地?-/, '').replace(/基地$/, '');
  nodeRows.push([
    nodeId, `did:am:node:${String(ni).padStart(4, '0')}`,
    ni === 1 ? 1 : 2, `${cleanLoc} · ${ni === 1 ? '调度中心' : '制造节点'}`,
    loc, locScene(loc), '在线', equips.length, online, load,
    fmt(new Date(Date.now() - ni * 4000)),
    JSON.stringify({ workshops: equips.length, maxBuild: Math.max(...equips.map((e) => e.build_size_x)) }),
  ]);
  equips.forEach((e) => equipOfNode.set(e.id, nodeId));
  ni++;
}
await dst.query('DELETE FROM node_registry');
for (const r of nodeRows) {
  await dst.query('INSERT INTO node_registry (node_id,did,node_type,node_name,location,scene,status,device_count,device_online,load_rate,last_heartbeat,capacity_profile) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', r);
}
// 补充演示用"某舰节点"（旧数据无舰场景，首页原型含此节点）
{
  const nodeId = 'NOD-010';
  nodeMeta.push({ nodeId, load: 30 });
  await dst.query(
    'INSERT INTO node_registry (node_id,did,node_type,node_name,location,scene,status,device_count,device_online,load_rate,last_heartbeat,capacity_profile) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [nodeId, 'did:am:node:0010', 2, '某舰节点 · 应急制造', '某舰', '舰', '在线', 1, 1, 30, fmt(new Date(Date.now() - 21000)), JSON.stringify({ desktop: true, weakNetwork: true })]
  );
}
console.log(`✓ node_registry: ${nodeRows.length + 1} 个节点（含某舰演示节点）`);

// ---------- 3. 设备台账 ----------
await dst.query('DELETE FROM equipment');
for (const e of equipRows) {
  const seed = parseInt(crypto.createHash('md5').update(e.id).digest('hex').slice(0, 6), 16);
  await dst.query('INSERT INTO equipment (equip_id,node_id,equip_name,equip_type,build_size_x,laser_max_power,protocol,online,status) VALUES (?,?,?,?,?,?,?,?,?)', [
    e.id, equipOfNode.get(e.id), e.equipment_name,
    /FS|SLM/i.test(e.equipment_name) ? 'SLM' : /EOS/i.test(e.equipment_name) ? 'LPBF' : pick(['SLM', 'LPBF', 'EBM'], seed),
    e.build_size_x, e.laser_max_power, pick(['OPC_UA', 'OPC_UA', 'MODBUS'], seed),
    e.equipment_status === '维护中' ? 0 : 1, e.equipment_status,
  ]);
}
// 舰载演示设备（须在批量清空之后插入）
await dst.query('INSERT INTO equipment (equip_id,node_id,equip_name,equip_type,build_size_x,laser_max_power,protocol,online,status) VALUES (?,?,?,?,?,?,?,?,?)',
  ['equip-ship-01', 'NOD-010', '桌面级3D打印机(舰载)', 'SLM', 150, 200, 'MODBUS', 1, '运行中']);
console.log(`✓ equipment: ${equipRows.length + 1} 台`);

// ---------- 4. 订单 → 需求单 / 派发订单 / 任务 / 候选 / 合约 / 事件 ----------
// 旧状态 → 新状态映射
const statusMap = {
  '待匹配': '待派单', '已匹配': '已派单', '已排产': '已派单',
  '生产中': '生产中', '已完成': null, // 已完成按序号轮转分配到 质检中/已交付/已归档
};
const doneStates = ['质检中', '已交付', '已归档'];
let doneIdx = 0;

await dst.query('DELETE FROM order_event'); await dst.query('DELETE FROM contract_space');
await dst.query('DELETE FROM dispatch_candidate'); await dst.query('DELETE FROM production_task');
await dst.query('DELETE FROM dispatch_order'); await dst.query('DELETE FROM demand_order');

const eventChain = { // 状态对应的事件链（生成 order_event）
  '待派单': ['创建', '受理'],
  '已派单': ['创建', '受理', '派单', '接单'],
  '生产中': ['创建', '受理', '派单', '接单', '开工'],
  '质检中': ['创建', '受理', '派单', '接单', '开工', '报工'],
  '已交付': ['创建', '受理', '派单', '接单', '开工', '报工', '质检', '交付'],
  '已归档': ['创建', '受理', '派单', '接单', '开工', '报工', '质检', '交付', '归档'],
};

let csCount = 0, taskCount = 0, candCount = 0, eventCount = 0;
for (let i = 0; i < orderRows.length; i++) {
  const o = orderRows[i];
  const seed = parseInt(crypto.createHash('md5').update(o.id).digest('hex').slice(0, 6), 16);
  const createdAt = new Date(dayOffset(-30 + i));
  const demandId = `DEM-${createdAt.toISOString().slice(0, 10).replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`;
  const newStatus = statusMap[o.order_status] || doneStates[(doneIdx++) % 3];
  const matched = !!o.matched_equipment_id;
  const progress = newStatus === '生产中' ? 20 + (seed % 70) : ['质检中', '已交付', '已归档'].includes(newStatus) ? 100 : 0;
  const abnormal = seed % 11 === 0 && newStatus === '生产中' ? 1 : 0;

  // 需求单（场景按确定性规则分布，保证舰/岛/岸页签都有数据）
  const scene = seed % 9 === 0 ? '舰' : seed % 7 === 0 ? '岛' : '岸';
  await dst.query(
    'INSERT INTO demand_order (demand_id,source_type,scene,part_desc,matched_part_id,material_code,quantity,priority,deadline,status,attachments,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [demandId, (seed % 3) + 1, scene, o.order_name, o.part_id, '', o.quantity, o.priority,
     fmt(dayOffset(10 + (seed % 20))), '已受理', null, '王工程师', fmt(createdAt)]
  );
  // 派发订单
  await dst.query(
    'INSERT INTO dispatch_order (order_id,demand_id,contract_space_id,part_id,material_id,quantity,priority,status,progress,required_delivery,delivered_at,abnormal_flag,latest_event_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [o.id, demandId, matched || newStatus !== '待派单' ? `CS-${createdAt.toISOString().slice(0, 10).replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}` : null,
     o.part_id, matByCode['316L'] || 'mat-001', o.quantity, o.priority, newStatus, progress,
     fmt(dayOffset(10 + (seed % 20))), ['已交付', '已归档'].includes(newStatus) ? fmt(dayOffset(-2)) : null,
     abnormal, fmt(new Date(Date.now() - (seed % 3600) * 1000))]
  );
  // 节点任务（已匹配且状态>=已派单）
  if (matched && newStatus !== '待派单') {
    const nodeId = equipOfNode.get(o.matched_equipment_id) || 'NOD-001';
    const taskStatus = newStatus === '已派单' ? '已接受' : ['质检中', '已交付', '已归档'].includes(newStatus) ? '已完成' : '执行中';
    await dst.query(
      'INSERT INTO production_task (task_id,order_id,node_id,equip_id,seq,status,respond_deadline,planned_start,planned_end,progress_reported,process_params) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [`TSK-${String(i + 1).padStart(4, '0')}`, o.id, nodeId, o.matched_equipment_id, 1, taskStatus,
       fmt(new Date(createdAt.getTime() + 11 * 60000)), o.schedule_info?.scheduleStartTime || null, o.schedule_info?.scheduleEndTime || null,
       progress, JSON.stringify(o.process_parameters || {})]
    );
    taskCount++;
  }
  // 派单候选（待派单/已派单：3 个候选）
  if (newStatus === '待派单' || newStatus === '已派单') {
    const start = seed % nodeMeta.length; // 候选随订单轮转，避免每单都是同样三个节点
    const cands = [0, 1, 2].map((k) => nodeMeta[(start + k) % nodeMeta.length]);
    let rank = 1;
    for (const n of cands) {
      const isWinner = matched && equipOfNode.get(o.matched_equipment_id) === n.nodeId;
      const score = isWinner ? 88 - (rank - 1) * 2 : 76 - rank * 5 - (seed % 5);
      await dst.query(
        'INSERT INTO dispatch_candidate (candidate_id,order_id,node_id,score,reason,rank_no,created_at) VALUES (?,?,?,?,?,?,?)',
        [`CND-${o.id}-${rank}`, o.id, n.nodeId, Math.max(55, score),
         JSON.stringify({ material: 30, load: n.load < 70 ? 20 : 10, proximity: 15, qualification: 20 - rank }), rank, fmt(new Date(createdAt.getTime() + 60000))]
      );
      rank++; candCount++;
    }
  }
  // 合约空间（状态>=已派单）
  if (newStatus !== '待派单') {
    const csId = `CS-${createdAt.toISOString().slice(0, 10).replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`;
    const csState = newStatus === '已归档' ? '已归档' : newStatus === '已交付' ? '待归档' : '履约中';
    await dst.query(
      'INSERT INTO contract_space (cs_id,order_id,state,members,policy_hash,chain_addr,created_at,archived_at) VALUES (?,?,?,?,?,?,?,?)',
      [csId, o.id, csState, JSON.stringify(['did:am:node:0001', 'did:am:node:0002', 'did:am:node:0003'].slice(0, 2 + (seed % 2))),
       hash(csId), `chain:am:contract:${csId}`, fmt(new Date(createdAt.getTime() + 300000)), csState === '已归档' ? fmt(dayOffset(-1)) : null]
    );
    csCount++;
  }
  // 订单事件
  const chain = eventChain[newStatus] || ['创建', '受理'];
  for (let k = 0; k < chain.length; k++) {
    const at = new Date(createdAt.getTime() + k * 3600000 * (2 + (seed % 3)));
    await dst.query(
      'INSERT INTO order_event (event_id,order_id,event_type,payload,tx_hash,occurred_at,actor_did) VALUES (?,?,?,?,?,?,?)',
      [`EVT-${o.id}-${String(k).padStart(2, '0')}`, o.id, chain[k],
       JSON.stringify({ note: `订单${chain[k]}` }), ['派单', '交付', '归档'].includes(chain[k]) ? hash(o.id + chain[k]) : null,
       fmt(at), k === 0 ? 'did:am:user:001' : 'did:am:node:0001']
    );
    eventCount++;
  }
}

console.log(`✓ demand_order: ${orderRows.length} 单`);
console.log(`✓ dispatch_order: ${orderRows.length} 单（七态：待派单 ${orderRows.filter(o => statusMap[o.order_status] === '待派单').length}）`);
console.log(`✓ production_task: ${taskCount} 条`);
console.log(`✓ dispatch_candidate: ${candCount} 条`);
console.log(`✓ contract_space: ${csCount} 条`);
console.log(`✓ order_event: ${eventCount} 条（含链上存证 tx_hash）`);

// ---------- 5. 汇总校验 ----------
const [statusAgg] = await dst.query('SELECT status, COUNT(*) c FROM dispatch_order GROUP BY status ORDER BY c DESC');
console.log('订单状态分布:', statusAgg.map((r) => `${r.status}:${r.c}`).join(' / '));

await src.end(); await dst.end();
console.log('迁移完成：am_database → dispatch_app');
