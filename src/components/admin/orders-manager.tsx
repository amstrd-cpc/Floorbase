'use client';

import { useCallback, useEffect, useState } from 'react';

type OrderLine = {
  id: string;
  menuItemId: string | null;
  nameSnapshot: string;
  priceMinorSnapshot: number;
  quantity: number;
  notes: string | null;
};

type Order = {
  id: string;
  tableId: string | null;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  notes: string | null;
  createdAt: string;
  lines: OrderLine[];
};

type TableOption = { id: string; name: string };
type MenuItemOption = {
  id: string;
  name: string;
  priceMinor: number;
  isActive: boolean;
};
type MenuCategoryOption = { id: string; name: string; items: MenuItemOption[] };

function formatPrice(priceMinor: number) {
  return `$${(priceMinor / 100).toFixed(2)}`;
}

function orderTotalMinor(order: Order) {
  return order.lines.reduce(
    (sum, line) => sum + line.priceMinorSnapshot * line.quantity,
    0
  );
}

export function OrdersManager({ venueId }: { venueId: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<TableOption[]>([]);
  const [categories, setCategories] = useState<MenuCategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{
    text: string;
    kind: 'ok' | 'err';
  } | null>(null);
  const [newOrderTableId, setNewOrderTableId] = useState('');
  const [addItemSelection, setAddItemSelection] = useState<
    Record<string, string>
  >({});

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [ordersRes, tablesRes, menuRes] = await Promise.all([
        fetch(`/api/admin/orders?venueId=${venueId}&status=OPEN`),
        fetch(`/api/admin/tables?venueId=${venueId}`),
        fetch(`/api/admin/menu?venueId=${venueId}`)
      ]);
      const ordersBody = await ordersRes.json().catch(() => ({}));
      const tablesBody = await tablesRes.json().catch(() => ({}));
      const menuBody = await menuRes.json().catch(() => ({}));
      if (!ordersRes.ok || !tablesRes.ok || !menuRes.ok) {
        setMessage({ text: 'Failed to load orders data.', kind: 'err' });
        return;
      }
      setOrders(ordersBody.orders ?? []);
      setTables(tablesBody.tables ?? []);
      setCategories(menuBody.categories ?? []);
    } catch {
      setMessage({
        text: 'Failed to load orders data. Please refresh.',
        kind: 'err'
      });
    } finally {
      setIsLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function createOrder() {
    setMessage(null);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId, tableId: newOrderTableId || undefined })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          text: body.error ?? 'Failed to create order.',
          kind: 'err'
        });
        return;
      }
      setNewOrderTableId('');
      setMessage({ text: 'Order created.', kind: 'ok' });
      await loadData();
    } catch {
      setMessage({ text: 'Failed to create order.', kind: 'err' });
    }
  }

  async function addLine(orderId: string) {
    const menuItemId = addItemSelection[orderId];
    if (!menuItemId) return;
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuItemId, quantity: 1 })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ text: body.error ?? 'Failed to add item.', kind: 'err' });
        return;
      }
      await loadData();
    } catch {
      setMessage({ text: 'Failed to add item.', kind: 'err' });
    }
  }

  async function setLineQuantity(lineId: string, quantity: number) {
    if (quantity < 1) return;
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/orders/lines/${lineId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          text: body.error ?? 'Failed to update item.',
          kind: 'err'
        });
        return;
      }
      await loadData();
    } catch {
      setMessage({ text: 'Failed to update item.', kind: 'err' });
    }
  }

  async function removeLine(lineId: string) {
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/orders/lines/${lineId}`, {
        method: 'DELETE'
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          text: body.error ?? 'Failed to remove item.',
          kind: 'err'
        });
        return;
      }
      await loadData();
    } catch {
      setMessage({ text: 'Failed to remove item.', kind: 'err' });
    }
  }

  async function closeOrder(orderId: string) {
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/close`, {
        method: 'POST'
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          text: body.error ?? 'Failed to close order.',
          kind: 'err'
        });
        return;
      }
      setMessage({ text: 'Order closed.', kind: 'ok' });
      await loadData();
    } catch {
      setMessage({ text: 'Failed to close order.', kind: 'err' });
    }
  }

  async function cancelOrder(orderId: string) {
    if (!window.confirm('Cancel this order? This cannot be undone.')) return;
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/cancel`, {
        method: 'POST'
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          text: body.error ?? 'Failed to cancel order.',
          kind: 'err'
        });
        return;
      }
      setMessage({ text: 'Order cancelled.', kind: 'ok' });
      await loadData();
    } catch {
      setMessage({ text: 'Failed to cancel order.', kind: 'err' });
    }
  }

  function tableName(tableId: string | null) {
    if (!tableId) return 'Walk-in';
    return (
      tables.find((table) => table.id === tableId)?.name ?? 'Unknown table'
    );
  }

  return (
    <section className="space-y-4 border border-border bg-card p-4">
      {message ? (
        <p
          className={`border p-2 text-sm ${
            message.kind === 'err'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-border bg-secondary'
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded border p-3">
        <p className="text-sm font-semibold">New order</p>
        <select
          className="rounded border p-2 text-sm"
          value={newOrderTableId}
          onChange={(e) => setNewOrderTableId(e.target.value)}
        >
          <option value="">Walk-in (no table)</option>
          {tables.map((table) => (
            <option key={table.id} value={table.id}>
              {table.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={createOrder}
          className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
        >
          Start order
        </button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <p className="rounded border border-dashed p-3 text-sm text-muted-foreground">
            Loading…
          </p>
        ) : null}
        {!isLoading && orders.length === 0 ? (
          <p className="rounded border border-dashed p-3 text-sm text-muted-foreground">
            No open orders. Start one above.
          </p>
        ) : null}
        {orders.map((order) => (
          <div key={order.id} className="border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-medium">{tableName(order.tableId)}</h4>
              <p className="font-mono text-sm">
                {formatPrice(orderTotalMinor(order))}
              </p>
            </div>

            <ul className="mt-2 space-y-1 text-sm">
              {order.lines.map((line) => (
                <li
                  key={line.id}
                  className="flex items-center justify-between gap-2 rounded border px-2 py-1"
                >
                  <span>{line.nameSnapshot}</span>
                  <span className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      className="w-14 rounded border p-1 text-xs"
                      value={line.quantity}
                      onChange={(e) =>
                        setLineQuantity(line.id, Number(e.target.value))
                      }
                    />
                    <span className="font-mono text-xs">
                      {formatPrice(line.priceMinorSnapshot * line.quantity)}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-red-700"
                      onClick={() => removeLine(line.id)}
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
              {order.lines.length === 0 ? (
                <li className="text-xs text-muted-foreground">No items yet.</li>
              ) : null}
            </ul>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                className="rounded border p-2 text-xs"
                value={addItemSelection[order.id] ?? ''}
                onChange={(e) =>
                  setAddItemSelection((current) => ({
                    ...current,
                    [order.id]: e.target.value
                  }))
                }
              >
                <option value="">Add item…</option>
                {categories.map((category) => (
                  <optgroup key={category.id} label={category.name}>
                    {category.items
                      .filter((item) => item.isActive)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} — {formatPrice(item.priceMinor)}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={() => addLine(order.id)}
              >
                Add
              </button>
              <button
                type="button"
                className="rounded bg-slate-900 px-2 py-1 text-xs text-white"
                onClick={() => closeOrder(order.id)}
              >
                Close order
              </button>
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs text-red-700"
                onClick={() => cancelOrder(order.id)}
              >
                Cancel order
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
