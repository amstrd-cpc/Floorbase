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
  // Round tables stay physically round; everything else is sharp (0 radius)
  if (shape === 'ROUND') return 'rounded-full';
  return 'rounded-none';
}

// Monochrome encoding — fill weight + hatch stand in for the old color semaphore
const HATCH =
  'repeating-linear-gradient(45deg, transparent, transparent 4px, hsl(var(--border)) 4px, hsl(var(--border)) 5px)';

function tableTone(status: PublicTableVisualState['status'], selected: boolean) {
  if (selected) {
    return 'border-foreground bg-foreground text-background ring-1 ring-foreground';
  }

  if (status === 'AVAILABLE') {
    return 'border-foreground bg-background text-foreground hover:bg-secondary';
  }

  if (status === 'UNAVAILABLE_EVENT') {
    return 'border border-dashed border-muted-foreground/50 bg-secondary text-muted-foreground';
  }

  // BOOKED / RULE / INACTIVE — muted, hatched
  return 'border-border bg-secondary text-muted-foreground/70';
}

function isHatched(status: PublicTableVisualState['status'], selected: boolean) {
  if (selected) return false;
  return status === 'UNAVAILABLE_BOOKED' || status === 'UNAVAILABLE_RULE' || status === 'INACTIVE';
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
    <div className="border border-border bg-secondary p-3">
      <div ref={containerRef} className="w-full" style={{ height: `${canvasHeight}px` }}>
        <div
          className="relative origin-top-left bg-background"
          style={{
            width: `${layout.canvasWidth}px`,
            height: `${layout.canvasHeight}px`,
            transform: `scale(${scale})`,
            backgroundImage:
              'linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)',
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
                  'absolute border px-1 text-left text-[11px] transition md:text-xs',
                  shapeClass(table.shape),
                  tableTone(state?.status ?? 'UNAVAILABLE_RULE', selected),
                  disabled ? 'cursor-not-allowed' : 'cursor-pointer'
                )}
                style={{
                  left: `${table.x}px`,
                  top: `${table.y}px`,
                  width: `${table.width}px`,
                  height: `${table.height}px`,
                  transform: `rotate(${table.rotation}deg)`,
                  transformOrigin: 'center center',
                  backgroundImage: isHatched(state?.status ?? 'UNAVAILABLE_RULE', selected) ? HATCH : undefined
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
