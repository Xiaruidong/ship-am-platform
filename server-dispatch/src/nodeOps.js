// 节点运维后台：单位接入（新增/维护）、节点版本分发、实时事件推送
// 挂载在 /dapi 与 /api 两个前缀下（由 index.js 统一挂载）
import crypto from 'node:crypto';

const rid = (prefix) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

// SSE 订阅者：把运维动作实时推给管理端
const subscribers = new Set();

function broadcast(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of subscribers) {
    try { res.write(payload); } catch { subscribers.delete(res); }
  }
}

export default function mountNodeOps(router, { pool, q }) {

  // 写事件：落库 + 实时广播（广播失败不影响主流程）
  async function logEvent(eventType, { nodeId = null, refId = null, message = '', actor = 'admin' } = {}) {
    const event = { event_type: eventType, node_id: nodeId, ref_id: refId, message, actor, at: new Date().toISOString() };
    try {
      await q(
        `INSERT INTO platform_event (event_type, node_id, ref_id, message, actor) VALUES (?,?,?,?,?)`,
        [eventType, nodeId, refId, message, actor]);
    } catch (err) {
      console.error('platform_event 写入失败:', err.message);
    }
    broadcast(event);
  }

  // 异步路由统一兜底：任何异常交给 Express 错误处理，绝不让进程退出
  const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  // ---------- 实时事件流 ----------
  router.get('/ops/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`retry: 3000\n\n`);
    res.write(`data: ${JSON.stringify({ event_type: 'hello', message: '运维事件流已连接', at: new Date().toISOString() })}\n\n`);
    subscribers.add(res);
    const ping = setInterval(() => {
      try { res.write(': ping\n\n'); } catch { /* 连接已断开 */ }
    }, 20000);
    req.on('close', () => { clearInterval(ping); subscribers.delete(res); });
  });

  router.get('/ops/events', ah(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 30, 200);
    const rows = await q(
      `SELECT event_id, event_type, node_id, ref_id, message, actor, created_at
       FROM platform_event ORDER BY event_id DESC LIMIT ?`, [limit]);
    res.json(rows);
  }));

  // ---------- 节点（单位）接入与维护 ----------
  router.post('/nodes', async (req, res, next) => {
    try {
      const b = req.body || {};
      if (!b.node_name || !b.location) return res.status(400).json({ error: 'node_name / location 必填' });
      const nodeId = b.node_id || rid('NOD');
      const did = b.did || `did:am:node:${crypto.randomBytes(4).toString('hex')}`;
      await q(
        `INSERT INTO node_registry
         (node_id, did, node_type, node_name, location, scene, status, device_count, device_online, load_rate, last_heartbeat, capacity_profile)
         VALUES (?,?,?,?,?,?,?,?,?,?,NOW(),?)`,
        [nodeId, did, Number(b.node_type ?? 2), b.node_name, b.location, b.scene || '岸',
         b.status || '在线', Number(b.device_count || 0), Number(b.device_online || 0),
         Number(b.load_rate || 0), b.capacity_profile ? JSON.stringify(b.capacity_profile) : null]);
      await logEvent('node.created', { nodeId, refId: nodeId, message: `新单位接入：${b.node_name}` });
      const [row] = await q('SELECT * FROM node_registry WHERE node_id = ?', [nodeId]);
      res.status(201).json(row);
    } catch (err) { next(err); }
  });

  router.patch('/nodes/:nodeId', async (req, res, next) => {
    try {
      const allowed = ['node_name', 'location', 'scene', 'status', 'device_count',
        'device_online', 'load_rate', 'node_type', 'capacity_profile'];
      const sets = [], params = [];
      for (const k of allowed) {
        if (req.body[k] === undefined) continue;
        sets.push(`${k} = ?`);
        params.push(k === 'capacity_profile' ? JSON.stringify(req.body[k]) : req.body[k]);
      }
      if (!sets.length) return res.status(400).json({ error: '没有可更新字段' });
      params.push(req.params.nodeId);
      const r = await q(`UPDATE node_registry SET ${sets.join(', ')} WHERE node_id = ?`, params);
      if (!r.affectedRows) return res.status(404).json({ error: '节点不存在' });
      await logEvent('node.updated', { nodeId: req.params.nodeId, refId: req.params.nodeId, message: '节点信息已更新' });
      const [row] = await q('SELECT * FROM node_registry WHERE node_id = ?', [req.params.nodeId]);
      res.json(row);
    } catch (err) { next(err); }
  });

  router.delete('/nodes/:nodeId', async (req, res, next) => {
    try {
      const [node] = await q('SELECT node_name FROM node_registry WHERE node_id = ?', [req.params.nodeId]);
      if (!node) return res.status(404).json({ error: '节点不存在' });
      const [used] = await q('SELECT COUNT(*) c FROM production_task WHERE node_id = ?', [req.params.nodeId]);
      if (used.c > 0) return res.status(409).json({ error: `该节点还有 ${used.c} 条任务，无法移除` });
      await q('DELETE FROM node_distribution WHERE node_id = ?', [req.params.nodeId]);
      await q('DELETE FROM node_maintenance WHERE node_id = ?', [req.params.nodeId]);
      await q('DELETE FROM node_registry WHERE node_id = ?', [req.params.nodeId]);
      await logEvent('node.removed', { nodeId: req.params.nodeId, refId: req.params.nodeId, message: `单位已移除：${node.node_name}` });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  router.get('/nodes/:nodeId', async (req, res, next) => {
    try {
      const [row] = await q('SELECT * FROM node_registry WHERE node_id = ?', [req.params.nodeId]);
      if (!row) return res.status(404).json({ error: '节点不存在' });
      const mains = await q(
        'SELECT * FROM node_maintenance WHERE node_id = ? ORDER BY created_at DESC LIMIT 20', [req.params.nodeId]);
      const dists = await q(
        `SELECT d.*, v.version_no FROM node_distribution d JOIN node_version v ON v.version_id = d.version_id
         WHERE d.node_id = ? ORDER BY d.created_at DESC`, [req.params.nodeId]);
      res.json({ ...row, maintenances: mains, distributions: dists });
    } catch (err) { next(err); }
  });

  // ---------- 维护工单 ----------
  router.get('/nodes/:nodeId/maintenances', ah(async (req, res) => {
    res.json(await q('SELECT * FROM node_maintenance WHERE node_id = ? ORDER BY created_at DESC', [req.params.nodeId]));
  }));

  router.post('/nodes/:nodeId/maintenances', async (req, res, next) => {
    try {
      const b = req.body || {};
      if (!b.title) return res.status(400).json({ error: 'title 必填' });
      const id = rid('MNT');
      await q(
        `INSERT INTO node_maintenance (maint_id, node_id, maint_type, title, content, operator, planned_at, status)
         VALUES (?,?,?,?,?,?,?,?)`,
        [id, req.params.nodeId, b.maint_type || '巡检', b.title, b.content || '',
         b.operator || 'admin', b.planned_at || null, b.status || '待执行']);
      await logEvent('maintenance.created', {
        nodeId: req.params.nodeId, refId: id, message: `新增维护工单：${b.title}` });
      const [row] = await q('SELECT * FROM node_maintenance WHERE maint_id = ?', [id]);
      res.status(201).json(row);
    } catch (err) { next(err); }
  });

  router.patch('/maintenances/:id', async (req, res, next) => {
    try {
      const b = req.body || {};
      const sets = [], params = [];
      if (b.status !== undefined) { sets.push('status = ?'); params.push(b.status); }
      if (b.content !== undefined) { sets.push('content = ?'); params.push(b.content); }
      if (b.operator !== undefined) { sets.push('operator = ?'); params.push(b.operator); }
      if (b.status === '已完成') sets.push('done_at = NOW()');
      if (!sets.length) return res.status(400).json({ error: '没有可更新字段' });
      params.push(req.params.id);
      const r = await q(`UPDATE node_maintenance SET ${sets.join(', ')} WHERE maint_id = ?`, params);
      if (!r.affectedRows) return res.status(404).json({ error: '工单不存在' });
      const [row] = await q('SELECT * FROM node_maintenance WHERE maint_id = ?', [req.params.id]);
      await logEvent('maintenance.updated', {
        nodeId: row.node_id, refId: row.maint_id, message: `维护工单 ${row.status}：${row.title}` });
      res.json(row);
    } catch (err) { next(err); }
  });

  // ---------- 节点端版本 ----------
  router.get('/versions', ah(async (_req, res) => {
    const rows = await q(
      `SELECT v.*, 
        (SELECT COUNT(*) FROM node_distribution d WHERE d.version_id = v.version_id) total,
        (SELECT COUNT(*) FROM node_distribution d WHERE d.version_id = v.version_id AND d.status = '已安装') installed
       FROM node_version v ORDER BY v.created_at DESC`);
    res.json(rows);
  }));

  router.post('/versions', async (req, res, next) => {
    try {
      const b = req.body || {};
      if (!b.version_no || !b.name) return res.status(400).json({ error: 'version_no / name 必填' });
      const [dup] = await q('SELECT version_id FROM node_version WHERE version_no = ?', [b.version_no]);
      if (dup) return res.status(409).json({ error: '版本号已存在' });
      const id = rid('VER');
      await q(
        `INSERT INTO node_version (version_id, version_no, name, changelog, file_url, checksum, size_kb, status)
         VALUES (?,?,?,?,?,?,?, '草稿')`,
        [id, b.version_no, b.name, b.changelog || '', b.file_url || '',
         b.checksum || crypto.createHash('md5').update(b.version_no + b.name).digest('hex').slice(0, 32),
         Number(b.size_kb || 0)]);
      await logEvent('version.created', { refId: id, message: `新版本草稿：${b.version_no}` });
      const [row] = await q('SELECT * FROM node_version WHERE version_id = ?', [id]);
      res.status(201).json(row);
    } catch (err) { next(err); }
  });

  // 发布：草稿 → 已发布，可被下发
  router.post('/versions/:id/release', async (req, res, next) => {
    try {
      const r = await q(
        `UPDATE node_version SET status = '已发布', released_at = NOW() WHERE version_id = ? AND status = '草稿'`,
        [req.params.id]);
      if (!r.affectedRows) return res.status(409).json({ error: '仅草稿版本可发布' });
      const [row] = await q('SELECT * FROM node_version WHERE version_id = ?', [req.params.id]);
      await logEvent('version.released', { refId: row.version_id, message: `版本发布：${row.version_no}` });
      res.json(row);
    } catch (err) { next(err); }
  });

  // 下发：把已发布版本推给指定单位（可重复下发，已存在的更新为待推送）
  router.post('/versions/:id/distribute', async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const [ver] = await q('SELECT * FROM node_version WHERE version_id = ?', [req.params.id]);
      if (!ver) return res.status(404).json({ error: '版本不存在' });
      if (ver.status !== '已发布') return res.status(409).json({ error: '版本未发布，不能下发' });
      const nodeIds = Array.isArray(req.body?.node_ids) ? req.body.node_ids : [];
      if (!nodeIds.length) return res.status(400).json({ error: 'node_ids 不能为空' });

      await conn.beginTransaction();
      const created = [];
      for (const nodeId of nodeIds) {
        const distId = `${ver.version_no}-${nodeId}`;
        await conn.query(
          `INSERT INTO node_distribution (dist_id, version_id, node_id, status, progress, operator, pushed_at)
           VALUES (?,?,?, '已下发', 0, ?, NOW())
           ON DUPLICATE KEY UPDATE status = '已下发', progress = 0, pushed_at = NOW(), ack_at = NULL, message = NULL`,
          [distId, ver.version_id, nodeId, req.body.operator || 'admin']);
        created.push(distId);
      }
      await conn.commit();
      await logEvent('version.distributed', {
        refId: ver.version_id, message: `${ver.version_no} 已下发 ${created.length} 个单位` });
      res.json({ ok: true, version_no: ver.version_no, distributed: created.length, dist_ids: created });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  });

  router.get('/distributions', ah(async (req, res) => {
    const { version_id, node_id, status } = req.query;
    const where = [], params = [];
    if (version_id) { where.push('d.version_id = ?'); params.push(version_id); }
    if (node_id) { where.push('d.node_id = ?'); params.push(node_id); }
    if (status) { where.push('d.status = ?'); params.push(status); }
    const rows = await q(
      `SELECT d.*, v.version_no, v.name AS version_name, n.node_name, n.location
       FROM node_distribution d
       JOIN node_version v ON v.version_id = d.version_id
       LEFT JOIN node_registry n ON n.node_id = d.node_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY d.created_at DESC`, params);
    res.json(rows);
  }));

  // 节点端回执：下载/安装进度回报
  router.patch('/distributions/:id', async (req, res, next) => {
    try {
      const { status, progress, message } = req.body || {};
      const sets = [], params = [];
      if (status !== undefined) { sets.push('status = ?'); params.push(status); }
      if (progress !== undefined) { sets.push('progress = ?'); params.push(Number(progress)); }
      if (message !== undefined) { sets.push('message = ?'); params.push(message); }
      if (status === '已安装' || status === '失败') sets.push('ack_at = NOW()');
      if (!sets.length) return res.status(400).json({ error: '没有可更新字段' });
      params.push(req.params.id);
      const r = await q(`UPDATE node_distribution SET ${sets.join(', ')} WHERE dist_id = ?`, params);
      if (!r.affectedRows) return res.status(404).json({ error: '分发记录不存在' });
      const [row] = await q('SELECT * FROM node_distribution WHERE dist_id = ?', [req.params.id]);
      await logEvent('distribution.ack', {
        nodeId: row.node_id, refId: row.dist_id, message: `节点回执：${row.status}` });
      res.json(row);
    } catch (err) { next(err); }
  });

  // 汇总：管理端首屏
  router.get('/ops/summary', ah(async (_req, res) => {
    const [[nodes], [maint], [vers], [dists]] = await Promise.all([
      q(`SELECT COUNT(*) total, SUM(status='在线') online FROM node_registry`),
      q(`SELECT COUNT(*) total, SUM(status IN ('待执行','进行中')) open FROM node_maintenance`),
      q(`SELECT COUNT(*) total, SUM(status='已发布') released FROM node_version`),
      q(`SELECT COUNT(*) total, SUM(status='已安装') installed, SUM(status='失败') failed FROM node_distribution`),
    ]);
    res.json({ nodes, maintenance: maint, versions: vers, distributions: dists });
  }));

  return { logEvent };

}
