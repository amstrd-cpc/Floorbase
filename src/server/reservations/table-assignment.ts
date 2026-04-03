export type AssignableTable = {
  id: string;
  label: string;
  capacityMin: number | null;
  capacityMax: number;
  isActive: boolean;
  canCombine?: boolean;
  combineGroup?: string | null;
};

export function rankTablesForParty(tables: AssignableTable[], partySize: number) {
  return tables
    .filter((table) => table.isActive)
    .filter((table) => partySize <= table.capacityMax)
    .filter((table) => !table.capacityMin || partySize >= table.capacityMin)
    .sort((a, b) => {
      if (a.capacityMax !== b.capacityMax) {
        return a.capacityMax - b.capacityMax;
      }

      return a.label.localeCompare(b.label);
    });
}

export function chooseBestTable(tables: AssignableTable[], partySize: number) {
  return rankTablesForParty(tables, partySize)[0] ?? null;
}

function compareTableSets(
  left: AssignableTable[],
  right: AssignableTable[],
  partySize: number
) {
  const leftCapacity = left.reduce((sum, table) => sum + table.capacityMax, 0);
  const rightCapacity = right.reduce((sum, table) => sum + table.capacityMax, 0);
  const leftOverflow = leftCapacity - partySize;
  const rightOverflow = rightCapacity - partySize;

  if (leftOverflow !== rightOverflow) {
    return leftOverflow - rightOverflow;
  }

  if (left.length !== right.length) {
    return left.length - right.length;
  }

  return left.map((table) => table.label).join('|').localeCompare(
    right.map((table) => table.label).join('|')
  );
}

export function chooseBestTableSet(tables: AssignableTable[], partySize: number) {
  const single = chooseBestTable(tables, partySize);
  if (single) {
    return [single];
  }

  const candidates = tables
    .filter((table) => table.isActive)
    .filter((table) => !table.capacityMin || partySize >= table.capacityMin)
    .filter((table) => (table.canCombine ?? false) && Boolean(table.combineGroup));

  const grouped = new Map<string, AssignableTable[]>();
  for (const table of candidates) {
    const key = table.combineGroup as string;
    grouped.set(key, [...(grouped.get(key) ?? []), table]);
  }

  let best: AssignableTable[] | null = null;

  for (const [, groupTables] of grouped) {
    const sorted = [...groupTables].sort((a, b) => {
      if (a.capacityMax !== b.capacityMax) return a.capacityMax - b.capacityMax;
      return a.label.localeCompare(b.label);
    });

    let runningCapacity = 0;
    const chosen: AssignableTable[] = [];
    for (const table of sorted) {
      chosen.push(table);
      runningCapacity += table.capacityMax;
      if (runningCapacity >= partySize) {
        break;
      }
    }

    if (runningCapacity < partySize) {
      continue;
    }

    if (!best || compareTableSets(chosen, best, partySize) < 0) {
      best = chosen;
    }
  }

  return best ?? [];
}
