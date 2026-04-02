import type { FloorLayoutDto } from '@/lib/floor-layout/types';

type Props = {
  layout: FloorLayoutDto;
  selectedTableId?: string | null;
  onSelectTable?: (tableId: string) => void;
  children?: React.ReactNode;
};

function shapeClass(shape: string) {
  if (shape === 'ROUND') return 'rounded-full';
  if (shape === 'RECTANGLE') return 'rounded-sm';
  return 'rounded-md';
}

export function FloorLayoutRenderer({
  layout,
  selectedTableId,
  onSelectTable,
  children
}: Props) {
  return (
    <div className="overflow-auto rounded border bg-slate-50 p-3">
      <div
        className="relative bg-white"
        style={{
          width: `${layout.canvasWidth}px`,
          height: `${layout.canvasHeight}px`,
          backgroundImage:
            'linear-gradient(to right, #f1f5f9 1px, transparent 1px), linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)',
          backgroundSize: `${layout.gridSize}px ${layout.gridSize}px`
        }}
      >
        {layout.tables.map((table) => (
          <button
            key={table.id}
            type="button"
            onClick={() => onSelectTable?.(table.id)}
            className={`absolute border text-left text-xs shadow-sm transition ${shapeClass(table.shape)} ${
              table.id === selectedTableId
                ? 'border-blue-600 ring-2 ring-blue-200'
                : 'border-slate-300'
            } ${table.isActive ? 'bg-white' : 'bg-slate-100 opacity-70'}`}
            style={{
              left: `${table.x}px`,
              top: `${table.y}px`,
              width: `${table.width}px`,
              height: `${table.height}px`,
              transform: `rotate(${table.rotation}deg)`,
              transformOrigin: 'center center'
            }}
          >
            <span className="block truncate px-2 pt-1 font-medium">{table.label}</span>
            <span className="block px-2 text-[10px] text-slate-500">{table.capacityMax} seats</span>
          </button>
        ))}

        {children}
      </div>
    </div>
  );
}
