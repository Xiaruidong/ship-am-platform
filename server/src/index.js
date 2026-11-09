import express from 'express';
import dotenv from 'dotenv';
import { pool, listEntity, getEntityById, getEntityConfig, statusTransitions } from './db.js';

dotenv.config();

const app = express();
app.use(express.json());

// 简单请求日志
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

const ENTITIES = ['materials', 'parts', 'equipment', 'inspection', 'standards', 'orders'];

// ---------- 全局搜索（须在通用 /api/:entity 路由之前注册） ----------

app.get('/api/search', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().toLowerCase();
    if (!q) return res.json([]);
    const [materials, parts, equipment, inspections, standards, orders] = await Promise.all([
      listEntity('materials'), listEntity('parts'), listEntity('equipment'),
      listEntity('inspection'), listEntity('standards'), listEntity('orders'),
    ]);
    const results = [];
    materials.forEach((m) => {
      if (m.materialName.toLowerCase().includes(q) || m.materialCode.toLowerCase().includes(q))
        results.push({ type: 'materials', label: '原材料', title: m.materialName, subtitle: m.materialCode });
    });
    parts.forEach((p) => {
      if (p.partName.toLowerCase().includes(q) || p.oemPartNumber.toLowerCase().includes(q))
        results.push({ type: 'parts', label: '零部件', title: p.partName, subtitle: p.oemPartNumber });
    });
    equipment.forEach((e) => {
      if (e.equipmentName.toLowerCase().includes(q) || e.manufacturer.toLowerCase().includes(q))
        results.push({ type: 'equipment', label: '设备', title: e.equipmentName, subtitle: e.manufacturer });
    });
    inspections.forEach((i) => {
      if (i.sampleName.toLowerCase().includes(q))
        results.push({ type: 'inspection', label: '检测', title: i.sampleName, subtitle: i.resultJudgment });
    });
    standards.forEach((s) => {
      if (s.standardNumber.toLowerCase().includes(q) || s.standardName.toLowerCase().includes(q))
        results.push({ type: 'standards', label: '标准', title: s.standardNumber, subtitle: s.standardName });
    });
    orders.forEach((o) => {
      if (o.orderName.toLowerCase().includes(q) || o.id.toLowerCase().includes(q))
        results.push({ type: 'orders', label: '订单', title: o.orderName, subtitle: o.id });
    });
    res.json(results.slice(0, 20));
  } catch (err) {
    next(err);
  }
});

// ---------- 通用读接口 ----------

app.get('/api/:entity', async (req, res, next) => {
  try {
    if (!ENTITIES.includes(req.params.entity)) {
      return res.status(404).json({ error: `未知实体: ${req.params.entity}` });
    }
    res.json(await listEntity(req.params.entity));
  } catch (err) {
    next(err);
  }
});

app.get('/api/:entity/:id', async (req, res, next) => {
  try {
    if (!ENTITIES.includes(req.params.entity)) {
      return res.status(404).json({ error: `未知实体: ${req.params.entity}` });
    }
    const item = await getEntityById(req.params.entity, req.params.id);
    if (!item) return res.status(404).json({ error: '记录不存在' });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// ---------- 订单写操作 ----------

// 创建订单
app.post('/api/orders', async (req, res, next) => {
  try {
    const o = req.body || {};
    if (!o.orderName || !o.materialId || !o.partId) {
      return res.status(400).json({ error: 'orderName、materialId、partId 为必填项' });
    }
    if (!o.id) {
      o.id = `ORD-${Date.now()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
    }
    const cfg = getEntityConfig('orders');
    await pool.query(cfg.insertSql, cfg.toRow(o));
    res.status(201).json(await getEntityById('orders', o.id));
  } catch (err) {
    next(err);
  }
});

// 状态流转（含回退），服务端校验状态机
app.patch('/api/orders/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body || {};
    const order = await getEntityById('orders', req.params.id);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    if (!status || !statusTransitions[status]) {
      return res.status(400).json({ error: `非法目标状态: ${status}` });
    }
    const transition = statusTransitions[order.orderStatus];
    if (status !== transition.next && status !== transition.prev) {
      return res.status(400).json({ error: `不允许从「${order.orderStatus}」流转到「${status}」` });
    }
    await pool.query('UPDATE orders SET order_status = ? WHERE id = ?', [status, order.id]);
    res.json(await getEntityById('orders', order.id));
  } catch (err) {
    next(err);
  }
});

// 设备匹配：绑定设备并生成默认工艺参数
app.post('/api/orders/:id/match', async (req, res, next) => {
  try {
    const { equipmentId } = req.body || {};
    const order = await getEntityById('orders', req.params.id);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    const equip = await getEntityById('equipment', equipmentId);
    if (!equip) return res.status(400).json({ error: '设备不存在' });

    const processParameters = {
      laserPower: equip.laserMaxPower || 500,
      scanSpeed: 1000,
      layerThickness: 0.03,
      scanStrategy: '棋盘式',
      preheatTemperature: 80,
      shieldingGas: '氩气',
    };
    const scheduleInfo = { ...order.scheduleInfo, equipmentName: equip.equipmentName || '' };
    await pool.query(
      'UPDATE orders SET order_status = ?, matched_equipment_id = ?, process_parameters = ?, schedule_info = ? WHERE id = ?',
      ['已匹配', equipmentId, JSON.stringify(processParameters), JSON.stringify(scheduleInfo), order.id]
    );
    res.json(await getEntityById('orders', order.id));
  } catch (err) {
    next(err);
  }
});

// 排产确认：写入排产信息并更新队列序号
app.post('/api/orders/:id/schedule', async (req, res, next) => {
  try {
    const { scheduleStartTime, scheduleEndTime: scheduleEndTime_, queuePosition, equipmentName } = req.body || {};
    const order = await getEntityById('orders', req.params.id);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    if (!scheduleStartTime) return res.status(400).json({ error: 'scheduleStartTime 为必填项' });

    // 结束时间未提供时，按「每件 2 天 + 最少 1 天」估算（与前端排产弹窗逻辑一致）
    let scheduleEndTime = scheduleEndTime_ || '';
    if (!scheduleEndTime) {
      const days = Math.max(1, order.quantity * 2);
      const end = new Date(scheduleStartTime);
      end.setDate(end.getDate() + days);
      scheduleEndTime = end.toISOString().slice(0, 10);
    }

    // 队列序号未提供时，按同设备已排产订单数 +1 计算
    let queue = queuePosition;
    if (!queue) {
      const [rows] = await pool.query(
        "SELECT COUNT(*) AS cnt FROM orders WHERE matched_equipment_id = ? AND order_status = '已排产' AND id != ?",
        [order.matchedEquipmentId, order.id]
      );
      queue = rows[0].cnt + 1;
    }

    const scheduleInfo = {
      scheduleStartTime,
      scheduleEndTime: scheduleEndTime || '',
      queuePosition: queue,
      equipmentName: equipmentName || order.scheduleInfo?.equipmentName || '',
    };
    await pool.query(
      'UPDATE orders SET order_status = ?, schedule_info = ? WHERE id = ?',
      ['已排产', JSON.stringify(scheduleInfo), order.id]
    );
    res.json(await getEntityById('orders', order.id));
  } catch (err) {
    next(err);
  }
});

// ---------- 错误处理 ----------

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || '服务器内部错误' });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`AM Database API 服务已启动: http://localhost:${port}`);
});
