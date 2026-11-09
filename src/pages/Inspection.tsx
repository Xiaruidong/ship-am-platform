import React, { useState, useMemo } from 'react';
import { Table, Tag, Input, Select, Button, Row, Col, Card } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DetailDrawer from '../components/DetailDrawer';
import PageHeader from '../components/PageHeader';
import { useInspections } from '../api/hooks';
import type { Inspection } from '../types';

const InspectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterId = searchParams.get('filterId');
  const { data: inspections, loading } = useInspections();

  const [searchName, setSearchName] = useState('');
  const [resultFilter, setResultFilter] = useState<string>('');
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const results = useMemo(() => Array.from(new Set(inspections.map((i) => i.resultJudgment))), [inspections]);

  const filteredData = useMemo(() => {
    return inspections.filter((i) => {
      if (filterId && i.id !== filterId) return false;
      if (resultFilter && i.resultJudgment !== resultFilter) return false;
      if (searchName && !i.sampleName.toLowerCase().includes(searchName.toLowerCase()) && !i.sampleDescription.toLowerCase().includes(searchName.toLowerCase())) return false;
      return true;
    });
  }, [filterId, resultFilter, searchName, inspections]);

  const columns = [
    {
      title: '样品名称',
      dataIndex: 'sampleName',
      key: 'sampleName',
      sorter: (a: Inspection, b: Inspection) => a.sampleName.localeCompare(b.sampleName),
    },
    {
      title: '样品描述',
      dataIndex: 'sampleDescription',
      key: 'sampleDescription',
      ellipsis: true,
    },
    {
      title: '取样位置',
      dataIndex: 'samplingPosition',
      key: 'samplingPosition',
      ellipsis: true,
    },
    {
      title: '抗拉强度 Rm(MPa)',
      dataIndex: 'tensileStrength',
      key: 'tensileStrength',
      sorter: (a: Inspection, b: Inspection) => a.tensileStrength - b.tensileStrength,
    },
    {
      title: '屈服强度 Rp0.2(MPa)',
      dataIndex: 'yieldStrength',
      key: 'yieldStrength',
      sorter: (a: Inspection, b: Inspection) => a.yieldStrength - b.yieldStrength,
    },
    {
      title: '结果判定',
      dataIndex: 'resultJudgment',
      key: 'resultJudgment',
      filters: results.map((r) => ({ text: r, value: r })),
      onFilter: (value: any, record: Inspection) => record.resultJudgment === value,
      render: (v: string) => (
        <Tag color={v === '合格' ? 'green' : 'red'}>{v}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Inspection) => (
        <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); handleView(record); }}>
          查看详情
        </Button>
      ),
    },
  ];

  const handleView = (record: Inspection) => {
    setSelectedInspection(record);
    setDrawerVisible(true);
  };

  const handleReset = () => {
    setSearchName('');
    setResultFilter('');
    if (filterId) navigate('/inspection');
  };

  return (
    <div>
      <PageHeader title="检测数据" subtitle="力学性能检测结果与合格判定记录" />
      <Card styles={{ body: { paddingTop: 16 } }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8} md={6}>
          <Input.Search
            placeholder="搜索样品名称或描述"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            allowClear
          />
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Select
            placeholder="按结果判定筛选"
            style={{ width: '100%' }}
            value={resultFilter || undefined}
            onChange={(v) => setResultFilter(v)}
            allowClear
          >
            {results.map((r) => (
              <Select.Option key={r} value={r}>{r}</Select.Option>
            ))}
          </Select>
        </Col>
        <Col xs={24} sm={24} md={12} style={{ textAlign: 'right' }}>
          <Button onClick={handleReset}>重置筛选</Button>
        </Col>
      </Row>
      <Table
        dataSource={filteredData}
        columns={columns}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50] }}
        size="middle"
        scroll={{ x: 1200 }}
        onRow={(record) => ({
          onClick: () => handleView(record),
          style: { cursor: 'pointer' },
        })}
      />
      </Card>
      <DetailDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        data={selectedInspection}
        moduleType="inspection"
      />
    </div>
  );
};

export default InspectionPage;
