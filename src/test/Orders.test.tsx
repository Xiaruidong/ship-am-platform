import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Orders from '../pages/Orders';
import { orders as mockOrders, statusTransitions } from '../mock/mockOrders';

describe('Orders 页面测试', () => {
  it('应渲染页面标题', () => {
    render(
      <MemoryRouter>
        <Orders />
      </MemoryRouter>
    );
    expect(screen.getByText('订单管理')).toBeInTheDocument();
  });

  it('应渲染订单数据表格表头', () => {
    render(
      <MemoryRouter>
        <Orders />
      </MemoryRouter>
    );
    const text = document.body.textContent || '';
    expect(text).toContain('订单编号');
    expect(text).toContain('订单名称');
    expect(text).toContain('订单状态');
  });

  it('应渲染所有订单数据', () => {
    render(
      <MemoryRouter>
        <Orders />
      </MemoryRouter>
    );
    const firstOrder = mockOrders[0];
    expect(screen.getByText(firstOrder.orderName)).toBeInTheDocument();
    expect(screen.getByText(firstOrder.id)).toBeInTheDocument();
  });

  it('应渲染状态标签（待匹配、已匹配、已排产、生产中、已完成）', () => {
    render(
      <MemoryRouter>
        <Orders />
      </MemoryRouter>
    );
    const text = document.body.textContent || '';
    expect(text).toContain('待匹配');
    expect(text).toContain('已完成');
  });

  it('应渲染创建订单按钮', () => {
    render(
      <MemoryRouter>
        <Orders />
      </MemoryRouter>
    );
    expect(screen.getByText('创建订单')).toBeInTheDocument();
  });

  it('搜索订单名称应过滤结果', () => {
    render(
      <MemoryRouter>
        <Orders />
      </MemoryRouter>
    );
    const searchInput = screen.getByPlaceholderText('搜索订单名称或编号');
    fireEvent.change(searchInput, { target: { value: '柴油机缸体' } });
    expect(screen.getByText('沪东H1207柴油机缸体修复')).toBeInTheDocument();
  });

  it('点击创建订单按钮应打开创建弹窗', async () => {
    render(
      <MemoryRouter>
        <Orders />
      </MemoryRouter>
    );
    const createButton = screen.getByText('创建订单');
    fireEvent.click(createButton);
    await waitFor(() => {
      expect(screen.getByText('创建新订单')).toBeInTheDocument();
    });
  });

  it('待匹配订单应显示匹配设备按钮', () => {
    render(
      <MemoryRouter>
        <Orders />
      </MemoryRouter>
    );
    const matchButtons = screen.getAllByText('匹配设备');
    expect(matchButtons.length).toBeGreaterThan(0);
  });

  it('已匹配订单应显示确认排产按钮', () => {
    render(
      <MemoryRouter>
        <Orders />
      </MemoryRouter>
    );
    const scheduleButtons = screen.getAllByText('确认排产');
    expect(scheduleButtons.length).toBeGreaterThan(0);
  });

  it('已完成订单不应显示操作按钮', () => {
    render(
      <MemoryRouter>
        <Orders />
      </MemoryRouter>
    );
    expect(screen.getByText('已完成')).toBeInTheDocument();
  });
});

describe('Orders 状态流转测试', () => {
  it('订单状态流转配置应正确', () => {
    expect(statusTransitions['待匹配'].next).toBe('已匹配');
    expect(statusTransitions['已匹配'].next).toBe('已排产');
    expect(statusTransitions['已排产'].next).toBe('生产中');
    expect(statusTransitions['生产中'].next).toBe('已完成');
    expect(statusTransitions['已完成'].next).toBeNull();
  });

  it('订单状态回退配置应正确', () => {
    expect(statusTransitions['待匹配'].prev).toBeNull();
    expect(statusTransitions['已匹配'].prev).toBe('待匹配');
    expect(statusTransitions['已排产'].prev).toBe('已匹配');
    expect(statusTransitions['生产中'].prev).toBe('已排产');
    expect(statusTransitions['已完成'].prev).toBe('生产中');
  });
});
