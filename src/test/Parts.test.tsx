import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Parts from '../pages/Parts';
import { parts } from '../mock/mockData';

describe('Parts 页面测试', () => {
  it('应渲染页面标题', () => {
    render(
      <MemoryRouter>
        <Parts />
      </MemoryRouter>
    );
    expect(screen.getByText('增材制造零部件模型')).toBeInTheDocument();
  });

  it('应渲染零部件数据表格表头', () => {
    render(
      <MemoryRouter>
        <Parts />
      </MemoryRouter>
    );
    const text = document.body.textContent || '';
    expect(text).toContain('零部件中文名称');
    expect(text).toContain('分类名称');
    expect(text).toContain('OEM原厂件号');
  });

  it('应渲染所有零部件数据', () => {
    render(
      <MemoryRouter>
        <Parts />
      </MemoryRouter>
    );
    const firstPart = parts[0];
    expect(screen.getByText(firstPart.partName)).toBeInTheDocument();
    expect(screen.getByText(firstPart.oemPartNumber)).toBeInTheDocument();
  });

  it('搜索零部件名称应过滤结果', () => {
    render(
      <MemoryRouter>
        <Parts />
      </MemoryRouter>
    );
    const searchInput = screen.getByPlaceholderText('搜索零部件名称或OEM件号');
    fireEvent.change(searchInput, { target: { value: '缸体' } });
    expect(screen.getByText('柴油机缸体')).toBeInTheDocument();
  });

  it('点击详情按钮应打开详情抽屉', async () => {
    render(
      <MemoryRouter>
        <Parts />
      </MemoryRouter>
    );
    const detailButton = screen.getAllByText('查看详情')[0];
    fireEvent.click(detailButton);
    await waitFor(() => {
      expect(screen.getByText('零部件模型详情')).toBeInTheDocument();
    });
  });
});
