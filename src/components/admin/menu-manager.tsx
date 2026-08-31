'use client';

import { useCallback, useEffect, useState } from 'react';

type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceMinor: number;
  sortOrder: number;
  isActive: boolean;
  trackInventory: boolean;
  stockQty: number;
  lowStockThreshold: number;
};

type MenuCategory = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  items: MenuItem[];
};

const EMPTY_CATEGORY_FORM = { name: '', sortOrder: 0, isActive: true };
const EMPTY_ITEM_FORM = {
  categoryId: '',
  name: '',
  description: '',
  price: '',
  sortOrder: 0,
  isActive: true,
  trackInventory: false,
  stockQty: '0',
  lowStockThreshold: '0'
};

function formatPrice(priceMinor: number) {
  return `$${(priceMinor / 100).toFixed(2)}`;
}

function parsePriceToMinor(price: string): number | null {
  const value = Number(price);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function MenuManager({ venueId }: { venueId: string }) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{
    text: string;
    kind: 'ok' | 'err';
  } | null>(null);

  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY_FORM);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null
  );
  const [categoryFormError, setCategoryFormError] = useState<string | null>(
    null
  );

  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemFormError, setItemFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/menu?venueId=${venueId}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ text: body.error ?? 'Failed to load menu.', kind: 'err' });
        return;
      }
      setCategories(body.categories ?? []);
    } catch {
      setMessage({ text: 'Failed to load menu. Please refresh.', kind: 'err' });
    } finally {
      setIsLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function saveCategory() {
    setCategoryFormError(null);
    setMessage(null);
    if (!categoryForm.name.trim()) {
      setCategoryFormError('Category name is required.');
      return;
    }
    try {
      const method = editingCategoryId ? 'PUT' : 'POST';
      const url = editingCategoryId
        ? `/api/admin/menu/categories/${editingCategoryId}`
        : '/api/admin/menu';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingCategoryId ? categoryForm : { ...categoryForm, venueId }
        )
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          text: body.error ?? 'Failed to save category.',
          kind: 'err'
        });
        return;
      }
      setCategoryForm(EMPTY_CATEGORY_FORM);
      setEditingCategoryId(null);
      setMessage({
        text: editingCategoryId ? 'Category updated.' : 'Category created.',
        kind: 'ok'
      });
      await loadData();
    } catch {
      setMessage({ text: 'Failed to save category.', kind: 'err' });
    }
  }

  async function removeCategory(categoryId: string) {
    if (
      !window.confirm(
        'Delete this category? All items in it will also be deleted.'
      )
    )
      return;
    try {
      const res = await fetch(`/api/admin/menu/categories/${categoryId}`, {
        method: 'DELETE'
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          text: body.error ?? 'Failed to delete category.',
          kind: 'err'
        });
        return;
      }
      setMessage({ text: 'Category deleted.', kind: 'ok' });
      await loadData();
    } catch {
      setMessage({ text: 'Failed to delete category.', kind: 'err' });
    }
  }

  async function saveItem() {
    setItemFormError(null);
    setMessage(null);
    if (!itemForm.categoryId) {
      setItemFormError('Choose a category.');
      return;
    }
    if (!itemForm.name.trim()) {
      setItemFormError('Item name is required.');
      return;
    }
    const priceMinor = parsePriceToMinor(itemForm.price);
    if (priceMinor === null) {
      setItemFormError('Enter a valid price.');
      return;
    }

    try {
      const method = editingItemId ? 'PUT' : 'POST';
      const url = editingItemId
        ? `/api/admin/menu/items/${editingItemId}`
        : '/api/admin/menu/items';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingItemId
            ? {}
            : { venueId, stockQty: Number(itemForm.stockQty) || 0 }),
          categoryId: itemForm.categoryId,
          name: itemForm.name,
          description: itemForm.description || null,
          priceMinor,
          sortOrder: itemForm.sortOrder,
          isActive: itemForm.isActive,
          trackInventory: itemForm.trackInventory,
          lowStockThreshold: Number(itemForm.lowStockThreshold) || 0
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ text: body.error ?? 'Failed to save item.', kind: 'err' });
        return;
      }
      setItemForm(EMPTY_ITEM_FORM);
      setEditingItemId(null);
      setMessage({
        text: editingItemId ? 'Item updated.' : 'Item created.',
        kind: 'ok'
      });
      await loadData();
    } catch {
      setMessage({ text: 'Failed to save item.', kind: 'err' });
    }
  }

  async function adjustStock(item: MenuItem) {
    const raw = window.prompt(
      `Adjust stock for "${item.name}" (current: ${item.stockQty}). Enter a signed number, e.g. 24 to restock or -2 for waste:`,
      ''
    );
    if (raw === null || raw.trim() === '') return;
    const quantityDelta = Number(raw);
    if (!Number.isInteger(quantityDelta) || quantityDelta === 0) {
      setMessage({ text: 'Enter a non-zero whole number.', kind: 'err' });
      return;
    }
    try {
      const res = await fetch(`/api/admin/menu/items/${item.id}/adjust-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantityDelta })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          text: body.error ?? 'Failed to adjust stock.',
          kind: 'err'
        });
        return;
      }
      setMessage({ text: 'Stock updated.', kind: 'ok' });
      await loadData();
    } catch {
      setMessage({ text: 'Failed to adjust stock.', kind: 'err' });
    }
  }

  async function removeItem(itemId: string) {
    if (!window.confirm('Delete this item?')) return;
    try {
      const res = await fetch(`/api/admin/menu/items/${itemId}`, {
        method: 'DELETE'
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          text: body.error ?? 'Failed to delete item.',
          kind: 'err'
        });
        return;
      }
      setMessage({ text: 'Item deleted.', kind: 'ok' });
      await loadData();
    } catch {
      setMessage({ text: 'Failed to delete item.', kind: 'err' });
    }
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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 rounded border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {editingCategoryId ? 'Edit category' : 'Add category'}
            </p>
            {editingCategoryId ? (
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={() => {
                  setEditingCategoryId(null);
                  setCategoryForm(EMPTY_CATEGORY_FORM);
                  setCategoryFormError(null);
                }}
              >
                Cancel edit
              </button>
            ) : null}
          </div>
          {categoryFormError ? (
            <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {categoryFormError}
            </p>
          ) : null}
          <input
            className="w-full rounded border p-2 text-sm"
            placeholder="Category name (e.g. Mains, Drinks)"
            value={categoryForm.name}
            onChange={(e) =>
              setCategoryForm({ ...categoryForm, name: e.target.value })
            }
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={categoryForm.isActive}
              onChange={(e) =>
                setCategoryForm({ ...categoryForm, isActive: e.target.checked })
              }
            />
            Active
          </label>
          <button
            type="button"
            onClick={saveCategory}
            className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
          >
            {editingCategoryId ? 'Update category' : 'Create category'}
          </button>
        </div>

        <div className="space-y-2 rounded border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {editingItemId ? 'Edit item' : 'Add item'}
            </p>
            {editingItemId ? (
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={() => {
                  setEditingItemId(null);
                  setItemForm(EMPTY_ITEM_FORM);
                  setItemFormError(null);
                }}
              >
                Cancel edit
              </button>
            ) : null}
          </div>
          {itemFormError ? (
            <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {itemFormError}
            </p>
          ) : null}
          <select
            className="w-full rounded border p-2 text-sm"
            value={itemForm.categoryId}
            onChange={(e) =>
              setItemForm({ ...itemForm, categoryId: e.target.value })
            }
          >
            <option value="">Select category…</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input
            className="w-full rounded border p-2 text-sm"
            placeholder="Item name (e.g. Cheeseburger)"
            value={itemForm.name}
            onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
          />
          <textarea
            className="w-full rounded border p-2 text-sm"
            rows={2}
            placeholder="Description (optional)"
            value={itemForm.description}
            onChange={(e) =>
              setItemForm({ ...itemForm, description: e.target.value })
            }
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={0}
              step="0.01"
              className="rounded border p-2 text-sm"
              placeholder="Price (e.g. 12.50)"
              value={itemForm.price}
              onChange={(e) =>
                setItemForm({ ...itemForm, price: e.target.value })
              }
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={itemForm.isActive}
                onChange={(e) =>
                  setItemForm({ ...itemForm, isActive: e.target.checked })
                }
              />
              Active
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={itemForm.trackInventory}
              onChange={(e) =>
                setItemForm({ ...itemForm, trackInventory: e.target.checked })
              }
            />
            Track inventory
          </label>
          {itemForm.trackInventory ? (
            <div className="grid grid-cols-2 gap-2">
              {editingItemId ? null : (
                <input
                  type="number"
                  min={0}
                  className="rounded border p-2 text-sm"
                  placeholder="Starting stock"
                  value={itemForm.stockQty}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, stockQty: e.target.value })
                  }
                />
              )}
              <input
                type="number"
                min={0}
                className="rounded border p-2 text-sm"
                placeholder="Low-stock threshold"
                value={itemForm.lowStockThreshold}
                onChange={(e) =>
                  setItemForm({
                    ...itemForm,
                    lowStockThreshold: e.target.value
                  })
                }
              />
            </div>
          ) : null}
          <button
            type="button"
            onClick={saveItem}
            className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
          >
            {editingItemId ? 'Update item' : 'Create item'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <p className="rounded border border-dashed p-3 text-sm text-muted-foreground">
            Loading…
          </p>
        ) : null}
        {!isLoading && categories.length === 0 ? (
          <p className="rounded border border-dashed p-3 text-sm text-muted-foreground">
            No menu categories yet. Add one above to start building the menu.
          </p>
        ) : null}
        {categories.map((category) => (
          <div key={category.id} className="border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-medium">
                {category.name}{' '}
                <span className="text-xs text-muted-foreground">
                  ({category.items.length} items)
                </span>
                {!category.isActive ? (
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                    Inactive
                  </span>
                ) : null}
              </h4>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => {
                    setCategoryForm({
                      name: category.name,
                      sortOrder: category.sortOrder,
                      isActive: category.isActive
                    });
                    setEditingCategoryId(category.id);
                    setCategoryFormError(null);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs text-red-700"
                  onClick={() => removeCategory(category.id)}
                >
                  Delete
                </button>
              </div>
            </div>
            <ul className="mt-2 grid gap-2 text-sm md:grid-cols-2">
              {category.items.map((item) => (
                <li key={item.id} className="rounded border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">
                      {item.name}
                      {!item.isActive ? (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                          Inactive
                        </span>
                      ) : null}
                    </p>
                    <p className="font-mono text-xs">
                      {formatPrice(item.priceMinor)}
                    </p>
                  </div>
                  {item.description ? (
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  ) : null}
                  {item.trackInventory ? (
                    <p
                      className={`mt-1 text-xs ${
                        item.stockQty <= item.lowStockThreshold
                          ? 'font-semibold text-red-700'
                          : 'text-muted-foreground'
                      }`}
                    >
                      Stock: {item.stockQty}
                      {item.stockQty <= item.lowStockThreshold
                        ? ' — low stock'
                        : ''}
                    </p>
                  ) : null}
                  <div className="mt-1 flex gap-2">
                    {item.trackInventory ? (
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() => adjustStock(item)}
                      >
                        Adjust stock
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded border px-2 py-1 text-xs"
                      onClick={() => {
                        setItemForm({
                          categoryId: item.categoryId,
                          name: item.name,
                          description: item.description ?? '',
                          price: (item.priceMinor / 100).toFixed(2),
                          sortOrder: item.sortOrder,
                          isActive: item.isActive,
                          trackInventory: item.trackInventory,
                          stockQty: String(item.stockQty),
                          lowStockThreshold: String(item.lowStockThreshold)
                        });
                        setEditingItemId(item.id);
                        setItemFormError(null);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded border px-2 py-1 text-xs text-red-700"
                      onClick={() => removeItem(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
