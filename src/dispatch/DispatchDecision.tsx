import React, { useEffect, useState, useCallback } from 'react';
import { Card, Tag, Button, App } from 'antd';
import DispatchShell from './DispatchShell';
import { dispatchApi, OrderRow, Candidate } from './api';
import './dispatch.css';

const dims: Array<[string, string, number]> = [
  ['材料适配', 'material', 30], ['负荷余量', 'load', 20], ['地理就近', 'proximity', 15], ['资质历史', 'qualification', 20],
];

const DispatchDecision: React.FC = () => {
  const { message } = App.useApp();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [cur, setCur] = useState<number>(-1);
  const [cands, setCands] = useState<Candidate[]>([]);
  const [sel, setSel] = useState<number>(-1);
  const [busy, setBusy] = useState(false);

  const loadOrders = useCallback(async () => {
    const list = await dispatchApi.orders({ status: '待派单', limit: 30 });
    setOrders(list);
    return list;
  }, []);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const selectOrder = async (i: number) => {
    setCur(i); setSel(-1); setCands([]);
    setCands(await dispatchApi.candidates(orders[i].order_id));
  };

  const confirm = async () => {
    if (sel < 0 || cur < 0) return;
    setBusy(true);
    try {
      const r = await dispatchApi.dispatchOrder(orders[cur].order_id, cands[sel].node_id);
      message.success(`派单成功：已派至 ${r.node}，合约空间 ${r.contract_space_id} 已创建并上链存证`);
      setCur(-1); setCands([]); setSel(-1);
      await loadOrders();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '派单失败');
    } finally {
      setBusy(false);
    }
  };

  const o = cur >= 0 ? orders[cur] : null;
  const risks = (c: Candidate): Array<[string, string]> => {
    const r: Array<[string, string]> = [];
    if (c.score >= 85) r.push(['ok', '✓ 综合评分优秀']);
    if ((c.reason?.load ?? 20) < 15) r.push(['bad', '✗ 节点负荷偏高，排产可能延迟']);
    if (c.node_name.includes('舰')) r.push(['warn', '⚠ 弱网节点，数据同步存在延迟风险']);
    if ((c.reason?.qualification ?? 0) < 18) r.push(['warn', '⚠ 该节点此类材料历史成交较少']);
    return r;
  };

  return (
    <DispatchShell>
      <div style={{ display: 'grid', gridTemplateColumns: '4fr 8fr', gap: 12, alignItems: 'start' }}>
        <Card styles={{ body: { padding: 16 } }}>
          <div className="dp-modtitle" style={{ marginBottom: 12 }}>
            待派单订单 <small style={{ fontWeight: 400, color: '#6F7785', fontSize: 12, marginLeft: 6 }}>共 {orders.length} 单</small>
          </div>
          <div className="dp-plist">
            {orders.length ? orders.map((p, i) => (
              <div key={p.order_id} className={`dp-pitem${i === cur ? ' on' : ''}${p.priority === '紧急' ? ' urgent' : ''}`} onClick={() => selectOrder(i)}>
                <span style={{ fontSize: 12, color: '#006DEA', fontWeight: 600 }}>{p.order_id}</span>
                <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.order_name}</div>
                <div style={{ fontSize: 11, color: '#6F7785', display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Tag color={p.priority === '紧急' ? 'red' : 'default'} style={{ marginRight: 0, fontSize: 11, lineHeight: '16px' }}>{p.priority}</Tag>
                  <Tag color="blue" style={{ marginRight: 0, fontSize: 11, lineHeight: '16px' }}>{p.scene}</Tag>
                  <span>{p.material || ''} · ×{p.quantity}</span>
                  <span>交付 {String(p.required_delivery).slice(0, 10)}</span>
                </div>
              </div>
            )) : <div style={{ color: '#6F7785', textAlign: 'center', padding: '60px 0', fontSize: 13 }}>暂无待派单订单 🎉</div>}
          </div>
        </Card>

        <div>
          <Card styles={{ body: { padding: 16 } }}>
            {!o ? (
              <div style={{ color: '#6F7785', textAlign: 'center', padding: '60px 0', fontSize: 13 }}>← 请选择左侧待派单订单</div>
            ) : (
              <>
                <div className="dp-modtitle">{o.order_name} <small className="ord" style={{ fontWeight: 400, color: '#6F7785', fontSize: 12, marginLeft: 6 }}>{o.order_id}</small></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, margin: '12px 0 14px' }}>
                  {[[o.material || '-', `材料 · ×${o.quantity}`], [String(o.required_delivery).slice(0, 10), '要求交付'], [o.scene, '场景'], [o.priority, '优先级']].map(([v, l], i) => (
                    <div key={String(l)} style={{ background: '#f7f8fa', borderRadius: 6, padding: '8px 12px' }}>
                      <b style={{ fontSize: 14, color: i === 3 && o.priority === '紧急' ? '#f53f3f' : '#1A1A1A' }}>{v}</b>
                      <div style={{ fontSize: 11, color: '#6F7785' }}>{l}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: '#2B313A', marginBottom: 10 }}>候选节点（评分引擎生成，点击选择）：</div>
                <div className="dp-cands">
                  {cands.map((c, k) => (
                    <div key={c.node_id} className={`dp-cand${k === 0 ? ' best' : ''}${k === sel ? ' on' : ''}`} onClick={() => setSel(k)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{c.node_name.split(' · ')[0]}</div>
                          <div style={{ fontSize: 11, color: '#6F7785' }}>{c.node_name}</div>
                        </div>
                        <div style={{ fontSize: 30, fontWeight: 700, color: '#006DEA', lineHeight: 1 }}>{c.score}<small style={{ fontSize: 11, color: '#6F7785', fontWeight: 400 }}>/100</small></div>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        {dims.map(([n, key, max]) => (
                          <div key={key} className="dp-dim">
                            <span>{n}</span>
                            <div className="dp-dimtrack"><i style={{ width: `${Math.round((c.reason?.[key] || 0) / max * 100)}%` }} /></div>
                            <span>{c.reason?.[key] ?? 0}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        {(risks(c).length ? risks(c) : [['ok', '✓ 无显著风险']] as Array<[string, string]>).map(([cls, t], i) => (
                          <div key={i} className="dp-risk" style={{ color: cls === 'bad' ? '#f53f3f' : cls === 'warn' ? '#ff7d00' : '#00b42a', background: cls === 'bad' ? '#ffece8' : cls === 'warn' ? '#fff7e8' : '#e8ffea' }}>{t}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
          {o && (
            <div style={{ marginTop: 12, background: '#fff', border: '1px solid #E6E9EE', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, fontSize: 12, color: '#6F7785', minWidth: 220 }}>
                {sel >= 0
                  ? <>将派单至 <b>{cands[sel].node_name}</b>（推荐分 {cands[sel].score}）· 确认后自动创建合约空间、生成节点任务并上链存证</>
                  : '请先在上方选择一个候选节点'}
              </div>
              <Button onClick={() => { setCur(-1); setCands([]); setSel(-1); }}>暂缓</Button>
              <Button type="primary" disabled={sel < 0 || busy} loading={busy} onClick={confirm}>确认派单 →</Button>
            </div>
          )}
        </div>
      </div>
    </DispatchShell>
  );
};

export default DispatchDecision;
