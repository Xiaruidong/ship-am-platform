import React, { useMemo, useState } from 'react';
import { Card, Table, Input, Space, Tag, Tabs } from 'antd';
import DetailDrawer from '../components/DetailDrawer';
import { useMaterials, useParts, useEquipment, useInspections, useStandards } from '../api/hooks';
import type { Material, Part, Equipment, Inspection, Standard, ModuleType } from '../types';
import DispatchShell from './DispatchShell';
import './dispatch.css';

type AnyRow = Material | Part | Equipment | Inspection | Standard;

const DataLibrary: React.FC = () => {
  const { data: materials } = useMaterials();
  const { data: parts } = useParts();
  const { data: equipment } = useEquipment();
  const { data: inspections } = useInspections();
  const { data: standards } = useStandards();
  const [tab, setTab] = useState<ModuleType>('materials');
  const [kw, setKw] = useState('');
  const [selected, setSelected] = useState<AnyRow | null>(null);
  const [open, setOpen] = useState(false);

  const counts: Array<[ModuleType, string, number]> = [
    ['materials', '材料库', materials.length],
    ['parts', '零部件模型库', parts.length],
    ['equipment', '产线装备库', equipment.length],
    ['inspection', '检测库', inspections.length],
    ['standards', '标准库', standards.length],
  ];
  const total = counts.reduce((s, c) => s + c[2], 0);

  const filter = (list: AnyRow[], fields: (r: AnyRow) => string[]) =>
    kw ? list.filter((r) => fields(r).some((v) => String(v || '').toLowerCase().includes(kw.toLowerCase()))) : list;

  const views: Record<string, { columns: any[]; rows: AnyRow[] }> = useMemo(() => ({
    materials: {
      columns: [
        { title: '牌号', dataIndex: 'materialCode', width: 130, render: (v: string) => <Tag color="blue">{v}</Tag> },
        { title: '名称', dataIndex: 'materialName', ellipsis: true },
        { title: '大类', dataIndex: 'materialCategory', width: 110 },
        { title: '粒径(μm)', dataIndex: 'averageParticleSize', width: 90 },
        { title: '供应商', dataIndex: 'supplier', ellipsis: true },
      ],
      rows: filter(materials, (r) => [(r as Material).materialName, (r as Material).materialCode, (r as Material).materialCategory]),
    },
    parts: {
      columns: [
        { title: '名称', dataIndex: 'partName', ellipsis: true },
        { title: '分类', dataIndex: 'categoryName', width: 130 },
        { title: 'OEM 件号', dataIndex: 'oemPartNumber', width: 160 },
        { title: '原始材料牌号', dataIndex: 'originalMaterialCode', width: 150 },
      ],
      rows: filter(parts, (r) => [(r as Part).partName, (r as Part).oemPartNumber, (r as Part).categoryName]),
    },
    equipment: {
      columns: [
        { title: '设备名称', dataIndex: 'equipmentName', ellipsis: true },
        { title: '制造商', dataIndex: 'manufacturer', width: 150 },
        { title: '机型', dataIndex: 'machineType', width: 90, render: (v: string) => <Tag>{v}</Tag> },
        { title: '成形尺寸(mm)', dataIndex: 'buildSizeX', width: 120 },
        { title: '功率(W)', dataIndex: 'laserMaxPower', width: 90 },
        { title: '状态', dataIndex: 'equipmentStatus', width: 90, render: (v: string) => <Tag color={v === '运行中' ? 'green' : v === '维护中' ? 'orange' : 'default'}>{v}</Tag> },
      ],
      rows: filter(equipment, (r) => [(r as Equipment).equipmentName, (r as Equipment).manufacturer, (r as Equipment).nodeLocation]),
    },
    inspection: {
      columns: [
        { title: '样品名称', dataIndex: 'sampleName', ellipsis: true },
        { title: '取样位置', dataIndex: 'samplingPosition', width: 120 },
        { title: '抗拉(MPa)', dataIndex: 'tensileStrength', width: 110 },
        { title: '屈服(MPa)', dataIndex: 'yieldStrength', width: 110 },
        { title: '判定', dataIndex: 'resultJudgment', width: 90, render: (v: string) => <Tag color={v === '合格' ? 'green' : v === '让步接收' ? 'orange' : 'red'}>{v}</Tag> },
      ],
      rows: filter(inspections, (r) => [(r as Inspection).sampleName, (r as Inspection).resultJudgment]),
    },
    standards: {
      columns: [
        { title: '标准编号', dataIndex: 'standardNumber', width: 170, render: (v: string) => <Tag color="blue">{v}</Tag> },
        { title: '标准名称', dataIndex: 'standardName', ellipsis: true },
        { title: '类型', dataIndex: 'standardType', width: 110 },
        { title: '船级社', dataIndex: 'classificationSociety', width: 90 },
      ],
      rows: filter(standards, (r) => [(r as Standard).standardNumber, (r as Standard).standardName, (r as Standard).classificationSociety]),
    },
  }), [materials, parts, equipment, inspections, standards, kw]);

  const labels: Record<string, string> = { materials: '材料库', parts: '零部件模型库', equipment: '产线装备库', inspection: '检测库', standards: '标准库' };

  return (
    <DispatchShell>
      <div className="dp-modtitle" style={{ marginBottom: 4 }}>数据资源库</div>
      <div style={{ fontSize: 12, color: '#6F7785', marginBottom: 14 }}>
        特种装备增材制造全生命周期专用数据 · 共 {total} 条记录 · 与主平台共享同一数据底座
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 14 }}>
        {counts.map(([key, label, n]) => (
          <Card key={key} hoverable styles={{ body: { padding: '14px 16px' } }} onClick={() => setTab(key)}>
            <b style={{ fontSize: 24, fontWeight: 700 }}>{n}</b>
            <span style={{ fontSize: 12, color: '#6F7785', marginLeft: 6 }}>条</span>
            <div style={{ fontSize: 12, color: '#6F7785' }}>{label}</div>
          </Card>
        ))}
      </div>
      <Card styles={{ body: { padding: 16 } }}>
        <Tabs
          activeKey={tab}
          onChange={(k) => { setTab(k as ModuleType); setKw(''); }}
          items={(['materials', 'parts', 'equipment', 'inspection', 'standards'] as ModuleType[]).map((k) => ({ key: k, label: labels[k] }))}
          tabBarExtraContent={<Space><Input.Search placeholder="搜索当前库…" allowClear onChange={(e) => setKw(e.target.value)} style={{ width: 260 }} /></Space>}
        />
        <Table
          dataSource={views[tab]?.rows || []}
          columns={views[tab]?.columns || []}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 10, showSizeChanger: false }}
          onRow={(record) => ({ onClick: () => { setSelected(record as AnyRow); setOpen(true); }, style: { cursor: 'pointer' } })}
        />
      </Card>
      <div style={{ fontSize: 12, color: '#6F7785', marginTop: 10 }}>
        提示：点击行打开详情抽屉，可查看化学成分、关联零部件/检测/标准等关联数据并一键跳转。
      </div>
      <DetailDrawer visible={open} onClose={() => setOpen(false)} data={selected} moduleType={tab} />
    </DispatchShell>
  );
};

export default DataLibrary;
