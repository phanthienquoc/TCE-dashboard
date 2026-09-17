'use client';

import '@xyflow/react/dist/style.css';

import { useMemo } from 'react';
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import Link from 'next/link';
import { Power, Settings2 } from 'lucide-react';

export type WorkflowEngineStatus = 'ACTIVE' | 'PAUSED' | 'ERROR';

export type WorkflowEngine = {
  id: string;
  name: string;
  shortName: string;
  category: string;
  description: string;
  status: WorkflowEngineStatus;
  enabled: boolean;
  dependencies: string[];
  configSummary?: string;
  href?: string;
  onToggle: (id: string) => void;
};

type EngineNodeProps = NodeProps<Node<WorkflowEngine, 'engine'>>;

function EngineNode({ data }: EngineNodeProps) {
  const statusClass =
    data.status === 'ACTIVE'
      ? 'border-emerald-400/60 bg-emerald-400/[0.08]'
      : data.status === 'ERROR'
        ? 'border-rose-400/60 bg-rose-400/[0.08]'
        : 'border-white/10 bg-white/[0.035]';

  return (
    <div className={`w-[230px] rounded-2xl border p-3 shadow-xl backdrop-blur ${statusClass}`}>
      <Handle type="target" position={Position.Top} className="!size-2 !border-0 !bg-slate-500" />
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={event => {
            event.stopPropagation();
            data.onToggle(data.id);
          }}
          className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border transition ${
            data.enabled
              ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-300'
              : 'border-white/10 bg-white/5 text-slate-500'
          }`}
          aria-label={`${data.enabled ? 'Disable' : 'Enable'} ${data.name}`}
        >
          <Power className="size-4" />
        </button>
        <Link href={data.href ?? '#'} onClick={event => event.stopPropagation()} className="min-w-0 flex-1" aria-label={`Open ${data.name}`}>
          <div className="flex items-center gap-2">
            <span className={`size-2 rounded-full ${data.status === 'ACTIVE' ? 'bg-emerald-400' : data.status === 'ERROR' ? 'bg-rose-400' : 'bg-slate-500'}`} />
            <p className="truncate text-[13px] font-semibold text-white">{data.shortName}</p>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">{data.category}</p>
        </Link>
        <Link href={data.href ?? '#'} onClick={event => event.stopPropagation()} className="text-slate-400 hover:text-white" aria-label={`Configure ${data.name}`}>
          <Settings2 className="size-4" />
        </Link>
      </div>
      <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-400">{data.description}</p>
      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-[10px]">
        <span className={data.status === 'ACTIVE' ? 'text-emerald-300' : data.status === 'ERROR' ? 'text-rose-300' : 'text-slate-400'}>{data.status}</span>
        <span className="max-w-[130px] truncate text-slate-500">{data.dependencies.length ? `Depends on ${data.dependencies.join(', ')}` : 'No dependency'}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!size-2 !border-0 !bg-slate-500" />
    </div>
  );
}

const nodeTypes = { engine: EngineNode };

export function EngineWorkflow({ engines }: { engines: WorkflowEngine[] }) {
  const nodes = useMemo<Node<WorkflowEngine, 'engine'>[]>(() => {
    const layout: Record<string, { x: number; y: number }> = {
      'tce-decision': { x: 70, y: 120 },
      'ssi-execution': { x: 70, y: 430 },
      'binance-market': { x: 350, y: 430 },
      'binance-xau': { x: 350, y: 740 },
    };
    return engines.map(engine => ({
      id: engine.id,
      type: 'engine',
      position: layout[engine.id] ?? { x: 70, y: 120 + engines.indexOf(engine) * 310 },
      data: engine,
      draggable: false,
    }));
  }, [engines]);

  const edges = useMemo<Edge[]>(() => engines.flatMap(engine => engine.dependencies.map(dependency => {
    const dependencyEngine = engines.find(item => item.id === dependency);
    const active = dependencyEngine?.status === 'ACTIVE' && engine.status === 'ACTIVE';
    return {
      id: `${dependency}-${engine.id}`,
      source: dependency,
      target: engine.id,
      animated: active,
      style: { stroke: active ? 'rgb(52 211 153 / 0.9)' : 'rgb(100 116 139 / 0.45)', strokeWidth: active ? 2.4 : 1 },
    };
  })), [engines]);

  const activeCount = engines.filter(engine => engine.status === 'ACTIVE').length;
  const errorCount = engines.filter(engine => engine.status === 'ERROR').length;

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3"><p className="text-xl font-semibold text-emerald-300">{activeCount}</p><p className="text-[11px] text-slate-400">Active</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><p className="text-xl font-semibold text-white">{engines.length - activeCount - errorCount}</p><p className="text-[11px] text-slate-400">Paused</p></div>
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-3"><p className="text-xl font-semibold text-rose-300">{errorCount}</p><p className="text-[11px] text-slate-400">Error</p></div>
      </div>
      <div className="h-[780px] overflow-hidden rounded-3xl border border-white/10 bg-[#07111b]">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.18 }} panOnDrag zoomOnPinch minZoom={0.35} maxZoom={1.4} nodesConnectable={false} nodesDraggable={false} elementsSelectable={false} proOptions={{ hideAttribution: true }}>
          <Background gap={20} size={1} color="rgba(148,163,184,0.10)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
}
