'use client';

import { BottomTabs, type BottomTabsProps } from '@/shareComponent/bottom-tabs';

export type NavigationDockProps = BottomTabsProps;

export function NavigationDock(props: NavigationDockProps) {
  return <BottomTabs {...props} />;
}
