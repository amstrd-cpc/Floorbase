import type { FloorLayoutDto } from '@/lib/floor-layout/types';

type TableStateTone = 'default' | 'free' | 'assigned' | 'conflict' | 'inactive';

type TableVisualState = {
  tone?: TableStateTone;
  badge?: string;
  subtitle?: string;
  disabled?: boolean;
};

type Props = {
  layout: FloorLayoutDto;
  selectedTableId?: string | null;
  onSelectTable?: (tableId: string) => void;
  tableStates?: Record<string, TableVisualState>;
  children?: React.ReactNode;
};

function shapeClass(shape: string) {
  if (shape === 'ROUND') return 'rounded-full';
  if (shape === 'RECTANGLE') return 'rounded-sm';
  return 'rounded-md';
}

function toneClass(tone: TableStateTone) {
  if (tone === 'assigned') {
    return 'border-blue-500 bg-blue-100 text-blue-950';
  }

  if (tone === 'conflict') {
    return 'border-red-400 bg-red-100 text-red-950';
  }

  if (tone === 'inactive') {
    return 'border-slate-300 bg-slate-100 text-slate-500';
  }

  if (tone === 'free') {
    return 'border-emerald-300 bg-emerald-50 text-emerald-950';
  }

  return 'border-border bg-background text-foreground';
}

export function FloorLayoutRenderer({
  layout,
  selectedTableId,
  onSelectTable,
  tableStates,
  children
}: Props) {
  return (
    <div className="max-h-[70vh] w-full min-w-0 overflow-auto rounded border bg-slate-50 p-3">
      <div
        className="relative inline-block bg-background"
        style={{
          width: `${layout.canvasWidth}px`,
          height: `${layout.canvasHeight}px`,
          backgroundImage:
            'linear-gradient(to right, #f1f5f9 1px, transparent 1px), linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)',
          backgroundSize: `${layout.gridSize}px ${layout.gridSize}px`
        }}
      >
        {layout.tables.map((table) => {
          const state = tableStates?.[table.id];
          const disabled = state?.disabled ?? false;
          const tone = table.isActive ? (state?.tone ?? 'default') : 'inactive';

          return (
            <button
              key={table.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectTable?.(table.id)}
              className={`absolute border text-left text-xs transition ${shapeClass(table.shape)} ${toneClass(tone)} ${
                table.id === selectedTableId ? 'ring-2 ring-blue-300' : ''
              } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
              style={{
                left: `${table.x}px`,
                top: `${table.y}px`,
                width: `${table.width}px`,
                height: `${table.height}px`,
                transform: `rotate(${table.rotation}deg)`,
                transformOrigin: 'center center'
              }}
            >
              <span className="block truncate px-2 pt-1 font-medium">
                {table.label}
              </span>
              <span className="block truncate px-2 text-[10px]">
                {state?.subtitle ?? `${table.capacityMax} seats`}
              </span>
              {state?.badge ? (
                <span className="absolute bottom-1 right-1 bg-background/70 px-1.5 py-0.5 text-[10px] font-medium">
                  {state.badge}
                </span>
              ) : null}
            </button>
          );
        })}

        {children}
      </div>
    </div>
  );
}
