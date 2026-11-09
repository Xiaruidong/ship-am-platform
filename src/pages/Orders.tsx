import React, { useState, useMemo } from 'react';
import { Table, Tag, Input, Select, Button, Row, Col, Space, Modal, Card, App } from 'antd';
import { statusTransitions, statusColors } from '../mock/mockOrders';
import { useMaterials, useParts, useEquipment, useOrders } from '../api/hooks';
import { api } from '../api/client';
import OrderCreateModal from '../components/OrderCreateModal';
import PageHeader from '../components/PageHeader';
import EquipmentMatchModal from '../components/EquipmentMatchModal';
import ScheduleConfirmModal from '../components/ScheduleConfirmModal';
import DetailDrawer from '../components/DetailDrawer';
import type { Order, OrderStatus, ScheduleInfo } from '../types';

const Orders: React.FC = () => {
  const { message } = App.useApp();
  const { data: orders, loading, reload } = useOrders();
  const { data: materials } = useMaterials();
  const { data: parts } = useParts();
  const { data: equipment } = useEquipment();
  const [searchName, setSearchName] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [matchModalVisible, setMatchModalVisible] = useState(false);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [actionOrder, setActionOrder] = useState<Order | null>(null);

  const priorities = useMemo(() => Array.from(new Set(orders.map(o => o.priority))), [orders]);
  const statuses = useMemo(() => Array.from(new Set(orders.map(o => o.orderStatus))), [orders]);

  const filteredData = useMemo(() => {
    return orders.filter(o => {
      if (statusFilter && o.orderStatus !== statusFilter) return false;
      if (priorityFilter && o.priority !== priorityFilter) return false;
      if (searchName && !o.orderName.toLowerCase().includes(searchName.toLowerCase()) && !o.id.toLowerCase().includes(searchName.toLowerCase())) return false;
      return true;
    });
  }, [orders, statusFilter, priorityFilter, searchName]);

  const getMaterialName = (id: string) => materials.find(m => m.id === id)?.materialName || id;
  const getPartName = (id: string) => parts.find(p => p.id === id)?.partName || id;
  const getEquipmentName = (id: string) => equipment.find(e => e.id === id)?.equipmentName || id;

  const runOrderAction = async (fn: () => Promise<unknown>, successMsg: string) => {
    try {
      await fn();
      await reload();
      message.success(successMsg);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleStatusChange = (order: Order, newStatus: OrderStatus) => {
    void runOrderAction(() => api.updateOrderStatus(order.id, newStatus), `订单已${newStatus}`);
  };

  const handleMatch = (equipmentId: string) => {
    if (actionOrder) {
      void runOrderAction(() => api.matchOrder(actionOrder.id, equipmentId), '设备匹配成功');
      setMatchModalVisible(false);
      setActionOrder(null);
    }
  };

  const handleScheduleConfirm = (scheduleInfo: ScheduleInfo) => {
    if (actionOrder) {
      void runOrderAction(() => api.scheduleOrder(actionOrder.id, scheduleInfo), '排产确认成功');
      setScheduleModalVisible(false);
      setActionOrder(null);
    }
  };

  const handleCreate = (newOrder: Order) => {
    void runOrderAction(() => api.createOrder(newOrder), '订单创建成功');
    setCreateModalVisible(false);
  };

  const openMatchModal = (order: Order) => {
    setActionOrder(order);
    setMatchModalVisible(true);
  };

  const openScheduleModal = (order: Order) => {
    setActionOrder(order);
    setScheduleModalVisible(true);
  };

  const columns = [
    {
      title: '订单编号',
      dataIndex: 'id',
      key: 'id',
      sorter: (a: Order, b: Order) => a.id.localeCompare(b.id),
    },
    {
      title: '订单名称',
      dataIndex: 'orderName',
      key: 'orderName',
      sorter: (a: Order, b: Order) => a.orderName.localeCompare(b.orderName),
    },
    {
      title: '原材料',
      dataIndex: 'materialId',
      key: 'materialId',
      render: (v: string) => <Tag>{getMaterialName(v)}</Tag>,
    },
    {
      title: '零部件',
      dataIndex: 'partId',
      key: 'partId',
      render: (v: string) => <Tag>{getPartName(v)}</Tag>,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      sorter: (a: Order, b: Order) => a.quantity - b.quantity,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      filters: priorities.map(p => ({ text: p, value: p })),
      onFilter: (value: any, record: Order) => record.priority === value,
      render: (v: string) => <Tag color={v === '紧急' ? 'red' : v === '高' ? 'orange' : 'default'}>{v}</Tag>,
    },
    {
      title: '订单状态',
      dataIndex: 'orderStatus',
      key: 'orderStatus',
      filters: statuses.map(s => ({ text: s, value: s })),
      onFilter: (value: any, record: Order) => record.orderStatus === value,
      render: (v: OrderStatus) => <Tag color={statusColors[v]}>{v}</Tag>,
    },
    {
      title: '匹配设备',
      dataIndex: 'matchedEquipmentId',
      key: 'matchedEquipmentId',
      render: (v: string) => v ? <Tag>{getEquipmentName(v)}</Tag> : '-',
    },
    {
      title: '交付日期',
      dataIndex: 'requiredDeliveryDate',
      key: 'requiredDeliveryDate',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Order) => {
        const transition = statusTransitions[record.orderStatus];
        return (
          <Space>
            <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); setSelectedOrder(record); setDrawerVisible(true); }}>
              详情
            </Button>
            {transition.next && (
              <Button type="primary" size="small" onClick={(e) => {
                e.stopPropagation();
                if (record.orderStatus === '待匹配') openMatchModal(record);
                else if (record.orderStatus === '已匹配') openScheduleModal(record);
                else handleStatusChange(record, transition.next as OrderStatus);
              }}>
                {transition.label}
              </Button>
            )}
            {transition.prev && (
              <Button size="small" danger onClick={(e) => {
                e.stopPropagation();
                Modal.confirm({
                  title: '确认回退？',
                  content: `将订单状态从「${record.orderStatus}」回退至「${transition.prev}」`,
                  onOk: () => handleStatusChange(record, transition.prev as OrderStatus),
                });
              }}>
                回退
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  const handleReset = () => {
    setSearchName('');
    setStatusFilter('');
    setPriorityFilter('');
  };

  return (
    <div>
      <PageHeader
        title="订单管理"
        subtitle="订单全生命周期：创建 → 设备匹配 → 排产 → 生产 → 质检 → 完成"
        extra={<Button type="primary" onClick={() => setCreateModalVisible(true)}>创建订单</Button>}
      />
      <Card styles={{ body: { paddingTop: 16 } }}>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8} md={6}>
          <Input.Search
            placeholder="搜索订单名称或编号"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            allowClear
          />
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Select
            placeholder="按状态筛选"
            style={{ width: '100%' }}
            value={statusFilter || undefined}
            onChange={(v) => setStatusFilter(v)}
            allowClear
          >
            {statuses.map(s => (
              <Select.Option key={s} value={s}>{s}</Select.Option>
            ))}
          </Select>
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Select
            placeholder="按优先级筛选"
            style={{ width: '100%' }}
            value={priorityFilter || undefined}
            onChange={(v) => setPriorityFilter(v)}
            allowClear
          >
            {priorities.map(p => (
              <Select.Option key={p} value={p}>{p}</Select.Option>
            ))}
          </Select>
        </Col>
        <Col xs={24} sm={24} md={6} style={{ textAlign: 'right' }}>
          <Button onClick={handleReset}>重置</Button>
        </Col>
      </Row>
      <Table
        dataSource={filteredData}
        columns={columns}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50] }}
        size="middle"
        scroll={{ x: 1400 }}
        onRow={(record) => ({
          onClick: () => { setSelectedOrder(record); setDrawerVisible(true); },
          style: { cursor: 'pointer' },
        })}
      />
      </Card>
      <DetailDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        data={selectedOrder}
        moduleType="orders"
      />
      <OrderCreateModal
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onCreate={handleCreate}
      />
      <EquipmentMatchModal
        visible={matchModalVisible}
        onCancel={() => setMatchModalVisible(false)}
        onMatch={handleMatch}
        order={actionOrder}
      />
      <ScheduleConfirmModal
        visible={scheduleModalVisible}
        onCancel={() => setScheduleModalVisible(false)}
        onConfirm={handleScheduleConfirm}
        order={actionOrder}
      />
    </div>
  );
};

export default Orders;
