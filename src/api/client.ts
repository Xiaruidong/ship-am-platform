// API 客户端：统一 fetch 封装 + 订单写操作
// 测试环境（vitest）下由 hooks 直接使用 Mock 数据，不走网络
import type { Order, ScheduleInfo } from '../types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let msg = `请求失败 (${res.status})`;
    try {
      const body = await res.json();
      if (body.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  createOrder: (order: Order) =>
    request<Order>('/api/orders', { method: 'POST', body: JSON.stringify(order) }),

  updateOrderStatus: (id: string, status: string) =>
    request<Order>(`/api/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  matchOrder: (id: string, equipmentId: string) =>
    request<Order>(`/api/orders/${id}/match`, { method: 'POST', body: JSON.stringify({ equipmentId }) }),

  scheduleOrder: (id: string, scheduleInfo: ScheduleInfo) =>
    request<Order>(`/api/orders/${id}/schedule`, { method: 'POST', body: JSON.stringify(scheduleInfo) }),
};
