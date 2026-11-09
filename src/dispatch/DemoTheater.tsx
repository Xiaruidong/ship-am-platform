import React, { useRef, useState } from 'react';
import { Card, Button, Tag, Progress, App } from 'antd';
import { useNavigate } from 'react-router-dom';
import DispatchShell from './DispatchShell';
import './dispatch.css';

type StepState = 'pending' | 'running' | 'done' | 'error';
interface Step { title: string; note: string; state: StepState; result?: string }

const SCRIPT: Array<{ title: string; note: string }> = [
  { title: '① 需求发起', note: '舰上发现海水泵叶轮腐蚀，提交应急抢修需求（紧急 · 舰场景 · 3 件）' },
  { title: '② AI 智能匹配', note: '解析故障描述，匹配零部件模型、原材料、设备与制造节点，生成数据链' },
  { title: '③ 智能派单', note: '按评分选择最优节点，确认派单——自动创建合约空间并上链存证' },
  { title: '④ 节点接单', note: '制造节点工作台收到待应答任务，确认接受' },
  { title: '⑤ 开工生产', note: '节点启动增材制造，订单进入生产中' },
  { title: '⑥ 过程报工', note: '生产进度实时回报（60%）' },
  { title: '⑦ 完工转质检', note: '制造完成，订单转入质检中' },
  { title: '⑧ 一虚两实比对', note: '海上实体件快检 vs 岸基复现件全检，与调度中心真理源数据包比对一致性' },
  { title: '⑨ 质检交付', note: '一致性达标，确认交付——上链存证' },
  { title: '⑩ 归档确权', note: '合约空间归档、权限自动回收——全程可追溯闭环完成' },
];

const DemoTheater: React.FC = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [steps, setSteps] = useState<Step[]>(SCRIPT.map((s) => ({ ...s, state: 'pending' as StepState })));
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [score, setScore] = useState('');
  const pausedRef = useRef(false);
  const abortRef = useRef(false);

  const api = async <T,>(url: string, opts?: RequestInit): Promise<T> => {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
    const d = await res.json();
    if (!res.ok) throw new Error((d as any).error || '请求失败');
    return d as T;
  };
  const sleep = (ms: number) => new Promise<void>((resolve) => {
    const start = Date.now();
    const check = () => {
      if (abortRef.current) return resolve();
      if (Date.now() - start >= ms && !pausedRef.current) return resolve();
      setTimeout(check, 150);
    };
    check();
  });

  const mark = (i: number, state: StepState, result?: string) =>
    setSteps((prev) => prev.map((s, k) => (k === i ? { ...s, state, result } : s)));

  const run = async () => {
    setRunning(true); setDone(false); abortRef.current = false; pausedRef.current = false;
    setSteps(SCRIPT.map((s) => ({ ...s, state: 'pending' as StepState })));
    setOrderId(''); setScore('');
    try {
      // 清理历史演示单
      await api('/dapi/demo/reset', { method: 'POST' });
      let oid = '';

      // ① 需求发起
      mark(0, 'running');
      await sleep(1600);
      const dem = await api<{ order_id: string }>('/dapi/demands', {
        method: 'POST',
        body: JSON.stringify({ order_name: '【演示】某舰应急海水泵叶轮抢修', part_id: 'part-002', material_id: 'mat-001', quantity: 3, priority: '紧急', scene: '舰', note: '演示剧场自动创建' }),
      });
      oid = dem.order_id; setOrderId(oid);
      mark(0, 'done', `需求单已受理，订单 ${oid}（待派单）`);

      // ② AI 匹配
      mark(1, 'running');
      await sleep(1400);
      const ai = await api<{ chain: { part: { part_name: string } | null; material: { material_code: string } | null; equipment: { equip_name: string } | null; node: { node_name: string } | null } }>('/dapi/ai/recommend', {
        method: 'POST', body: JSON.stringify({ text: '【演示】某舰海水泵叶轮腐蚀严重，需要316L材料紧急抢修 3 件' }),
      });
      mark(1, 'done', `${ai.chain.part?.part_name ?? '—'} → ${ai.chain.material?.material_code ?? '—'} → ${ai.chain.equipment?.equip_name ?? '—'} → ${ai.chain.node?.node_name.split(' · ')[0] ?? '—'}`);

      // ③ 智能派单
      mark(2, 'running');
      await sleep(1500);
      const cands = await api<Array<{ node_id: string; node_name: string; score: number }>>(`/dapi/candidates?order_id=${oid}`);
      const best = cands[0];
      const disp = await api<{ contract_space_id: string }>(`/dapi/orders/${oid}/dispatch`, {
        method: 'POST', body: JSON.stringify({ node_id: best.node_id }),
      });
      mark(2, 'done', `派至 ${best.node_name.split(' · ')[0]}（${best.score} 分）· 合约 ${disp.contract_space_id} 已上链`);

      // 节点任务
      const tasks = await api<Array<{ task_id: string; order_id: string }>>(`/dapi/nodes/${best.node_id}/tasks`);
      const task = tasks.find((t) => t.order_id === oid);

      // ④ 接单
      mark(3, 'running'); await sleep(1300);
      await api(`/dapi/tasks/${task!.task_id}/accept`, { method: 'POST' });
      mark(3, 'done', '节点已确认接单（响应窗口内）');

      // ⑤ 开工
      mark(4, 'running'); await sleep(1300);
      await api(`/dapi/tasks/${task!.task_id}/start`, { method: 'POST' });
      mark(4, 'done', '订单进入生产中');

      // ⑥ 报工
      mark(5, 'running'); await sleep(1400);
      await api(`/dapi/tasks/${task!.task_id}/report`, { method: 'POST', body: JSON.stringify({ progress: 60 }) });
      mark(5, 'done', '生产进度 60% 已回报');

      // ⑦ 完工
      mark(6, 'running'); await sleep(1400);
      await api(`/dapi/tasks/${task!.task_id}/complete`, { method: 'POST' });
      mark(6, 'done', '制造完成，订单转入质检中');

      // ⑧ 一虚两实
      mark(7, 'running'); await sleep(1600);
      const qc = await api<{ consistency_score: number; verdict: string }>(`/dapi/orders/${oid}/twin-qc/run`, { method: 'POST' });
      setScore(String(qc.consistency_score));
      mark(7, 'done', `一致性 ${qc.consistency_score} 分 · ${qc.verdict}`);

      // ⑨ 交付
      mark(8, 'running'); await sleep(1300);
      await api(`/dapi/orders/${oid}/transition`, { method: 'POST', body: JSON.stringify({ status: '已交付' }) });
      mark(8, 'done', '交付完成，交易上链存证');

      // ⑩ 归档
      mark(9, 'running'); await sleep(1400);
      await api(`/dapi/orders/${oid}/transition`, { method: 'POST', body: JSON.stringify({ status: '已归档' }) });
      mark(9, 'done', '合约归档 · 权限回收 · 闭环完成');

      setDone(true);
      message.success('演示完成：从故障到交付归档全程落地，关键环节已上链');
    } catch (e) {
      const cur = steps.findIndex((s) => s.state === 'running');
      if (cur >= 0) mark(cur, 'error', e instanceof Error ? e.message : '失败');
      message.error(e instanceof Error ? e.message : '演示中断');
    } finally {
      setRunning(false);
    }
  };

  const doneCount = steps.filter((s) => s.state === 'done').length;

  return (
    <DispatchShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="dp-modtitle">演示剧场 · 一单到底</div>
          <div style={{ fontSize: 12, color: '#6F7785', marginTop: 4 }}>
            一键运行完整业务闭环：需求发起 → AI 匹配 → 智能派单 → 节点生产 → 孪生质检 → 交付归档（全程真实落库、关键环节上链）
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {running && (
            <Button onClick={() => { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); }}>
              {paused ? '▶ 继续' : '⏸ 暂停'}
            </Button>
          )}
          <Button onClick={() => { abortRef.current = true; setRunning(false); }} disabled={!running}>停止</Button>
          <Button type="primary" size="large" loading={running} onClick={run} disabled={running}>
            {running ? `演示中 ${doneCount}/${steps.length}` : done ? '再演示一遍' : '▶ 开始演示'}
          </Button>
        </div>
      </div>

      <Card styles={{ body: { padding: 20 } }}>
        <Progress percent={Math.round((doneCount / steps.length) * 100)} strokeColor="#006DEA" style={{ marginBottom: 18 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 860 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, position: 'relative', paddingBottom: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', fontSize: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: s.state === 'done' ? '#00B42A' : s.state === 'running' ? '#006DEA' : s.state === 'error' ? '#F53F3F' : '#F1F3F5',
                  color: s.state === 'pending' ? '#97A0AD' : '#fff',
                  fontWeight: 600,
                  boxShadow: s.state === 'running' ? '0 0 0 4px rgba(0,109,234,0.15)' : 'none',
                }}>
                  {s.state === 'done' ? '✓' : s.state === 'error' ? '✕' : i + 1}
                </div>
                {i < steps.length - 1 && <div style={{ width: 2, flex: 1, background: steps[i + 1]?.state === 'pending' ? '#E6E9EE' : '#006DEA', marginTop: 4, opacity: 0.4 }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 14, fontWeight: 600, color: s.state === 'pending' ? '#97A0AD' : '#1A1A1A' }}>{s.title}</b>
                  {s.state === 'running' && <Tag color="blue" style={{ animation: 'pulse 1.2s infinite' }}>执行中…</Tag>}
                </div>
                <div style={{ fontSize: 12, color: '#6F7785', marginTop: 2 }}>{s.note}</div>
                {s.result && (
                  <div style={{
                    fontSize: 12, marginTop: 6, padding: '4px 10px', borderRadius: 3,
                    background: s.state === 'error' ? '#FFECE8' : '#E8FFEA', color: s.state === 'error' ? '#D93636' : '#007A20',
                  }}>
                    {s.result}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {done && (
          <div style={{ marginTop: 8, padding: '16px 20px', background: '#EDF5FF', borderRadius: 6, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <b style={{ fontSize: 14 }}>✅ 演示闭环完成</b>
              <div style={{ fontSize: 12, color: '#0057A8', marginTop: 4 }}>
                订单 {orderId} · 孪生质检一致性 {score} 分 · 全程事件已上链存证
              </div>
            </div>
            <Button type="primary" onClick={() => navigate(`/dispatch/order/${orderId}`)}>查看订单详情与存证时间线 →</Button>
            <Button onClick={() => navigate('/dispatch')}>回协同总览 →</Button>
          </div>
        )}
      </Card>
      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .45; } }`}</style>
    </DispatchShell>
  );
};

export default DemoTheater;
