'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const DEFAULT_POSITION_MIN_PRICE = 10_000;
export const DEFAULT_POSITION_MAX_PRICE = 30_000;

export type PositionDividendFilters = {
  selectedMonth: string;
  minPrice: number;
  maxPrice: number;
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
  minPrice: DEFAULT_POSITION_MIN_PRICE,
  maxPrice: DEFAULT_POSITION_MAX_PRICE,
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
      version: 3,
      migrate: (persisted: unknown) => {
        const state = persisted as Partial<PositionDividendFilters> & { priceFilter?: number };
        return {
          selectedMonth:
            typeof state.selectedMonth === 'string' ? state.selectedMonth : currentMonthKey(),
          minPrice: Number.isFinite(Number(state.minPrice))
            ? Number(state.minPrice)
            : DEFAULT_POSITION_MIN_PRICE,
          maxPrice: Number.isFinite(Number(state.maxPrice))
            ? Number(state.maxPrice)
            : Number.isFinite(Number(state.priceFilter))
              ? Number(state.priceFilter)
              : DEFAULT_POSITION_MAX_PRICE,
          minYield: state.minYield == null ? null : Number(state.minYield),
          maxYield: state.maxYield == null ? null : Number(state.maxYield),
        };
      },
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        selectedMonth: state.selectedMonth,
        minPrice: state.minPrice,
        maxPrice: state.maxPrice,
        minYield: state.minYield,
        maxYield: state.maxYield,
      }),
      skipHydration: true,
    }
  )
);
