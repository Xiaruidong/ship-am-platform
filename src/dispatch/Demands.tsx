import React, { useEffect, useState, useCallback } from 'react';
import { Card, Table, Tag, Input, Select, Button, Modal, Form, InputNumber, Statistic, Row, Col, App } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DispatchShell from './DispatchShell';
import { useMaterials, useParts } from '../api/hooks';
import './dispatch.css';

interface DemandRow {
  demand_id: string; source_type: number; scene: string; part_desc: string;
  priority: string; deadline: string | null; demand_status: string; created_at: string;
  item_count: number; parts: string | null; total_qty: number;
  order_count: number; pending_orders: number;
  order_id: string | null; order_status: string | null;
  cand_count: number;
}

const SOURCE_LABEL: Record<number, string> = { 1: '终端上报', 2: 'Web 录入', 3: 'API 对接' };
const stColor = (s: string | null): string => ({
  待派单: 'default', 已派单: 'blue', 生产中: 'green', 质检中: 'orange', 已交付: 'default', 已归档: 'default',
}[s || ''] || 'default');

const Demands: React.FC = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<DemandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fStatus] = useState('全部');
  const [fScene, setFScene] = useState('全部');
  const [fPriority, setFPriority] = useState('全部');
  const [kw, setKw] = useState('');
  const [modalOpen, setModalOpen] = useState(searchParams.get('new') === '1');
  const [busy, setBusy] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState('');
  const [form] = Form.useForm();
  const { data: materials } = useMaterials();
  const { data: parts } = useParts();

  // AI 解析自然语言并预填表单（零部件/材料/数量/优先级/场景）
  const aiFill = async () => {
    if (!aiText.trim()) { message.warning('请先输入故障描述'); return; }
    setAiBusy(true); setAiNote('');
    try {
      const res = await fetch('/dapi/ai/recommend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText }),
      });
      const d = await res.json();
      const { intent, chain } = d;
      const notes: string[] = [];
      const firstItem: Record<string, unknown> = { quantity: intent.quantity || 1 };
      if (chain.part) { firstItem.part_id = chain.part.id; notes.push(`零部件：${chain.part.part_name}`); }
      else notes.push('零部件未匹配，请手动选择');
      if (chain.material) { firstItem.material_id = chain.material.id; notes.push(`材料：${chain.material.material_code}${chain.material.suggested ? '（近似推荐）' : ''}`); }
      else notes.push('材料未匹配，请手动选择');
      if (chain.node) notes.push(`建议节点：${chain.node.node_name.split(' · ')[0]}（负荷 ${chain.node.load_rate}%）`);
      // 只覆盖第一条明细，保留用户已添加的其他明细
      form.setFieldsValue({ order_name: aiText.trim(), priority: intent.urgency || '普通', scene: intent.scene || '岸' });
      form.setFieldValue(['items', 0], firstItem);
      setAiNote(`已填充第 1 条明细 → ${notes.join(' ｜ ')}${intent.quantity ? '' : ''}；如涉及多个零部件请点下方「添加明细」`);
      message.success('AI 解析完成，已填充表单');
    } catch {
      message.error('AI 解析失败，请手动填写');
    } finally {
      setAiBusy(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (fStatus !== '全部') p.set('status', fStatus);
      if (fScene !== '全部') p.set('scene', fScene);
      if (fPriority !== '全部') p.set('priority', fPriority);
      p.set('limit', '50');
      const res = await fetch('/dapi/demands?' + p.toString());
      const data: DemandRow[] = await res.json();
      setRows(kw
        ? data.filter((r) => r.part_desc.toLowerCase().includes(kw.toLowerCase()) || r.demand_id.toLowerCase().includes(kw.toLowerCase()))
        : data);
    } catch {
      message.error('需求单加载失败');
    } finally {
      setLoading(false);
    }
  }, [fStatus, fScene, fPriority, kw]);

  useEffect(() => { void load(); }, [load]);

  const stats = {
    total: rows.length,
    pending: rows.reduce((sum, r) => sum + (r.pending_orders || 0), 0),
    urgent: rows.filter((r) => r.priority === '紧急').length,
    ship: rows.filter((r) => r.scene === '舰').length,
  };

  const submit = async () => {
    const v = await form.validateFields();
    setBusy(true);
    try {
      const res = await fetch('/dapi/demands', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...v, deadline: v.deadline ? `${v.deadline} 00:00:00` : undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '创建失败');
      message.success(`需求单已创建：${d.demand_id} · ${d.item_count} 条明细 → ${d.order_ids?.length || 1} 张待派单（每单 ${d.candidates} 个候选）`);
      form.resetFields();
      setModalOpen(false);
      await load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建失败');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { title: '需求单', dataIndex: 'demand_id', width: 150, render: (v: string) => <span style={{ color: '#006DEA', fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
    {
      title: '描述 / 明细', ellipsis: true,
      render: (_: unknown, r: DemandRow) => (
        <div>
          <b style={{ fontWeight: 500 }}>{r.part_desc}</b>
          <small style={{ color: '#6F7785', marginLeft: 6 }}>{r.item_count} 项：{r.parts || '—'}</small>
        </div>
      ),
    },
    { title: '场景', dataIndex: 'scene', width: 64, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '优先级', dataIndex: 'priority', width: 76, render: (v: string) => <Tag color={v === '紧急' ? 'red' : v === '高' ? 'orange' : 'default'}>{v}</Tag> },
    { title: '总数量', dataIndex: 'total_qty', width: 74, align: 'right' as const },
    { title: '来源', dataIndex: 'source_type', width: 88, render: (v: number) => SOURCE_LABEL[v] || v },
    {
      title: '订单状态', width: 130,
      render: (_: unknown, r: DemandRow) => r.pending_orders > 0
        ? <Tag color="blue">{r.pending_orders}/{r.order_count} 单待派</Tag>
        : r.order_id
          ? <Tag color={stColor(r.order_status)} style={{ cursor: 'pointer' }} onClick={() => navigate(`/dispatch/order/${r.order_id}`)}>{r.order_status} <small>（{r.order_count} 单）</small></Tag>
          : <Tag>未转单</Tag>,
    },
    { title: '操作', key: 'act', width: 140, render: (_: unknown, r: DemandRow) => (
      r.pending_orders > 0 && r.cand_count > 0
        ? <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate('/dispatch/decision')}>去派单（{r.cand_count} 候选）</Button>
        : r.order_id
          ? <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/dispatch/order/${r.order_id}`)}>详情 →</Button>
          : '—'
    ) },
  ];

  return (
    <DispatchShell>
      <div className="dp-modtitle" style={{ marginBottom: 4 }}>需求单管理</div>
      <div style={{ fontSize: 12, color: '#6F7785', marginBottom: 14 }}>
        多渠道需求统一接入 · 创建后自动转待派单并生成评分候选
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          ['需求单总数', stats.total, '#1A1A1A'],
          ['待派单', stats.pending, '#006DEA'],
          ['紧急', stats.urgent, '#F53F3F'],
          ['舰场景', stats.ship, '#0058C2'],
        ].map(([l, v, c]) => (
          <Col key={String(l)} xs={12} md={6}><Card styles={{ body: { padding: '14px 18px' } }}><Statistic title={<span style={{ fontSize: 12 }}>{l as string}</span>} value={v as number} valueStyle={{ color: c as string, fontSize: 26, fontWeight: 600 }} /></Card></Col>
        ))}
      </Row>

      <Card styles={{ body: { padding: 16 } }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input.Search placeholder="搜索描述 / 需求单号…" allowClear onChange={(e) => setKw(e.target.value)} style={{ width: 240 }} />
          <Select value={fPriority} onChange={setFPriority} style={{ width: 110 }} options={['全部', '紧急', '高', '普通', '低'].map((v) => ({ value: v, label: v === '全部' ? '优先级：全部' : v }))} />
          <Select value={fScene} onChange={setFScene} style={{ width: 110 }} options={['全部', '舰', '岛', '岸'].map((v) => ({ value: v, label: v === '全部' ? '场景：全部' : v }))} />
          <div style={{ flex: 1 }} />
          <Button onClick={() => load()}>刷新</Button>
          <Button type="primary" onClick={() => setModalOpen(true)}>＋ 新建需求单</Button>
        </div>
        <Table dataSource={rows} columns={columns} rowKey="demand_id" loading={loading} size="middle"
          pagination={{ pageSize: 10, showSizeChanger: false }} />
      </Card>

      <Modal
        title="新建需求单" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={submit}
        confirmLoading={busy} okText="创建并转待派单" cancelText="取消" width={640}
      >
        <Form form={form} layout="vertical" initialValues={{ priority: '普通', scene: '岸', items: [{ quantity: 1 }] }}>
          {/* AI 智能填写：自然语言一键解析预填表单 */}
          <div style={{ background: '#EDF5FF', border: '1px solid #B8D8FF', borderRadius: 4, padding: '10px 12px', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#006DEA', marginBottom: 6 }}>AI 智能填写</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input.TextArea rows={2} value={aiText} onChange={(e) => setAiText(e.target.value)}
                placeholder="用一句话描述故障，如：3号舰柴油机缸体出现裂纹，需要紧急抢修 2 件" style={{ flex: 1 }} />
              <Button type="primary" loading={aiBusy} onClick={aiFill} style={{ alignSelf: 'flex-end' }}>AI 解析并填充</Button>
            </div>
            {aiNote && <div style={{ fontSize: 12, color: '#0057A8', marginTop: 6 }}>{aiNote}</div>}
          </div>
          <Form.Item name="order_name" label="需求描述" rules={[{ required: true, message: '请输入需求描述' }]}>
            <Input placeholder="如：3号舰柴油机缸体裂纹，紧急抢修（可由 AI 自动填充）" />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: '#2B313A' }}>
              需求明细 <span style={{ color: '#6F7785', fontSize: 12 }}>（一次故障可涉及多个零部件与多种原材料，每行生成一张待派单）</span>
            </span>
          </div>
          <Form.List
            name="items"
            rules={[{
              validator: async (_, items) => {
                if (!items || !items.length) throw new Error('至少填写一条明细');
              },
            }]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                {fields.map((field, idx) => (
                  <div key={field.key} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 90px 32px', gap: 8, alignItems: 'start', marginBottom: 4 }}>
                    <Form.Item
                      name={[field.name, 'part_id']}
                      rules={[{ required: true, message: idx === 0 ? '请选择零部件' : '必选' }]}
                      style={{ marginBottom: 10 }}
                    >
                      <Select showSearch optionFilterProp="label" placeholder={`零部件 ${idx + 1}`}
                        options={parts.map((p) => ({ value: p.id, label: `${p.partName}（${p.originalMaterialCode}）` }))} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'material_id']}
                      rules={[{ required: true, message: idx === 0 ? '请选择材料' : '必选' }]}
                      style={{ marginBottom: 10 }}
                    >
                      <Select showSearch optionFilterProp="label" placeholder={`原材料 ${idx + 1}`}
                        options={materials.map((m) => ({ value: m.id, label: `${m.materialName}（${m.materialCode}）` }))} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'quantity']} rules={[{ required: true, message: '数量' }]} style={{ marginBottom: 10 }}>
                      <InputNumber min={1} placeholder="数量" style={{ width: '100%' }} />
                    </Form.Item>
                    <Button
                      type="text" danger disabled={fields.length === 1}
                      onClick={() => remove(field.name)} title={fields.length === 1 ? '至少保留一条明细' : '删除该明细'}
                      style={{ marginTop: 1 }}
                    >删</Button>
                  </div>
                ))}
                <Form.Item style={{ marginBottom: 14 }}>
                  <Button type="dashed" onClick={() => add({ quantity: 1 })} block>＋ 添加零部件/原材料明细</Button>
                  <Form.ErrorList errors={errors} />
                </Form.Item>
              </>
            )}
          </Form.List>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="priority" label="优先级"><Select options={['紧急', '高', '普通', '低'].map((v) => ({ value: v }))} /></Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="scene" label="场景"><Select options={['舰', '岛', '岸'].map((v) => ({ value: v }))} /></Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="deadline" label="交付日期">
                <Input type="date" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="note" label="备注"><Input.TextArea rows={2} placeholder="故障现象、特殊要求等" /></Form.Item>
          <div style={{ fontSize: 12, color: '#6F7785', background: '#F7F8FA', borderRadius: 4, padding: '8px 12px' }}>
            提交后自动：生成需求单（已受理）→ 创建待派单 → 按节点负荷生成 3 个评分候选 → 可直接前往派单决策
          </div>
        </Form>
      </Modal>
    </DispatchShell>
  );
};

export default Demands;
