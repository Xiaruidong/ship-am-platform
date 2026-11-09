import React, { useState } from 'react';
import { Card, Input, Button, Tag, Space, Empty, Spin, Alert, App } from 'antd';
import { useNavigate } from 'react-router-dom';
import DispatchShell from './DispatchShell';
import './dispatch.css';

interface Part { id: string; part_name: string; category_name: string; oem_part_number: string; original_material_code: string }
interface Material { id: string; material_name: string; material_code: string; material_category: string; material_sub_category: string; average_particle_size: number; supplier: string; suggested?: boolean }
interface Equip { equip_id: string; equip_name: string; equip_type: string; laser_max_power: number; build_size_x: number; status: string; node_id: string; node_name: string; location: string; load_rate: number }
interface Node { node_id: string; node_name: string; location: string; scene: string; load_rate: number; device_count: number }
interface Result {
  intent: { source: string; partKeyword: string; materialKeyword: string; quantity: number; urgency: string; scene: string; summary: string };
  chain: { part: Part | null; material: Material | null; equipment: Equip | null; node: Node | null; alternatives: { parts: Part[]; materials: Material[]; nodes: Node[] }; reasoning: string[] };
}

const EXAMPLES = [
  '3号舰柴油机缸体出现裂纹，需要紧急抢修 2 件',
  '海水泵叶轮腐蚀严重，需要316L材料替换 5 个',
  '推进轴联轴器磨损，用17-4PH材料加工 1 件',
  '涡轮叶片出现烧蚀，Inconel 718 补制 12 件',
];

const chainCard = (step: string, title: React.ReactNode, sub?: React.ReactNode, accent?: string) => (
  <div style={{ flex: 1, minWidth: 150, background: '#fff', border: '1px solid #E6E9EE', borderRadius: 10, padding: '12px 14px', position: 'relative' }}>
    <div style={{ fontSize: 11, color: accent || '#006DEA', marginBottom: 6, fontWeight: 600, letterSpacing: '.05em' }}>{step}</div>
    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>{title}</div>
    {sub && <div style={{ fontSize: 11, color: '#6F7785', marginTop: 4, lineHeight: 1.6 }}>{sub}</div>}
  </div>
);

const AiAssistant: React.FC = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<Array<{ q: string; at: string }>>([]);
  const [creating, setCreating] = useState(false);

  // 按匹配结果一键创建需求单（联动生成待派单+候选）
  const createDemand = async () => {
    if (!result) return;
    const { intent, chain } = result;
    if (!chain.part || !chain.material) return;
    setCreating(true);
    try {
      const res = await fetch('/dapi/demands', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_name: intent.summary || text,
          part_id: chain.part.id,
          material_id: chain.material.id,
          quantity: intent.quantity || 1,
          priority: intent.urgency || '普通',
          scene: intent.scene || '岸',
          note: `AI 匹配创建：推荐 ${chain.node?.node_name || '-'}（负荷 ${chain.node?.load_rate ?? '-'}%）`,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '创建失败');
      message.success(`需求单已创建：${d.demand_id} · 订单 ${d.order_id}（待派单，${d.candidates} 个候选）`);
      navigate('/dispatch/decision');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const run = async (q?: string) => {
    const query = (q ?? text).trim();
    if (!query) return;
    setLoading(true); setError(''); setResult(null);
    try {
      let llm: any = null;
      try { llm = JSON.parse(localStorage.getItem('dispatch_llm_config') || 'null'); } catch { /* ignore */ }
      const res = await fetch('/dapi/ai/recommend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: query, llm: llm?.apiKey ? llm : undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error || '匹配失败');
      const data = await res.json();
      setResult(data);
      setHistory((h) => [{ q: query, at: new Date().toLocaleTimeString() }, ...h].slice(0, 8));
    } catch (e) {
      setError(e instanceof Error ? e.message : '匹配失败');
    } finally {
      setLoading(false);
    }
  };

  const c = result?.chain;
  return (
    <DispatchShell>
      <div className="dp-modtitle" style={{ marginBottom: 4 }}>AI 智能匹配助手</div>
      <div style={{ fontSize: 12, color: '#6F7785', marginBottom: 14 }}>
        用自然语言描述故障或需求，自动推荐零部件模型、原材料、设备与制造节点，形成完整数据链
      </div>

      <Card styles={{ body: { padding: 18 } }}>
        <Input.TextArea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例如：3号舰柴油机缸体出现裂纹，需要紧急抢修 2 件"
          onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); void run(); } }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#6F7785' }}>示例：</span>
          {EXAMPLES.map((e) => (
            <Tag key={e} style={{ cursor: 'pointer', fontSize: 12 }} onClick={() => { setText(e); void run(e); }}>{e}</Tag>
          ))}
          <Button type="primary" style={{ marginLeft: 'auto' }} loading={loading} onClick={() => run()}>智能匹配</Button>
        </div>
      </Card>

      {error && <Alert type="error" showIcon message={error} style={{ marginTop: 12 }} />}
      {loading && <div style={{ textAlign: 'center', padding: 40 }}><Spin tip="正在匹配数据链…" /></div>}

      {result && c && (
        <>
          <Card style={{ marginTop: 12 }} styles={{ body: { padding: 16 } }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
              <b style={{ fontSize: 14 }}>需求解析</b>
              <Tag color={result.intent.source === 'llm' ? 'purple' : 'default'}>
                {result.intent.source === 'llm' ? '大模型解析' : result.intent.source === 'rule(fallback)' ? '规则兜底（大模型调用失败）' : '规则匹配'}
              </Tag>
              {result.intent.partKeyword && <Tag color="blue">零部件：{result.intent.partKeyword}</Tag>}
              {result.intent.materialKeyword && <Tag color="cyan">材料：{result.intent.materialKeyword}</Tag>}
              <Tag>数量：{result.intent.quantity}</Tag>
              <Tag color={result.intent.urgency === '紧急' ? 'red' : 'default'}>{result.intent.urgency}</Tag>
              <Tag color="geekblue">场景：{result.intent.scene}</Tag>
            </div>
            <div style={{ fontSize: 12, color: '#6F7785' }}>{result.intent.summary}</div>
          </Card>

          <Card style={{ marginTop: 12 }} styles={{ body: { padding: 16 } }}>
            <div className="dp-modtitle" style={{ marginBottom: 12 }}>推荐数据链</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', flexWrap: 'wrap' }}>
              {chainCard('① 需求', result.intent.summary || '—', `优先级 ${result.intent.urgency} · 场景 ${result.intent.scene} · ${result.intent.quantity} 件`)}
              <div style={{ alignSelf: 'center', color: '#D5DAE1' }}>→</div>
              {chainCard('② 零部件模型', c.part ? c.part.part_name : '未匹配',
                c.part ? `${c.part.category_name} · OEM ${c.part.oem_part_number}\n原始牌号 ${c.part.original_material_code || '-'}` : '建议走模型设计流程')}
              <div style={{ alignSelf: 'center', color: '#D5DAE1' }}>→</div>
              {chainCard('③ 原材料', c.material ? `${c.material.material_name}` : '未匹配',
                c.material ? `${c.material.material_code} · ${c.material.material_category}\n粒径 ${c.material.average_particle_size}μm · ${c.material.supplier}${c.material.suggested ? '\n（按大类近似推荐）' : ''}` : '需人工确认牌号')}
              <div style={{ alignSelf: 'center', color: '#D5DAE1' }}>→</div>
              {chainCard('④ 设备', c.equipment ? c.equipment.equip_name : '暂无',
                c.equipment ? `${c.equipment.equip_type} · 激光 ${c.equipment.laser_max_power}W · 成形 ${c.equipment.build_size_x}mm` : '—')}
              <div style={{ alignSelf: 'center', color: '#D5DAE1' }}>→</div>
              {chainCard('⑤ 制造节点 / 地点', c.node ? c.node.node_name : '暂无',
                c.node ? `${c.node.location} · 负荷 ${c.node.load_rate}% · ${c.node.device_count} 台设备` : '—', '#00b42a')}
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>匹配依据</div>
              {c.reasoning.map((r, i) => (
                <div key={i} style={{ fontSize: 12, color: '#2B313A', padding: '3px 0' }}>· {r}</div>
              ))}
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, color: '#6F7785', marginBottom: 6 }}>其他零部件候选</div>
                <Space wrap size={4}>{c.alternatives.parts.slice(0, 4).map((p) => <Tag key={p.id} style={{ fontSize: 11 }}>{p.part_name}</Tag>)}</Space>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#6F7785', marginBottom: 6 }}>其他材料候选</div>
                <Space wrap size={4}>{c.alternatives.materials.slice(0, 4).map((m) => <Tag key={m.id} style={{ fontSize: 11 }}>{m.material_code}</Tag>)}</Space>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#6F7785', marginBottom: 6 }}>其他节点候选</div>
                <Space wrap size={4}>{c.alternatives.nodes.slice(0, 4).map((n) => <Tag key={n.node_id} style={{ fontSize: 11 }}>{n.node_name}（{n.load_rate}%）</Tag>)}</Space>
              </div>
            </div>

            <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button type="primary" loading={creating} onClick={createDemand}
                disabled={!c.part || !c.material}
                title={!c.part || !c.material ? '零部件或材料未匹配，无法自动创建' : ''}>
                按此结果创建需求单 →
              </Button>
              <Button onClick={() => navigate('/dispatch/decision')}>去派单决策页</Button>
              <Button onClick={() => setResult(null)}>重新匹配</Button>
              <span style={{ fontSize: 12, color: '#6F7785', alignSelf: 'center' }}>
                创建后自动生成待派单与评分候选，可直接派单
              </span>
            </div>
          </Card>
        </>
      )}

      {!result && !loading && (
        <div style={{ marginTop: 40 }}><Empty description="输入故障描述开始智能匹配" /></div>
      )}

      {history.length > 0 && (
        <Card style={{ marginTop: 12 }} styles={{ body: { padding: 16 } }}>
          <div className="dp-modtitle" style={{ marginBottom: 8 }}>本次会话记录</div>
          {history.map((h, i) => (
            <div key={i} style={{ fontSize: 12, color: '#2B313A', padding: '5px 0', borderBottom: i < history.length - 1 ? '1px dashed #F1F3F5' : 'none', cursor: 'pointer' }}
              onClick={() => { setText(h.q); void run(h.q); }}>
              <span style={{ color: '#B8C0CC', marginRight: 8 }}>{h.at}</span>{h.q}
            </div>
          ))}
        </Card>
      )}
    </DispatchShell>
  );
};

export default AiAssistant;
