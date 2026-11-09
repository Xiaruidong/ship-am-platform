import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Standards from '../pages/Standards';
import { standards } from '../mock/mockData';

describe('Standards 页面测试', () => {
  it('应渲染页面标题', () => {
    render(
      <MemoryRouter>
        <Standards />
      </MemoryRouter>
    );
    expect(screen.getByText('标准数据')).toBeInTheDocument();
  });

  it('应渲染标准数据表格表头', () => {
    render(
      <MemoryRouter>
        <Standards />
      </MemoryRouter>
    );
    const text = document.body.textContent || '';
    expect(text).toContain('标准编号');
    expect(text).toContain('标准名称');
    expect(text).toContain('标准类型');
    expect(text).toContain('船级社');
  });

  it('应渲染所有标准数据', () => {
    render(
      <MemoryRouter>
        <Standards />
      </MemoryRouter>
    );
    const firstStandard = standards[0];
    expect(screen.getByText(firstStandard.standardNumber)).toBeInTheDocument();
    expect(screen.getByText(firstStandard.standardName)).toBeInTheDocument();
  });

  it('搜索标准编号应过滤结果', () => {
    render(
      <MemoryRouter>
        <Standards />
      </MemoryRouter>
    );
    const searchInput = screen.getByPlaceholderText('搜索标准编号');
    fireEvent.change(searchInput, { target: { value: 'GB/T' } });
    expect(screen.getByText('GB/T 39254-2020')).toBeInTheDocument();
  });

  it('点击详情按钮应打开详情抽屉', async () => {
    render(
      <MemoryRouter>
        <Standards />
      </MemoryRouter>
    );
    const detailButton = screen.getAllByText('查看详情')[0];
    fireEvent.click(detailButton);
    await waitFor(() => {
      expect(screen.getByText('标准数据详情')).toBeInTheDocument();
    });
  });
});
