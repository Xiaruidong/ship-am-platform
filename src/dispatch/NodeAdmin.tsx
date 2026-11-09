import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  App, Button, Card, Descriptions, Drawer, Form, Input, InputNumber, Modal,
  Progress, Select, Space, Statistic, Table, Tabs, Tag, Tooltip, Empty,
} from 'antd';
import DispatchShell from './DispatchShell';
import './dispatch.css';

interface NodeRow {
  node_id: string; did: string; node_name: string; location: string; scene: string;
  status: string; device_count: number; device_online: number; load_rate: number;
  last_heartbeat: string | null; node_type: number;
}
interface MaintRow {
  maint_id: string; node_id: string; maint_type: string; title: string; content: string;
  operator: string; planned_at: string | null; done_at: string | null; status: string; created_at: string;
}
interface VersionRow {
  version_id: string; version_no: string; name: string; changelog: string;
  checksum: string; size_kb: number; status: string; released_at: string | null; created_at: string;
  total: number; installed: number;
}
interface DistRow {
  dist_id: string; version_id: string; node_id: string; status: string; progress: number;
  message: string | null; pushed_at: string | null; ack_at: string | null;
  version_no: string; version_name: string; node_name: string | null; location: string | null;
}
interface PrinterRow {
  printer_id: string; name: string; brand: string; model: string; ip: string | null;
  serial_no: string | null; ams: number; status: string; node_id: string | null;
  last_heartbeat: string | null; last_seen: string | null; running: number;
}
interface OpsEvent {
  event_id?: number; event_type: string; node_id: string | null; ref_id: string | null;
  message: string; actor: string; created_at?: string; at?: string;
}
interface Summary {
  nodes: { total: number; online: number | string | null };
  maintenance: { total: number; open: number | string | null };
  versions: { total: number; released: number | string | null };
  distributions: { total: number; installed: number | string | null; failed: number | string | null };
}

const DIST_ST: Record<string, { color: string; label: string }> = {
  待推送: { color: 'default', label: '待推送' },
  已下发: { color: 'processing', label: '已下发' },
  已安装: { color: 'success', label: '已安装' },
  失败: { color: 'error', label: '失败' },
};
const MAINT_ST: Record<string, string> = {
  待执行: 'orange', 进行中: 'processing', 已完成: 'success', 已取消: 'default',
};
const EV_LABEL: Record<string, string> = {
  'node.created': '单位接入', 'node.updated': '单位维护', 'node.removed': '单位移除',
  'maintenance.created': '新增维护工单', 'maintenance.updated': '维护工单变更',
  'version.created': '版本草稿', 'version.released': '版本发布',
  'version.distributed': '版本下发', 'distribution.ack': '节点回执',
};

const fmt = (v?: string | null) => (v ? String(v).slice(0, 16) : '—');

const NodeAdmin: React.FC = () => {
  const { message } = App.useApp();
  const [tab, setTab] = useState('nodes');
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [dists, setDists] = useState<DistRow[]>([]);
  const [events, setEvents] = useState<OpsEvent[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeVersion, setActiveVersion] = useState<string>('');
  const [printers, setPrinters] = useState<PrinterRow[]>([]);
  const [prtModal, setPrtModal] = useState<{ open: boolean; row?: PrinterRow }>({ open: false });
  const [prtForm] = Form.useForm();
  const [testing, setTesting] = useState('');

  // 单位表单
  const [nodeModal, setNodeModal] = useState<{ open: boolean; row?: NodeRow }>({ open: false });
  const [nodeForm] = Form.useForm();
  // 维护工单
  const [maintDrawer, setMaintDrawer] = useState<{ open: boolean; node?: NodeRow; rows: MaintRow[] }>({ open: false, rows: [] });
  const [maintForm] = Form.useForm();
  // 版本
  const [verModal, setVerModal] = useState(false);
  const [verForm] = Form.useForm();
  // 下发
  const [distModal, setDistModal] = useState<{ open: boolean; version?: VersionRow }>({ open: false });
  const [distForm] = Form.useForm();

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [n, v, d, s, e, prt] = await Promise.all([
        fetch('/dapi/nodes').then((r) => r.json()),
        fetch('/dapi/versions').then((r) => r.json()),
        fetch('/dapi/distributions').then((r) => r.json()),
        fetch('/dapi/ops/summary').then((r) => r.json()),
        fetch('/dapi/ops/events?limit=40').then((r) => r.json()),
        fetch('/dapi/printers').then((r) => r.json()),
      ]);
      setNodes(Array.isArray(n) ? n : []);
      setVersions(Array.isArray(v) ? v : []);
      setDists(Array.isArray(d) ? d : []);
      setSummary(s);
      setEvents(Array.isArray(e) ? e : []);
      setPrinters(Array.isArray(prt) ? prt : []);
      setActiveVersion((cur) => cur || (Array.isArray(v) && v[0] ? v[0].version_id : ''));
    } catch (err) {
      message.error('运维数据加载失败：' + String(err));
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  // 实时事件流（SSE）：收到事件即刷新，模拟"运维动作实时可见"
  const esRef = useRef<EventSource | null>(null);
  useEffect(() => {
    const es = new EventSource('/dapi/ops/stream');
    esRef.current = es;
    es.onmessage = (ev) => {
      try {
        const data: OpsEvent = JSON.parse(ev.data);
        if (data.event_type === 'hello') return;
        setEvents((prev) => [{ ...data, created_at: data.at || new Date().toISOString() }, ...prev].slice(0, 60));
        void loadAll();
      } catch { /* 忽略非法事件 */ }
    };
    es.onerror = () => { /* 浏览器会自动重连 */ };
    return () => { es.close(); esRef.current = null; };
  }, [loadAll]);

  const kpi = useMemo(() => ({
    total: summary?.nodes.total ?? nodes.length,
    online: Number(summary?.nodes.online ?? 0) || nodes.filter((n) => n.status === '在线').length,
    openMaint: Number(summary?.maintenance.open ?? 0),
    installed: Number(summary?.distributions.installed ?? 0),
    distTotal: Number(summary?.distributions.total ?? 0),
    failed: Number(summary?.distributions.failed ?? 0),
  }), [summary, nodes]);

  const openNodeModal = (row?: NodeRow) => {
    setNodeModal({ open: true, row });
    nodeForm.resetFields();
    if (row) nodeForm.setFieldsValue(row);
    else nodeForm.setFieldsValue({ scene: '岸', node_type: 2, device_count: 4, device_online: 4, load_rate: 0 });
  };

  const submitNode = async () => {
    const vals = await nodeForm.validateFields();
    const editing = nodeModal.row;
    const url = editing ? `/dapi/nodes/${editing.node_id}` : '/dapi/nodes';
    const res = await fetch(url, {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vals),
    });
    if (!res.ok) { message.error((await res.json()).error || '保存失败'); return; }
    message.success(editing ? '单位信息已更新' : '单位已接入');
    setNodeModal({ open: false });
    void loadAll();
  };

  const removeNode = (row: NodeRow) => {
    Modal.confirm({
      title: `移除单位「${row.node_name}」？`,
      content: '将同时清除该单位的版本分发与维护记录，有在制任务的单位不允许移除。',
      okButtonProps: { danger: true },
      onOk: async () => {
        const res = await fetch(`/dapi/nodes/${row.node_id}`, { method: 'DELETE' });
        if (!res.ok) { message.error((await res.json()).error || '移除失败'); return; }
        message.success('已移除');
        void loadAll();
      },
    });
  };

  const openMaint = async (row: NodeRow) => {
    const rows: MaintRow[] = await fetch(`/dapi/nodes/${row.node_id}/maintenances`).then((r) => r.json());
    setMaintDrawer({ open: true, node: row, rows });
    maintForm.resetFields();
    maintForm.setFieldsValue({ maint_type: '巡检', status: '待执行' });
  };

  const addMaint = async () => {
    const vals = await maintForm.validateFields();
    const node = maintDrawer.node;
    if (!node) return;
    const res = await fetch(`/dapi/nodes/${node.node_id}/maintenances`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(vals),
    });
    if (!res.ok) { message.error('工单创建失败'); return; }
    message.success('维护工单已创建');
    const rows: MaintRow[] = await fetch(`/dapi/nodes/${node.node_id}/maintenances`).then((r) => r.json());
    setMaintDrawer((s) => ({ ...s, rows }));
    maintForm.resetFields(['title', 'content']);
    void loadAll();
  };

  const finishMaint = async (m: MaintRow) => {
    await fetch(`/dapi/maintenances/${m.maint_id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: '已完成' }),
    });
    const node = maintDrawer.node;
    if (node) {
      const rows: MaintRow[] = await fetch(`/dapi/nodes/${node.node_id}/maintenances`).then((r) => r.json());
      setMaintDrawer((s) => ({ ...s, rows }));
    }
    message.success('工单已完成');
    void loadAll();
  };

  const createVersion = async () => {
    const vals = await verForm.validateFields();
    const res = await fetch('/dapi/versions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(vals),
    });
    if (!res.ok) { message.error((await res.json()).error || '创建失败'); return; }
    message.success('版本草稿已创建');
    setVerModal(false);
    verForm.resetFields();
    void loadAll();
  };

  const releaseVersion = async (v: VersionRow) => {
    const res = await fetch(`/dapi/versions/${v.version_id}/release`, { method: 'POST' });
    if (!res.ok) { message.error((await res.json()).error || '发布失败'); return; }
    message.success(`版本 ${v.version_no} 已发布`);
    void loadAll();
  };

  const distribute = async () => {
    const vals = await distForm.validateFields();
    const v = distModal.version;
    if (!v) return;
    const res = await fetch(`/dapi/versions/${v.version_id}/distribute`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_ids: vals.node_ids }),
    });
    if (!res.ok) { message.error((await res.json()).error || '下发失败'); return; }
    const data = await res.json();
    message.success(`${data.version_no} 已下发 ${data.distributed} 个单位`);
    setDistModal({ open: false });
    setActiveVersion(v.version_id);
    setTab('versions');
    void loadAll();
  };

  const openPrtModal = (row?: PrinterRow) => {
    setPrtModal({ open: true, row });
    prtForm.resetFields();
    if (row) prtForm.setFieldsValue(row);
    else prtForm.setFieldsValue({ brand: 'Bambu Lab', model: 'H2D Combo' });
  };

  const submitPrt = async () => {
    const vals = await prtForm.validateFields();
    const editing = prtModal.row;
    const url = editing ? `/dapi/printers/${editing.printer_id}` : '/dapi/printers';
    const res = await fetch(url, {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vals),
    });
    if (!res.ok) { message.error((await res.json()).error || '保存失败'); return; }
    message.success(editing ? '打印机已更新' : '打印机已登记');
    setPrtModal({ open: false });
    void loadAll();
  };

  const testPrt = async (row: PrinterRow) => {
    setTesting(row.printer_id);
    try {
      const res = await fetch(`/dapi/printers/${row.printer_id}/test`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) message.success(`${row.name}：${data.message}`);
      else message.warning(`${row.name}：${data.message}`);
    } finally {
      setTesting('');
      void loadAll();
    }
  };

  // 模拟节点端回执（真实环境由节点端调用同一接口上报）
  const ackDist = async (d: DistRow, status: string) => {
    await fetch(`/dapi/distributions/${d.dist_id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, progress: status === '已安装' ? 100 : d.progress }),
    });
    void loadAll();
  };

  const nodeCols = [
    { title: '单位 / 节点', dataIndex: 'node_name', render: (v: string, r: NodeRow) => (
      <div>
        <div style={{ fontWeight: 500 }}>{v}</div>
        <div style={{ fontSize: 12, color: '#8C8C8C' }}>{r.did}</div>
      </div>
    ) },
    { title: '所在位置', dataIndex: 'location', width: 140 },
    { title: '场景', dataIndex: 'scene', width: 70, render: (v: string) => <Tag>{v}</Tag> },
    { title: '状态', dataIndex: 'status', width: 80, render: (v: string) => (
      <Tag color={v === '在线' ? 'success' : 'default'}>{v}</Tag>
    ) },
    { title: '设备（在线/总数）', width: 130, render: (_: unknown, r: NodeRow) => `${r.device_online} / ${r.device_count}` },
    { title: '负荷', dataIndex: 'load_rate', width: 140, render: (v: number) => (
      <Progress percent={v} size="small" status={v >= 85 ? 'exception' : 'normal'} />
    ) },
    { title: '最近心跳', dataIndex: 'last_heartbeat', width: 150, render: fmt },
    {
      title: '操作', width: 200, render: (_: unknown, r: NodeRow) => (
        <Space size={4}>
          <Button size="small" onClick={() => openNodeModal(r)}>编辑</Button>
          <Button size="small" onClick={() => openMaint(r)}>维护</Button>
          <Button size="small" danger onClick={() => removeNode(r)}>移除</Button>
        </Space>
      ),
    },
  ];

  const verCols = [
    { title: '版本号', dataIndex: 'version_no', width: 110, render: (v: string) => <b>{v}</b> },
    { title: '名称', dataIndex: 'name', width: 150 },
    { title: '状态', dataIndex: 'status', width: 90, render: (v: string) => (
      <Tag color={v === '已发布' ? 'success' : v === '草稿' ? 'default' : 'warning'}>{v}</Tag>
    ) },
    { title: '安装覆盖', width: 170, render: (_: unknown, r: VersionRow) => (
      <Tooltip title={`${r.installed || 0}/${r.total || 0} 个节点已安装`}>
        <Progress percent={r.total ? Math.round(((r.installed || 0) / r.total) * 100) : 0} size="small" />
      </Tooltip>
    ) },
    { title: '发布时间', dataIndex: 'released_at', width: 150, render: fmt },
    {
      title: '操作', width: 170, render: (_: unknown, r: VersionRow) => (
        <Space size={4}>
          {r.status === '草稿' && <Button size="small" type="primary" onClick={() => releaseVersion(r)}>发布</Button>}
          {r.status === '已发布' && (
            <Button size="small" onClick={() => {
              setDistModal({ open: true, version: r });
              distForm.setFieldsValue({ node_ids: nodes.map((n) => n.node_id) });
            }}>下发</Button>
          )}
          <Button size="small" type="link" onClick={() => setActiveVersion(r.version_id)}>分发明细</Button>
        </Space>
      ),
    },
  ];

  const distCols = [
    { title: '节点 / 单位', dataIndex: 'node_name', render: (v: string | null, r: DistRow) => (
      <div>
        <div>{v || r.node_id}</div>
        <div style={{ fontSize: 12, color: '#8C8C8C' }}>{r.location || '—'}</div>
      </div>
    ) },
    { title: '版本', dataIndex: 'version_no', width: 100 },
    { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => (
      <Tag color={DIST_ST[v]?.color}>{v}</Tag>
    ) },
    { title: '安装进度', dataIndex: 'progress', width: 160, render: (v: number, r: DistRow) => (
      <Progress percent={v} size="small" status={r.status === '失败' ? 'exception' : r.status === '已安装' ? 'success' : 'active'} />
    ) },
    { title: '下发时间', dataIndex: 'pushed_at', width: 150, render: fmt },
    { title: '回执时间', dataIndex: 'ack_at', width: 150, render: fmt },
    { title: '备注', dataIndex: 'message', width: 110, render: (v: string | null) => v || '—' },
    {
      title: '模拟节点回执', width: 180, render: (_: unknown, r: DistRow) => (
        <Space size={4}>
          <Button size="small" disabled={r.status === '已安装'} onClick={() => ackDist(r, '已安装')}>已安装</Button>
          <Button size="small" disabled={r.status === '失败'} onClick={() => ackDist(r, '失败')}>失败</Button>
        </Space>
      ),
    },
  ];

  const activeDist = dists.filter((d) => !activeVersion || d.version_id === activeVersion);
  const activeVer = versions.find((v) => v.version_id === activeVersion);

  return (
    <DispatchShell>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>节点运维后台</h2>
        <span style={{ color: '#8C8C8C', fontSize: 13 }}>单位接入 · 维护工单 · 版本分发 · 实时同步</span>
        <div style={{ flex: 1 }} />
        <Tag color={esRef.current ? 'success' : 'default'}>
          {esRef.current ? '实时通道已连接' : '实时通道重连中'}
        </Tag>
        <Button size="small" onClick={() => void loadAll()} loading={loading}>刷新</Button>
      </div>

      <div className="dp-kpis" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <Card className="dp-kpi" size="small"><Statistic title="接入单位" value={kpi.total} suffix="个" /></Card>
        <Card className="dp-kpi" size="small"><Statistic title="在线节点" value={kpi.online} suffix="个" valueStyle={{ color: '#00B42A' }} /></Card>
        <Card className="dp-kpi" size="small"><Statistic title="待办维护" value={kpi.openMaint} suffix="张" valueStyle={{ color: kpi.openMaint ? '#FF7D00' : undefined }} /></Card>
        <Card className="dp-kpi" size="small">
          <Statistic title="版本安装覆盖" value={kpi.distTotal ? Math.round((kpi.installed / kpi.distTotal) * 100) : 0} suffix="%" />
        </Card>
        <Card className="dp-kpi" size="small"><Statistic title="分发失败" value={kpi.failed} suffix="个" valueStyle={{ color: kpi.failed ? '#F53F3F' : undefined }} /></Card>
      </div>

      <Card size="small" style={{ marginTop: 16 }}>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            {
              key: 'nodes',
              label: `单位接入与维护（${nodes.length}）`,
              children: (
                <>
                  <div style={{ display: 'flex', marginBottom: 10 }}>
                    <Button type="primary" size="small" onClick={() => openNodeModal()}>＋ 接入新单位</Button>
                  </div>
                  <Table
                    rowKey="node_id" size="small" loading={loading}
                    dataSource={nodes} columns={nodeCols as never} pagination={{ pageSize: 8, size: 'small' }}
                  />
                </>
              ),
            },
            {
              key: 'versions',
              label: `版本分发（${versions.length}）`,
              children: (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 8 }}>
                    <Button type="primary" size="small" onClick={() => { setVerModal(true); verForm.resetFields(); }}>
                      ＋ 新建版本
                    </Button>
                    <span style={{ color: '#8C8C8C', fontSize: 12 }}>
                      版本发布后可按单位下发，节点端通过回执接口上报安装结果
                    </span>
                  </div>
                  <Table
                    rowKey="version_id" size="small" dataSource={versions} columns={verCols as never}
                    pagination={false} onRow={(r) => ({ onClick: () => setActiveVersion(r.version_id) })}
                  />
                  <div style={{ margin: '16px 0 8px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span className="dp-modtitle">分发明细</span>
                    <span style={{ fontSize: 12, color: '#8C8C8C' }}>
                      {activeVer ? `${activeVer.version_no} · ${activeDist.length} 条` : '选择上方版本查看明细'}
                    </span>
                  </div>
                  <Table
                    rowKey="dist_id" size="small" dataSource={activeDist} columns={distCols as never}
                    pagination={{ pageSize: 8, size: 'small' }}
                    locale={{ emptyText: <Empty description="该版本尚未下发" /> }}
                  />
                </>
              ),
            },
            {
              key: 'printers',
              label: `打印机（${printers.length}）`,
              children: (
                <>
                  <div style={{ display: 'flex', marginBottom: 10 }}>
                    <Button type="primary" size="small" onClick={() => openPrtModal()}>＋ 登记打印机</Button>
                    <span style={{ color: '#8C8C8C', fontSize: 12, marginLeft: 12, alignSelf: 'center' }}>
                      局域网模式：打印机与服务器同网段，填写 IP / 序列号 / 访问码即可直控（拓竹 H2D 等）
                    </span>
                  </div>
                  <Table
                    rowKey="printer_id" size="small" dataSource={printers} pagination={false}
                    columns={[
                      { title: '名称', dataIndex: 'name', render: (v: string, r: PrinterRow) => (
                        <div>
                          <div style={{ fontWeight: 500 }}>{v}</div>
                          <div style={{ fontSize: 12, color: '#8C8C8C' }}>{r.model}{r.ams ? ' · 多色' : ''}</div>
                        </div>
                      ) },
                      { title: 'IP', dataIndex: 'ip', width: 130, render: (v: string | null) => v || <span style={{ color: '#B8C0CC' }}>未配置</span> },
                      { title: '序列号', dataIndex: 'serial_no', width: 150, render: (v: string | null) => v || '—' },
                      { title: '状态', dataIndex: 'status', width: 90, render: (v: string) => (
                        <Tag color={v === '在线' ? 'success' : 'default'}>{v}</Tag>
                      ) },
                      { title: '在打任务', dataIndex: 'running', width: 90 },
                      { title: '最近在线', dataIndex: 'last_seen', width: 150, render: fmt },
                      { title: '操作', width: 190, render: (_: unknown, r: PrinterRow) => (
                        <Space size={4}>
                          <Button size="small" loading={testing === r.printer_id} onClick={() => void testPrt(r)}>连通测试</Button>
                          <Button size="small" onClick={() => openPrtModal(r)}>编辑</Button>
                        </Space>
                      ) },
                    ] as never}
                    locale={{ emptyText: <Empty description="尚未登记打印机" /> }}
                  />
                </>
              ),
            },
            {
              key: 'events',
              label: `实时事件（${events.length}）`,
              children: (
                <Table
                  rowKey={(r: OpsEvent) => String(r.event_id ?? r.at ?? Math.random())}
                  size="small" dataSource={events} pagination={{ pageSize: 12, size: 'small' }}
                  columns={[
                    { title: '时间', width: 170, render: (_: unknown, r: OpsEvent) => fmt(r.created_at || r.at) },
                    { title: '类型', width: 130, render: (_: unknown, r: OpsEvent) => (
                      <Tag color="blue">{EV_LABEL[r.event_type] || r.event_type}</Tag>
                    ) },
                    { title: '内容', dataIndex: 'message' },
                    { title: '节点', dataIndex: 'node_id', width: 180, render: (v: string | null) => v || '—' },
                    { title: '操作人', dataIndex: 'actor', width: 100 },
                  ] as never}
                  locale={{ emptyText: <Empty description="暂无运维事件" /> }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* 单位接入 / 编辑 */}
      <Modal
        open={nodeModal.open} title={nodeModal.row ? '编辑单位' : '接入新单位'}
        onCancel={() => setNodeModal({ open: false })} onOk={submitNode} okText="保存"
      >
        <Form form={nodeForm} layout="vertical" size="small">
          <Form.Item name="node_name" label="单位 / 节点名称" rules={[{ required: true }]}>
            <Input placeholder="如：宁波 · 制造节点" />
          </Form.Item>
          <Form.Item name="location" label="所在位置" rules={[{ required: true }]}>
            <Input placeholder="如：宁波北仑" />
          </Form.Item>
          <Space style={{ width: '100%' }} size={12}>
            <Form.Item name="scene" label="应用场景" style={{ width: 150 }}>
              <Select options={[{ value: '岸' }, { value: '舰' }, { value: '岛' }]} />
            </Form.Item>
            <Form.Item name="node_type" label="节点类型" style={{ width: 170 }}>
              <Select options={[
                { value: 1, label: '调度中心' }, { value: 2, label: '制造节点' },
                { value: 3, label: '检测机构' }, { value: 4, label: '应急制造' },
              ]} />
            </Form.Item>
            <Form.Item name="status" label="状态" style={{ width: 120 }}>
              <Select options={[{ value: '在线' }, { value: '离线' }]} />
            </Form.Item>
          </Space>
          <Space size={12}>
            <Form.Item name="device_count" label="设备总数" style={{ width: 130 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="device_online" label="在线设备" style={{ width: 130 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="load_rate" label="当前负荷 %" style={{ width: 130 }}>
              <InputNumber min={0} max={100} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* 维护工单 */}
      <Drawer
        open={maintDrawer.open} width={640}
        title={`维护工单 · ${maintDrawer.node?.node_name || ''}`}
        onClose={() => setMaintDrawer({ open: false, rows: [] })}
      >
        {maintDrawer.node && (
          <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="节点编号">{maintDrawer.node.node_id}</Descriptions.Item>
            <Descriptions.Item label="DID">{maintDrawer.node.did}</Descriptions.Item>
            <Descriptions.Item label="位置">{maintDrawer.node.location}</Descriptions.Item>
            <Descriptions.Item label="设备">{maintDrawer.node.device_online}/{maintDrawer.node.device_count}</Descriptions.Item>
          </Descriptions>
        )}
        <Card size="small" title="新建工单" style={{ marginBottom: 16 }}>
          <Form form={maintForm} layout="vertical" size="small">
            <Space size={12} style={{ width: '100%' }}>
              <Form.Item name="maint_type" label="类型" style={{ width: 130 }}>
                <Select options={[{ value: '巡检' }, { value: '检修' }, { value: '标定' }, { value: '升级' }]} />
              </Form.Item>
              <Form.Item name="planned_at" label="计划时间" style={{ width: 200 }}>
                <Input placeholder="2026-11-08 09:00:00" />
              </Form.Item>
            </Space>
            <Form.Item name="title" label="标题" rules={[{ required: true }]}>
              <Input placeholder="如：季度设备巡检" />
            </Form.Item>
            <Form.Item name="content" label="内容">
              <Input.TextArea rows={2} placeholder="检查项、注意事项" />
            </Form.Item>
            <Button type="primary" size="small" onClick={addMaint}>创建工单</Button>
          </Form>
        </Card>
        <Table
          rowKey="maint_id" size="small" dataSource={maintDrawer.rows} pagination={false}
          columns={[
            { title: '类型', dataIndex: 'maint_type', width: 70 },
            { title: '标题', dataIndex: 'title' },
            { title: '状态', dataIndex: 'status', width: 90, render: (v: string) => <Tag color={MAINT_ST[v]}>{v}</Tag> },
            { title: '计划时间', dataIndex: 'planned_at', width: 150, render: fmt },
            {
              title: '操作', width: 90, render: (_: unknown, r: MaintRow) => (
                r.status !== '已完成'
                  ? <Button size="small" type="link" onClick={() => finishMaint(r)}>完成</Button>
                  : <span style={{ color: '#B8C0CC' }}>—</span>
              ),
            },
          ] as never}
          locale={{ emptyText: <Empty description="暂无维护工单" /> }}
        />
      </Drawer>

      {/* 新建版本 */}
      <Modal open={verModal} title="新建节点端版本" onCancel={() => setVerModal(false)} onOk={createVersion} okText="创建草稿">
        <Form form={verForm} layout="vertical" size="small">
          <Form.Item name="version_no" label="版本号" rules={[{ required: true }]}>
            <Input placeholder="如：v1.5.0" />
          </Form.Item>
          <Form.Item name="name" label="版本名称" rules={[{ required: true }]}>
            <Input placeholder="如：节点端主程序" />
          </Form.Item>
          <Form.Item name="changelog" label="更新说明">
            <Input.TextArea rows={3} placeholder="本次变更内容" />
          </Form.Item>
          <Form.Item name="size_kb" label="安装包大小 KB">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 打印机登记 */}
      <Modal
        open={prtModal.open} title={prtModal.row ? '编辑打印机' : '登记打印机'}
        onCancel={() => setPrtModal({ open: false })} onOk={submitPrt} okText="保存"
      >
        <Form form={prtForm} layout="vertical" size="small">
          <Form.Item name="name" label="打印机名称" rules={[{ required: true }]}>
            <Input placeholder="如：H2D-01 车间机" />
          </Form.Item>
          <Form.Item name="model" label="型号" rules={[{ required: true }]}>
            <Input placeholder="Bambu Lab H2D Combo" />
          </Form.Item>
          <Form.Item name="ip" label="局域网 IP">
            <Input placeholder="如：192.168.1.50（联调时填写）" />
          </Form.Item>
          <Form.Item name="serial_no" label="序列号">
            <Input placeholder="打印机 设置 → 设备信息 中查看" />
          </Form.Item>
          <Form.Item name="access_code" label="访问码（局域网模式）">
            <Input.Password placeholder="打印机 屏幕/App 中获取" />
          </Form.Item>
          <Space>
            <Form.Item name="ams" label="多色系统" style={{ marginBottom: 0 }}>
              <Select style={{ width: 110 }} allowClear placeholder="无"
                options={[{ value: 1, label: '带 AMS' }, { value: 0, label: '单色' }]} />
            </Form.Item>
            <Form.Item name="node_id" label="归属节点" style={{ width: 240 }}>
              <Select
                allowClear placeholder="选择所属单位"
                options={nodes.map((n) => ({ value: n.node_id, label: n.node_name }))}
              />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* 下发 */}
      <Modal
        open={distModal.open} title={`下发版本 ${distModal.version?.version_no || ''}`}
        onCancel={() => setDistModal({ open: false })} onOk={distribute} okText="确认下发"
      >
        <p style={{ color: '#8C8C8C', fontSize: 13 }}>
          选择接收单位，下发后节点端会收到推送并回报安装进度。
        </p>
        <Form form={distForm} layout="vertical" size="small">
          <Form.Item name="node_ids" label="接收单位" rules={[{ required: true, message: '至少选择一个单位' }]}>
            <Select
              mode="multiple" allowClear
              options={nodes.map((n) => ({ value: n.node_id, label: `${n.node_name}（${n.location}）` }))}
              placeholder="可多选，默认全部"
            />
          </Form.Item>
        </Form>
      </Modal>
    </DispatchShell>
  );
};

export default NodeAdmin;
