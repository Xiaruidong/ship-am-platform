import React, { useState, useMemo } from 'react';
import { Table, Tag, Input, Select, Button, Row, Col, Card } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DetailDrawer from '../components/DetailDrawer';
import PageHeader from '../components/PageHeader';
import { useMaterials } from '../api/hooks';
import type { Material } from '../types';

const Materials: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterId = searchParams.get('filterId');
  const { data: materials, loading } = useMaterials();

  const [searchName, setSearchName] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const categories = useMemo(() => Array.from(new Set(materials.map((m) => m.materialCategory))), [materials]);

  const filteredData = useMemo(() => {
    return materials.filter((m) => {
      if (filterId && m.id !== filterId) return false;
      if (categoryFilter && m.materialCategory !== categoryFilter) return false;
      if (searchName && !m.materialName.toLowerCase().includes(searchName.toLowerCase())) return false;
      if (searchCode && !m.materialCode.toLowerCase().includes(searchCode.toLowerCase())) return false;
      return true;
    });
  }, [filterId, categoryFilter, searchName, searchCode, materials]);

  const columns = [
    {
      title: '材料牌号编码',
      dataIndex: 'materialCode',
      key: 'materialCode',
      sorter: (a: Material, b: Material) => a.materialCode.localeCompare(b.materialCode),
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '材料中文名称',
      dataIndex: 'materialName',
      key: 'materialName',
      sorter: (a: Material, b: Material) => a.materialName.localeCompare(b.materialName),
    },
    {
      title: '材料大类',
      dataIndex: 'materialCategory',
      key: 'materialCategory',
      filters: categories.map((c) => ({ text: c, value: c })),
      onFilter: (value: any, record: Material) => record.materialCategory === value,
      render: (v: string) => <Tag color="cyan">{v}</Tag>,
    },
    {
      title: '材料子类',
      dataIndex: 'materialSubCategory',
      key: 'materialSubCategory',
    },
    {
      title: '供应商',
      dataIndex: 'supplier',
      key: 'supplier',
      ellipsis: true,
    },
    {
      title: '批次号',
      dataIndex: 'batchNumber',
      key: 'batchNumber',
    },
    {
      title: '平均粒径(μm)',
      dataIndex: 'averageParticleSize',
      key: 'averageParticleSize',
      sorter: (a: Material, b: Material) => a.averageParticleSize - b.averageParticleSize,
    },
    {
      title: '霍尔流速(s/50g)',
      dataIndex: 'hallFlow',
      key: 'hallFlow',
      sorter: (a: Material, b: Material) => a.hallFlow - b.hallFlow,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Material) => (
        <Button type="link" size="small" onClick={() => handleView(record)}>
          查看详情
        </Button>
      ),
    },
  ];

  const handleView = (record: Material) => {
    setSelectedMaterial(record);
    setDrawerVisible(true);
  };

  const handleReset = () => {
    setSearchName('');
    setSearchCode('');
    setCategoryFilter('');
    if (filterId) navigate('/materials');
  };

  return (
    <div>
      <PageHeader title="金属增材用原材料" subtitle="粉末牌号、化学成分与批次台账" />
      <Card styles={{ body: { paddingTop: 16 } }}>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8} md={6}>
          <Input.Search
            placeholder="搜索材料名称"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            onSearch={() => {}}
            allowClear
          />
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Input.Search
            placeholder="搜索材料牌号"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            onSearch={() => {}}
            allowClear
          />
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Select
            placeholder="按材料大类筛选"
            style={{ width: '100%' }}
            value={categoryFilter || undefined}
            onChange={(v) => setCategoryFilter(v)}
            allowClear
          >
            {categories.map((c) => (
              <Select.Option key={c} value={c}>{c}</Select.Option>
            ))}
          </Select>
        </Col>
        <Col xs={24} sm={24} md={6} style={{ textAlign: 'right' }}>
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
        data={selectedMaterial}
        moduleType="materials"
      />
    </div>
  );
};

export default Materials;
