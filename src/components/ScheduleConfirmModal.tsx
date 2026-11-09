import React, { useMemo } from 'react';
import { Modal, Table, DatePicker, Form, Tag, Descriptions, Divider } from 'antd';
import dayjs from 'dayjs';
import { useEquipment, useMaterials, useParts, useOrders } from '../api/hooks';
import type { Order, ScheduleInfo } from '../types';

interface ScheduleConfirmModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (scheduleInfo: ScheduleInfo) => void;
  order: Order | null;
}

const ScheduleConfirmModal: React.FC<ScheduleConfirmModalProps> = ({ visible, onCancel, onConfirm, order }) => {
  const [form] = Form.useForm();
  const { data: equipment } = useEquipment();
  const { data: materials } = useMaterials();
  const { data: parts } = useParts();
  const { data: allOrders } = useOrders();

  const matchedEquipment = useMemo(() => equipment.find(e => e.id === order?.matchedEquipmentId), [order, equipment]);
  const material = useMemo(() => materials.find(m => m.id === order?.materialId), [order, materials]);
  const part = useMemo(() => parts.find(p => p.id === order?.partId), [order, parts]);

  // 获取该设备的当前排产队列
  const equipmentQueue = useMemo(() => {
    if (!matchedEquipment) return [];
    return allOrders
      .filter(o => o.matchedEquipmentId === matchedEquipment.id && o.orderStatus === '已排产' && o.id !== order?.id)
      .sort((a, b) => dayjs(a.scheduleInfo.scheduleStartTime).diff(dayjs(b.scheduleInfo.scheduleStartTime)));
  }, [matchedEquipment, order, allOrders]);

  const columns = [
    { title: '订单编号', dataIndex: 'id', key: 'id' },
    { title: '订单名称', dataIndex: 'orderName', key: 'orderName' },
    { title: '预计开始', dataIndex: ['scheduleInfo', 'scheduleStartTime'], key: 'start' },
    { title: '预计结束', dataIndex: ['scheduleInfo', 'scheduleEndTime'], key: 'end' },
    { title: '排产序号', dataIndex: ['scheduleInfo', 'queuePosition'], key: 'queue' },
  ];

  const handleConfirm = () => {
    form.validateFields().then((values) => {
      const startDate = values.scheduleStartTime.format('YYYY-MM-DD');
      // 假设每个零件需要2天，加上准备时间
      const daysNeeded = order ? Math.max(1, order.quantity * 2) : 2;
      const endDate = dayjs(startDate).add(daysNeeded, 'day').format('YYYY-MM-DD');
      const queuePosition = equipmentQueue.length + 1;

      onConfirm({
        scheduleStartTime: startDate,
        scheduleEndTime: endDate,
        queuePosition,
        equipmentName: matchedEquipment?.equipmentName || '',
      });
    });
  };

  return (
    <Modal
      title="订单排产确认"
      open={visible}
      onCancel={onCancel}
      onOk={handleConfirm}
      width={800}
      okText="确认排产"
      cancelText="取消"
    >
      {order && matchedEquipment && (
        <div>
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="订单名称" span={2}>{order.orderName}</Descriptions.Item>
            <Descriptions.Item label="原材料">{material?.materialName || '-'}</Descriptions.Item>
            <Descriptions.Item label="零部件">{part?.partName || '-'}</Descriptions.Item>
            <Descriptions.Item label="匹配设备"><Tag color="blue">{matchedEquipment.equipmentName}</Tag></Descriptions.Item>
            <Descriptions.Item label="设备节点">{matchedEquipment.nodeLocation}</Descriptions.Item>
          </Descriptions>
          <Divider />
          <h4>当前设备排产队列</h4>
          <Table
            dataSource={equipmentQueue}
            columns={columns}
            rowKey="id"
            pagination={false}
            size="small"
            locale={{ emptyText: '暂无排产队列' }}
          />
          <Divider />
          <Form form={form} layout="vertical">
            <Form.Item
              name="scheduleStartTime"
              label="选择预计开始时间"
              rules={[{ required: true, message: '请选择开始时间' }]}
              initialValue={dayjs().add(1, 'day')}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Form>
          <div style={{ color: '#6F7785', fontSize: 12 }}>
            系统将根据加工数量自动计算预计完成时间（约 {order.quantity * 2} 天）
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ScheduleConfirmModal;
