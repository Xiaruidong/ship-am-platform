import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

describe('App 路由测试', () => {
  it('默认首页应渲染态势大屏', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByTitle('多中心化协同态势大屏')).toBeInTheDocument();
  });

  it('工作台首页应渲染数据仪表盘', () => {
    render(
      <MemoryRouter initialEntries={['/workbench']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getAllByText('数据仪表盘').length).toBeGreaterThanOrEqual(1);
  });

  it('应渲染 金属原材料 页面', () => {
    render(
      <MemoryRouter initialEntries={['/materials']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByText('金属增材用原材料')).toBeInTheDocument();
  });

  it('应渲染 零部件模型 页面', () => {
    render(
      <MemoryRouter initialEntries={['/parts']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByText('增材制造零部件模型')).toBeInTheDocument();
  });

  it('应渲染 增材设备 页面', () => {
    render(
      <MemoryRouter initialEntries={['/equipment']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByText('增材设备信息')).toBeInTheDocument();
  });

  it('应渲染 检测数据 页面', () => {
    render(
      <MemoryRouter initialEntries={['/inspection']}>
        <App />
      </MemoryRouter>
    );
    const headings = screen.getAllByText('检测数据');
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it('应渲染 订单管理 页面', () => {
    render(
      <MemoryRouter initialEntries={['/orders']}>
        <App />
      </MemoryRouter>
    );
    const headings = screen.getAllByText('订单管理');
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it('应渲染 标准数据 页面', () => {
    render(
      <MemoryRouter initialEntries={['/standards']}>
        <App />
      </MemoryRouter>
    );
    const headings = screen.getAllByText('标准数据');
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });
});
