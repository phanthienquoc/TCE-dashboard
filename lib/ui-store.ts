import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Tab = 'Overview' | 'Positions' | 'Recent Orders' | 'Trading Platforms' | 'Security';

type UIState = {
  activeTab: Tab;
  binanceEnvironment: string;
  setActiveTab: (tab: Tab) => void;
  setBinanceEnvironment: (environment: string) => void;
};

export const useUIStore = create<UIState>()(
  persist(
    set => ({
      activeTab: 'Overview',
      binanceEnvironment: 'testnet',
      setActiveTab: activeTab => set({ activeTab }),
      setBinanceEnvironment: binanceEnvironment => set({ binanceEnvironment }),
    }),
    {
      name: 'tce-ui',
      skipHydration: true,
      partialize: state => ({
        activeTab: state.activeTab,
        binanceEnvironment: state.binanceEnvironment,
      }),
      version: 1,
    }
  )
);
