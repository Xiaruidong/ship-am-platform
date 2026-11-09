// 订单派发应用 · 查询服务（dispatch_app）
// 六个首页区块 API + 静态原型托管
import express from 'express';
import mysql from 'mysql2/promise';
import mountNodeOps from './nodeOps.js';
import mountPrinter from './printer.js';

const pool = mysql.createPool({
  host: 'localhost', user: 'root', password: '',
  database: 'dispatch_app', charset: 'utf8mb4', dateStrings: true,
  connectionLimit: 8,
});

const app = express();
const router = express.Router();
app.use(express.json());

app.use('/api', router);
app.use('/dapi', router); // React 前端经 Vite 代理访问

// 跨域（原型联调用）
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

const q = async (sql, params = []) => (await pool.query(sql, params))[0];

// ---------- 1. KPI 汇总 ----------
router.get('/overview/kpi', async (_req, res) => {
  const [todayDemands, ystDemands, byStatus, delivered, abnormal] = await Promise.all([
    q("SELECT COUNT(*) c FROM demand_order WHERE created_at >= CURDATE()"),
    q("SELECT COUNT(*) c FROM demand_order WHERE created_at >= CURDATE() - INTERVAL 1 DAY AND created_at < CURDATE()"),
    q("SELECT status, COUNT(*) c FROM dispatch_order GROUP BY status"),
    q("SELECT COUNT(*) total, SUM(delivered_at <= required_delivery) ontime FROM dispatch_order WHERE delivered_at IS NOT NULL AND delivered_at >= CURDATE() - INTERVAL 30 DAY"),
    q("SELECT COUNT(*) c FROM dispatch_order WHERE abnormal_flag = 1 AND status IN ('生产中','已派单')"),
  ]);
  const s = Object.fromEntries(byStatus.map((r) => [r.status, r.c]));
  const rate = delivered[0].total ? ((delivered[0].ontime / delivered[0].total) * 100).toFixed(1) : '0.0';
  res.json({
    todayNewDemands: todayDemands[0].c,
    demandDelta: todayDemands[0].c - ystDemands[0].c,
    pendingDispatch: s['待派单'] || 0,
    inProduction: s['生产中'] || 0,
    inInspection: s['质检中'] || 0,
    onTimeRate: Number(rate),
    abnormal: abnormal[0].c,
  });
});

// ---------- 2. 订单列表（支持 优先级/场景/状态 筛选） ----------
router.get('/orders', async (req, res) => {
  const { priority, scene, status, limit = 12 } = req.query;
  const where = [];
  const params = [];
  if (priority && priority !== '全部') { where.push('d.priority = ?'); params.push(priority); }
  if (scene && scene !== '全部') { where.push('d.scene = ?'); params.push(scene); }
  if (status && status !== '全部') { where.push('o.status = ?'); params.push(status); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  params.push(Number(limit));
  const rows = await q(
    `SELECT o.order_id, d.part_desc AS order_name, d.scene, d.priority,
            m.material_name AS material, o.quantity, o.status, o.progress,
            n.node_name, o.required_delivery
     FROM dispatch_order o
     JOIN demand_order d ON o.demand_id = d.demand_id
     LEFT JOIN am_database.materials m ON o.material_id = m.id
     LEFT JOIN production_task t ON t.order_id = o.order_id AND t.seq = 1
     LEFT JOIN node_registry n ON t.node_id = n.node_id
     ${whereSql}
     ORDER BY FIELD(d.priority,'紧急','高','普通','低'), o.latest_event_at DESC
     LIMIT ?`, params);
  res.json(rows);
});

// ---------- 3. 节点列表 ----------
router.get('/nodes', async (_req, res) => {
  const rows = await q(
    `SELECT node_id, did, node_name, location, scene, status, device_count, device_online, load_rate, last_heartbeat
     FROM node_registry ORDER BY node_type, device_count DESC`);
  res.json(rows);
});

// ---------- 4. 派单候选 ----------
router.get('/candidates', async (req, res) => {
  const { order_id } = req.query;
  if (!order_id) return res.status(400).json({ error: 'order_id 必填' });
  const rows = await q(
    `SELECT c.node_id, n.node_name, c.score, c.reason, c.rank_no
     FROM dispatch_candidate c JOIN node_registry n ON c.node_id = n.node_id
     WHERE c.order_id = ? ORDER BY c.rank_no`, [order_id]);
  res.json(rows);
});

// ---------- 5. 合约空间 ----------
router.get('/contracts', async (_req, res) => {
  const [stats, list] = await Promise.all([
    q("SELECT SUM(state='履约中') active_, SUM(state='待归档') pending_archive, COUNT(*) total FROM contract_space"),
    q(`SELECT cs.cs_id, d.part_desc AS name, cs.state
        FROM contract_space cs JOIN dispatch_order o ON cs.order_id = o.order_id
        JOIN demand_order d ON o.demand_id = d.demand_id
        ORDER BY FIELD(cs.state,'待归档','履约中'), cs.created_at DESC LIMIT 5`),
  ]);
  // 链上存证数 = 带哈希的存证事件数（演示口径）
  const [evc] = await q("SELECT COUNT(*) c FROM order_event WHERE tx_hash IS NOT NULL");
  res.json({
    active: stats[0].active_ || 0,
    pendingArchive: stats[0].pending_archive || 0,
    onchainTotal: evc.c,
    list,
  });
});

// ---------- 6. 协同动态 ----------
router.get('/events', async (req, res) => {
  const limit = Number(req.query.limit || 9);
  const rows = await q(
    `SELECT e.event_type, e.occurred_at, e.tx_hash,
            d.part_desc AS order_name, n.node_name
     FROM order_event e
     JOIN dispatch_order o ON e.order_id = o.order_id
     JOIN demand_order d ON o.demand_id = d.demand_id
     LEFT JOIN node_registry n ON e.actor_did = n.did
     WHERE e.event_type IN ('接单','开工','报工','质检','交付','归档','派单')
     ORDER BY e.occurred_at DESC LIMIT ?`, [limit]);
  res.json(rows);
});

// ---------- 6.5 确认派单（写操作：订单/任务/合约/事件联动落库） ----------
import crypto from 'node:crypto';
const sha = (s) => '0x' + crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 40);

router.post('/orders/:id/dispatch', async (req, res) => {
  const { id } = req.params;
  const { node_id } = req.body || {};
  if (!node_id) return res.status(400).json({ error: 'node_id 必填' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[order]] = await conn.query(
      `SELECT o.order_id, o.demand_id, o.status, d.priority FROM dispatch_order o
       JOIN demand_order d ON o.demand_id = d.demand_id WHERE o.order_id = ? FOR UPDATE`, [id]);
    if (!order) { await conn.rollback(); return res.status(404).json({ error: '订单不存在' }); }
    if (order.status !== '待派单') { await conn.rollback(); return res.status(400).json({ error: `订单当前状态为「${order.status}」，仅待派单订单可派单` }); }
    const [[node]] = await conn.query('SELECT * FROM node_registry WHERE node_id = ?', [node_id]);
    if (!node) { await conn.rollback(); return res.status(400).json({ error: '节点不存在' }); }
    const [equips] = await conn.query('SELECT equip_id FROM equipment WHERE node_id = ? AND online = 1 LIMIT 1', [node_id]);
    const equipId = equips[0]?.equip_id || '';

    // 1. 合约空间创建（链上地址与策略哈希模拟生成）
    const now = new Date();
    const csSuffix = sha(id).slice(2, 10); // 订单号哈希后缀，避免不同订单号尾段相同导致主键冲突
    const csId = `CS-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${csSuffix}`;
    await conn.query(
      `INSERT INTO contract_space (cs_id, order_id, state, members, policy_hash, chain_addr, created_at)
       VALUES (?,?,?,?,?,?,NOW())`,
      [csId, id, '履约中', JSON.stringify(['did:am:user:001', node.did]), sha(csId), `chain:am:contract:${csId}`]);

    // 2. 订单状态 → 已派单，绑定合约
    await conn.query(
      `UPDATE dispatch_order SET status = '已派单', contract_space_id = ?, latest_event_at = NOW() WHERE order_id = ?`, [csId, id]);

    // 3. 生成节点任务（响应截止 10 分钟，等待节点应答）
    const plannedStart = new Date(now.getTime() + 86400000);
    const plannedEnd = new Date(now.getTime() + 86400000 * 3);
    const taskId = `TSK-${csSuffix}`;
    await conn.query(
      `INSERT INTO production_task (task_id, order_id, node_id, equip_id, seq, status, respond_deadline, planned_start, planned_end, progress_reported)
       VALUES (?,?,?,?,1,'待应答',DATE_ADD(NOW(), INTERVAL 10 MINUTE),?,?,0)`,
      [taskId, id, node_id, equipId, plannedStart.toISOString().slice(0, 10), plannedEnd.toISOString().slice(0, 10)]);

    // 4. 派单事件上链（接单事件由节点在工作台确认后产生）
    await conn.query(
      `INSERT INTO order_event (event_id, order_id, event_type, payload, tx_hash, occurred_at, actor_did)
       VALUES (?,?,?,?,?,NOW(),'did:am:user:001')`,
      [`EVT-${id}-D1`, id, '派单', JSON.stringify({ node: node.node_name, contract: csId }), sha(id + '派单')]);

    await conn.commit();
    res.json({ ok: true, order_id: id, contract_space_id: csId, task_id: taskId, node: node.node_name });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});
router.get('/overview/meta', async (_req, res) => {
  const [nodes] = await q("SELECT COUNT(*) c FROM node_registry WHERE status='在线'");
  // 模拟区块高度 = 存证事件数 + 基数
  const [evc] = await q("SELECT COUNT(*) c FROM order_event WHERE tx_hash IS NOT NULL");
  res.json({
    asOf: new Date().toISOString().slice(0, 19).replace('T', ' '),
    onlineNodes: nodes.c,
    blockHeight: 1284207 + evc.c,
  });
});

// ---------- 6.6 AI 需求匹配助手 ----------
// 输入自然语言 → 解析意图 → 匹配 零部件/原材料/设备/节点 → 返回完整数据链
// 配置了 LLM 则用大模型解析意图，未配置或失败时回退规则匹配

const URGENT_WORDS = ['紧急', '急', '尽快', '马上', '立即', '抢修', '应急', '断货'];
const SCENE_RULES = [
  ['舰', ['舰', '船上', '海上', '航行', '远海']],
  ['岛', ['岛', '岛礁', '驻守']],
  ['岸', ['基地', '岸', '船厂', '码头', '车间']],
];

// 中文关键词提取：从文本里找出库中实体名（去掉"测试/编号"等噪声后取核心词）
function extractKeyword(text, names) {
  let best = null;
  for (const n of names) {
    const core = String(n)
      .replace(/测试零件\d+-?/g, '')
      .replace(/测试\d+/g, '')
      .replace(/-测试\d+/g, '')
      .replace(/[（(].*?[)）]/g, '')
      .trim();
    if (core.length >= 2 && text.includes(core)) {
      if (!best || core.length > best.core.length) best = { name: n, core };
    }
  }
  return best;
}

async function ruleParse(text) {
  const parts = await q('SELECT id, part_name, category_name, oem_part_number, original_material_code FROM am_database.parts');
  const materials = await q('SELECT id, material_name, material_code, material_category, material_sub_category, average_particle_size FROM am_database.materials');
  const partHit = extractKeyword(text, parts.map((p) => p.part_name));
  // 材料：牌号 / 名称 / 大类关键词
  const matHit = materials.find((m) => text.toUpperCase().includes(String(m.material_code).toUpperCase()))
    || extractKeyword(text, materials.map((m) => m.material_name))
    || materials.find((m) => text.includes(m.material_category) || text.includes(m.material_sub_category));
  const qtyMatch = text.match(/(\d+)\s*(件|个|套|只|台)/);
  return {
    source: 'rule',
    partKeyword: partHit?.core || '',
    partId: partHit ? parts.find((p) => p.part_name === partHit.name)?.id : undefined,
    materialKeyword: matHit ? matHit.material_code : '',
    materialId: matHit?.id,
    quantity: qtyMatch ? Number(qtyMatch[1]) : 1,
    urgency: URGENT_WORDS.some((w) => text.includes(w)) ? '紧急' : '普通',
    scene: SCENE_RULES.find(([, kws]) => kws.some((w) => text.includes(w)))?.[0] || '岸',
    summary: text.slice(0, 80),
  };
}

async function llmParse(text, llm) {
  const res = await fetch(`${llm.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${llm.apiKey}` },
    body: JSON.stringify({
      model: llm.model || 'deepseek-chat',
      temperature: 0,
      messages: [
        { role: 'system', content: '你是船舶增材制造维修助手。从用户描述中提取结构化信息，只输出 JSON，不要解释。字段：partKeyword(零部件中文名，如 缸体/叶轮/法兰), materialKeyword(材料牌号，如 316L/IN718，无则空串), quantity(整数), urgency(紧急或普通), scene(舰/岛/岸), summary(一句话概述)。' },
        { role: 'user', content: text },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  const jsonText = content.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(jsonText);
  return { ...parsed, source: 'llm' };
}

async function matchChain(intent) {
  const parts = await q('SELECT id, part_name, category_name, oem_part_number, original_material_code, model_file_path FROM am_database.parts');
  const materials = await q('SELECT id, material_name, material_code, material_category, material_sub_category, average_particle_size, hall_flow, supplier FROM am_database.materials');
  const equipment = await q(
    `SELECT e.equip_id, e.equip_name, e.equip_type, e.build_size_x, e.laser_max_power, e.status, e.online,
            n.node_id, n.node_name, n.location, n.load_rate, n.scene
     FROM equipment e JOIN node_registry n ON e.node_id = n.node_id
     WHERE e.online = 1 ORDER BY n.load_rate ASC, e.laser_max_power DESC`);
  const nodes = await q('SELECT node_id, node_name, location, scene, load_rate, device_count, status FROM node_registry ORDER BY load_rate ASC');

  // 零部件匹配：优先精确关键词，其次模糊包含
  const kw = String(intent.partKeyword || '').trim();
  let part = kw ? parts.find((p) => p.part_name.includes(kw)) : undefined;
  if (!part && intent.partId) part = parts.find((p) => p.id === intent.partId);
  const partAlts = kw ? parts.filter((p) => p !== part && p.part_name.includes(kw)).slice(0, 3) : parts.slice(0, 3);

  // 原材料匹配：优先指定牌号；否则用零部件原始材料牌号；再否则按牌号前缀
  const mkw = String(intent.materialKeyword || '').trim().toUpperCase();
  let material = mkw ? materials.find((m) => String(m.material_code).toUpperCase() === mkw)
    || materials.find((m) => String(m.material_code).toUpperCase().includes(mkw)) : undefined;
  if (!material && part?.original_material_code) {
    const orig = String(part.original_material_code);
    material = materials.find((m) => String(m.material_code).toUpperCase() === orig.toUpperCase());
    if (!material) {
      // 近似匹配：原始牌号包含库内牌号，或同大类兜底
      material = materials.find((m) => orig.toUpperCase().includes(String(m.material_code).toUpperCase()));
    }
    if (!material) {
      const catRule = [
        ['铁基', /铸铁|铸钢|钢|HT|QT/], ['钛', /钛|Ti/], ['铝', /铝|Al/], ['镍', /镍|Inconel|IN/],
      ].find(([, re]) => re.test(orig));
      if (catRule) material = materials.find((m) => m.material_category.includes(catRule[0]));
      if (material) material = { ...material, suggested: true };
    }
  }
  const materialAlts = mkw
    ? materials.filter((m) => m !== material && (String(m.material_code).toUpperCase().includes(mkw) || m.material_name.includes(mkw))).slice(0, 3)
    : materials.filter((m) => m !== material && (!part || m.material_code === part.original_material_code)).slice(0, 3);

  // 节点选择：只在"有在线设备"的节点中选，优先匹配场景（舰/岛/岸），场景内按负荷升序
  const nodesWithEquip = new Set(equipment.map((e) => e.node_id));
  const usable = nodes.filter((n) => nodesWithEquip.has(n.node_id));
  const sceneNodes = usable.filter((n) => n.scene === intent.scene);
  const node = (sceneNodes.length ? sceneNodes : usable.length ? usable : nodes)[0];
  const nodeEquip = equipment.filter((e) => e.node_id === node?.node_id);
  const equip = nodeEquip[0] || equipment[0];
  const nodeAlts = nodes.filter((n) => n.node_id !== node?.node_id).slice(0, 3);

  const reasoning = [];
  reasoning.push(part ? `零部件识别：「${kw}」→ ${part.part_name}（${part.category_name}，OEM ${part.oem_part_number}）` : '未在零部件库匹配到对应模型，建议走模型设计流程');
  reasoning.push(material ? `原材料匹配：${material.material_name}（${material.material_code}，${material.material_category}，粒径 ${material.average_particle_size}μm）` : '未匹配到原材料，需人工确认牌号');
  reasoning.push(equip ? `设备匹配：${equip.equip_name}（${equip.equip_type}，激光 ${equip.laser_max_power}W，成形尺寸 ${equip.build_size_x}mm）` : '暂无在线设备');
  reasoning.push(node ? `节点推荐：${node.node_name}（${node.location}，当前负荷 ${node.load_rate}%，${node.device_count} 台设备）` : '暂无可用节点');
  reasoning.push(`约束：优先级 ${intent.urgency} · 场景 ${intent.scene} · 数量 ${intent.quantity}`);

  return {
    part: part || null,
    material: material || null,
    equipment: equip || null,
    node: node || null,
    alternatives: { parts: partAlts, materials: materialAlts, nodes: nodeAlts },
    reasoning,
  };
}

router.post('/ai/recommend', async (req, res, next) => {
  try {
    const { text, llm } = req.body || {};
    if (!text || !String(text).trim()) return res.status(400).json({ error: '请输入需求描述' });
    let intent;
    if (llm && llm.apiKey) {
      try {
        intent = await llmParse(String(text), llm);
      } catch (e) {
        console.warn('LLM 解析失败，回退规则匹配：', e.message);
        intent = await ruleParse(String(text));
        intent.source = 'rule(fallback)';
      }
    } else {
      intent = await ruleParse(String(text));
    }
    const chain = await matchChain(intent);
    res.json({ intent, chain });
  } catch (err) { next(err); }
});

// ---------- 6.7 订单详情（含存证时间线） ----------
router.get('/orders/:id/detail', async (req, res, next) => {
  try {
    const { id } = req.params;
    const [order] = await q(
      `SELECT o.order_id, o.status, o.progress, o.priority, o.quantity,
              o.required_delivery, o.delivered_at, o.contract_space_id, o.abnormal_flag, o.latest_event_at,
              d.demand_id, d.part_desc AS order_name, d.scene, d.source_type,
              m.material_name, m.material_code, m.material_category,
              cs.state AS contract_state, cs.members, cs.policy_hash, cs.chain_addr, cs.created_at AS contract_created_at, cs.archived_at,
              t.task_id, t.node_id, t.equip_id, t.status AS task_status, t.planned_start, t.planned_end, t.progress_reported, t.process_params,
              n.node_name, n.location AS node_location, n.did AS node_did
       FROM dispatch_order o
       JOIN demand_order d ON o.demand_id = d.demand_id
       LEFT JOIN am_database.materials m ON o.material_id = m.id
       LEFT JOIN contract_space cs ON o.contract_space_id = cs.cs_id
       LEFT JOIN production_task t ON t.order_id = o.order_id AND t.seq = 1
       LEFT JOIN node_registry n ON t.node_id = n.node_id
       WHERE o.order_id = ?`, [id]);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    const events = await q(
      `SELECT e.event_id, e.event_type, e.payload, e.tx_hash, e.occurred_at, e.actor_did,
              CASE WHEN e.actor_did LIKE 'did:am:node%' THEN n2.node_name ELSE '调度工程师' END AS actor_name
       FROM order_event e
       LEFT JOIN node_registry n2 ON e.actor_did = n2.did
       WHERE e.order_id = ? ORDER BY e.occurred_at ASC, e.event_id ASC`, [id]);
    res.json({ order, events });
  } catch (err) { next(err); }
});

// ---------- 6.8 订单状态流转（五态机 + 自动上链 + 合约联动） ----------
const compactId = (prefix = 'EVT') => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const TRANSITIONS = {
  '生产中': { from: ['已派单'], action: '开工', label: '开工', onchain: false,
    sql: 'UPDATE dispatch_order SET status = ?, latest_event_at = NOW(), progress = GREATEST(progress, 5) WHERE order_id = ?',
    extra: (conn, id) => conn.query("UPDATE production_task SET status = '执行中', progress_reported = GREATEST(progress_reported, 5) WHERE order_id = ? AND seq = 1", [id]) },
  '质检中': { from: ['生产中'], action: '完工报工', label: '完工报工', onchain: false,
    sql: 'UPDATE dispatch_order SET status = ?, progress = 100, latest_event_at = NOW() WHERE order_id = ?',
    extra: (conn, id) => conn.query("UPDATE production_task SET status = '已完成', progress_reported = 100 WHERE order_id = ? AND seq = 1", [id]) },
  '已交付': { from: ['质检中'], action: '质检通过并交付', label: '交付', onchain: true,
    sql: 'UPDATE dispatch_order SET status = ?, delivered_at = NOW(), latest_event_at = NOW() WHERE order_id = ?',
    extra: (conn, id) => conn.query("UPDATE contract_space SET state = '待归档' WHERE order_id = ?", [id]) },
  '已归档': { from: ['已交付'], action: '归档（权限回收）', label: '归档', onchain: true,
    sql: 'UPDATE dispatch_order SET status = ?, latest_event_at = NOW() WHERE order_id = ?',
    extra: (conn, id) => conn.query("UPDATE contract_space SET state = '已归档', archived_at = NOW() WHERE order_id = ?", [id]) },
};

router.post('/orders/:id/transition', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const t = TRANSITIONS[status];
  if (!t) return res.status(400).json({ error: `非法目标状态：${status}（可用：${Object.keys(TRANSITIONS).join('/')}）` });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[order]] = await conn.query('SELECT order_id, status FROM dispatch_order WHERE order_id = ? FOR UPDATE', [id]);
    if (!order) { await conn.rollback(); return res.status(404).json({ error: '订单不存在' }); }
    if (!t.from.includes(order.status)) {
      await conn.rollback();
      return res.status(400).json({ error: `不允许从「${order.status}」流转到「${status}」（当前可流转至：${Object.entries(TRANSITIONS).filter(([, v]) => v.from.includes(order.status)).map(([k]) => k).join('/') || '终态'}）` });
    }
    await conn.query(t.sql, [status, id]);
    if (t.extra) await t.extra(conn, id);
    const txHash = t.onchain ? sha(id + status) : null;
    await conn.query(
      `INSERT INTO order_event (event_id, order_id, event_type, payload, tx_hash, occurred_at, actor_did)
       VALUES (?,?,?,?,?,NOW(),'did:am:user:001')`,
      [compactId('EVT'), id, t.action, JSON.stringify({ to: status, label: t.label }), txHash]);
    await conn.commit();
    res.json({ ok: true, order_id: id, status, tx_hash: txHash });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ---------- 6.9 需求单管理 ----------
// 列表（含关联订单状态与候选数）
router.get('/demands', async (req, res, next) => {
  try {
    const { status, scene, priority, source, limit = 50 } = req.query;
    const where = []; const params = [];
    if (status && status !== '全部') { where.push('d.status = ?'); params.push(status); }
    if (scene && scene !== '全部') { where.push('d.scene = ?'); params.push(scene); }
    if (priority && priority !== '全部') { where.push('d.priority = ?'); params.push(priority); }
    if (source && source !== '全部') { where.push('d.source_type = ?'); params.push(Number(source)); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    params.push(Number(limit));
    const rows = await q(
      `SELECT d.demand_id, d.source_type, d.scene, d.part_desc, d.priority,
              d.deadline, d.status AS demand_status, d.created_at,
              (SELECT COUNT(*) FROM demand_item i WHERE i.demand_id = d.demand_id) AS item_count,
              (SELECT GROUP_CONCAT(p2.part_name ORDER BY i2.seq SEPARATOR '、')
                 FROM demand_item i2 JOIN am_database.parts p2 ON i2.part_id = p2.id
                WHERE i2.demand_id = d.demand_id) AS parts,
              (SELECT COALESCE(SUM(i3.quantity), 0) FROM demand_item i3 WHERE i3.demand_id = d.demand_id) AS total_qty,
              (SELECT COUNT(*) FROM dispatch_order o2 WHERE o2.demand_id = d.demand_id) AS order_count,
              (SELECT COUNT(*) FROM dispatch_order o3 WHERE o3.demand_id = d.demand_id AND o3.status = '待派单') AS pending_orders,
              (SELECT o4.order_id FROM dispatch_order o4 WHERE o4.demand_id = d.demand_id ORDER BY o4.order_id LIMIT 1) AS order_id,
              (SELECT o5.status FROM dispatch_order o5 WHERE o5.demand_id = d.demand_id ORDER BY o5.order_id LIMIT 1) AS order_status,
              (SELECT COALESCE(SUM((SELECT COUNT(*) FROM dispatch_candidate c WHERE c.order_id = o6.order_id)), 0)
                 FROM dispatch_order o6 WHERE o6.demand_id = d.demand_id) AS cand_count
       FROM demand_order d
       ${whereSql}
       ORDER BY FIELD(d.priority,'紧急','高','普通','低'), d.created_at DESC
       LIMIT ?`, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// 创建需求单：联动生成待派单 + 评分候选 + 事件（创建/受理）
router.post('/demands', async (req, res) => {
  const b = req.body || {};
  // 兼容两种入参：items[]（多明细，推荐）或单 part_id/material_id/quantity（旧格式）
  const items = Array.isArray(b.items) && b.items.length
    ? b.items
    : (b.part_id && b.material_id ? [{ part_id: b.part_id, material_id: b.material_id, quantity: b.quantity || 1 }] : []);
  if (!b.order_name || !b.scene || !b.priority) return res.status(400).json({ error: '缺少必填项：需求描述/场景/优先级' });
  if (!items.length) return res.status(400).json({ error: '至少需要一条明细（零部件 + 原材料 + 数量）' });
  const bad = items.findIndex((it) => !it.part_id || !it.material_id || !(Number(it.quantity) > 0));
  if (bad >= 0) return res.status(400).json({ error: `第 ${bad + 1} 条明细缺少零部件、原材料或数量` });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // 校验全部明细的实体存在性
    for (const it of items) {
      const [p] = await conn.query('SELECT id FROM am_database.parts WHERE id = ?', [it.part_id]);
      const [m] = await conn.query('SELECT id, material_code FROM am_database.materials WHERE id = ?', [it.material_id]);
      if (!p.length || !m.length) { await conn.rollback(); return res.status(400).json({ error: '明细中存在不存在的零部件或材料' }); }
      it._materialCode = m[0].material_code;
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = String(Date.now()).slice(-6);
    const demandId = `DEM-${dateStr}-${seq}`;
    const deadline = b.deadline || new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    const totalQty = items.reduce((sum, it) => sum + Number(it.quantity), 0);

    // 1. 需求单主表（数量=明细合计，零部件字段保留首条便于旧查询兼容）
    await conn.query(
      `INSERT INTO demand_order (demand_id, source_type, scene, part_desc, matched_part_id, material_code, quantity, priority, deadline, status, attachments, created_by, created_at)
       VALUES (?,2,?,?,?,?,?,?,?, '已受理', ?, '王工程师', NOW())`,
      [demandId, b.scene, b.order_name, items[0].part_id, items[0]._materialCode, totalQty, b.priority, deadline, JSON.stringify({ note: b.note || '', itemCount: items.length })]);

    // 2. 逐条明细 → 明细表 + 待派单 + 评分候选 + 事件
    const [nodes] = await conn.query(
      `SELECT n.node_id, n.node_name, n.load_rate FROM node_registry n
       WHERE EXISTS (SELECT 1 FROM equipment e WHERE e.node_id = n.node_id AND e.online = 1)
       ORDER BY n.load_rate ASC LIMIT 3`);

    const orderIds = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const orderId = `ORD-${dateStr}-${seq}-${i + 1}`;
      const itemId = `DIT-${demandId.slice(-6)}-${i + 1}`;
      orderIds.push(orderId);

      await conn.query(
        `INSERT INTO demand_item (item_id, demand_id, seq, part_id, material_id, quantity, note)
         VALUES (?,?,?,?,?,?,?)`,
        [itemId, demandId, i + 1, it.part_id, it.material_id, Number(it.quantity), it.note || '']);

      await conn.query(
        `INSERT INTO dispatch_order (order_id, demand_id, item_id, part_id, material_id, quantity, priority, status, progress, required_delivery, latest_event_at)
         VALUES (?,?,?,?,?,?,?, '待派单', 0, ?, NOW())`,
        [orderId, demandId, itemId, it.part_id, it.material_id, Number(it.quantity), b.priority, deadline]);

      let rank = 1;
      for (const n of nodes) {
        const score = Math.max(55, 88 - (rank - 1) * 7 - Math.floor(n.load_rate / 10));
        await conn.query(
          `INSERT INTO dispatch_candidate (candidate_id, order_id, node_id, score, reason, rank_no, created_at)
           VALUES (?,?,?,?,?,?,NOW())`,
          [`CND-${orderId}-${rank}`, orderId, n.node_id, score,
           JSON.stringify({ material: 30, load: n.load_rate < 70 ? 20 : 10, proximity: 15, qualification: 20 - rank * 2 }), rank]);
        rank++;
      }

      await conn.query(
        `INSERT INTO order_event (event_id, order_id, event_type, payload, tx_hash, occurred_at, actor_did)
         VALUES (?,?, '创建', ?, NULL, NOW(), 'did:am:user:001')`,
        [`EVT-${orderId}-C1`, orderId, JSON.stringify({ note: '需求单创建', seq: i + 1 })]);
      await conn.query(
        `INSERT INTO order_event (event_id, order_id, event_type, payload, tx_hash, occurred_at, actor_did)
         VALUES (?,?, '受理', ?, NULL, NOW(), 'did:am:user:001')`,
        [`EVT-${orderId}-C2`, orderId, JSON.stringify({ note: '评审通过转订单', seq: i + 1 })]);
    }

    await conn.commit();
    res.status(201).json({
      ok: true, demand_id: demandId, order_id: orderIds[0], order_ids: orderIds,
      item_count: items.length, candidates: nodes.length,
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ---------- 6.10 节点工作台 ----------
// 节点任务列表（含订单与设备信息）
router.get('/nodes/:nodeId/tasks', async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    const rows = await q(
      `SELECT t.task_id, t.order_id, t.node_id, t.equip_id, t.seq, t.status AS task_status,
              t.respond_deadline, t.planned_start, t.planned_end, t.progress_reported,
              o.status AS order_status, o.priority, o.quantity, o.progress AS order_progress,
              d.part_desc AS order_name, d.scene,
              m.material_name, m.material_code,
              e.equip_name, e.equip_type, e.laser_max_power
       FROM production_task t
       JOIN dispatch_order o ON t.order_id = o.order_id
       JOIN demand_order d ON o.demand_id = d.demand_id
       LEFT JOIN am_database.materials m ON o.material_id = m.id
       LEFT JOIN equipment e ON t.equip_id = e.equip_id
       WHERE t.node_id = ?
       ORDER BY FIELD(t.status,'待应答','已接受','执行中','已完成','已拒绝'), t.respond_deadline ASC, t.planned_start ASC`,
      [nodeId]);
    res.json(rows);
  } catch (err) { next(err); }
});

// 节点任务操作统一事务处理
const TASK_ACTIONS = {
  accept: { from: ['待应答'], taskStatus: '已接受', event: '接单', extraSql: null },
  reject: {
    from: ['待应答'], taskStatus: '已拒绝', event: '拒绝',
    extraSql: `UPDATE dispatch_order SET abnormal_flag = 1, latest_event_at = NOW() WHERE order_id = ?`,
  },
  start: {
    from: ['已接受'], taskStatus: '执行中', event: '开工', orderStatus: '生产中',
    extraSql: `UPDATE dispatch_order SET status = '生产中', progress = GREATEST(progress, 5), latest_event_at = NOW() WHERE order_id = ?`,
  },
  report: { from: ['执行中'], taskStatus: '执行中', event: '报工', extraSql: null },
  complete: {
    from: ['执行中', '已接受'], taskStatus: '已完成', event: '完工报工', orderStatus: '质检中',
    extraSql: `UPDATE dispatch_order SET status = '质检中', progress = 100, latest_event_at = NOW() WHERE order_id = ?`,
  },
};

router.post('/tasks/:taskId/:action', async (req, res) => {
  const { taskId, action } = req.params;
  const cfg = TASK_ACTIONS[action];
  if (!cfg) return res.status(400).json({ error: `未知操作：${action}` });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[task]] = await conn.query('SELECT task_id, order_id, node_id, status FROM production_task WHERE task_id = ? FOR UPDATE', [taskId]);
    if (!task) { await conn.rollback(); return res.status(404).json({ error: '任务不存在' }); }
    if (!cfg.from.includes(task.status)) {
      await conn.rollback();
      return res.status(400).json({ error: `任务当前状态为「${task.status}」，不允许执行该操作` });
    }
    const [[node]] = await conn.query('SELECT did, node_name FROM node_registry WHERE node_id = ?', [task.node_id]);

    if (action === 'report') {
      const p = Math.max(0, Math.min(99, Number(req.body?.progress ?? 0)));
      if (!p) { await conn.rollback(); return res.status(400).json({ error: 'progress 必填（1-99）' }); }
      await conn.query('UPDATE production_task SET progress_reported = ? WHERE task_id = ?', [p, taskId]);
      await conn.query('UPDATE dispatch_order SET progress = ?, latest_event_at = NOW() WHERE order_id = ?', [p, task.order_id]);
      await conn.query(
        `INSERT INTO order_event (event_id, order_id, event_type, payload, tx_hash, occurred_at, actor_did)
         VALUES (?,?,?,?,NULL,NOW(),?)`,
        [compactId('EVT'), task.order_id, '报工', JSON.stringify({ task: taskId, progress: p }), node?.did || '']);
    } else {
      await conn.query(
        `UPDATE production_task SET status = ?${action === 'complete' ? ', progress_reported = 100' : ''} WHERE task_id = ?`,
        [cfg.taskStatus, taskId]);
      if (cfg.extraSql) await conn.query(cfg.extraSql, [task.order_id]);
      await conn.query(
        `INSERT INTO order_event (event_id, order_id, event_type, payload, tx_hash, occurred_at, actor_did)
         VALUES (?,?,?,?,NULL,NOW(),?)`,
        [compactId('EVT'), task.order_id, cfg.event,
         JSON.stringify({ task: taskId, node: node?.node_name, reason: req.body?.reason || undefined }), node?.did || '']);
    }
    await conn.commit();
    res.json({ ok: true, task_id: taskId, task_status: cfg.taskStatus, order_id: task.order_id, order_status: cfg.orderStatus || undefined });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ---------- 6.11 一虚两实孪生质检 ----------
// 生成比对数据：以调度中心数据包哈希为真理源，海上实体件快检 vs 岸基复现件全检
router.post('/orders/:id/twin-qc/run', async (req, res) => {
  const { id } = req.params;
  const [order] = await q(
    `SELECT o.order_id, o.status FROM dispatch_order o WHERE o.order_id = ?`, [id]);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  if (!['质检中', '已交付', '已归档'].includes(order.status)) {
    return res.status(400).json({ error: `订单当前状态为「${order.status}」，需完工转入质检中后才能启动比对` });
  }
  const existRows = await q('SELECT * FROM twin_qc WHERE order_id = ?', [id]);
  if (existRows.length) return res.json(existRows[0]);

  // 确定性随机：以订单号哈希为种子，同一订单重复生成结果一致
  let seed = parseInt(crypto.createHash('md5').update(id).digest('hex').slice(0, 8), 16);
  const rnd = (min, max, dp = 1) => {
    seed = (seed * 9301 + 49297) % 233280;
    const v = min + (seed / 233280) * (max - min);
    return Number(v.toFixed(dp));
  };
  // 316L 典型值：Rm~650MPa Rp0.2~310MPa A~45% HBW~160 尺寸偏差~0.05mm
  const base = { tensile: rnd(640, 665), yield: rnd(300, 320), elongation: rnd(42, 47), hardness: rnd(155, 168, 0), dimension: rnd(0.03, 0.07, 3) };
  const ship = {
    tensileStrength: base.tensile + rnd(-8, 8),
    yieldStrength: base.yield + rnd(-6, 6),
    elongation: base.elongation + rnd(-1.5, 1.5),
    hardnessHBW: Math.round(base.hardness + rnd(-4, 4, 0)),
    dimensionDeviation: Number((base.dimension + rnd(0, 0.02)).toFixed(3)),
  };
  const shore = {
    tensileStrength: base.tensile + rnd(-5, 5),
    yieldStrength: base.yield + rnd(-4, 4),
    elongation: base.elongation + rnd(-1, 1),
    hardnessHBW: Math.round(base.hardness + rnd(-3, 3, 0)),
    dimensionDeviation: Number((base.dimension + rnd(0, 0.015)).toFixed(3)),
  };
  const rel = (a, b, scale) => Math.abs(a - b) / scale;
  const dev = (rel(ship.tensileStrength, shore.tensileStrength, 650)
    + rel(ship.yieldStrength, shore.yieldStrength, 310)
    + rel(ship.elongation, shore.elongation, 45)
    + rel(ship.hardnessHBW, shore.hardnessHBW, 160)
    + rel(ship.dimensionDeviation, shore.dimensionDeviation, 0.1)) / 5;
  const raw = 100 - dev * 100 * 2.2;
  const score = Number(Math.max(70, Math.min(99.5, raw)).toFixed(1));
  const verdict = score >= 92 ? '一致性达标 · 制造即可信、交付即合格'
    : score >= 85 ? '基本一致 · 建议人工复核局部指标' : '一致性不足 · 转人工分析';

  const truthHash = sha(id + 'truth-package');
  await pool.query(
    `INSERT INTO twin_qc (order_id, truth_hash, ship_metrics, shore_metrics, consistency_score, verdict)
     VALUES (?,?,?,?,?,?)`, [id, truthHash, JSON.stringify(ship), JSON.stringify(shore), score, verdict]);
  await pool.query(
    `INSERT INTO order_event (event_id, order_id, event_type, payload, tx_hash, occurred_at, actor_did)
     VALUES (?,?, '质检', ?, ?, NOW(), 'did:am:user:001')`,
    [`EVT-${id}-TQC`, id, JSON.stringify({ ship, shore, score, verdict }), sha(id + '质检')]);
  res.json({ order_id: id, truth_hash: truthHash, ship_metrics: ship, shore_metrics: shore, consistency_score: score, verdict });
});

router.get('/orders/:id/twin-qc', async (req, res) => {
  const rows = await q('SELECT * FROM twin_qc WHERE order_id = ?', [req.params.id]);
  res.json(rows[0] || null);
});

// ---------- 6.12 演示剧场辅助 ----------
router.post('/demo/reset', async (_req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [ids] = await conn.query(
      `SELECT o.order_id FROM dispatch_order o JOIN demand_order d ON o.demand_id = d.demand_id
       WHERE d.part_desc LIKE '【演示】%' FOR UPDATE`);
    const list = ids.map((r) => r.order_id);
    if (list.length) {
      await conn.query('DELETE FROM twin_qc WHERE order_id IN (?)', [list]);
      await conn.query('DELETE FROM order_event WHERE order_id IN (?)', [list]);
      await conn.query('DELETE FROM production_task WHERE order_id IN (?)', [list]);
      await conn.query('DELETE FROM dispatch_candidate WHERE order_id IN (?)', [list]);
      await conn.query('DELETE FROM dispatch_order WHERE order_id IN (?)', [list]);
      await conn.query(`DELETE FROM demand_order WHERE part_desc LIKE '【演示】%'`);
    }
    await conn.commit();
    res.json({ ok: true, cleaned: list.length });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ---------- 节点运维后台（单位接入 / 版本分发 / 实时事件） ----------
const { logEvent } = mountNodeOps(router, { pool, q });

// ---------- 拓竹 3D 打印机（局域网直控 + 模拟回退） ----------
mountPrinter(router, { pool, q, logEvent });

// 静态原型托管
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, '..', 'public')));

// 错误处理
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const PORT = 3002;
app.listen(PORT, () => console.log(`订单派发查询服务: http://localhost:${PORT}`));
