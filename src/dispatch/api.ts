// 订单派发应用 API 客户端（经 Vite 代理 /dapi → server-dispatch:3002）
export interface Kpi {
  todayNewDemands: number; demandDelta: number; pendingDispatch: number;
  inProduction: number; inInspection: number; onTimeRate: number; abnormal: number;
}
export interface OrderRow {
  order_id: string; order_name: string; scene: string; priority: string;
  material: string | null; quantity: number; status: string; progress: number;
  node_name: string | null; required_delivery: string | null;
}
export interface NodeRow {
  node_id: string; did: string; node_name: string; location: string;
  scene: string; status: string; device_count: number; device_online: number;
  load_rate: number; last_heartbeat: string | null;
}
export interface Candidate {
  node_id: string; node_name: string; score: number;
  reason: Record<string, number>; rank_no: number;
}
export interface Meta { asOf: string; onlineNodes: number; blockHeight: number; }

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const dispatchApi = {
  kpi: () => get<Kpi>('/dapi/overview/kpi'),
  meta: () => get<Meta>('/dapi/overview/meta'),
  orders: (params: { priority?: string; scene?: string; status?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
    return get<OrderRow[]>('/dapi/orders?' + q.toString());
  },
  nodes: () => get<NodeRow[]>('/dapi/nodes'),
  candidates: (orderId: string) => get<Candidate[]>(`/dapi/candidates?order_id=${encodeURIComponent(orderId)}`),
  contracts: () => get<{ active: number; pendingArchive: number; onchainTotal: number; list: Array<{ cs_id: string; name: string; state: string }> }>('/dapi/contracts'),
  events: (limit = 9) => get<Array<{ event_type: string; occurred_at: string; tx_hash: string | null; order_name: string; node_name: string | null }>>(`/dapi/events?limit=${limit}`),
  dispatchOrder: (orderId: string, nodeId: string) =>
    fetch(`/dapi/orders/${encodeURIComponent(orderId)}/dispatch`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_id: nodeId }),
    }).then(async (r) => {
      if (!r.ok) throw new Error((await r.json()).error || '派单失败');
      return r.json() as Promise<{ ok: boolean; contract_space_id: string; node: string }>;
    }),
};
