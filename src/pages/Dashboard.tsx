import React, { useMemo } from 'react';
import { Row, Col, Card, Table, Tag, Empty } from 'antd';
import {
  GoldOutlined,
  AppstoreOutlined,
  ToolOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  ShoppingCartOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { useMaterials, useParts, useEquipment, useInspections, useStandards, useOrders } from '../api/hooks';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const { data: materials } = useMaterials();
  const { data: parts } = useParts();
  const { data: equipment } = useEquipment();
  const { data: inspections } = useInspections();
  const { data: standards } = useStandards();
  const { data: orders } = useOrders();

  const materialStats = useMemo(() => {
    const categoryCount: Record<string, number> = {};
    materials.forEach((m) => {
      categoryCount[m.materialCategory] = (categoryCount[m.materialCategory] || 0) + 1;
    });
    return Object.entries(categoryCount).map(([name, value]) => ({ name, value }));
  }, [materials]);

  const equipmentStatus = useMemo(() => {
    const statusCount: Record<string, number> = {};
    equipment.forEach((e) => {
      statusCount[e.equipmentStatus] = (statusCount[e.equipmentStatus] || 0) + 1;
    });
    return Object.entries(statusCount).map(([name, value]) => ({ name, value }));
  }, [equipment]);

  const passRate = useMemo(() => {
    return inspections.length ? ((inspections.filter((i) => i.resultJudgment === '合格').length / inspections.length) * 100).toFixed(1) : '0.0';
  }, [inspections]);

  const recentMaterials = useMemo(() => {
    return [...materials].reverse().slice(0, 5);
  }, [materials]);

  const recentInspections = useMemo(() => {
    return [...inspections].reverse().slice(0, 5);
  }, [inspections]);

  const globalSearchResults = useMemo(() => {
    if (!searchQuery) return null;
    const q = searchQuery.toLowerCase();
    const results: Array<{ type: string; title: string; subtitle: string; path: string }> = [];

    materials.forEach((m) => {
      if (m.materialName.toLowerCase().includes(q) || m.materialCode.toLowerCase().includes(q)) {
        results.push({ type: '原材料', title: m.materialName, subtitle: m.materialCode, path: '/materials' });
      }
    });
    parts.forEach((p) => {
      if (p.partName.toLowerCase().includes(q) || p.oemPartNumber.toLowerCase().includes(q)) {
        results.push({ type: '零部件', title: p.partName, subtitle: p.oemPartNumber, path: '/parts' });
      }
    });
    equipment.forEach((e) => {
      if (e.equipmentName.toLowerCase().includes(q) || e.manufacturer.toLowerCase().includes(q)) {
        results.push({ type: '设备', title: e.equipmentName, subtitle: e.manufacturer, path: '/equipment' });
      }
    });
    inspections.forEach((i) => {
      if (i.sampleName.toLowerCase().includes(q)) {
        results.push({ type: '检测', title: i.sampleName, subtitle: i.resultJudgment, path: '/inspection' });
      }
    });
    standards.forEach((s) => {
      if (s.standardNumber.toLowerCase().includes(q) || s.standardName.toLowerCase().includes(q)) {
        results.push({ type: '标准', title: s.standardNumber, subtitle: s.standardName, path: '/standards' });
      }
    });
    orders.forEach((o) => {
      if (o.orderName.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)) {
        results.push({ type: '订单', title: o.orderName, subtitle: o.id, path: '/orders' });
      }
    });
    return results.slice(0, 20);
  }, [searchQuery, materials, parts, equipment, inspections, standards, orders]);

  const statCards = [
    { title: '金属原材料', value: materials.length, icon: <GoldOutlined />, path: '/materials' },
    { title: '零部件模型', value: parts.length, icon: <AppstoreOutlined />, path: '/parts' },
    { title: '增材设备', value: equipment.length, icon: <ToolOutlined />, path: '/equipment' },
    { title: '检测数据', value: inspections.length, icon: <ExperimentOutlined />, path: '/inspection' },
    { title: '标准数据', value: standards.length, icon: <FileTextOutlined />, path: '/standards' },
    { title: '订单管理', value: orders.length, icon: <ShoppingCartOutlined />, path: '/orders' },
  ];

  const materialColumns = [
    { title: '材料名称', dataIndex: 'materialName', key: 'materialName' },
    { title: '牌号', dataIndex: 'materialCode', key: 'materialCode' },
    { title: '大类', dataIndex: 'materialCategory', key: 'materialCategory', render: (v: string) => <Tag>{v}</Tag> },
    { title: '粒径(μm)', dataIndex: 'averageParticleSize', key: 'averageParticleSize' },
  ];

  const inspectionColumns = [
    { title: '样品名称', dataIndex: 'sampleName', key: 'sampleName' },
    { title: '抗拉强度(MPa)', dataIndex: 'tensileStrength', key: 'tensileStrength' },
    { title: '屈服强度(MPa)', dataIndex: 'yieldStrength', key: 'yieldStrength' },
    { title: '判定', dataIndex: 'resultJudgment', key: 'resultJudgment', render: (v: string) => <Tag color={v === '合格' ? 'success' : v === '让步接收' ? 'warning' : 'error'}>{v}</Tag> },
  ];

  if (searchQuery && globalSearchResults) {
    return (
      <div>
        <PageHeader
          title={`全局搜索结果：${searchQuery}`}
          subtitle={`共找到 ${globalSearchResults.length} 条相关记录`}
        />
        {globalSearchResults.length === 0 ? (
          <Card>
            <Empty description="暂无匹配结果" style={{ margin: '32px 0' }} />
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {globalSearchResults.map((r, idx) => (
              <Col xs={24} sm={12} lg={8} key={idx}>
                <Card
                  hoverable
                  onClick={() => navigate(r.path)}
                  styles={{ body: { padding: 16 } }}
                >
                  <Tag color="blue">{r.type}</Tag>
                  <div style={{ fontWeight: 600, fontSize: 15, marginTop: 8 }}>{r.title}</div>
                  <div style={{ color: '#6F7785', fontSize: 13, marginTop: 4 }}>{r.subtitle}</div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="数据仪表盘" subtitle="平台六类核心数据总览与最近动态" />

      <Row gutter={[16, 16]}>
        {statCards.map((card) => (
          <Col xs={12} sm={8} lg={4} key={card.title}>
            <Card
              hoverable
              onClick={() => navigate(card.path)}
              styles={{ body: { padding: 18 } }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: '#EDF5FF',
                  color: '#006DEA',
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                {card.icon}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.2 }}>
                {card.value}
              </div>
              <div style={{ fontSize: 13, color: '#6F7785', marginTop: 4 }}>{card.title}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="材料大类分布" styles={{ body: { paddingTop: 8 } }}>
            {materialStats.map((s) => {
              const pct = materials.length ? (s.value / materials.length) * 100 : 0;
              return (
                <div key={s.name} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>{s.name}</span>
                    <span style={{ color: '#6F7785' }}>{s.value} 种</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: '#f1f3f5', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: '#006DEA', opacity: 0.75 }} />
                  </div>
                </div>
              );
            })}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="订单状态分布" styles={{ body: { paddingTop: 8 } }}>
            {(() => {
              const statusCount: Record<string, number> = {};
              orders.forEach((o) => { statusCount[o.orderStatus] = (statusCount[o.orderStatus] || 0) + 1; });
              const order = ['待匹配', '已匹配', '已排产', '生产中', '已完成'];
              return order
                .filter((name) => statusCount[name])
                .map((name) => {
                  const value = statusCount[name];
                  const pct = orders.length ? (value / orders.length) * 100 : 0;
                  return (
                    <div key={name} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span>{name}</span>
                        <span style={{ color: '#6F7785' }}>{value} 个</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: '#f1f3f5', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: '#006DEA', opacity: name === '已完成' ? 1 : 0.75 }} />
                      </div>
                    </div>
                  );
                });
            })()}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={8}>
          <Card title="设备状态分布" styles={{ body: { paddingTop: 8 } }}>
            {equipmentStatus.map((s) => (
              <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
                <span>{s.name}</span>
                <Tag color={s.name === '运行中' ? 'success' : s.name === '维护中' ? 'warning' : 'default'}>{s.value} 台</Tag>
              </div>
            ))}
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card title="检测合格率" styles={{ body: { padding: 20 } }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, justifyContent: 'center', padding: '8px 0' }}>
              <span style={{ fontSize: 36, fontWeight: 700, color: '#006DEA', letterSpacing: '-0.02em' }}>{passRate}%</span>
              <span style={{ color: '#6F7785', fontSize: 13 }}>
                检测总数 {inspections.length} 次 / 合格 {inspections.filter((i) => i.resultJudgment === '合格').length} 次
              </span>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            title="最近录入材料"
            extra={<a onClick={() => navigate('/materials')} style={{ fontSize: 13 }}>查看全部 <ArrowRightOutlined /></a>}
            styles={{ body: { paddingTop: 4 } }}
          >
            <Table dataSource={recentMaterials} columns={materialColumns} rowKey="id" pagination={false} size="small" />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title="最近订单"
            extra={<a onClick={() => navigate('/orders')} style={{ fontSize: 13 }}>查看全部 <ArrowRightOutlined /></a>}
            styles={{ body: { paddingTop: 4 } }}
          >
            <Table
              dataSource={orders.slice(0, 5)}
              columns={[
                { title: '订单编号', dataIndex: 'id', key: 'id' },
                { title: '订单名称', dataIndex: 'orderName', key: 'orderName', ellipsis: true },
                { title: '状态', dataIndex: 'orderStatus', key: 'orderStatus', width: 90, render: (v: string) => <Tag color={v === '已完成' ? 'success' : v === '生产中' ? 'processing' : v === '已排产' ? 'warning' : v === '已匹配' ? 'blue' : 'default'}>{v}</Tag> },
              ]}
              rowKey="id"
              pagination={false}
              size="small"
              onRow={(_record) => ({
                onClick: () => navigate('/orders'),
                style: { cursor: 'pointer' },
              })}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card
            title="最近检测记录"
            extra={<a onClick={() => navigate('/inspection')} style={{ fontSize: 13 }}>查看全部 <ArrowRightOutlined /></a>}
            styles={{ body: { paddingTop: 4 } }}
          >
            <Table dataSource={recentInspections} columns={inspectionColumns} rowKey="id" pagination={false} size="small" />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
