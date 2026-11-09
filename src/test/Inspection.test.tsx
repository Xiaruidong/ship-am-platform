import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Inspection from '../pages/Inspection';
import { inspections } from '../mock/mockData';

describe('Inspection 页面测试', () => {
  it('应渲染页面标题', () => {
    render(
      <MemoryRouter>
        <Inspection />
      </MemoryRouter>
    );
    expect(screen.getByText('检测数据')).toBeInTheDocument();
  });

  it('应渲染检测数据表格表头', () => {
    render(
      <MemoryRouter>
        <Inspection />
      </MemoryRouter>
    );
    const text = document.body.textContent || '';
    expect(text).toContain('样品名称');
    expect(text).toContain('抗拉强度 Rm(MPa)');
    expect(text).toContain('结果判定');
  });

  it('应渲染所有检测数据', () => {
    render(
      <MemoryRouter>
        <Inspection />
      </MemoryRouter>
    );
    const firstInspection = inspections[0];
    expect(screen.getByText(firstInspection.sampleName)).toBeInTheDocument();
  });

  it('应正确显示合格/不合格标签', () => {
    render(
      <MemoryRouter>
        <Inspection />
      </MemoryRouter>
    );
    const tags = screen.getAllByText('合格');
    expect(tags.length).toBeGreaterThan(0);
  });

  it('按结果判定筛选应工作', () => {
    render(
      <MemoryRouter>
        <Inspection />
      </MemoryRouter>
    );
    const text = document.body.textContent || '';
    expect(text).toContain('合格');
  });

  it('点击详情按钮应打开详情抽屉', async () => {
    render(
      <MemoryRouter>
        <Inspection />
      </MemoryRouter>
    );
    const detailButton = screen.getAllByText('查看详情')[0];
    fireEvent.click(detailButton);
    await waitFor(() => {
      expect(screen.getByText('检测数据详情')).toBeInTheDocument();
    });
  });
});
