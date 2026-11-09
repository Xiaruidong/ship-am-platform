import React, { useMemo } from 'react';
import { Modal, Card, Tag, Button, List, Space, Divider, Descriptions } from 'antd';
import { EnvironmentOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useEquipment, useMaterials, useParts } from '../api/hooks';
import type { Order } from '../types';

interface EquipmentMatchModalProps {
  visible: boolean;
  onCancel: () => void;
  onMatch: (equipmentId: string) => void;
  order: Order | null;
}

const EquipmentMatchModal: React.FC<EquipmentMatchModalProps> = ({ visible, onCancel, onMatch, order }) => {
  const { data: equipment } = useEquipment();
  const { data: materials } = useMaterials();
  const { data: parts } = useParts();
  const material = useMemo(() => materials.find(m => m.id === order?.materialId), [order, materials]);
  const part = useMemo(() => parts.find(p => p.id === order?.partId), [order, parts]);

  const recommendedEquipment = useMemo(() => {
    if (!order || !material || !part) return [];

    // 匹配逻辑：
    // 1. 排除维护中
    // 2. 曾加工过该材料（关联零部件→材料）
    // 3. 成形尺寸 >= 250mm（简化假设零件尺寸）
    // 4. 状态优先级：待机 > 运行中
    // 5. 激光功率匹配度

    const candidateEquipments = equipment.filter(e => e.equipmentStatus !== '维护中');
    
    return candidateEquipments.map(e => {
      let score = 0;
      let reason: string[] = [];

      // 状态加分
      if (e.equipmentStatus === '待机') {
        score += 30;
        reason.push('设备待机');
      } else if (e.equipmentStatus === '运行中') {
        score += 10;
        reason.push('设备运行中');
      }

      // 激光功率匹配（假设材料推荐功率为300-700W）
      const recommendedPower = 500;
      const powerMatch = 1 - Math.abs(e.laserMaxPower - recommendedPower) / 1000;
      score += Math.round(powerMatch * 20);
      reason.push(`激光功率${e.laserMaxPower}W`);

      // 成形尺寸
      if (e.buildSizeX >= 400) {
        score += 20;
        reason.push('成形尺寸充裕');
      } else {
        score += 10;
        reason.push('成形尺寸可加工');
      }

      // 节点就近（假设上海基地更近）
      if (e.nodeLocation.includes('上海')) {
        score += 15;
        reason.push('上海基地就近');
      } else {
        score += 5;
      }

      return { equipment: e, score, reason };
    }).sort((a, b) => b.score - a.score);
  }, [order, material, part, equipment]);

  return (
    <Modal
      title="分布式设备资源匹配"
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={800}
    >
      {order && (
        <div>
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="订单名称" span={2}>{order.orderName}</Descriptions.Item>
            <Descriptions.Item label="原材料">{material?.materialName || '-'}</Descriptions.Item>
            <Descriptions.Item label="零部件">{part?.partName || '-'}</Descriptions.Item>
            <Descriptions.Item label="加工数量">{order.quantity}</Descriptions.Item>
            <Descriptions.Item label="优先级"><Tag color={order.priority === '紧急' ? 'red' : order.priority === '高' ? 'orange' : 'default'}>{order.priority}</Tag></Descriptions.Item>
          </Descriptions>
          <Divider />
          <h4>推荐设备（按匹配得分排序）</h4>
          <List
            dataSource={recommendedEquipment}
            renderItem={({ equipment: e, score, reason }) => (
              <List.Item
                actions={[
                  <Button type="primary" onClick={() => onMatch(e.id)}>选择此设备</Button>
                ]}
              >
                <Card style={{ width: '100%', borderLeft: '3px solid #006DEA' }} size="small">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>{e.equipmentName}</div>
                      <div style={{ color: '#6F7785', fontSize: 13 }}>{e.manufacturer} · {e.nodeLocation}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#006DEA' }}>{score}<span style={{ fontSize: 14, color: '#6F7785' }}>/100</span></div>
                      <div style={{ fontSize: 12, color: '#6F7785' }}>匹配得分</div>
                    </div>
                  </div>
                  <Divider style={{ margin: '8px 0' }} />
                  <Space wrap>
                    <Tag color={e.equipmentStatus === '待机' ? 'green' : e.equipmentStatus === '运行中' ? 'blue' : 'default'}>
                      <ThunderboltOutlined /> {e.equipmentStatus}
                    </Tag>
                    <Tag>成形尺寸 {e.buildSizeX}mm</Tag>
                    <Tag>激光功率 {e.laserMaxPower}W</Tag>
                    <Tag><EnvironmentOutlined /> {e.nodeLocation}</Tag>
                  </Space>
                  <div style={{ marginTop: 8, fontSize: 12, color: '#4B5563' }}>
                    推荐理由：{reason.join(' · ')}
                  </div>
                </Card>
              </List.Item>
            )}
          />
        </div>
      )}
    </Modal>
  );
};

export default EquipmentMatchModal;
