import React, { useState, useMemo } from 'react';
import { Table, Tag, Input, Select, Button, Row, Col, Card } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DetailDrawer from '../components/DetailDrawer';
import PageHeader from '../components/PageHeader';
import { useStandards } from '../api/hooks';
import type { Standard } from '../types';

const StandardsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterId = searchParams.get('filterId');
  const { data: standards, loading } = useStandards();

  const [searchNumber, setSearchNumber] = useState('');
  const [searchName, setSearchName] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [societyFilter, setSocietyFilter] = useState<string>('');
  const [selectedStandard, setSelectedStandard] = useState<Standard | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const types = useMemo(() => Array.from(new Set(standards.map((s) => s.standardType))), [standards]);
  const societies = useMemo(() => Array.from(new Set(standards.map((s) => s.classificationSociety))), [standards]);

  const filteredData = useMemo(() => {
    return standards.filter((s) => {
      if (filterId && s.id !== filterId) return false;
      if (typeFilter && s.standardType !== typeFilter) return false;
      if (societyFilter && s.classificationSociety !== societyFilter) return false;
      if (searchNumber && !s.standardNumber.toLowerCase().includes(searchNumber.toLowerCase())) return false;
      if (searchName && !s.standardName.toLowerCase().includes(searchName.toLowerCase())) return false;
      return true;
    });
  }, [filterId, typeFilter, societyFilter, searchNumber, searchName, standards]);

  const columns = [
    {
      title: '标准编号',
      dataIndex: 'standardNumber',
      key: 'standardNumber',
      sorter: (a: Standard, b: Standard) => a.standardNumber.localeCompare(b.standardNumber),
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '标准名称',
      dataIndex: 'standardName',
      key: 'standardName',
      ellipsis: true,
    },
    {
      title: '标准类型',
      dataIndex: 'standardType',
      key: 'standardType',
      filters: types.map((t) => ({ text: t, value: t })),
      onFilter: (value: any, record: Standard) => record.standardType === value,
      render: (v: string) => <Tag color="cyan">{v}</Tag>,
    },
    {
      title: '船级社',
      dataIndex: 'classificationSociety',
      key: 'classificationSociety',
      filters: societies.map((s) => ({ text: s, value: s })),
      onFilter: (value: any, record: Standard) => record.classificationSociety === value,
      render: (v: string) => <Tag color="gold">{v}</Tag>,
    },
    {
      title: '标准文件路径',
      dataIndex: 'standardPath',
      key: 'standardPath',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Standard) => (
        <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); handleView(record); }}>
          查看详情
        </Button>
      ),
    },
  ];

  const handleView = (record: Standard) => {
    setSelectedStandard(record);
    setDrawerVisible(true);
  };

  const handleReset = () => {
    setSearchNumber('');
    setSearchName('');
    setTypeFilter('');
    setSocietyFilter('');
    if (filterId) navigate('/standards');
  };

  return (
    <div>
      <PageHeader title="标准数据" subtitle="船级社标准库：材料、工艺与验收标准" />
      <Card styles={{ body: { paddingTop: 16 } }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8} md={6}>
          <Input.Search
            placeholder="搜索标准编号"
            value={searchNumber}
            onChange={(e) => setSearchNumber(e.target.value)}
            allowClear
          />
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Input.Search
            placeholder="搜索标准名称"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            allowClear
          />
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Select
            placeholder="按标准类型筛选"
            style={{ width: '100%' }}
            value={typeFilter || undefined}
            onChange={(v) => setTypeFilter(v)}
            allowClear
          >
            {types.map((t) => (
              <Select.Option key={t} value={t}>{t}</Select.Option>
            ))}
          </Select>
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Select
            placeholder="按船级社筛选"
            style={{ width: '100%' }}
            value={societyFilter || undefined}
            onChange={(v) => setSocietyFilter(v)}
            allowClear
          >
            {societies.map((s) => (
              <Select.Option key={s} value={s}>{s}</Select.Option>
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
        data={selectedStandard}
        moduleType="standards"
      />
    </div>
  );
};

export default StandardsPage;
