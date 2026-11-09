import React, { useEffect, useState, useCallback } from 'react';
import { Card, Select, Tag, Button, Progress, Empty, Descriptions, Space, Tabs, Modal, InputNumber, App } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DispatchShell from './DispatchShell';
import './dispatch.css';

interface NodeRow {
  node_id: string; node_name: string; did: string; location: string; scene: string;
  status: string; device_count: number; device_online: number; load_rate: number; last_heartbeat: string | null;
}
interface TaskRow {
  task_id: string; order_id: string; node_id: string; equip_id: string; task_status: string;
  respond_deadline: string | null; planned_start: string | null; planned_end: string | null;
  progress_reported: number; order_status: string; priority: string; quantity: number; order_progress: number;
  order_name: string; scene: string; material_name: string | null; material_code: string | null;
  equip_name: string | null; equip_type: string | null; laser_max_power: number | null;
}

const TASK_ST: Record<string, { color: string; label: string }> = {
  '待应答': { color: 'orange', label: '待应答' },
  '已接受': { color: 'blue', label: '已接受' },
  '执行中': { color: 'processing', label: '执行中' },
  '已完成': { color: 'green', label: '已完成' },
  '已拒绝': { color: 'red', label: '已拒绝' },
};

const NodeWorkbench: React.FC = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [nodeId, setNodeId] = useState<string>(searchParams.get('node') || '');
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [reportTask, setReportTask] = useState<TaskRow | null>(null);
  const [reportVal, setReportVal] = useState(60);
  const [tab, setTab] = useState('active');

  useEffect(() => {
    (async () => {
      const res = await fetch('/dapi/nodes');
      const all: NodeRow[] = await res.json();
      setNodes(all);
      const param = searchParams.get('node');
      const firstMfg = all.find((n) => n.device_count > 0 && !n.node_name.includes('调度中心')) || all[0];
      if (param && all.some((n) => n.node_id === param)) setNodeId(param);
      else if (firstMfg) setNodeId(firstMfg.node_id);
    })();
  }, [searchParams]);

  const loadTasks = useCallback(async () => {
    if (!nodeId) return;
    setLoading(true);
    try {
      const res = await fetch(`/dapi/nodes/${nodeId}/tasks`);
      setTasks(await res.json());
    } catch {
      message.error('任务加载失败');
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  const act = async (task: TaskRow, action: string, extra?: Record<string, unknown>, successText?: string) => {
    setBusy(task.task_id + action);
    try {
      const res = await fetch(`/dapi/tasks/${task.task_id}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extra || {}),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '操作失败');
      message.success(successText || '操作成功');
      await loadTasks();
      setReportTask(null);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy('');
    }
  };

  const node = nodes.find((n) => n.node_id === nodeId);
  const active = tasks.filter((t) => ['待应答', '已接受', '执行中'].includes(t.task_status));
  const done = tasks.filter((t) => !['待应答', '已接受', '执行中'].includes(t.task_status));

  const taskCard = (t: TaskRow) => {
    const st = TASK_ST[t.task_status] || { color: 'default', label: t.task_status };
    const urgent = t.priority === '紧急';
    return (
      <div key={t.task_id} style={{
        border: '1px solid #E6E9EE', borderRadius: 4, padding: '12px 14px', marginBottom: 10,
        borderLeft: urgent ? '3px solid #F53F3F' : undefined, background: '#fff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#006DEA' }}>{t.order_id}</span>
              <Tag color={st.color}>{st.label}</Tag>
              {urgent && <Tag color="red">紧急</Tag>}
              <Tag>{t.scene}</Tag>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{t.order_name}</div>
            <div style={{ fontSize: 12, color: '#6F7785', marginTop: 2 }}>
              {t.material_name || '-'} · ×{t.quantity}
              {t.equip_name ? ` · ${t.equip_name}${t.laser_max_power ? `（${t.laser_max_power}W）` : ''}` : ' · 未绑定设备'}
              {t.planned_start ? ` · 计划 ${String(t.planned_start).slice(0, 10)} ~ ${String(t.planned_end).slice(0, 10)}` : ''}
            </div>
          </div>
          <Space wrap>
            {t.task_status === '待应答' && (
              <>
                <Button type="primary" size="small" loading={busy === t.task_id + 'accept'} onClick={() => act(t, 'accept', {}, '已接单')}>接受</Button>
                <Button size="small" danger loading={busy === t.task_id + 'reject'} onClick={() => act(t, 'reject', { reason: '产能不足' }, '已拒绝并通知调度中心')}>拒绝</Button>
              </>
            )}
            {t.task_status === '已接受' && (
              <Button type="primary" size="small" loading={busy === t.task_id + 'start'} onClick={() => act(t, 'start', {}, '已开工，订单进入生产中')}>开工</Button>
            )}
            {t.task_status === '执行中' && (
              <>
                <Button size="small" onClick={() => { setReportTask(t); setReportVal(Math.min(95, (t.order_progress || 0) + 20)); }}>报工</Button>
                <Button type="primary" size="small" loading={busy === t.task_id + 'complete'} onClick={() => act(t, 'complete', {}, '已完工，订单转入质检')}>完工</Button>
              </>
            )}
            <Button size="small" type="link" style={{ padding: 0 }} onClick={() => navigate(`/dispatch/order/${t.order_id}`)}>订单详情</Button>
          </Space>
        </div>
        <div style={{ marginTop: 10 }}>
          <Progress percent={t.order_progress || 0} size="small" strokeColor="#006DEA" format={(p) => `${p}%`} />
        </div>
      </div>
    );
  };

  return (
    <DispatchShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="dp-modtitle">节点工作台</div>
          <div style={{ fontSize: 12, color: '#6F7785', marginTop: 4 }}>任务接收 · 排产确认 · 开工报工 · 完工交付</div>
        </div>
        <Select value={nodeId || undefined} onChange={(v) => { setNodeId(v); setSearchParams({ node: v }); }} style={{ width: 280 }}
          options={nodes.map((n) => ({ value: n.node_id, label: `${n.node_name}（${n.device_count} 台）` }))} />
      </div>

      {node && (
        <Card styles={{ body: { padding: 16 } }} style={{ marginBottom: 16 }}>
          <Descriptions column={4} size="small" styles={{ label: { color: '#6F7785' } }}>
            <Descriptions.Item label="节点名称">{node.node_name}</Descriptions.Item>
            <Descriptions.Item label="DID"><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{node.did}</span></Descriptions.Item>
            <Descriptions.Item label="地点 / 场景">{node.location} · {node.scene}</Descriptions.Item>
            <Descriptions.Item label="心跳">{String(node.last_heartbeat || '').slice(11, 19)}</Descriptions.Item>
          </Descriptions>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
            {[
              ['在线设备', `${node.device_online}/${node.device_count}`],
              ['当前负荷', `${node.load_rate}%`],
              ['待处理任务', active.length],
              ['已完成任务', done.filter((t) => t.task_status === '已完成').length],
            ].map(([l, v]) => (
              <div key={String(l)} style={{ background: '#F7F8FA', borderRadius: 4, padding: '10px 14px' }}>
                <div style={{ fontSize: 12, color: '#6F7785' }}>{l}</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card styles={{ body: { padding: 16 } }}>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            { key: 'active', label: `待处理任务（${active.length}）` },
            { key: 'done', label: `已完成 / 已拒绝（${done.length}）` },
          ]}
          tabBarExtraContent={<Button size="small" onClick={loadTasks} loading={loading}>刷新</Button>}
        />
        {(tab === 'active' ? active : done).length
          ? (tab === 'active' ? active : done).map(taskCard)
          : <Empty description={tab === 'active' ? '暂无待处理任务' : '暂无已完成任务'} style={{ padding: '40px 0' }} />}
      </Card>

      <Modal
        title="报工进度" open={!!reportTask} onCancel={() => setReportTask(null)}
        onOk={() => reportTask && act(reportTask, 'report', { progress: reportVal }, `已报工 ${reportVal}%`)}
        okText="提交报工" cancelText="取消" confirmLoading={busy.includes('report')}
      >
        {reportTask && (
          <div>
            <div style={{ fontSize: 13, marginBottom: 12 }}>{reportTask.order_id} · {reportTask.order_name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: '#6F7785' }}>当前进度</span>
              <InputNumber min={1} max={99} value={reportVal} onChange={(v) => setReportVal(Number(v || 0))} style={{ width: 120 }} />
              <span style={{ fontSize: 12, color: '#6F7785' }}>%（100% 请使用「完工」）</span>
            </div>
          </div>
        )}
      </Modal>
    </DispatchShell>
  );
};

export default NodeWorkbench;
