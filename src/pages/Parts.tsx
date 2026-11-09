import React, { useState, useMemo } from 'react';
import { Table, Tag, Input, Button, Row, Col, Card } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DetailDrawer from '../components/DetailDrawer';
import PageHeader from '../components/PageHeader';
import { useParts } from '../api/hooks';
import type { Part } from '../types';

const Parts: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterId = searchParams.get('filterId');
  const { data: parts, loading } = useParts();

  const [searchName, setSearchName] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const categories = useMemo(() => Array.from(new Set(parts.map((p) => p.categoryName))), [parts]);

  const filteredData = useMemo(() => {
    return parts.filter((p) => {
      if (filterId && p.id !== filterId) return false;
      if (searchName && !p.partName.toLowerCase().includes(searchName.toLowerCase()) && !p.oemPartNumber.toLowerCase().includes(searchName.toLowerCase())) return false;
      if (searchCategory && p.categoryName !== searchCategory) return false;
      return true;
    });
  }, [filterId, searchName, searchCategory, parts]);

  const columns = [
    {
      title: '零部件中文名称',
      dataIndex: 'partName',
      key: 'partName',
      sorter: (a: Part, b: Part) => a.partName.localeCompare(b.partName),
    },
    {
      title: '分类名称',
      dataIndex: 'categoryName',
      key: 'categoryName',
      filters: categories.map((c) => ({ text: c, value: c })),
      onFilter: (value: any, record: Part) => record.categoryName === value,
      render: (v: string) => <Tag color="green">{v}</Tag>,
    },
    {
      title: 'OEM原厂件号',
      dataIndex: 'oemPartNumber',
      key: 'oemPartNumber',
    },
    {
      title: '原始材料牌号',
      dataIndex: 'originalMaterialCode',
      key: 'originalMaterialCode',
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '模型文件',
      dataIndex: 'modelFilePath',
      key: 'modelFilePath',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Part) => (
        <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); handleView(record); }}>
          查看详情
        </Button>
      ),
    },
  ];

  const handleView = (record: Part) => {
    setSelectedPart(record);
    setDrawerVisible(true);
  };

  const handleReset = () => {
    setSearchName('');
    setSearchCategory('');
    if (filterId) navigate('/parts');
  };

  return (
    <div>
      <PageHeader title="增材制造零部件模型" subtitle="零部件三维模型台账与 OEM 件号索引" />
      <Card styles={{ body: { paddingTop: 16 } }}>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8} md={6}>
          <Input.Search
            placeholder="搜索零部件名称或OEM件号"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            allowClear
          />
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Input.Search
            placeholder="搜索分类名称"
            value={searchCategory}
            onChange={(e) => setSearchCategory(e.target.value)}
            allowClear
          />
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
        scroll={{ x: 1000 }}
        onRow={(record) => ({
          onClick: () => handleView(record),
          style: { cursor: 'pointer' },
        })}
      />
      </Card>
      <DetailDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        data={selectedPart}
        moduleType="parts"
      />
    </div>
  );
};

export default Parts;
