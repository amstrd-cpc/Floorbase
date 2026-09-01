'use client';

import { useCallback, useEffect, useState } from 'react';

type OrderLine = {
  id: string;
  nameSnapshot: string;
  quantity: number;
  notes: string | null;
  kitchenStatus: 'PENDING' | 'READY';
};

type Order = {
  id: string;
  tableId: string | null;
  createdAt: string;
  lines: OrderLine[];
};

type TableOption = { id: string; name: string };

const POLL_INTERVAL_MS = 4000;

function minutesAgo(createdAt: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000)
  );
  return minutes < 1 ? '<1m' : `${minutes}m`;
}

export function KitchenDisplay({ venueId }: { venueId: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<TableOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [ordersRes, tablesRes] = await Promise.all([
        fetch(`/api/admin/orders?venueId=${venueId}&status=OPEN`),
        fetch(`/api/admin/tables?venueId=${venueId}`)
      ]);
      const ordersBody = await ordersRes.json().catch(() => ({}));
      const tablesBody = await tablesRes.json().catch(() => ({}));
      if (!ordersRes.ok || !tablesRes.ok) {
        setError('Failed to load kitchen tickets.');
        return;
      }
      setError(null);
      setOrders(ordersBody.orders ?? []);
      setTables(tablesBody.tables ?? []);
    } catch {
      setError('Failed to load kitchen tickets.');
    } finally {
      setIsLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    // Standard fetch-on-mount; this app has no React Compiler / data-fetching
    // library, loadData's setIsLoading(true) is the intended initial state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
    const interval = setInterval(() => void loadData(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadData]);

  async function setLineStatus(lineId: string, kitchenStatus: 'PENDING' | 'READY') {
    // Optimistic update so a tap feels instant instead of waiting a poll cycle.
    setOrders((current) =>
      current.map((order) => ({
        ...order,
        lines: order.lines.map((line) =>
          line.id === lineId ? { ...line, kitchenStatus } : line
        )
      }))
    );
    try {
      const res = await fetch(`/api/admin/orders/lines/${lineId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitchenStatus })
      });
      if (!res.ok) {
        setError('Failed to update item. Refreshing…');
        await loadData();
        return;
      }
    } catch {
      setError('Failed to update item. Refreshing…');
      await loadData();
    }
  }

  async function bumpOrder(order: Order) {
    const pending = order.lines.filter((line) => line.kitchenStatus === 'PENDING');
    await Promise.all(pending.map((line) => setLineStatus(line.id, 'READY')));
  }

  function tableName(tableId: string | null) {
    if (!tableId) return 'Walk-in';
    return tables.find((table) => table.id === tableId)?.name ?? 'Table';
  }

  const activeTickets = orders.filter((order) =>
    order.lines.some((line) => line.kitchenStatus === 'PENDING')
  );

  return (
    <section className="space-y-4">
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="rounded border border-dashed p-3 text-sm text-muted-foreground">
          Loading…
        </p>
      ) : null}
      {!isLoading && activeTickets.length === 0 ? (
        <p className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
          No active tickets. New items from the till appear here within a
          few seconds.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {activeTickets.map((order) => (
          <div key={order.id} className="flex flex-col border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
              <h4 className="font-semibold">{tableName(order.tableId)}</h4>
              <span className="font-mono text-[11px] text-muted-foreground">
                {minutesAgo(order.createdAt)}
              </span>
            </div>

            <ul className="mt-2 flex-1 space-y-1.5 text-sm">
              {order.lines.map((line) => {
                const isReady = line.kitchenStatus === 'READY';
                return (
                  <li key={line.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setLineStatus(line.id, isReady ? 'PENDING' : 'READY')
                      }
                      className={`w-full rounded border px-2 py-1.5 text-left transition-colors ${
                        isReady
                          ? 'border-border text-muted-foreground line-through'
                          : 'border-foreground font-medium'
                      }`}
                    >
                      {line.quantity}× {line.nameSnapshot}
                      {line.notes ? (
                        <span className="mt-0.5 block text-xs font-normal not-italic text-muted-foreground">
                          {line.notes}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              onClick={() => bumpOrder(order)}
              className="mt-2 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            >
              Bump all
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
