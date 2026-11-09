import React, { useEffect, useState, useCallback } from 'react';
import { Card, Tag, Button, Spin, Popconfirm, Progress, Descriptions, App } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import DispatchShell from './DispatchShell';
import './dispatch.css';

interface Detail {
  order: Record<string, any>;
  events: Array<{ event_id: string; event_type: string; payload: Record<string, any>; tx_hash: string | null; occurred_at: string; actor_name: string }>;
}
interface TwinMetrics { tensileStrength: number; yieldStrength: number; elongation: number; hardnessHBW: number; dimensionDeviation: number }
interface TwinQc { order_id: string; truth_hash: string; ship_metrics: TwinMetrics; shore_metrics: TwinMetrics; consistency_score: number; verdict: string }

const stColor = (s: string): string => ({
  待派单: 'default', 已派单: 'blue', 生产中: 'green', 质检中: 'orange', 已交付: 'default', 已归档: 'default',
}[s] || 'default');

const NEXT: Record<string, { status: string; label: string; desc: string }> = {
  已派单: { status: '生产中', label: '开工', desc: '节点开始生产，进度启动' },
  生产中: { status: '质检中', label: '完工报工', desc: '生产完成，转入质检' },
  质检中: { status: '已交付', label: '质检通过并交付', desc: '交付并将上链存证' },
  已交付: { status: '已归档', label: '归档（权限回收）', desc: '合约归档、权限回收、上链存证' },
};

const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [twin, setTwin] = useState<TwinQc | null>(null);
  const [twinBusy, setTwinBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/dapi/orders/${encodeURIComponent(id || '')}/detail`);
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      setData(await res.json());
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  // 加载/启动一虚两实比对
  const loadTwin = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/dapi/orders/${encodeURIComponent(id)}/twin-qc`);
    setTwin(await res.json());
  }, [id]);
  useEffect(() => { setTwin(null); void loadTwin(); }, [loadTwin]);

  const runTwin = async () => {
    if (!data?.order) return;
    setTwinBusy(true);
    try {
      const res = await fetch(`/dapi/orders/${data.order.order_id}/twin-qc/run`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '比对失败');
      setTwin(d);
      message.success(`一虚两实比对完成：一致性 ${d.consistency_score} 分，结果已上链存证`);
      await load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '比对失败');
    } finally {
      setTwinBusy(false);
    }
  };

  const transition = async () => {
    const o = data?.order;
    if (!o) return;
    const next = NEXT[o.status];
    if (!next) return;
    setBusy(true);
    try {
      const res = await fetch(`/dapi/orders/${o.order_id}/transition`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next.status }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '流转失败');
      message.success(d.tx_hash ? `已${next.label}，交易已上链：${String(d.tx_hash).slice(0, 18)}…` : `已${next.label}`);
      await load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '流转失败');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <DispatchShell><div style={{ textAlign: 'center', padding: 80 }}><Spin tip="加载订单详情…" /></div></DispatchShell>;
  if (!data) return <DispatchShell><div style={{ textAlign: 'center', padding: 80, color: '#6F7785' }}>订单不存在</div></DispatchShell>;

  const o = data.order;
  const next = NEXT[o.status];
  const p = o.process_params || {};
  const members: string[] = o.members ? (Array.isArray(o.members) ? o.members : Object.values(o.members)) : [];

  return (
    <DispatchShell>
      {/* 页头 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <a onClick={() => navigate('/dispatch')} style={{ fontSize: 12, marginRight: 8 }}>← 返回总览</a>
          <div className="dp-modtitle" style={{ fontSize: 18, marginTop: 4 }}>{o.order_name}</div>
          <div style={{ fontSize: 12, color: '#6F7785', marginTop: 4 }}>
            <span style={{ color: '#006DEA', fontWeight: 600 }}>{o.order_id}</span>
            <span style={{ margin: '0 10px' }}>·</span>需求单 {o.demand_id}
            <span style={{ margin: '0 10px' }}>·</span>{o.scene} 场景
            <span style={{ margin: '0 10px' }}>·</span>创建于 {String(o.latest_event_at).slice(0, 10)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Tag color={stColor(o.status)} style={{ fontSize: 13, padding: '2px 12px' }}>{o.status}</Tag>
          {o.abnormal_flag === 1 && <Tag color="red">异常</Tag>}
          {next && (
            <Popconfirm title={`确认执行「${next.label}」？`} description={next.desc} onConfirm={transition} okText="确认" cancelText="取消">
              <Button type="primary" loading={busy}>{next.label} →</Button>
            </Popconfirm>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* 左列：基本信息 + 执行 + 工艺 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card styles={{ body: { padding: 16 } }}>
            <div className="dp-modtitle" style={{ marginBottom: 12 }}>基本信息</div>
            <Descriptions column={2} size="small" styles={{ label: { color: '#6F7785', width: 90 } }}>
              <Descriptions.Item label="材料">{o.material_name || '-'}（{o.material_code}）</Descriptions.Item>
              <Descriptions.Item label="数量">×{o.quantity}</Descriptions.Item>
              <Descriptions.Item label="优先级"><Tag color={o.priority === '紧急' ? 'red' : 'default'}>{o.priority}</Tag></Descriptions.Item>
              <Descriptions.Item label="要求交付">{String(o.required_delivery || '-').slice(0, 10)}</Descriptions.Item>
              <Descriptions.Item label="实际交付">{o.delivered_at ? String(o.delivered_at).slice(0, 10) : '—'}</Descriptions.Item>
              <Descriptions.Item label="订单状态">{o.status}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card styles={{ body: { padding: 16 } }}>
            <div className="dp-modtitle" style={{ marginBottom: 12 }}>执行节点</div>
            {o.node_name ? (
              <Descriptions column={1} size="small" styles={{ label: { color: '#6F7785', width: 90 } }}>
                <Descriptions.Item label="节点">{o.node_name}</Descriptions.Item>
                <Descriptions.Item label="地点">{o.node_location}</Descriptions.Item>
                <Descriptions.Item label="设备">{o.equip_id || '—'}</Descriptions.Item>
                <Descriptions.Item label="任务状态"><Tag color={o.task_status === '已完成' ? 'green' : o.task_status === '执行中' ? 'blue' : 'default'}>{o.task_status}</Tag></Descriptions.Item>
                <Descriptions.Item label="排产窗口">{String(o.planned_start || '—').slice(0, 10)} ~ {String(o.planned_end || '—').slice(0, 10)}</Descriptions.Item>
              </Descriptions>
            ) : <div style={{ color: '#6F7785', fontSize: 13 }}>尚未派单，无执行节点</div>}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: '#6F7785', marginBottom: 4 }}>生产进度</div>
              <Progress percent={o.progress || 0} size="small" strokeColor="#006DEA" />
            </div>
          </Card>

          <Card styles={{ body: { padding: 16 } }}>
            <div className="dp-modtitle" style={{ marginBottom: 12 }}>工艺参数包</div>
            {Object.keys(p).length ? (
              <Descriptions column={2} size="small" styles={{ label: { color: '#6F7785' } }}>
                <Descriptions.Item label="激光功率">{p.laserPower ?? '—'} W</Descriptions.Item>
                <Descriptions.Item label="扫描速度">{p.scanSpeed ?? '—'} mm/s</Descriptions.Item>
                <Descriptions.Item label="层厚">{p.layerThickness ?? '—'} mm</Descriptions.Item>
                <Descriptions.Item label="扫描策略">{p.scanStrategy || '—'}</Descriptions.Item>
                <Descriptions.Item label="预热温度">{p.preheatTemperature ?? '—'} ℃</Descriptions.Item>
                <Descriptions.Item label="保护气体">{p.shieldingGas || '—'}</Descriptions.Item>
              </Descriptions>
            ) : <div style={{ color: '#6F7785', fontSize: 13 }}>未匹配设备，工艺参数未生成</div>}
          </Card>
        </div>

        {/* 右列：合约空间 + 存证时间线 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card styles={{ body: { padding: 16 } }}>
            <div className="dp-modtitle" style={{ marginBottom: 12 }}>合约空间</div>
            {o.contract_space_id ? (
              <>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                  <span style={{ color: '#006DEA', fontFamily: 'monospace', fontSize: 13 }}>{o.contract_space_id}</span>
                  <Tag color={o.contract_state === '已归档' ? 'default' : o.contract_state === '待归档' ? 'orange' : 'blue'}>{o.contract_state}</Tag>
                </div>
                <Descriptions column={1} size="small" styles={{ label: { color: '#6F7785', width: 90 } }}>
                  <Descriptions.Item label="策略哈希"><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{String(o.policy_hash || '').slice(0, 26)}…</span></Descriptions.Item>
                  <Descriptions.Item label="链上地址"><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{String(o.chain_addr || '').slice(0, 30)}…</span></Descriptions.Item>
                  <Descriptions.Item label="成员">{members.length} 方（{members.map((m) => String(m).replace('did:am:', '')).join('、')}）</Descriptions.Item>
                  <Descriptions.Item label="创建时间">{String(o.contract_created_at || '').slice(0, 19)}</Descriptions.Item>
                  {o.archived_at && <Descriptions.Item label="归档时间">{String(o.archived_at).slice(0, 19)}</Descriptions.Item>}
                </Descriptions>
              </>
            ) : <div style={{ color: '#6F7785', fontSize: 13 }}>尚未创建（派单后自动生成）</div>}
          </Card>

          {/* 一虚两实孪生质检 */}
          <Card styles={{ body: { padding: 16 } }}>
            <div className="dp-modtitle" style={{ marginBottom: 8 }}>一虚两实 · 孪生质检</div>
            {!twin && o.status === '质检中' && (
              <div style={{ textAlign: 'center', padding: '18px 0' }}>
                <div style={{ fontSize: 12, color: '#6F7785', marginBottom: 12 }}>
                  以调度中心「模型+材料+工艺」数据包为真理源，海上实体件快检 与 岸基复现件全检 同步比对
                </div>
                <Button type="primary" loading={twinBusy} onClick={runTwin}>启动一虚两实比对</Button>
              </div>
            )}
            {!twin && o.status !== '质检中' && (
              <div style={{ fontSize: 13, color: '#6F7785', textAlign: 'center', padding: '14px 0' }}>
                {['已交付', '已归档'].includes(o.status) ? '本订单无孪生质检记录' : '完工转入质检中后可启动比对'}
              </div>
            )}
            {twin && (() => {
              const rows: Array<[string, number, number, string]> = [
                ['抗拉强度 Rm (MPa)', twin.ship_metrics.tensileStrength, twin.shore_metrics.tensileStrength, 'MPa'],
                ['屈服强度 Rp0.2 (MPa)', twin.ship_metrics.yieldStrength, twin.shore_metrics.yieldStrength, 'MPa'],
                ['延伸率 A (%)', twin.ship_metrics.elongation, twin.shore_metrics.elongation, '%'],
                ['硬度 (HBW)', twin.ship_metrics.hardnessHBW, twin.shore_metrics.hardnessHBW, ''],
                ['尺寸偏差 (mm)', twin.ship_metrics.dimensionDeviation, twin.shore_metrics.dimensionDeviation, 'mm'],
              ];
              const ok = twin.consistency_score >= 92;
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                    <div style={{
                      width: 88, height: 88, borderRadius: '50%', flexShrink: 0,
                      border: `6px solid ${ok ? '#00B42A' : twin.consistency_score >= 85 ? '#FF7D00' : '#F53F3F'}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <b style={{ fontSize: 22, color: '#1A1A1A', lineHeight: 1.1 }}>{twin.consistency_score}</b>
                      <span style={{ fontSize: 10, color: '#6F7785' }}>一致性评分</span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <Tag color={ok ? 'green' : twin.consistency_score >= 85 ? 'orange' : 'red'} style={{ fontSize: 13, padding: '2px 10px' }}>
                        {ok ? '✓ ' : '⚠ '}{twin.verdict}
                      </Tag>
                      <div style={{ fontSize: 11, color: '#6F7785', marginTop: 6, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        真理源数据包：{String(twin.truth_hash).slice(0, 26)}…
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 84px 84px', gap: '4px 8px', fontSize: 12 }}>
                    <span style={{ color: '#6F7785' }}>检测指标</span>
                    <span style={{ color: '#6F7785', textAlign: 'center' }}>海上实体件</span>
                    <span style={{ color: '#6F7785', textAlign: 'center' }}>岸基复现件</span>
                    {rows.map(([label, s, h, unit]) => {
                      const diff = Math.abs(s - h) / Math.max(Math.abs(s), 1);
                      return (
                        <React.Fragment key={label}>
                          <span>{label}</span>
                          <span style={{ textAlign: 'center', fontFamily: 'monospace', color: diff > 0.03 ? '#FF7D00' : '#2B313A' }}>{s}{unit ? ` ${unit}` : ''}</span>
                          <span style={{ textAlign: 'center', fontFamily: 'monospace', color: diff > 0.03 ? '#FF7D00' : '#2B313A' }}>{h}{unit ? ` ${unit}` : ''}</span>
                        </React.Fragment>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: '#97A0AD', marginTop: 10 }}>
                    差异 &gt;3% 的指标以橙色标注 · 比对结果已写入链上存证（质检事件）
                  </div>
                </>
              );
            })()}
          </Card>

          <Card styles={{ body: { padding: 16, maxHeight: 460, overflowY: 'auto' } }}>
            <div className="dp-modtitle" style={{ marginBottom: 4 }}>链上存证时间线</div>
            <div style={{ fontSize: 12, color: '#6F7785', marginBottom: 12 }}>
              共 {data.events.length} 条事件 · {data.events.filter((e) => e.tx_hash).length} 条上链存证 · 全程可追溯
            </div>
            {data.events.map((e, i) => (
              <div key={e.event_id} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: 18 }}>
                {/* 时间线轴 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: e.tx_hash ? '#006DEA' : '#D5DAE1',
                    boxShadow: e.tx_hash ? '0 0 0 3px rgba(0,109,234,0.15)' : 'none',
                  }} />
                  {i < data.events.length - 1 && <div style={{ width: 2, flex: 1, background: '#E6E9EE', marginTop: 2 }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <b style={{ fontSize: 13, fontWeight: 600 }}>{e.event_type}</b>
                    {e.tx_hash && <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px', marginRight: 0 }}>已上链</Tag>}
                  </div>
                  <div style={{ fontSize: 12, color: '#6F7785', marginTop: 2 }}>
                    {String(e.occurred_at).slice(0, 19)} · {e.actor_name || '系统'}
                    {e.payload?.note ? ` · ${e.payload.note}` : ''}
                    {e.payload?.node ? ` · ${e.payload.node}` : ''}
                    {e.payload?.contract ? ` · ${e.payload.contract}` : ''}
                  </div>
                  {e.tx_hash && (
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#97A0AD', marginTop: 3, wordBreak: 'break-all' }}>
                      tx: {e.tx_hash}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </DispatchShell>
  );
};

export default OrderDetail;
