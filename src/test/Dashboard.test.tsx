import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import { materials, parts, equipment, inspections, standards } from '../mock/mockData';
import { orders } from '../mock/mockOrders';

describe('Dashboard 页面测试', () => {
  it('应渲染数据仪表盘标题', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    expect(screen.getByText('数据仪表盘')).toBeInTheDocument();
  });

  it('应渲染统计卡片', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    expect(screen.getByText('金属原材料')).toBeInTheDocument();
    expect(screen.getByText('零部件模型')).toBeInTheDocument();
    expect(screen.getByText('增材设备')).toBeInTheDocument();
    expect(screen.getByText('检测数据')).toBeInTheDocument();
    expect(screen.getByText('标准数据')).toBeInTheDocument();
    expect(screen.getByText('订单管理')).toBeInTheDocument();
  });

  it('统计卡片应显示正确数量', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    const text = document.body.textContent || '';
    expect(text).toContain(String(materials.length));
    expect(text).toContain(String(parts.length));
    expect(text).toContain(String(equipment.length));
    expect(text).toContain(String(inspections.length));
    expect(text).toContain(String(standards.length));
    expect(text).toContain(String(orders.length));
  });

  it('应渲染材料大类分布', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    expect(screen.getByText('材料大类分布')).toBeInTheDocument();
  });

  it('应渲染设备状态分布', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    expect(screen.getByText('设备状态分布')).toBeInTheDocument();
  });

  it('应渲染检测合格率', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    expect(screen.getByText('检测合格率')).toBeInTheDocument();
    const passed = inspections.filter(i => i.resultJudgment === '合格').length;
    const rate = ((passed / inspections.length) * 100).toFixed(1);
    expect(screen.getByText(`${rate}%`)).toBeInTheDocument();
  });

  it('应渲染订单状态分布', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    expect(screen.getByText('订单状态分布')).toBeInTheDocument();
  });

  it('应渲染最近录入材料和最近订单', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    expect(screen.getByText('最近录入材料')).toBeInTheDocument();
    expect(screen.getByText('最近订单')).toBeInTheDocument();
  });

  it('应渲染最近检测记录', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    expect(screen.getByText('最近检测记录')).toBeInTheDocument();
  });
});

describe('Dashboard 全局搜索测试', () => {
  it('全局搜索应显示搜索结果', () => {
    render(
      <MemoryRouter initialEntries={['/workbench?search=316L']}>
        <Dashboard />
      </MemoryRouter>
    );
    expect(screen.getByText(/全局搜索结果/)).toBeInTheDocument();
  });

  it('无搜索结果时显示正确数量', () => {
    render(
      <MemoryRouter initialEntries={['/workbench?search=不存在的搜索']}>
        <Dashboard />
      </MemoryRouter>
    );
    expect(screen.getByText('共找到 0 条相关记录')).toBeInTheDocument();
  });
});
