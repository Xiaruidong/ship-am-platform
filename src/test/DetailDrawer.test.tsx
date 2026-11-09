import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DetailDrawer from '../components/DetailDrawer';
import { materials, parts, equipment, inspections, standards } from '../mock/mockData';

describe('DetailDrawer 组件测试', () => {
  it('materials 模块应正确渲染材料详情', () => {
    const material = materials[0];
    render(
      <MemoryRouter>
        <DetailDrawer visible={true} onClose={() => {}} data={material} moduleType="materials" />
      </MemoryRouter>
    );
    expect(screen.getByText('金属原材料详情')).toBeInTheDocument();
    expect(screen.getByText(material.materialName)).toBeInTheDocument();
    expect(screen.getByText(material.materialCode)).toBeInTheDocument();
    expect(screen.getByText('化学成分（wt%）')).toBeInTheDocument();
  });

  it('parts 模块应正确渲染零部件详情', () => {
    const part = parts[0];
    render(
      <MemoryRouter>
        <DetailDrawer visible={true} onClose={() => {}} data={part} moduleType="parts" />
      </MemoryRouter>
    );
    expect(screen.getByText('零部件模型详情')).toBeInTheDocument();
    expect(screen.getByText(part.partName)).toBeInTheDocument();
    expect(screen.getByText(part.oemPartNumber)).toBeInTheDocument();
  });

  it('equipment 模块应正确渲染设备详情', () => {
    const equip = equipment[0];
    render(
      <MemoryRouter>
        <DetailDrawer visible={true} onClose={() => {}} data={equip} moduleType="equipment" />
      </MemoryRouter>
    );
    expect(screen.getByText('增材设备详情')).toBeInTheDocument();
    expect(screen.getByText(equip.equipmentName)).toBeInTheDocument();
    expect(screen.getByText(equip.manufacturer)).toBeInTheDocument();
  });

  it('inspection 模块应正确渲染检测详情', () => {
    const inspection = inspections[0];
    render(
      <MemoryRouter>
        <DetailDrawer visible={true} onClose={() => {}} data={inspection} moduleType="inspection" />
      </MemoryRouter>
    );
    expect(screen.getByText('检测数据详情')).toBeInTheDocument();
    expect(screen.getByText(inspection.sampleName)).toBeInTheDocument();
  });

  it('standards 模块应正确渲染标准详情', () => {
    const standard = standards[0];
    render(
      <MemoryRouter>
        <DetailDrawer visible={true} onClose={() => {}} data={standard} moduleType="standards" />
      </MemoryRouter>
    );
    expect(screen.getByText('标准数据详情')).toBeInTheDocument();
    expect(screen.getByText(standard.standardNumber)).toBeInTheDocument();
  });

  it('data 为 null 时不应渲染内容', () => {
    const { container } = render(
      <MemoryRouter>
        <DetailDrawer visible={true} onClose={() => {}} data={null} moduleType="materials" />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });
});
