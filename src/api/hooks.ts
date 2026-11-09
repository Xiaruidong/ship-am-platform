// 数据获取 Hooks：开发/生产环境从后端 API 加载；测试环境同步使用 Mock 数据，
// 使既有测试（同步断言 Mock 内容）无需改动即可通过。
import { useState, useEffect, useCallback } from 'react';
import type { Material, Part, Equipment, Inspection, Standard, Order } from '../types';
import { materials as mockMaterials, parts as mockParts, equipment as mockEquipment, inspections as mockInspections, standards as mockStandards } from '../mock/mockData';
import { orders as mockOrders } from '../mock/mockOrders';

const isTest = import.meta.env.MODE === 'test';

export interface EntityData<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

function useApiList<T>(url: string, mockInitial: T[]): EntityData<T> {
  const [data, setData] = useState<T[]>(() => (isTest ? mockInitial : []));
  const [loading, setLoading] = useState(!isTest);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (isTest) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`加载失败 (${res.status})`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

export const useMaterials = () => useApiList<Material>('/api/materials', mockMaterials);
export const useParts = () => useApiList<Part>('/api/parts', mockParts);
export const useEquipment = () => useApiList<Equipment>('/api/equipment', mockEquipment);
export const useInspections = () => useApiList<Inspection>('/api/inspection', mockInspections);
export const useStandards = () => useApiList<Standard>('/api/standards', mockStandards);
export const useOrders = () => useApiList<Order>('/api/orders', mockOrders);
