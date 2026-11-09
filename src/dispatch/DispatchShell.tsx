import React, { useEffect, useState } from 'react';
import { Input, Button, Badge } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';

// 需求单红点：以"上次查看时间"为界，只统计之后新增的待派单需求
const SEEN_KEY = 'dispatch_demands_seen_at';

const DispatchShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [demandBadge, setDemandBadge] = useState(0);

  // 加载未读需求数
  const loadBadge = async () => {
    try {
      const res = await fetch('/dapi/demands?limit=100');
      const rows: Array<{ order_status: string | null; created_at: string }> = await res.json();
      const seen = localStorage.getItem(SEEN_KEY);
      const pending = rows.filter((r) => r.order_status === '待派单');
      const unread = seen ? pending.filter((r) => String(r.created_at) > seen).length : pending.length;
      setDemandBadge(unread);
    } catch {
      setDemandBadge(0);
    }
  };

  // 进入需求单页面即标记已读，红点归零
  const markSeen = () => {
    localStorage.setItem(SEEN_KEY, new Date().toISOString().slice(0, 19).replace('T', ' '));
    setDemandBadge(0);
  };

  useEffect(() => {
    if (location.pathname === '/dispatch/demands') {
      markSeen();
    } else {
      void loadBadge();
    }
  }, [location.pathname]);

  const menu = [
    {
      group: '总览',
      items: [
        { key: '/dispatch', label: '首页 · 协同总览' },
        { key: '/dispatch/demo', label: '演示剧场' },
      ],
    },
    {
      group: '订单业务',
      items: [
        { key: '/dispatch/demands', label: '需求单管理', badge: demandBadge },
        { key: '/dispatch/decision', label: '派单决策' },
        { key: '/dispatch/ai', label: 'AI 智能匹配' },
        { key: '/dispatch/orders', label: '订单管理' },
      ],
    },
    {
      group: '数据资源',
      items: [
        { key: '/dispatch/library', label: '数据资源库' },
        { key: '', label: '合约空间' },
      ],
    },
    {
      group: '节点协同',
      items: [
        { key: '/dispatch/nodes', label: '制造节点' },
        { key: '/dispatch/node-admin', label: '节点运维后台' },
        { key: '/dispatch/node-client', label: '节点端' },
      ],
    },
    {
      group: '系统',
      items: [
        { key: '/dispatch/settings', label: '系统设置' },
        { key: '/', label: '指挥大屏（展示）' },
      ],
    },
  ];

  return (
    <div className="dp-shell">
      <div className="dp-sider">
        <div className="dp-logo">
          <div className="dp-badge">AM</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>订单派发应用</div>
        </div>
        <div className="dp-menu">
          {menu.map((g) => (
            <div key={g.group} className="dp-mgroup">
              <div className="dp-mgroup-title">{g.group}</div>
              {g.items.map((m) => (
                <div
                  key={m.label}
                  className={`dp-mi${m.key && location.pathname === m.key ? ' on' : ''}`}
                  onClick={() => {
                    if (!m.key && m.key !== '/') return;
                    if (m.key === '/dispatch/demands') markSeen();
                    navigate(m.key);
                  }}
                  style={{ opacity: m.key ? 1 : 0.55 }}
                >
                  <span style={{ width: 15, height: 15, borderRadius: 4, border: '1.5px solid currentColor', opacity: 0.5 }} />
                  {m.label}
                  {!!m.badge && <Badge count={m.badge} size="small" style={{ marginLeft: 'auto' }} />}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid #E6E9EE', fontSize: 11, color: '#D5DAE1' }}>V0.5 · React 版</div>
      </div>
      <div className="dp-main">
        <div className="dp-topbar">
          <Input.Search placeholder="订单号 / 零部件 / 节点" style={{ maxWidth: 320 }} size="small" />
          <div style={{ flex: 1 }} />
          <Button size="small">今日 ▾</Button>
          <Button type="primary" size="small" onClick={() => navigate('/dispatch/demands?new=1')}>＋ 新建需求单</Button>
          <Badge dot><Button size="small">🔔</Button></Badge>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
            <div className="dp-badge" style={{ borderRadius: '50%' }}>王</div>
            <span style={{ fontSize: 13 }}>王工程师</span>
          </div>
        </div>
        <div className="dp-content">{children}</div>
        <div style={{ borderTop: '1px solid #E6E9EE', background: '#fff', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#B8C0CC', flexWrap: 'wrap', gap: 8 }}>
          <span>船舶增材制造数据共享平台 · 订单派发应用</span>
          <span>服务正常 · 链节点同步正常</span>
        </div>
      </div>
    </div>
  );
};

export default DispatchShell;
