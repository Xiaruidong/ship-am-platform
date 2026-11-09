import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  App, Badge, Button, Card, Descriptions, Empty, Input, Progress, Select, Space, Steps, Tag,
} from 'antd';
import DispatchShell from './DispatchShell';
import './dispatch.css';

interface NodeRow {
  node_id: string; did: string; node_name: string; location: string; scene: string;
  status: string; device_count: number; device_online: number; load_rate: number;
  last_heartbeat: string | null;
}
interface DistRow {
  dist_id: string; version_id: string; node_id: string; status: string; progress: number;
  message: string | null; pushed_at: string | null; ack_at: string | null;
  version_no: string; version_name: string; changelog?: string;
}
interface PrinterRow {
  printer_id: string; name: string; model: string; ip: string | null;
  status: string; ams: number; running: number;
}
interface PrintJobRow {
  job_id: string; order_id: string; printer_id: string; file_name: string;
  status: string; progress: number; nozzle_temp: number | null; bed_temp: number | null;
  simulated: number; message: string | null; started_at: string | null;
  printer_name: string; order_name: string | null;
}
interface MaintRow {
  maint_id: string; maint_type: string; title: string; status: string;
  planned_at: string | null; content: string;
}

const DIST_ST: Record<string, { color: string; text: string }> = {
  待推送: { color: 'default', text: '待推送' },
  已下发: { color: 'processing', text: '已下发，待安装' },
  已安装: { color: 'success', text: '已安装' },
  失败: { color: 'error', text: '安装失败' },
};

const NodeClient: React.FC = () => {
  const { message } = App.useApp();
  const [nodeId, setNodeId] = useState('');
  const [node, setNode] = useState<NodeRow | null>(null);
  const [dists, setDists] = useState<DistRow[]>([]);
  const [maints, setMaints] = useState<MaintRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [printers, setPrinters] = useState<PrinterRow[]>([]);
  const [jobs, setJobs] = useState<PrintJobRow[]>([]);
  const [pickOrder, setPickOrder] = useState('');
  const [pickPrinter, setPickPrinter] = useState('');
  const [sending, setSending] = useState(false);
  const [nodeOrders, setNodeOrders] = useState<Array<{ order_id: string; order_name: string; status: string }>>([]);
  // 正在模拟安装的 dist_id -> 定时器句柄
  const installing = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    try {
      const nodeRes = await fetch(`/dapi/nodes/${encodeURIComponent(id)}`);
      if (!nodeRes.ok) { setNode(null); setDists([]); setNotFound(true); return; }
      const nodeData: NodeRow & { maintenances: MaintRow[]; distributions: DistRow[] } = await nodeRes.json();
      const distRes = await fetch(`/dapi/distributions?node_id=${encodeURIComponent(id)}`);
      const distData: DistRow[] = await distRes.json();
      setNode(nodeData);
      setMaints(nodeData.maintenances || []);
      const [prtRes, jobRes] = await Promise.all([
        fetch('/dapi/printers'), fetch('/dapi/print-jobs'),
      ]);
      const prt: PrinterRow[] = await prtRes.json();
      const jb: PrintJobRow[] = await jobRes.json();
      setPrinters(Array.isArray(prt) ? prt : []);
      setJobs(Array.isArray(jb) ? jb : []);
      setPickPrinter((cur) => cur || (prt[0] ? prt[0].printer_id : ''));
      try {
        const t = await fetch(`/dapi/nodes/${encodeURIComponent(id)}/tasks`);
        const tasks: Array<{ order_id: string; order_name: string; order_status: string }> = await t.json();
        setNodeOrders((Array.isArray(tasks) ? tasks : []).map((x) => ({ order_id: x.order_id, order_name: x.order_name, status: x.order_status })));
      } catch { setNodeOrders([]); }
      setDists(Array.isArray(distData) ? distData : []);
    } catch {
      message.error('节点端数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => () => {
    // 离开页面清理所有模拟安装定时器
    Object.values(installing.current).forEach(clearInterval);
  }, []);

  // 打印任务进度轮询
  const jobsTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    jobsTimer.current = setInterval(async () => {
      if (!nodeId) return;
      try {
        const res = await fetch('/dapi/print-jobs');
        const jb: PrintJobRow[] = await res.json();
        if (Array.isArray(jb)) setJobs(jb);
      } catch { /* 忽略 */ }
    }, 2500);
    return () => { if (jobsTimer.current) clearInterval(jobsTimer.current); };
  }, [nodeId]);

  const sendPrint = async () => {
    if (!pickOrder || !pickPrinter) { message.warning('请选择订单和打印机'); return; }
    setSending(true);
    try {
      const res = await fetch('/dapi/print-jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: pickOrder, printer_id: pickPrinter }),
      });
      const data = await res.json();
      if (!res.ok) { message.error(data.error || '下发失败'); return; }
      message.success(`已下发到 ${data.message || '打印机'}`);
      const jb: PrintJobRow[] = await fetch('/dapi/print-jobs').then((r) => r.json());
      setJobs(Array.isArray(jb) ? jb : []);
    } finally { setSending(false); }
  };

  const cancelJob = async (id: string) => {
    await fetch(`/dapi/print-jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
    message.warning('打印任务已取消');
    const jb: PrintJobRow[] = await fetch('/dapi/print-jobs').then((r) => r.json());
    setJobs(Array.isArray(jb) ? jb : []);
  };

  const report = async (distId: string, body: Record<string, unknown>) => {
    const res = await fetch(`/dapi/distributions/${encodeURIComponent(distId)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  };

  // 模拟节点端安装过程：进度 20 → 55 → 85 → 100，每步上报一次，最后报"已安装"
  const startInstall = (d: DistRow) => {
    if (installing.current[d.dist_id]) return;
    message.info(`开始安装 ${d.version_no}…`);
    let step = 0;
    const stages = [
      { progress: 20, status: '已下发', msg: '下载安装包' },
      { progress: 55, status: '已下发', msg: '校验文件完整性' },
      { progress: 85, status: '已下发', msg: '写入固件' },
      { progress: 100, status: '已安装', msg: '安装完成，自检通过' },
    ];
    installing.current[d.dist_id] = setInterval(async () => {
      const st = stages[step];
      step += 1;
      const ok = await report(d.dist_id, { status: st.status, progress: st.progress, message: st.msg });
      if (!ok || step >= stages.length) {
        clearInterval(installing.current[d.dist_id]);
        delete installing.current[d.dist_id];
        if (ok) message.success(`${d.version_no} ${st.msg}`);
        else message.error('上报失败');
      }
      setDists((prev) => prev.map((x) => (x.dist_id === d.dist_id
        ? { ...x, status: st.status, progress: st.progress, message: st.msg } : x)));
    }, 900);
  };

  const reportFail = async (d: DistRow) => {
    const ok = await report(d.dist_id, { status: '失败', progress: d.progress, message: '节点端上报：磁盘空间不足' });
    if (ok) {
      message.warning(`已上报 ${d.version_no} 安装失败`);
      setDists((prev) => prev.map((x) => (x.dist_id === d.dist_id
        ? { ...x, status: '失败', message: '节点端上报：磁盘空间不足' } : x)));
    }
  };

  const pending = dists.filter((d) => d.status !== '已安装');
  const current = dists.find((d) => d.status === '已下发') || dists[0];

  return (
    <DispatchShell>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>节点端</h2>
        <span style={{ color: '#8C8C8C', fontSize: 13 }}>接收平台版本下发 · 上报安装进度</span>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Input
            style={{ width: 280 }} size="small" allowClear
            placeholder="输入节点编号，如 NOD-006"
            value={nodeId}
            onChange={(e) => setNodeId(e.target.value.trim())}
            onPressEnter={() => void load(nodeId)}
          />
          <Button type="primary" size="small" loading={loading} onClick={() => void load(nodeId)}>登录本节点</Button>
          {node && <Tag color="success">已连接：{node.node_name}</Tag>}
        </Space>
        {notFound && <div style={{ color: '#F53F3F', marginTop: 8, fontSize: 13 }}>节点编号不存在，请核对后重试</div>}
      </Card>

      {!node && !notFound && (
        <Card size="small"><Empty description="输入节点编号后，本页即模拟该节点端视角" style={{ padding: '40px 0' }} /></Card>
      )}

      {node && (
        <>
          <Card size="small" style={{ marginBottom: 16 }} title="节点信息">
            <Descriptions size="small" column={4}>
              <Descriptions.Item label="节点编号">{node.node_id}</Descriptions.Item>
              <Descriptions.Item label="DID">{node.did}</Descriptions.Item>
              <Descriptions.Item label="位置">{node.location}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Badge status={node.status === '在线' ? 'success' : 'default'} text={node.status} />
              </Descriptions.Item>
              <Descriptions.Item label="设备">{node.device_online}/{node.device_count} 在线</Descriptions.Item>
              <Descriptions.Item label="负荷">{node.load_rate}%</Descriptions.Item>
              <Descriptions.Item label="最近心跳">{node.last_heartbeat || '—'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            size="small" style={{ marginBottom: 16 }} title="版本升级"
            extra={<span style={{ fontSize: 12, color: '#8C8C8C' }}>{pending.length} 个待安装</span>}
          >
            {dists.length === 0 && <Empty description="平台尚未向本节点下发版本" style={{ padding: '24px 0' }} />}
            {dists.map((d) => (
              <div key={d.dist_id} style={{ padding: '12px 4px', borderBottom: '1px solid #F2F3F5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <b style={{ fontFamily: 'monospace' }}>{d.version_no}</b>
                  <span>{d.version_name}</span>
                  <Tag color={DIST_ST[d.status]?.color}>{DIST_ST[d.status]?.text || d.status}</Tag>
                  {d.message && <span style={{ fontSize: 12, color: '#8C8C8C' }}>{d.message}</span>}
                  <div style={{ flex: 1 }} />
                  {d.status === '已下发' && (
                    <>
                      <Button size="small" type="primary" onClick={() => startInstall(d)}>安装</Button>
                      <Button size="small" danger onClick={() => void reportFail(d)}>上报失败</Button>
                    </>
                  )}
                  {d.status === '失败' && (
                    <Button size="small" onClick={() => startInstall(d)}>重试安装</Button>
                  )}
                </div>
                <Progress
                  percent={d.progress} size="small" style={{ maxWidth: 480, marginTop: 6 }}
                  status={d.status === '失败' ? 'exception' : d.status === '已安装' ? 'success' : 'active'}
                />
                <div style={{ fontSize: 12, color: '#8C8C8C', marginTop: 2 }}>
                  下发时间 {d.pushed_at || '—'} · 回执时间 {d.ack_at || '—'}
                </div>
              </div>
            ))}
          </Card>

          {current && (
            <Card size="small" title={`安装过程演示 · ${current.version_no}`} style={{ marginBottom: 16 }}>
              <Steps
                size="small"
                items={[
                  { title: '平台下发', description: current.pushed_at?.slice(0, 16) || '—',
                    status: 'finish' },
                  { title: '下载校验', status: current.progress >= 55 ? 'finish' : current.progress > 0 ? 'process' : 'wait' },
                  { title: '写入安装', status: current.progress >= 100 ? 'finish' : current.progress >= 85 ? 'process' : 'wait' },
                  { title: '回执平台', status: current.status === '已安装' ? 'finish' : 'wait',
                    description: current.ack_at?.slice(0, 16) },
                ]}
              />
            </Card>
          )}

          <Card
            size="small" title="发送打印任务" style={{ marginBottom: 16 }}
            extra={<span style={{ fontSize: 12, color: '#8C8C8C' }}>订单 → 打印机</span>}
          >
            <Space wrap>
              <Select
                size="small" style={{ width: 260 }} placeholder="选择订单"
                value={pickOrder || undefined} onChange={setPickOrder}
                options={nodeOrders.map((o) => ({ value: o.order_id, label: `${o.order_id} · ${o.order_name}` }))}
              />
              <Select
                size="small" style={{ width: 220 }} placeholder="选择打印机"
                value={pickPrinter || undefined} onChange={setPickPrinter}
                options={printers.map((p) => ({
                  value: p.printer_id,
                  label: `${p.name}（${p.status}${p.ams ? '·AMS' : ''}）`,
                }))}
              />
              <Button size="small" type="primary" loading={sending} onClick={() => void sendPrint()}>开始打印</Button>
            </Space>
            {jobs.length > 0 && (
              <div style={{ marginTop: 12 }}>
                {jobs.slice(0, 6).map((j) => (
                  <div key={j.job_id} style={{ padding: '8px 4px', borderBottom: '1px solid #F2F3F5' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <b style={{ fontFamily: 'monospace', fontSize: 12 }}>{j.order_id}</b>
                      <span style={{ fontSize: 12, color: '#8C8C8C', flex: 1 }}>
                        {j.printer_name}{j.simulated ? '（模拟驱动）' : '（MQTT 直控）'} · {j.message}
                      </span>
                      <Tag color={j.status === '已完成' ? 'success' : j.status === '失败' ? 'error' : 'processing'}>{j.status}</Tag>
                      {j.status === '打印中' && (
                        <Button size="small" danger onClick={() => void cancelJob(j.job_id)}>取消</Button>
                      )}
                    </div>
                    <Progress
                      percent={j.progress} size="small" style={{ maxWidth: 480, marginTop: 4 }}
                      status={j.status === '失败' ? 'exception' : j.status === '已完成' ? 'success' : 'active'}
                    />
                    {j.status === '打印中' && (
                      <div style={{ fontSize: 12, color: '#8C8C8C' }}>
                        喷头 {j.nozzle_temp ?? '—'}°C · 热床 {j.bed_temp ?? '—'}°C
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card size="small" title={`平台维护工单（${maints.length}）`}>
            {maints.length === 0 && <Empty description="暂无工单" style={{ padding: '16px 0' }} />}
            {maints.map((m) => (
              <div key={m.maint_id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 4px', borderBottom: '1px solid #F2F3F5' }}>
                <Tag>{m.maint_type}</Tag>
                <span>{m.title}</span>
                <span style={{ color: '#8C8C8C', fontSize: 12, flex: 1 }}>{m.content}</span>
                <span style={{ fontSize: 12, color: '#8C8C8C' }}>计划 {m.planned_at?.slice(0, 10) || '—'}</span>
                <Tag color={m.status === '已完成' ? 'success' : 'orange'}>{m.status}</Tag>
              </div>
            ))}
          </Card>
        </>
      )}
    </DispatchShell>
  );
};

export default NodeClient;
