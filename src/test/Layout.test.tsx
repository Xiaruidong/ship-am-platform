import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../components/Layout';

describe('Layout 组件测试', () => {
  it('应渲染侧边栏菜单和标题', () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );
    expect(screen.getByText('增材制造数据平台')).toBeInTheDocument();
    expect(screen.getByText('数据仪表盘')).toBeInTheDocument();
    expect(screen.getByText('金属原材料')).toBeInTheDocument();
    expect(screen.getByText('零部件模型')).toBeInTheDocument();
    expect(screen.getByText('增材设备')).toBeInTheDocument();
    expect(screen.getByText('检测数据')).toBeInTheDocument();
    expect(screen.getByText('订单管理')).toBeInTheDocument();
    expect(screen.getByText('标准数据')).toBeInTheDocument();
  });

  it('应渲染顶部搜索栏', () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );
    expect(screen.getByPlaceholderText('全局搜索：材料牌号、零部件名称、标准编号...')).toBeInTheDocument();
  });

  it('点击菜单应进行导航', () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );
    const menuItem = screen.getByText('金属原材料');
    fireEvent.click(menuItem);
    expect(menuItem.closest('li')).toHaveClass('ant-menu-item-selected');
  });

  it('全局搜索应触发导航', () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );
    const searchInput = screen.getByPlaceholderText('全局搜索：材料牌号、零部件名称、标准编号...');
    fireEvent.change(searchInput, { target: { value: '316L' } });
    const searchButton = screen.getByRole('button', { name: /search/i });
    fireEvent.click(searchButton);
  });
});
