import React, { useState, useMemo } from 'react';
import { Table, Tag, Input, Select, Button, Row, Col, Card } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DetailDrawer from '../components/DetailDrawer';
import PageHeader from '../components/PageHeader';
import { useEquipment } from '../api/hooks';
import type { Equipment } from '../types';

const EquipmentPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterId = searchParams.get('filterId');
  const { data: equipment, loading } = useEquipment();

  const [searchName, setSearchName] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const statuses = useMemo(() => Array.from(new Set(equipment.map((e) => e.equipmentStatus))), [equipment]);

  const filteredData = useMemo(() => {
    return equipment.filter((e) => {
      if (filterId && e.id !== filterId) return false;
      if (statusFilter && e.equipmentStatus !== statusFilter) return false;
      if (searchName && !e.equipmentName.toLowerCase().includes(searchName.toLowerCase()) && !e.manufacturer.toLowerCase().includes(searchName.toLowerCase())) return false;
      return true;
    });
  }, [filterId, statusFilter, searchName, equipment]);

  const columns = [
    {
      title: '设备名称',
      dataIndex: 'equipmentName',
      key: 'equipmentName',
      sorter: (a: Equipment, b: Equipment) => a.equipmentName.localeCompare(b.equipmentName),
    },
    {
      title: '制造商',
      dataIndex: 'manufacturer',
      key: 'manufacturer',
    },
    {
      title: '机型分类',
      dataIndex: 'machineType',
      key: 'machineType',
      render: (v: string) => <Tag color="purple">{v}</Tag>,
    },
    {
      title: '成形尺寸X(mm)',
      dataIndex: 'buildSizeX',
      key: 'buildSizeX',
      sorter: (a: Equipment, b: Equipment) => a.buildSizeX - b.buildSizeX,
    },
    {
      title: '激光器最大功率(W)',
      dataIndex: 'laserMaxPower',
      key: 'laserMaxPower',
      sorter: (a: Equipment, b: Equipment) => a.laserMaxPower - b.laserMaxPower,
    },
    {
      title: '设备节点',
      dataIndex: 'nodeLocation',
      key: 'nodeLocation',
    },
    {
      title: '设备状态',
      dataIndex: 'equipmentStatus',
      key: 'equipmentStatus',
      filters: statuses.map((s) => ({ text: s, value: s })),
      onFilter: (value: any, record: Equipment) => record.equipmentStatus === value,
      render: (v: string) => (
        <Tag color={v === '运行中' ? 'green' : v === '维护中' ? 'orange' : 'default'}>{v}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Equipment) => (
        <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); handleView(record); }}>
          查看详情
        </Button>
      ),
    },
  ];

  const handleView = (record: Equipment) => {
    setSelectedEquipment(record);
    setDrawerVisible(true);
  };

  const handleReset = () => {
    setSearchName('');
    setStatusFilter('');
    if (filterId) navigate('/equipment');
  };

  return (
    <div>
      <PageHeader title="增材设备信息" subtitle="分布式设备节点台账与运行状态" />
      <Card styles={{ body: { paddingTop: 16 } }}>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8} md={6}>
          <Input.Search
            placeholder="搜索设备名称或制造商"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            allowClear
          />
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Select
            placeholder="按设备状态筛选"
            style={{ width: '100%' }}
            value={statusFilter || undefined}
            onChange={(v) => setStatusFilter(v)}
            allowClear
          >
            {statuses.map((s) => (
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
        data={selectedEquipment}
        moduleType="equipment"
      />
    </div>
  );
};

export default EquipmentPage;
