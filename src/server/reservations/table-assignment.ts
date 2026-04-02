export type AssignableTable = {
  id: string;
  label: string;
  capacityMin: number | null;
  capacityMax: number;
  isActive: boolean;
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
