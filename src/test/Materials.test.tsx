import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Materials from '../pages/Materials';
import { materials } from '../mock/mockData';

describe('Materials 页面测试', () => {
  it('应渲染页面标题', () => {
    render(
      <MemoryRouter>
        <Materials />
      </MemoryRouter>
    );
    expect(screen.getByText('金属增材用原材料')).toBeInTheDocument();
  });

  it('应渲染搜索输入框', () => {
    render(
      <MemoryRouter>
        <Materials />
      </MemoryRouter>
    );
    expect(screen.getByPlaceholderText('搜索材料名称')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索材料牌号')).toBeInTheDocument();
  });

  it('应渲染材料数据表格表头', () => {
    render(
      <MemoryRouter>
        <Materials />
      </MemoryRouter>
    );
    const text = document.body.textContent || '';
    expect(text).toContain('材料牌号编码');
    expect(text).toContain('材料中文名称');
    expect(text).toContain('材料大类');
  });

  it('应渲染所有材料数据行', () => {
    render(
      <MemoryRouter>
        <Materials />
      </MemoryRouter>
    );
    const firstMaterial = materials[0];
    expect(screen.getByText(firstMaterial.materialName)).toBeInTheDocument();
    expect(screen.getByText(firstMaterial.materialCode)).toBeInTheDocument();
  });

  it('搜索材料名称应过滤结果', () => {
    render(
      <MemoryRouter>
        <Materials />
      </MemoryRouter>
    );
    const searchInput = screen.getByPlaceholderText('搜索材料名称');
    fireEvent.change(searchInput, { target: { value: '316L' } });
    expect(screen.getByText('奥氏体不锈钢316L')).toBeInTheDocument();
  });

  it('搜索不存在的材料应显示无数据', async () => {
    render(
      <MemoryRouter>
        <Materials />
      </MemoryRouter>
    );
    const searchInput = screen.getByPlaceholderText('搜索材料名称');
    fireEvent.change(searchInput, { target: { value: '不存在的材料' } });
    await waitFor(() => {
      const text = document.body.textContent || '';
      // antd 在英文 locale 下显示 "No data"
      expect(text.toLowerCase()).toMatch(/no data|暂无数据/);
    });
  });

  it('点击重置按钮应清除筛选', () => {
    render(
      <MemoryRouter>
        <Materials />
      </MemoryRouter>
    );
    const searchInput = screen.getByPlaceholderText('搜索材料名称');
    fireEvent.change(searchInput, { target: { value: '316L' } });
    const resetButton = screen.getByText('重置筛选');
    fireEvent.click(resetButton);
    expect(screen.getByText('奥氏体不锈钢316L')).toBeInTheDocument();
  });

  it('点击表格行应打开详情抽屉', async () => {
    render(
      <MemoryRouter>
        <Materials />
      </MemoryRouter>
    );
    const row = screen.getByText('奥氏体不锈钢316L').closest('tr');
    if (row) fireEvent.click(row);
    await waitFor(() => {
      expect(screen.getByText('金属原材料详情')).toBeInTheDocument();
    });
  });

  it('点击详情按钮应打开详情抽屉', async () => {
    render(
      <MemoryRouter>
        <Materials />
      </MemoryRouter>
    );
    const detailButton = screen.getAllByText('查看详情')[0];
    fireEvent.click(detailButton);
    await waitFor(() => {
      expect(screen.getByText('金属原材料详情')).toBeInTheDocument();
    });
  });
});
