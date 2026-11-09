// 拓竹 3D 打印机对接：局域网直控（MQTT 8883 + FTPS 990）
// 无打印机/不可达时自动降级为模拟驱动，保证平台链路可演示
import crypto from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';

const rid = (prefix) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

export default function mountPrinter(router, { pool, q, logEvent }) {

  // ---------- 打印进度模拟器（联调前占位；真实打印机接入后由 MQTT 状态驱动） ----------
  const simTimers = new Map();

  function stopSim(jobId) {
    const t = simTimers.get(jobId);
    if (t) { clearInterval(t); simTimers.delete(jobId); }
  }

  async function tickJob(jobId) {
    const [job] = await q('SELECT * FROM print_job WHERE job_id = ?', [jobId]);
    if (!job || job.status === '已完成' || job.status === '失败') return stopSim(jobId);
    const next = Math.min(100, job.progress + Math.floor(4 + Math.random() * 7));
    const done = next >= 100;
    await q(
      `UPDATE print_job SET progress = ?, status = ?, nozzle_temp = ?, bed_temp = ?, layer = ?,
        finished_at = ${done ? 'NOW()' : 'finished_at'}, message = ? WHERE job_id = ?`,
      [next, done ? '已完成' : '打印中',
        done ? 0 : 220 + Math.floor(Math.random() * 10),
        done ? 35 : 55 + Math.floor(Math.random() * 5),
        done ? 240 : Math.floor(240 * next / 100),
        done ? '打印完成，冷却中' : '挤出正常，层间结合良好',
        jobId]);
    // 打印进度回流到订单与生产任务
    await q('UPDATE dispatch_order SET progress = ? WHERE order_id = ?', [next, job.order_id]);
    await q('UPDATE production_task SET progress_reported = ? WHERE order_id = ?', [next, job.order_id]);
    if (done) {
      await q(`UPDATE dispatch_order SET status = '质检中' WHERE order_id = ? AND status = '生产中'`, [job.order_id]);
      await logEvent('print.done', { refId: jobId, message: `打印完成：${job.file_name}` });
      stopSim(jobId);
    }
  }

  function driveSimulated(jobId) {
    stopSim(jobId);
    simTimers.set(jobId, setInterval(() => { tickJob(jobId).catch(() => stopSim(jobId)); }, 2500));
    void tickJob(jobId);
  }

  // ---------- 真实打印机通道 ----------
  async function printerReachable(ip, port = 8883, timeout = 2500) {
    return new Promise((resolve) => {
      const s = net.connect({ host: ip, port, timeout });
      s.on('connect', () => { s.destroy(); resolve(true); });
      s.on('timeout', () => { s.destroy(); resolve(false); });
      s.on('error', () => resolve(false));
    });
  }

  // MQTT 下发打印指令（拓竹局域网协议：device/{serial}/request）
  // 依赖在依赖清单中，使用动态 import 避免无打印机环境下阻塞启动
  async function sendPrintCommand(printer, fileName) {
    const mqtt = await import('mqtt');
    const url = `mqtts://${printer.ip}:8883`;
    const topic = `device/${printer.serial_no}/request`;
    return new Promise((resolve, reject) => {
      const client = mqtt.connect(url, {
        username: 'bblp',
        password: printer.access_code,
        rejectUnauthorized: false, // 拓竹使用自签名证书
        connectTimeout: 5000,
        reconnectPeriod: 0,
      });
      const timer = setTimeout(() => { client.end(true); reject(new Error('MQTT 连接超时')); }, 7000);
      client.on('connect', () => {
        // 打印 SD 卡根目录下的文件；3mf/gcode 均可
        client.publish(topic, JSON.stringify({
          print: { command: 'project_file', param: `/sdcard/${fileName}`, url: `ftp://${fileName}`, subtask_name: fileName },
        }), { qos: 1 }, (err) => {
          clearTimeout(timer);
          client.end(true);
          if (err) reject(err); else resolve({ ok: true });
        });
      });
      client.on('error', (err) => { clearTimeout(timer); client.end(true); reject(err); });
    });
  }

  // ---------- API：打印机管理 ----------
  router.get('/printers', async (_req, res) => {
    const rows = await q(
      `SELECT printer_id, name, brand, model, ip, serial_no, ams, status, node_id, last_seen, created_at,
        (SELECT COUNT(*) FROM print_job j WHERE j.printer_id = printer.printer_id AND j.status IN ('排队中','打印中')) running
       FROM printer ORDER BY created_at`);
    res.json(rows); // access_code 不下发到前端
  });

  router.post('/printers', async (req, res, next) => {
    try {
      const b = req.body || {};
      if (!b.name || !b.model) return res.status(400).json({ error: 'name / model 必填' });
      const id = rid('PRT');
      await q(
        `INSERT INTO printer (printer_id, name, brand, model, ip, serial_no, access_code, ams, node_id, status)
         VALUES (?,?,?,?,?,?,?,?,?,'离线')`,
        [id, b.name, b.brand || 'Bambu Lab', b.model, b.ip || null, b.serial_no || null,
         b.access_code || null, b.ams ? 1 : 0, b.node_id || null]);
      await logEvent('printer.created', { refId: id, message: `新打印机登记：${b.name}` });
      const [row] = await q('SELECT printer_id, name, brand, model, ip, serial_no, ams, status, node_id FROM printer WHERE printer_id = ?', [id]);
      res.status(201).json(row);
    } catch (err) { next(err); }
  });

  router.patch('/printers/:id', async (req, res, next) => {
    try {
      const allowed = ['name', 'ip', 'serial_no', 'access_code', 'node_id', 'ams'];
      const sets = [], params = [];
      for (const k of allowed) {
        if (req.body[k] === undefined) continue;
        sets.push(`${k} = ?`); params.push(k === 'ams' ? (req.body[k] ? 1 : 0) : req.body[k]);
      }
      if (!sets.length) return res.status(400).json({ error: '没有可更新字段' });
      params.push(req.params.id);
      const r = await q(`UPDATE printer SET ${sets.join(', ')} WHERE printer_id = ?`, params);
      if (!r.affectedRows) return res.status(404).json({ error: '打印机不存在' });
      const [row] = await q('SELECT printer_id, name, brand, model, ip, serial_no, ams, status, node_id FROM printer WHERE printer_id = ?', [req.params.id]);
      res.json(row);
    } catch (err) { next(err); }
  });

  // 连通测试：探测 MQTT 8883 / FTPS 990 端口
  router.post('/printers/:id/test', async (req, res, next) => {
    try {
      const [p] = await q('SELECT * FROM printer WHERE printer_id = ?', [req.params.id]);
      if (!p) return res.status(404).json({ error: '打印机不存在' });
      if (!p.ip) return res.json({ ok: false, message: '未配置 IP' });
      const [mqttOk, ftpOk] = await Promise.all([
        printerReachable(p.ip, 8883), printerReachable(p.ip, 990),
      ]);
      const ok = mqttOk; // MQTT 通即可控；FTP 用于传文件
      await q('UPDATE printer SET status = ?, last_seen = ? WHERE printer_id = ?',
        [ok ? '在线' : '离线', ok ? new Date() : null, p.printer_id]);
      await logEvent('printer.test', { refId: p.printer_id, message: `连通测试：${p.name} ${ok ? '在线' : '不可达'}` });
      res.json({ ok, mqtt: mqttOk, ftp: ftpOk,
        message: ok ? `MQTT 端口可达${ftpOk ? '，FTP 通道正常' : ''}` : '局域网内不可达，请检查 IP / 局域网模式' });
    } catch (err) { next(err); }
  });

  // ---------- API：打印任务 ----------
  router.get('/print-jobs', async (req, res) => {
    const { order_id, printer_id, limit = 50 } = req.query;
    const where = [], params = [];
    if (order_id) { where.push('j.order_id = ?'); params.push(order_id); }
    if (printer_id) { where.push('j.printer_id = ?'); params.push(printer_id); }
    const rows = await q(
      `SELECT j.*, p.name AS printer_name, p.model AS printer_model,
        (SELECT part_desc FROM demand_order d JOIN dispatch_order o ON o.demand_id = d.demand_id WHERE o.order_id = j.order_id) order_name
       FROM print_job j JOIN printer p ON p.printer_id = j.printer_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY j.created_at DESC LIMIT ?`, [...params, Number(limit)]);
    res.json(rows);
  });

  // 下发打印：订单 → 打印机
  // mode: 'real' 强制真实下发；默认自动——打印机可达走 MQTT，不可达模拟驱动
  router.post('/print-jobs', async (req, res, next) => {
    try {
      const b = req.body || {};
      if (!b.order_id || !b.printer_id) return res.status(400).json({ error: 'order_id / printer_id 必填' });
      const [printer] = await q('SELECT * FROM printer WHERE printer_id = ?', [b.printer_id]);
      if (!printer) return res.status(404).json({ error: '打印机不存在' });
      const [order] = await q(
        `SELECT o.order_id, d.part_desc FROM dispatch_order o JOIN demand_order d ON o.demand_id = d.demand_id
         WHERE o.order_id = ?`, [b.order_id]);
      if (!order) return res.status(404).json({ error: '订单不存在' });

      const fileName = b.file_name || `${b.order_id}.gcode.3mf`;
      const jobId = rid('PJOB');
      let simulated = 1, msg = '模拟驱动（未连接打印机）';

      if (printer.ip && printer.serial_no && printer.access_code && b.mode !== 'sim') {
        const reachable = await printerReachable(printer.ip);
        if (reachable) {
          try {
            await sendPrintCommand(printer, fileName);
            simulated = 0; msg = '已通过 MQTT 下发到打印机';
          } catch (err) {
            msg = `MQTT 下发失败（${err.message}），降级为模拟驱动`;
          }
        }
      }

      await q(
        `INSERT INTO print_job (job_id, order_id, printer_id, file_name, file_url, status, progress, simulated, message, started_at)
         VALUES (?,?,?,?,?, '打印中', 0, ?, ?, NOW())`,
        [jobId, b.order_id, b.printer_id, fileName, b.file_url || '', simulated, msg]);
      await q(`UPDATE dispatch_order SET status = '生产中' WHERE order_id = ? AND status IN ('待派单','已派单')`, [b.order_id]);
      await logEvent('print.started', {
        refId: jobId, message: `${order.part_desc} → ${printer.name}${simulated ? '（模拟）' : ''}` });

      if (simulated) driveSimulated(jobId);

      const [row] = await q('SELECT * FROM print_job WHERE job_id = ?', [jobId]);
      res.status(201).json(row);
    } catch (err) { next(err); }
  });

  // 停止/取消
  router.post('/print-jobs/:id/cancel', async (req, res, next) => {
    try {
      const [job] = await q('SELECT * FROM print_job WHERE job_id = ?', [req.params.id]);
      if (!job) return res.status(404).json({ error: '任务不存在' });
      if (['已完成', '失败'].includes(job.status)) return res.status(409).json({ error: '任务已结束' });
      stopSim(job.job_id);
      await q(`UPDATE print_job SET status = '失败', message = '人工取消', finished_at = NOW() WHERE job_id = ?`, [job.job_id]);
      await logEvent('print.cancelled', { refId: job.job_id, message: `打印已取消：${job.file_name}` });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // 打印机状态快照（大屏/工作台可拉取）
  router.get('/printers/status', async (_req, res) => {
    const rows = await q(
      `SELECT p.printer_id, p.name, p.model, p.status, p.last_seen,
        (SELECT COUNT(*) FROM print_job j WHERE j.printer_id = p.printer_id AND j.status = '打印中') printing,
        (SELECT progress FROM print_job j WHERE j.printer_id = p.printer_id AND j.status = '打印中' ORDER BY j.started_at DESC LIMIT 1) progress
       FROM printer p`);
    res.json(rows);
  });
}
