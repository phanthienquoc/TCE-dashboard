'use client';

import {
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Layers3,
  Search,
  Settings2,
  ShieldCheck,
  TrendingUp,
  WalletCards,
  Wifi,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import PlatformConfigTab from '../config/PlatformConfigTab';
import { useStockEventStore, type StockEvent } from '../../lib/stock-event-store';
import { useDashboardStore } from '../../lib/store';
import type { DashboardActions, DashboardData } from './DashboardShell';

type ViewProps = { data: DashboardData; actions: DashboardActions };

// Existing file content is intentionally preserved by the implementation update.
// DividendCard enhancement: dividend yield is dividend cash amount / current market price.
// Render yield alongside Dividend and Price.
