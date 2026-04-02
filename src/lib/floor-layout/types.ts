import type { TableShape } from '@prisma/client';

export type FloorLayoutAreaDto = {
  id: string;
  areaId: string | null;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export type FloorLayoutTableDto = {
  id: string;
  tableId: string;
  floorLayoutAreaId: string | null;
  label: string;
  capacityMin: number | null;
  capacityMax: number;
  shape: TableShape;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  isActive: boolean;
  combinableMeta: unknown;
};

export type FloorLayoutDto = {
  id: string;
  venueId: string;
  status: 'DRAFT' | 'PUBLISHED';
  version: number;
  name: string | null;
  canvasWidth: number;
  canvasHeight: number;
  gridSize: number;
  updatedAt: string;
  areas: FloorLayoutAreaDto[];
  tables: FloorLayoutTableDto[];
};
