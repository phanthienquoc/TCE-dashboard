'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardShell from '../../components/dashboard/DashboardShell';
import { Card } from '../../components/ui/card';
import { dashboardApi } from '../../lib/api';

type Position = { sequence: number; symbol: string; state: string; tceDecision?: { quantity: number; entryPrice: number; takeProfitPrice: number }; availableAt?: string; realizedPnl?: number; recycledCapital?: number };
type Campaign = { id: string; event: { symbol: string; eventId: string; eventDate: string }; status: string };
type Row = { campaign: Campaign; current: Position | null; next: Position | null; positions: Position[]; continuity: { completed: number; gaps: number; total: number } };

export default function DrePage() {
  return <DashboardShell view="overview">{() => <DreDashboard />}</DashboardShell>;
}

function DreDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { dashboardApi.dreCampaigns().then(r => setRows(r.data)).finally(() => setLoading(false)); }, []);
  const totals = useMemo(() => rows.reduce((a, r) => ({ campaigns: a.campaigns + 1, gaps: a.gaps + r.continuity.gaps }), { campaigns: 0, gaps: 0 }), [rows]);
  return <main className="mx-auto w-full max-w-7xl space-y-5 p-4 md:p-6">
    <div><h1 className="text-xl font-semibold">Dividend Rolling Engine</h1><p className="text-sm text-muted-foreground">Current → T+2 → TP → recycle → Next</p></div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Metric label="Campaigns" value={totals.campaigns}/><Metric label="Gaps" value={totals.gaps}/><Metric label="Active" value={rows.filter(r => r.campaign.status === 'ACTIVE').length}/><Metric label="Ready NEXT" value={rows.filter(r => r.next?.state === 'NEXT').length}/></div>
    {loading ? <Card className="p-6 text-sm">Loading DRE state…</Card> : rows.length === 0 ? <Card className="p-6 text-sm text-muted-foreground">No dividend rolling campaigns.</Card> : <div className="space-y-3">{rows.map(row => <CampaignCard key={row.campaign.id} row={row}/>)}</div>}
  </main>;
}
function Metric({ label, value }: { label: string; value: number }) { return <Card className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></Card>; }
function CampaignCard({ row }: { row: Row }) { const c = row.campaign; const cur = row.current; const next = row.next; return <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><div className="font-semibold">{c.event.symbol} · {c.event.eventId}</div><div className="text-xs text-muted-foreground">Dividend {c.event.eventDate}</div></div><span className="rounded-full border px-2 py-1 text-xs">{c.status}</span></div><div className="grid gap-3 p-4 md:grid-cols-3"><State title="CURRENT" position={cur}/><State title="NEXT" position={next}/><div><div className="text-xs text-muted-foreground">CONTINUITY</div><div className="mt-2 text-sm">{row.continuity.completed}/{row.continuity.total} completed · {row.continuity.gaps} gap(s)</div>{cur?.availableAt && <div className="mt-1 text-xs text-muted-foreground">Available {new Date(cur.availableAt).toLocaleDateString()}</div>}</div></div></Card>; }
function State({ title, position }: { title: string; position: Position | null }) { return <div><div className="text-xs text-muted-foreground">{title}</div>{position ? <div className="mt-2"><div className="font-medium">#{position.sequence} · {position.state}</div><div className="text-sm">Qty {position.tceDecision?.quantity ?? '—'} · Entry {position.tceDecision?.entryPrice ?? '—'}</div>{position.tceDecision && <div className="text-xs text-muted-foreground">TP {position.tceDecision.takeProfitPrice} · P&L {position.realizedPnl ?? '—'}</div>}</div> : <div className="mt-2 text-sm text-muted-foreground">—</div>}</div>; }
