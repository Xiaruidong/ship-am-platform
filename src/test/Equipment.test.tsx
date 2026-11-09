import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Equipment from '../pages/Equipment';
import { equipment } from '../mock/mockData';

describe('Equipment 页面测试', () => {
  it('应渲染页面标题', () => {
    render(
      <MemoryRouter>
        <Equipment />
      </MemoryRouter>
    );
    expect(screen.getByText('增材设备信息')).toBeInTheDocument();
  });

  it('应渲染设备数据表格表头', () => {
    render(
      <MemoryRouter>
        <Equipment />
      </MemoryRouter>
    );
    const text = document.body.textContent || '';
    expect(text).toContain('设备名称');
    expect(text).toContain('制造商');
    expect(text).toContain('设备状态');
  });

  it('应渲染所有设备数据', () => {
    render(
      <MemoryRouter>
        <Equipment />
      </MemoryRouter>
    );
    const firstEquipment = equipment[0];
    expect(screen.getByText(firstEquipment.equipmentName)).toBeInTheDocument();
  });

  it('按设备状态筛选应工作', () => {
    render(
      <MemoryRouter>
        <Equipment />
      </MemoryRouter>
    );
    const text = document.body.textContent || '';
    expect(text).toContain('运行中');
  });

  it('搜索设备名称应过滤结果', () => {
    render(
      <MemoryRouter>
        <Equipment />
      </MemoryRouter>
    );
    const searchInput = screen.getByPlaceholderText('搜索设备名称或制造商');
    fireEvent.change(searchInput, { target: { value: 'SLM' } });
    expect(screen.getByText('SLM Solutions SLM 500')).toBeInTheDocument();
  });

  it('点击详情按钮应打开详情抽屉', async () => {
    render(
      <MemoryRouter>
        <Equipment />
      </MemoryRouter>
    );
    const detailButton = screen.getAllByText('查看详情')[0];
    fireEvent.click(detailButton);
    await waitFor(() => {
      expect(screen.getByText('增材设备详情')).toBeInTheDocument();
    });
  });
});
