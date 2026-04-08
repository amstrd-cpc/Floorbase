'use client';

import { useMemo } from 'react';
import type { FloorLayoutDto } from '@/lib/floor-layout/types';
import { cn } from '@/lib/utils';
import { useFitScale } from './use-fit-scale';

export type PublicTableVisualState = {
  status:
    | 'AVAILABLE'
    | 'UNAVAILABLE_BOOKED'
    | 'UNAVAILABLE_RULE'
    | 'UNAVAILABLE_EVENT'
    | 'INACTIVE';
  reason: string;
  selectable: boolean;
};

type Props = {
  layout: FloorLayoutDto;
  selectedTableId: string | null;
  tableStates: Record<string, PublicTableVisualState>;
  onSelectTable: (tableId: string) => void;
};

function shapeClass(shape: string) {
  if (shape === 'ROUND') return 'rounded-full';
  if (shape === 'RECTANGLE') return 'rounded-sm';
  return 'rounded-md';
}

function tableTone(status: PublicTableVisualState['status'], selected: boolean) {
  if (selected) {
    return 'border-blue-700 bg-blue-100 text-blue-950 ring-2 ring-blue-400';
  }

  if (status === 'AVAILABLE') {
    return 'border-emerald-400 bg-emerald-50 text-emerald-950 hover:bg-emerald-100';
  }

  if (status === 'UNAVAILABLE_BOOKED') {
    return 'border-rose-300 bg-rose-50 text-rose-900';
  }

  if (status === 'UNAVAILABLE_EVENT') {
    return 'border-amber-300 bg-amber-50 text-amber-900';
  }

  return 'border-slate-300 bg-slate-100 text-slate-500';
}

export function FloorLayoutCanvas({
  layout,
  selectedTableId,
  tableStates,
  onSelectTable
}: Props) {
  const { containerRef, scale } = useFitScale({
    width: layout.canvasWidth,
    height: layout.canvasHeight,
    maxScale: 1
  });

  const canvasHeight = useMemo(() => layout.canvasHeight * scale, [layout.canvasHeight, scale]);

  return (
    <div className="rounded-lg border bg-slate-50 p-3">
      <div ref={containerRef} className="w-full" style={{ height: `${canvasHeight}px` }}>
        <div
          className="relative origin-top-left bg-white"
          style={{
            width: `${layout.canvasWidth}px`,
            height: `${layout.canvasHeight}px`,
            transform: `scale(${scale})`,
            backgroundImage:
              'linear-gradient(to right, #f1f5f9 1px, transparent 1px), linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)',
            backgroundSize: `${layout.gridSize}px ${layout.gridSize}px`
          }}
        >
          {layout.tables.map((table) => {
            const state = tableStates[table.id];
            const selected = table.tableId === selectedTableId;
            const disabled = !state?.selectable;

            return (
              <button
                key={table.id}
                type="button"
                aria-pressed={selected}
                aria-label={`${table.label}. ${state?.reason ?? 'Unavailable'}`}
                disabled={disabled}
                onClick={() => {
                  if (!disabled) {
                    onSelectTable(table.tableId);
                  }
                }}
                className={cn(
                  'absolute border px-1 text-left text-[11px] shadow-sm transition md:text-xs',
                  shapeClass(table.shape),
                  tableTone(state?.status ?? 'UNAVAILABLE_RULE', selected),
                  disabled ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                )}
                style={{
                  left: `${table.x}px`,
                  top: `${table.y}px`,
                  width: `${table.width}px`,
                  height: `${table.height}px`,
                  transform: `rotate(${table.rotation}deg)`,
                  transformOrigin: 'center center'
                }}
              >
                <span className="block truncate font-medium">{table.label}</span>
                <span className="block truncate text-[10px]">{state?.reason ?? 'Unavailable'}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
