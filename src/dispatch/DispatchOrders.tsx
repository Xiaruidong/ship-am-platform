import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, Table, Tag, Input, Select, Button, Row, Col, Statistic, App, Progress } from 'antd';
import { useNavigate } from 'react-router-dom';
import DispatchShell from './DispatchShell';
import './dispatch.css';

interface OrderRow {
  order_id: string; order_name: string; scene: string; priority: string;
  material: string | null; quantity: number; status: string; progress: number;
  node_name: string | null; required_delivery: string | null;
}

const ST_COLOR: Record<string, string> = {
  待派单: 'default', 已派单: 'blue', 生产中: 'green', 质检中: 'orange', 已交付: 'cyan', 已归档: 'default',
};
const STATUS_ORDER = ['待派单', '已派单', '生产中', '质检中', '已交付', '已归档'];

const DispatchOrders: React.FC = () => {
  const navigate = useNavigate();
  const { message: msg } = App.useApp();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('全部');
  const [priority, setPriority] = useState('全部');
  const [scene, setScene] = useState('全部');
  const [kw, setKw] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: '300' });
      if (status !== '全部') p.set('status', status);
      if (priority !== '全部') p.set('priority', priority);
      if (scene !== '全部') p.set('scene', scene);
      const res = await fetch('/dapi/orders?' + p.toString());
      setRows(await res.json());
    } catch {
      msg.error('订单加载失败');
    } finally {
      setLoading(false);
    }
  }, [status, priority, scene, msg]);

  useEffect(() => { void load(); }, [load]);

  const data = useMemo(() => (kw
    ? rows.filter((r) => r.order_id.toLowerCase().includes(kw.toLowerCase()) || r.order_name.toLowerCase().includes(kw.toLowerCase()))
    : rows), [rows, kw]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [rows]);

  const columns = [
    { title: '订单编号', dataIndex: 'order_id', width: 150, render: (v: string) => <span style={{ color: '#006DEA', fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
    {
      title: '订单名称', dataIndex: 'order_name', ellipsis: true,
      render: (v: string, r: OrderRow) => (
        <div>
          <b style={{ fontWeight: 500 }}>{v}</b>
          <div style={{ fontSize: 11, color: '#6F7785' }}>{r.material || '-'} · ×{r.quantity} · {r.scene} 场景</div>
        </div>
      ),
    },
    { title: '优先级', dataIndex: 'priority', width: 76, render: (v: string) => <Tag color={v === '紧急' ? 'red' : v === '高' ? 'orange' : 'default'}>{v}</Tag> },
    { title: '状态', dataIndex: 'status', width: 92, render: (v: string) => <Tag color={ST_COLOR[v] || 'default'}>{v}</Tag> },
    {
      title: '进度', dataIndex: 'progress', width: 120,
      render: (v: number, r: OrderRow) => {
        if (r.status === '待派单') return <span style={{ fontSize: 12, color: '#6F7785' }}>待派单</span>;
        if (r.status === '已派单') return <span style={{ fontSize: 12, color: '#006DEA' }}>待开工</span>;
        return <Progress percent={v} size="small" strokeColor="#006DEA" />;
      },
    },
    { title: '执行节点', dataIndex: 'node_name', width: 160, render: (v: string | null) => v || <span style={{ color: '#97A0AD' }}>未派单</span> },
    { title: '要求交付', dataIndex: 'required_delivery', width: 110, render: (v: string | null) => String(v || '—').slice(0, 10) },
    {
      title: '操作', key: 'act', width: 130,
      render: (_: unknown, r: OrderRow) => (
        <>
          {r.status === '待派单' && (
            <Button type="link" size="small" style={{ padding: 0, marginRight: 8 }} onClick={() => navigate('/dispatch/decision')}>去派单</Button>
          )}
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/dispatch/order/${r.order_id}`)}>详情 →</Button>
        </>
      ),
    },
  ];

  return (
    <DispatchShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="dp-modtitle">订单管理</div>
          <div style={{ fontSize: 12, color: '#6F7785', marginTop: 4 }}>
            全量订单 · 状态机流转 · 点击订单查看生产进度与链上存证
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={load}>刷新</Button>
          <Button type="primary" onClick={() => navigate('/dispatch/demands?new=1')}>＋ 新建需求单</Button>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          ['订单总数', rows.length, '#1A1A1A'],
          ['待派单', counts['待派单'] || 0, '#006DEA'],
          ['生产中', counts['生产中'] || 0, '#00B42A'],
          ['质检中', counts['质检中'] || 0, '#FF7D00'],
          ['已交付', counts['已交付'] || 0, '#0057A8'],
          ['已归档', counts['已归档'] || 0, '#6F7785'],
        ].map(([l, v, c]) => (
          <Col key={String(l)} xs={12} sm={8} md={4}>
            <Card styles={{ body: { padding: '14px 16px' } }}>
              <Statistic title={<span style={{ fontSize: 12 }}>{l as string}</span>} value={v as number}
                valueStyle={{ color: c as string, fontSize: 24, fontWeight: 600 }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card styles={{ body: { padding: 16 } }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input.Search placeholder="搜索订单编号 / 名称…" allowClear onChange={(e) => setKw(e.target.value)} style={{ width: 240 }} />
          <Select value={status} onChange={setStatus} style={{ width: 130 }}
            options={['全部', ...STATUS_ORDER].map((v) => ({ value: v, label: v === '全部' ? '状态：全部' : v }))} />
          <Select value={priority} onChange={setPriority} style={{ width: 130 }}
            options={['全部', '紧急', '高', '普通', '低'].map((v) => ({ value: v, label: v === '全部' ? '优先级：全部' : v }))} />
          <Select value={scene} onChange={setScene} style={{ width: 120 }}
            options={['全部', '舰', '岛', '岸'].map((v) => ({ value: v, label: v === '全部' ? '场景：全部' : v }))} />
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: '#6F7785' }}>共 {data.length} 条</span>
        </div>
        <Table
          dataSource={data}
          columns={columns}
          rowKey="order_id"
          loading={loading}
          size="middle"
          pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50] }}
          onRow={(r) => ({ onClick: () => navigate(`/dispatch/order/${r.order_id}`), style: { cursor: 'pointer' } })}
        />
      </Card>
    </DispatchShell>
  );
};

export default DispatchOrders;
