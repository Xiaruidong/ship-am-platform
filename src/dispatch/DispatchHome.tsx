import React, { useEffect, useState, useCallback } from 'react';
import { Card, Tag, Tooltip, App } from 'antd';
import { useNavigate } from 'react-router-dom';
import DispatchShell from './DispatchShell';
import { dispatchApi, Kpi, OrderRow, NodeRow, Meta } from './api';
import './dispatch.css';

const stColor = (s: string): string => ({
  待派单: 'default', 已派单: 'blue', 生产中: 'green', 质检中: 'orange', 已交付: 'default', 已归档: 'default',
}[s] || 'default');

const DispatchHome: React.FC = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [contracts, setContracts] = useState<Awaited<ReturnType<typeof dispatchApi.contracts>> | null>(null);
  const [events, setEvents] = useState<Awaited<ReturnType<typeof dispatchApi.events>>>([]);
  const [fp, setFp] = useState('全部');
  const [fs, setFs] = useState('全部');

  const loadAll = useCallback(async () => {
    try {
      const [k, m, o, n, c, e] = await Promise.all([
        dispatchApi.kpi(), dispatchApi.meta(),
        dispatchApi.orders({ priority: fp, scene: fs, limit: 10 }),
        dispatchApi.nodes(), dispatchApi.contracts(), dispatchApi.events(9),
      ]);
      setKpi(k); setMeta(m); setOrders(o); setNodes(n); setContracts(c); setEvents(e);
    } catch {
      message.error('数据加载失败，请确认派发查询服务(3002)已启动');
    }
  }, [fp, fs]);

  useEffect(() => {
    void loadAll();
    const t = setInterval(loadAll, 30000);
    return () => clearInterval(t);
  }, [loadAll]);

  const kpiCards = kpi && [
    { ico: '需', label: '今日新增需求', val: kpi.todayNewDemands, d: kpi.demandDelta > 0 ? `↑ ${kpi.demandDelta} 较昨日` : '— 持平', tip: '当日 0 点以来新增需求单（三渠道合计）', alert: false },
    { ico: '派', label: '待派单', val: kpi.pendingDispatch, d: '', tip: '已受理且尚未确认派单的订单', alert: false },
    { ico: '产', label: '生产中', val: kpi.inProduction, d: '', tip: '节点已开工、未完工的订单', alert: false },
    { ico: '检', label: '质检中', val: kpi.inInspection, d: '', tip: '完工转入检测/比对的订单', alert: false },
    { ico: '交', label: '按期交付率', val: `${kpi.onTimeRate}%`, d: '近 30 天口径', tip: '近 30 天已交付订单中按期交付占比', alert: false },
    { ico: '!', label: '待处理异常', val: kpi.abnormal, d: '', tip: '未关闭且需处理的异常订单', alert: true },
  ];

  return (
    <DispatchShell>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>协同总览</div>
        {meta && (
          <div style={{ fontSize: 11, color: '#6F7785' }}>
            数据截止 <b>{meta.asOf}</b>｜共 <b>{meta.onlineNodes}</b> 个在线节点｜链上区块 <b>#{meta.blockHeight.toLocaleString()}</b>
          </div>
        )}
      </div>

      {kpiCards && (
        <div className="dp-kpis">
          {kpiCards.map((k) => (
            <Card key={k.label} className="dp-kpi" styles={{ body: { padding: 0 } }}>
              <Tooltip title={k.tip}>
                <span style={{ position: 'absolute', top: 10, right: 10, width: 16, height: 16, borderRadius: '50%', border: '1px solid #D5DAE1', color: '#6F7785', fontSize: 10, lineHeight: '14px', textAlign: 'center', cursor: 'help' }}>?</span>
              </Tooltip>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6F7785' }}>
                <span style={{ width: 26, height: 26, borderRadius: 6, background: k.alert ? '#ffece8' : '#EDF5FF', color: k.alert ? '#f53f3f' : '#006DEA', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{k.ico}</span>
                {k.label}
              </div>
              <div>
                <div className="dp-kpi-num" style={{ color: k.alert ? '#f53f3f' : '#1A1A1A' }}>{k.val}</div>
                {k.d && <div style={{ fontSize: 11, color: '#00b42a' }}>{k.d}</div>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="dp-row2">
        <Card styles={{ body: { padding: 16 } }}>
          <div className="dp-modtitle" style={{ marginBottom: 12 }}>协同网络拓扑</div>
          <svg viewBox="0 0 400 300" style={{ width: '100%', display: 'block' }}>
            <g fill="none" stroke="#D5DAE1" strokeWidth="1.3">
              {nodes.slice(0, 5).map((n, i) => {
                const a = (Math.PI * 2 * i) / Math.min(5, nodes.length) - Math.PI / 2;
                const x = 200 + 95 * Math.cos(a) * 1.35;
                const y = 150 + 95 * Math.sin(a) * 0.92;
                return <line key={n.node_id} x1="200" y1="150" x2={x} y2={y} strokeDasharray={n.scene === '舰' ? '5 5' : undefined} />;
              })}
            </g>
            <circle cx="200" cy="150" r="18" fill="none" stroke="#E6E9EE" />
            <circle cx="200" cy="150" r="10" fill="#006DEA" />
            <circle cx="200" cy="150" r="3.2" fill="#fff" />
            <text x="200" y="184" textAnchor="middle" fontSize="10" fill="#2B313A" fontWeight="600">调度中心</text>
            {nodes.slice(0, 5).map((n, i) => {
              const cnt = Math.min(5, nodes.length);
              const a = (Math.PI * 2 * i) / cnt - Math.PI / 2;
              const x = 200 + 95 * Math.cos(a) * 1.35;
              const y = 150 + 95 * Math.sin(a) * 0.92;
              const color = n.load_rate >= 80 ? '#ff7d00' : n.status === '在线' ? '#00b42a' : '#D5DAE1';
              return (
                <g key={n.node_id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/dispatch/nodes?node=${n.node_id}`)}>
                  <title>{`${n.node_name} · 负荷 ${n.load_rate}% · 点击进入节点工作台`}</title>
                  <circle cx={x} cy={y} r="7" fill={color} />
                  <circle cx={x} cy={y} r="11" fill="transparent" />
                  <text x={x} y={y + (y > 150 ? 20 : -14)} textAnchor="middle" fontSize="10" fill="#6F7785">{n.node_name.split(' · ')[0]}</text>
                </g>
              );
            })}
          </svg>
          <div style={{ fontSize: 11, color: '#B8C0CC', display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
            <span>● 绿 运行</span><span style={{ color: '#ff7d00' }}>● 橙 高负荷</span><span>— 稳定链路</span><span style={{ color: '#D5DAE1' }}>-- 弱链路（舰）</span>
            <span style={{ marginLeft: 'auto' }}>共 {nodes.length} 个节点</span>
          </div>
        </Card>

        <Card styles={{ body: { padding: 16 } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="dp-modtitle">订单看板</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <a onClick={() => navigate('/dispatch/orders')} style={{ fontSize: 12 }}>订单管理 →</a>
              <a onClick={() => navigate('/dispatch/decision')} style={{ fontSize: 12 }}>派单决策 →</a>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#6F7785' }}>
              <span style={{ width: 44 }}>优先级</span>
              {['全部', '紧急'].map((v) => <span key={v} className={`dp-fchip${fp === v ? ' on' : ''}`} onClick={() => setFp(v)}>{v}</span>)}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#6F7785' }}>
              <span style={{ width: 44 }}>站点</span>
              {['全部', '舰', '岛', '岸'].map((v) => <span key={v} className={`dp-fchip${fs === v ? ' on' : ''}`} onClick={() => setFs(v)}>{v}</span>)}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 140px 120px 80px', gap: 8, fontSize: 11, color: '#6F7785', borderBottom: '1px solid #E6E9EE', padding: '0 10px 7px' }}>
            <span>订单</span><span>名称 / 规格</span><span>进度</span><span>节点</span><span style={{ justifySelf: 'end' }}>状态</span>
          </div>
          <div className="dp-olist">
            {orders.map((o) => (
              <div key={o.order_id} className={`dp-oitem${o.priority === '紧急' ? ' urgent' : ''}`} onClick={() => navigate(`/dispatch/order/${o.order_id}`)}>
                <span style={{ fontWeight: 600, color: '#006DEA', fontSize: 12 }}>{o.order_id}</span>
                <div>
                  <b style={{ fontWeight: 500, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.order_name}</b>
                  <small style={{ color: '#6F7785', fontSize: 11 }}>{o.material || ''} · ×{o.quantity} · {o.scene}</small>
                </div>
                <div>
                  {o.status === '待派单' ? <span style={{ fontSize: 11, color: '#6F7785' }}>待派</span> : (
                    <>
                      <div className="dp-pbar"><i style={{ width: `${o.progress}%` }} /></div>
                      <div style={{ fontSize: 11, color: '#2B313A', marginTop: 2 }}>{o.progress}%</div>
                    </>
                  )}
                </div>
                <span style={{ fontSize: 12, color: '#2B313A' }}>{o.node_name || '—'}</span>
                <Tag color={stColor(o.status)} style={{ justifySelf: 'end', marginRight: 0 }}>{o.status}</Tag>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="dp-row3">
        <Card styles={{ body: { padding: 16 } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="dp-modtitle">节点负荷</div>
            <a onClick={() => navigate('/dispatch/nodes')} style={{ fontSize: 12 }}>节点工作台 →</a>
          </div>
          <div className="dp-nlist">
            {nodes.map((n) => (
              <div key={n.node_id} className="dp-nrow" style={{ cursor: 'pointer' }}
                title="点击进入该节点工作台"
                onClick={() => navigate(`/dispatch/nodes?node=${n.node_id}`)}>
                <div>
                  <div style={{ fontSize: 13 }}>{n.node_name}</div>
                  <small style={{ color: '#6F7785', fontSize: 11 }}>{n.location} · {n.device_count} 台 · 心跳 {String(n.last_heartbeat || '').slice(11)}</small>
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, textAlign: 'right', color: n.load_rate >= 80 ? '#ff7d00' : '#00b42a' }}>{n.load_rate}%</div>
                <div className="dp-track"><i style={{ width: `${n.load_rate}%`, background: n.load_rate >= 80 ? '#ff7d00' : '#00b42a' }} /></div>
              </div>
            ))}
          </div>
        </Card>

        <Card styles={{ body: { padding: 16 } }}>
          <div className="dp-modtitle" style={{ marginBottom: 8 }}>待我处理（演示）</div>
          <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid #F1F3F5' }}>
            <span style={{ fontSize: 11, color: '#6F7785', width: 44 }}>14:20</span>
            <Tag color="blue" style={{ fontSize: 11, marginInlineEnd: 0, height: 22, lineHeight: '18px' }}>确认派单</Tag>
            <div style={{ fontSize: 13 }}>
              {orders.find((o) => o.status === '待派单')?.order_name || '当前无待派单'} —— 前往派单决策处理
              <div style={{ marginTop: 4 }}>
                <a onClick={() => navigate('/dispatch/decision')} style={{ fontSize: 12 }}>去处理 →</a>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, padding: '10px 0' }}>
            <span style={{ fontSize: 11, color: '#6F7785', width: 44 }}>13:05</span>
            <Tag color="orange" style={{ fontSize: 11, marginInlineEnd: 0, height: 22, lineHeight: '18px' }}>异常处理</Tag>
            <div style={{ fontSize: 13 }}>高负荷节点排产预警（演示）</div>
          </div>
        </Card>

        <Card styles={{ body: { padding: 16 } }}>
          <div className="dp-modtitle" style={{ marginBottom: 8 }}>合约空间</div>
          {contracts && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
                {[['履约中', contracts.active, '#006DEA'], ['待归档', contracts.pendingArchive, '#1A1A1A'], ['累计上链存证', contracts.onchainTotal, '#1A1A1A']].map(([l, v, c]) => (
                  <div key={String(l)} style={{ background: '#f7f8fa', borderRadius: 6, padding: '8px 10px' }}>
                    <b style={{ fontSize: 18, color: c as string }}>{v as number}</b>
                    <div style={{ fontSize: 11, color: '#6F7785' }}>{l as string}</div>
                  </div>
                ))}
              </div>
              {contracts.list.map((r) => (
                <div key={r.cs_id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F1F3F5', fontSize: 12 }}>
                  <span style={{ color: '#006DEA', width: 110 }}>{r.cs_id}</span>
                  <span style={{ flex: 1, color: '#2B313A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                  <Tag color={r.state === '待归档' ? 'orange' : 'blue'} style={{ marginRight: 0 }}>{r.state}</Tag>
                </div>
              ))}
            </>
          )}
        </Card>
      </div>

      <Card style={{ marginTop: 12 }} styles={{ body: { padding: 16 } }}>
        <div className="dp-modtitle" style={{ marginBottom: 8 }}>协同动态</div>
        <div className="dp-feed">
          {events.map((e, i) => (
            <div key={i} className="dp-fi">
              <span style={{ fontSize: 11, color: '#B8C0CC', width: 78 }}>{String(e.occurred_at).slice(5, 16)}</span>
              <Tag style={{ fontSize: 11, marginInlineEnd: 0, height: 22, lineHeight: '18px' }} color={['交付', '归档', '质检'].includes(e.event_type) ? 'green' : ['派单', '接单', '开工'].includes(e.event_type) ? 'blue' : 'default'}>{e.event_type}</Tag>
              <span style={{ color: '#2B313A' }}><b style={{ color: '#1A1A1A', fontWeight: 500 }}>{e.order_name}</b> · {e.node_name || '调度中心'}{e.tx_hash ? ' · 已上链' : ''}</span>
            </div>
          ))}
        </div>
      </Card>
    </DispatchShell>
  );
};

export default DispatchHome;
