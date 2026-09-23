'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const DEFAULT_POSITION_PRICE_FILTER = 30_000;

export type PositionDividendFilters = {
  selectedMonth: string;
  priceFilter: number;
  minYield: number | null;
  maxYield: number | null;
};

type PositionFilterStore = PositionDividendFilters & {
  setFilters: (filters: PositionDividendFilters) => void;
  resetFilters: () => void;
};

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const defaults = (): PositionDividendFilters => ({
  selectedMonth: currentMonthKey(),
  priceFilter: DEFAULT_POSITION_PRICE_FILTER,
  minYield: null,
  maxYield: null,
});

export const usePositionFilterStore = create<PositionFilterStore>()(
  persist(
    set => ({
      ...defaults(),
      setFilters: filters => set(filters),
      resetFilters: () => set(defaults()),
    }),
    {
      name: 'tce:positions:dividend-filters:v2',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        selectedMonth: state.selectedMonth,
        priceFilter: state.priceFilter,
        minYield: state.minYield,
        maxYield: state.maxYield,
      }),
      skipHydration: true,
    }
  )
);
