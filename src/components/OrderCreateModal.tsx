import React, { useMemo } from 'react';
import { Modal, Form, Input, Select, DatePicker, InputNumber, Row, Col } from 'antd';
import dayjs from 'dayjs';
import { useMaterials, useParts } from '../api/hooks';
import type { Order } from '../types';

interface OrderCreateModalProps {
  visible: boolean;
  onCancel: () => void;
  onCreate: (order: Order) => void;
}

const OrderCreateModal: React.FC<OrderCreateModalProps> = ({ visible, onCancel, onCreate }) => {
  const [form] = Form.useForm();
  const { data: materials } = useMaterials();
  const { data: parts } = useParts();
  const materialOptions = useMemo(() => materials.map(m => ({ value: m.id, label: `${m.materialName} (${m.materialCode})` })), [materials]);
  const partOptions = useMemo(() => parts.map(p => ({ value: p.id, label: `${p.partName} (${p.oemPartNumber})` })), [parts]);

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const newOrder: Order = {
        id: `ORD-${dayjs().format('YYYY-MM-DD')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
        orderName: values.orderName,
        materialId: values.materialId,
        partId: values.partId,
        quantity: values.quantity,
        priority: values.priority,
        requiredDeliveryDate: values.requiredDeliveryDate.format('YYYY-MM-DD'),
        orderStatus: '待匹配',
        matchedEquipmentId: '',
        processParameters: {
          laserPower: 0,
          scanSpeed: 0,
          layerThickness: 0,
          scanStrategy: '',
          preheatTemperature: 0,
          shieldingGas: '',
        },
        scheduleInfo: {
          scheduleStartTime: '',
          scheduleEndTime: '',
          queuePosition: 0,
          equipmentName: '',
        },
        qualityInspectionId: '',
        remark: values.remark || '',
        createdAt: dayjs().format('YYYY-MM-DD'),
      };
      onCreate(newOrder);
      form.resetFields();
    });
  };

  return (
    <Modal
      title="创建新订单"
      open={visible}
      onCancel={() => { form.resetFields(); onCancel(); }}
      onOk={handleSubmit}
      width={720}
      okText="创建订单"
      cancelText="取消"
    >
      <Form form={form} layout="vertical">
        <Form.Item name="orderName" label="订单名称" rules={[{ required: true, message: '请输入订单名称' }]}>
          <Input placeholder="如：沪东H1207柴油机缸体修复" />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="materialId" label="选择原材料" rules={[{ required: true, message: '请选择原材料' }]}>
              <Select options={materialOptions} placeholder="请选择原材料" showSearch optionFilterProp="label" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="partId" label="选择零部件" rules={[{ required: true, message: '请选择零部件' }]}>
              <Select options={partOptions} placeholder="请选择零部件" showSearch optionFilterProp="label" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="quantity" label="加工数量" rules={[{ required: true, message: '请输入数量' }]} initialValue={1}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="priority" label="优先级" rules={[{ required: true, message: '请选择优先级' }]} initialValue="普通">
              <Select>
                <Select.Option value="紧急">紧急</Select.Option>
                <Select.Option value="高">高</Select.Option>
                <Select.Option value="普通">普通</Select.Option>
                <Select.Option value="低">低</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="requiredDeliveryDate" label="要求交付日期" rules={[{ required: true, message: '请选择交付日期' }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="remark" label="备注">
          <Input.TextArea rows={3} placeholder="请输入订单备注信息" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default OrderCreateModal;
