import React, { useMemo } from 'react';
import { Drawer, Descriptions, Tag, Button, Space, Divider } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { Material, Part, Equipment, Inspection, Standard, ModuleType, Order } from '../types';
import { useMaterials, useParts, useEquipment, useInspections, useStandards } from '../api/hooks';

interface DetailDrawerProps {
  visible: boolean;
  onClose: () => void;
  data: Material | Part | Equipment | Inspection | Standard | Order | null;
  moduleType: ModuleType;
}

const moduleLabels: Record<ModuleType, string> = {
  materials: '金属原材料',
  parts: '零部件模型',
  equipment: '增材设备',
  inspection: '检测数据',
  standards: '标准数据',
  orders: '订单管理',
};

const modulePaths: Record<ModuleType, string> = {
  materials: '/materials',
  parts: '/parts',
  equipment: '/equipment',
  inspection: '/inspection',
  standards: '/standards',
  orders: '/orders',
};

const DetailDrawer: React.FC<DetailDrawerProps> = ({ visible, onClose, data, moduleType }) => {
  const navigate = useNavigate();
  const { data: materials } = useMaterials();
  const { data: parts } = useParts();
  const { data: equipment } = useEquipment();
  const { data: inspections } = useInspections();
  const { data: standards } = useStandards();

  const targetDataMap: Record<string, any> = useMemo(() => ({
    materials: materials.reduce((acc, m) => ({ ...acc, [m.id]: m }), {}),
    parts: parts.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}),
    equipment: equipment.reduce((acc, e) => ({ ...acc, [e.id]: e }), {}),
    inspection: inspections.reduce((acc, i) => ({ ...acc, [i.id]: i }), {}),
    standards: standards.reduce((acc, s) => ({ ...acc, [s.id]: s }), {}),
  }), [materials, parts, equipment, inspections, standards]);

  if (!data) return null;

  const handleJump = (targetModule: ModuleType, filterId: string) => {
    navigate(`${modulePaths[targetModule]}?filterId=${filterId}`);
    onClose();
  };

  const renderLinkButton = (targetModule: ModuleType, ids: string[]) => {
    if (!ids || ids.length === 0) return null;

    const map = targetDataMap[targetModule];
    return (
      <Space wrap>
        {ids.map((id) => {
          const item = map[id];
          if (!item) return null;
          let label = '';
          if (targetModule === 'materials') label = (item as Material).materialName;
          else if (targetModule === 'parts') label = (item as Part).partName;
          else if (targetModule === 'equipment') label = (item as Equipment).equipmentName;
          else if (targetModule === 'inspection') label = (item as Inspection).sampleName;
          else if (targetModule === 'standards') label = (item as Standard).standardNumber;
          return (
            <Button
              key={id}
              size="small"
              type="link"
              icon={<LinkOutlined />}
              onClick={() => handleJump(targetModule, id)}
            >
              {label}
            </Button>
          );
        })}
      </Space>
    );
  };

  const renderContent = () => {
    switch (moduleType) {
      case 'materials': {
        const m = data as Material;
        return (
          <>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="材料中文名称" span={2}>{m.materialName}</Descriptions.Item>
              <Descriptions.Item label="材料牌号编码">{m.materialCode}</Descriptions.Item>
              <Descriptions.Item label="材料大类"><Tag color="blue">{m.materialCategory}</Tag></Descriptions.Item>
              <Descriptions.Item label="材料子类">{m.materialSubCategory}</Descriptions.Item>
              <Descriptions.Item label="供应商全称" span={2}>{m.supplier}</Descriptions.Item>
              <Descriptions.Item label="批次号">{m.batchNumber}</Descriptions.Item>
              <Descriptions.Item label="平均粒径">{m.averageParticleSize} μm</Descriptions.Item>
              <Descriptions.Item label="霍尔流速">{m.hallFlow} s/50g</Descriptions.Item>
              <Descriptions.Item label="典型应用场景" span={2}>{m.applicationDescription}</Descriptions.Item>
            </Descriptions>
            <Divider orientation="left">化学成分（wt%）</Divider>
            <Descriptions bordered column={3} size="small">
              <Descriptions.Item label="碳(C)">{m.chemicalComposition.C}</Descriptions.Item>
              <Descriptions.Item label="铬(Cr)">{m.chemicalComposition.Cr}</Descriptions.Item>
              <Descriptions.Item label="镍(Ni)">{m.chemicalComposition.Ni}</Descriptions.Item>
              <Descriptions.Item label="钼(Mo)">{m.chemicalComposition.Mo}</Descriptions.Item>
              <Descriptions.Item label="锰(Mn)">{m.chemicalComposition.Mn}</Descriptions.Item>
              <Descriptions.Item label="硅(Si)">{m.chemicalComposition.Si}</Descriptions.Item>
              <Descriptions.Item label="磷(P)">{m.chemicalComposition.P}</Descriptions.Item>
              <Descriptions.Item label="硫(S)">{m.chemicalComposition.S}</Descriptions.Item>
              <Descriptions.Item label="氮(N)">{m.chemicalComposition.N}</Descriptions.Item>
              <Descriptions.Item label="氧(O)">{m.chemicalComposition.O}</Descriptions.Item>
              <Descriptions.Item label="铁(Fe)">{m.chemicalComposition.Fe}</Descriptions.Item>
            </Descriptions>
            <Divider orientation="left">关联数据</Divider>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="关联零部件">{renderLinkButton('parts', m.relatedParts) || '-'}</Descriptions.Item>
              <Descriptions.Item label="关联检测">{renderLinkButton('inspection', m.relatedInspections) || '-'}</Descriptions.Item>
              <Descriptions.Item label="关联标准">{renderLinkButton('standards', m.relatedStandards) || '-'}</Descriptions.Item>
            </Descriptions>
          </>
        );
      }
      case 'parts': {
        const p = data as Part;
        return (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="零部件中文名称" span={2}>{p.partName}</Descriptions.Item>
            <Descriptions.Item label="分类名称"><Tag color="green">{p.categoryName}</Tag></Descriptions.Item>
            <Descriptions.Item label="OEM原厂件号">{p.oemPartNumber}</Descriptions.Item>
            <Descriptions.Item label="原始材料牌号">{p.originalMaterialCode}</Descriptions.Item>
            <Descriptions.Item label="模型文件路径">{p.modelFilePath}</Descriptions.Item>
            <Descriptions.Item label="关联原材料" span={2}>{renderLinkButton('materials', p.relatedMaterials) || '-'}</Descriptions.Item>
            <Descriptions.Item label="关联检测" span={2}>{renderLinkButton('inspection', p.relatedInspections) || '-'}</Descriptions.Item>
            <Descriptions.Item label="关联设备" span={2}>{renderLinkButton('equipment', p.relatedEquipment) || '-'}</Descriptions.Item>
          </Descriptions>
        );
      }
      case 'equipment': {
        const e = data as Equipment;
        return (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="设备名称" span={2}>{e.equipmentName}</Descriptions.Item>
            <Descriptions.Item label="制造商">{e.manufacturer}</Descriptions.Item>
            <Descriptions.Item label="机型分类"><Tag color="purple">{e.machineType}</Tag></Descriptions.Item>
            <Descriptions.Item label="成形尺寸X">{e.buildSizeX} mm</Descriptions.Item>
            <Descriptions.Item label="激光器最大功率">{e.laserMaxPower} W/单束</Descriptions.Item>
            <Descriptions.Item label="设备节点">{e.nodeLocation}</Descriptions.Item>
            <Descriptions.Item label="设备状态">
              <Tag color={e.equipmentStatus === '运行中' ? 'green' : e.equipmentStatus === '维护中' ? 'orange' : 'default'}>
                {e.equipmentStatus}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="关联零部件" span={2}>{renderLinkButton('parts', e.relatedParts) || '-'}</Descriptions.Item>
          </Descriptions>
        );
      }
      case 'inspection': {
        const i = data as Inspection;
        return (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="样品名称" span={2}>{i.sampleName}</Descriptions.Item>
            <Descriptions.Item label="样品描述" span={2}>{i.sampleDescription}</Descriptions.Item>
            <Descriptions.Item label="取样位置">{i.samplingPosition}</Descriptions.Item>
            <Descriptions.Item label="结果判定">
              <Tag color={i.resultJudgment === '合格' ? 'green' : 'red'}>{i.resultJudgment}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="抗拉强度 Rm">{i.tensileStrength} MPa</Descriptions.Item>
            <Descriptions.Item label="屈服强度 Rp0.2">{i.yieldStrength} MPa</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>{i.remark}</Descriptions.Item>
            <Descriptions.Item label="关联零部件" span={2}>{renderLinkButton('parts', i.relatedParts) || '-'}</Descriptions.Item>
            <Descriptions.Item label="关联原材料" span={2}>{renderLinkButton('materials', i.relatedMaterials) || '-'}</Descriptions.Item>
          </Descriptions>
        );
      }
      case 'standards': {
        const s = data as Standard;
        return (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="标准编号" span={2}><Tag color="blue">{s.standardNumber}</Tag></Descriptions.Item>
            <Descriptions.Item label="标准名称" span={2}>{s.standardName}</Descriptions.Item>
            <Descriptions.Item label="标准英文名称" span={2}>{s.standardEnglishName}</Descriptions.Item>
            <Descriptions.Item label="标准类型">{s.standardType}</Descriptions.Item>
            <Descriptions.Item label="船级社">{s.classificationSociety}</Descriptions.Item>
            <Descriptions.Item label="标准文件路径">{s.standardPath}</Descriptions.Item>
            <Descriptions.Item label="关联材料" span={2}>{renderLinkButton('materials', s.relatedMaterials) || '-'}</Descriptions.Item>
            <Descriptions.Item label="关联检测" span={2}>{renderLinkButton('inspection', s.relatedInspections) || '-'}</Descriptions.Item>
          </Descriptions>
        );
      }
      case 'orders': {
        const o = data as Order;
        const mat = materials.find(m => m.id === o.materialId);
        const part = parts.find(p => p.id === o.partId);
        const equip = equipment.find(e => e.id === o.matchedEquipmentId);
        const inspect = inspections.find(i => i.id === o.qualityInspectionId);

        return (
          <>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="订单编号" span={2}><Tag color="blue">{o.id}</Tag></Descriptions.Item>
              <Descriptions.Item label="订单名称" span={2}>{o.orderName}</Descriptions.Item>
              <Descriptions.Item label="原材料"><Tag color="blue">{mat?.materialName || '-'}</Tag></Descriptions.Item>
              <Descriptions.Item label="零部件"><Tag color="green">{part?.partName || '-'}</Tag></Descriptions.Item>
              <Descriptions.Item label="加工数量">{o.quantity}</Descriptions.Item>
              <Descriptions.Item label="优先级"><Tag color={o.priority === '紧急' ? 'red' : o.priority === '高' ? 'orange' : 'default'}>{o.priority}</Tag></Descriptions.Item>
              <Descriptions.Item label="要求交付日期">{o.requiredDeliveryDate}</Descriptions.Item>
              <Descriptions.Item label="创建日期">{o.createdAt}</Descriptions.Item>
              <Descriptions.Item label="订单状态">
                <Tag color={o.orderStatus === '已完成' ? 'green' : o.orderStatus === '生产中' ? 'processing' : o.orderStatus === '已排产' ? 'orange' : o.orderStatus === '已匹配' ? 'blue' : 'default'}>{o.orderStatus}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>{o.remark || '-'}</Descriptions.Item>
            </Descriptions>
            <Divider orientation="left">工艺参数</Divider>
            {o.matchedEquipmentId ? (
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="激光功率(W)" span={2}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>实际：{o.processParameters.laserPower} W</span>
                    <span style={{ color: '#6F7785' }}>设备理论最大值：{equip?.laserMaxPower} W</span>
                    <span style={{ color: o.processParameters.laserPower <= (equip?.laserMaxPower || 0) ? '#00B42A' : '#F53F3F' }}>
                      {o.processParameters.laserPower <= (equip?.laserMaxPower || 0) ? '✓ 在安全范围' : '✗ 超出设备能力'}
                    </span>
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="扫描速度">{o.processParameters.scanSpeed} mm/s</Descriptions.Item>
                <Descriptions.Item label="层厚">{o.processParameters.layerThickness} mm</Descriptions.Item>
                <Descriptions.Item label="扫描策略">{o.processParameters.scanStrategy}</Descriptions.Item>
                <Descriptions.Item label="预热温度">{o.processParameters.preheatTemperature} ℃</Descriptions.Item>
                <Descriptions.Item label="保护气体">{o.processParameters.shieldingGas}</Descriptions.Item>
              </Descriptions>
            ) : (
              <div style={{ color: '#6F7785', textAlign: 'center', padding: '16px' }}>尚未匹配设备，工艺参数未生成</div>
            )}
            <Divider orientation="left">设备与排产</Divider>
            {o.matchedEquipmentId ? (
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="匹配设备" span={2}><Tag color="purple">{equip?.equipmentName || '-'}</Tag></Descriptions.Item>
                <Descriptions.Item label="设备制造商">{equip?.manufacturer || '-'}</Descriptions.Item>
                <Descriptions.Item label="设备节点">{equip?.nodeLocation || '-'}</Descriptions.Item>
                <Descriptions.Item label="预计开始时间">{o.scheduleInfo.scheduleStartTime || '-'}</Descriptions.Item>
                <Descriptions.Item label="预计完成时间">{o.scheduleInfo.scheduleEndTime || '-'}</Descriptions.Item>
                <Descriptions.Item label="排产队列序号">{o.scheduleInfo.queuePosition || '-'}</Descriptions.Item>
              </Descriptions>
            ) : (
              <div style={{ color: '#6F7785', textAlign: 'center', padding: '16px' }}>尚未匹配设备，排产信息未生成</div>
            )}
            <Divider orientation="left">质量详情</Divider>
            {o.qualityInspectionId ? (
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="关联检测报告" span={2}>{renderLinkButton('inspection', [o.qualityInspectionId]) || '-'}</Descriptions.Item>
                <Descriptions.Item label="检测结果判定">{inspect?.resultJudgment || '-'}</Descriptions.Item>
                <Descriptions.Item label="抗拉强度">{inspect?.tensileStrength || '-'} MPa</Descriptions.Item>
                <Descriptions.Item label="屈服强度">{inspect?.yieldStrength || '-'} MPa</Descriptions.Item>
                <Descriptions.Item label="备注">{inspect?.remark || '-'}</Descriptions.Item>
              </Descriptions>
            ) : (
              <div style={{ color: '#6F7785', textAlign: 'center', padding: '16px' }}>尚未完成检测，质量详情待生成</div>
            )}
            <Divider orientation="left">关联数据</Divider>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="原材料">{renderLinkButton('materials', [o.materialId]) || '-'}</Descriptions.Item>
              <Descriptions.Item label="零部件">{renderLinkButton('parts', [o.partId]) || '-'}</Descriptions.Item>
              <Descriptions.Item label="设备">{o.matchedEquipmentId ? renderLinkButton('equipment', [o.matchedEquipmentId]) || '-' : '-'}</Descriptions.Item>
              <Descriptions.Item label="检测报告">{o.qualityInspectionId ? renderLinkButton('inspection', [o.qualityInspectionId]) || '-' : '-'}</Descriptions.Item>
            </Descriptions>
          </>
        );
      }
      default:
        return null;
    }
  };

  return (
    <Drawer
      title={`${moduleLabels[moduleType]}详情`}
      placement="right"
      width={720}
      onClose={onClose}
      open={visible}
      bodyStyle={{ paddingBottom: 24 }}
    >
      {renderContent()}
    </Drawer>
  );
};

export default DetailDrawer;
