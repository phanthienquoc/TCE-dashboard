'use client';

import dynamic from 'next/dynamic';
import { ArrowLeft, Bell } from 'lucide-react';
import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { NavigationDock } from '../../../components/navigation/NavigationDock';
import { Button } from '../../../components/ui/button';
const TelegramBotConfig = dynamic(() => import('../TelegramBotConfig'), { loading: () => <div className="loading-state min-h-[360px] animate-pulse rounded-2xl p-4" /> });
export default function NewNotificationPage() {
  const router=useRouter();
  return <main className="app-shell"><div className="app-container app-content"><div className="mb-3 flex items-center gap-2"><Button type="button" variant="outline" size="icon" className="shrink-0" onClick={()=>router.push('/notifications')} aria-label="Back to notifications"><ArrowLeft className="size-4"/></Button><div className="min-w-0"><p className="eyebrow">Notifications</p><p className="account-email">New Telegram channel</p></div></div><section className="page-heading"><div className="min-w-0"><p className="eyebrow">Delivery</p><h1>Add notification channel</h1><p className="page-subtitle">Connect a Telegram bot and configure its backend debug routing.</p></div><div className="hero-status">Telegram</div></section><TelegramBotConfig/></div><Suspense fallback={null}><NavigationDock items={[{id:'notifications',label:'Notifications',icon:Bell,active:true}]} onSelect={()=>router.push('/notifications')}/></Suspense></main>;
}
