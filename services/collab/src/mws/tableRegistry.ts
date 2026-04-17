/**
 * In-memory кеш таблиц MWS.
 * При idle-таймауте данные выгружаются; при следующем join — перечитываются из MWS.
 */

import { CellsMap, CellValue, getRecords } from "./mwsClient";
import { config } from "../config";

interface TableEntry {
  dstId: string;
  viewId: string;
  cells: CellsMap;
  idleTimer: ReturnType<typeof setTimeout>;
}

// dst_id:view_id → TableEntry
const tables = new Map<string, TableEntry>();

function makeKey(dstId: string, viewId?: string): string {
  return `${dstId}::${viewId ?? ""}`;
}

function scheduleEviction(key: string): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    tables.delete(key);
    console.log(`[tableRegistry] evicted ${key}`);
  }, config.tableIdleMs);
}

/** Проверяет, загружена ли таблица в кеш (не делает HTTP-запроса). */
export function hasTable(dstId: string, viewId?: string): boolean {
  return tables.has(makeKey(dstId, viewId));
}

/**
 * Шаг 6 / Шаг 9: возвращает кеш для dst_id.
 * Если кеша нет — загружает из MWS с токеном пользователя.
 * Сбрасывает idle-таймер при каждом обращении.
 */
export async function loadTable(
  dstId: string,
  token: string,
  viewId?: string
): Promise<CellsMap> {
  const key = makeKey(dstId, viewId);
  const existing = tables.get(key);
  if (existing) {
    clearTimeout(existing.idleTimer);
    existing.idleTimer = scheduleEviction(key);
    return existing.cells;
  }

  const cells = await getRecords(dstId, token, viewId);
  tables.set(key, {
    dstId,
    viewId: viewId ?? "",
    cells,
    idleTimer: scheduleEviction(key),
  });
  console.log(`[tableRegistry] loaded ${dstId}${viewId ? ` view=${viewId}` : ""}, ${cells.size} records`);
  return cells;
}

/**
 * Обновляет ячейку в кеше и сбрасывает idle.
 * Вызывается после broadcast (до подтверждения MWS) — optimistic update.
 */
export function updateCell(
  dstId: string,
  recordId: string,
  fieldId: string,
  value: CellValue
): void {
  for (const [key, entry] of tables.entries()) {
    if (entry.dstId !== dstId) continue;
    const row = entry.cells.get(recordId);
    if (!row) continue;
    row[fieldId] = value;
    entry.cells.set(recordId, row);
    clearTimeout(entry.idleTimer);
    entry.idleTimer = scheduleEviction(key);
  }
}

/**
 * Возвращает текущее значение ячейки из кеша (или undefined если нет).
 */
export function getCellValue(
  dstId: string,
  recordId: string,
  fieldId: string
): CellValue | undefined {
  for (const entry of tables.values()) {
    if (entry.dstId !== dstId) continue;
    const value = entry.cells.get(recordId)?.[fieldId];
    if (value !== undefined) return value;
  }
  return undefined;
}

/**
 * Откатывает ячейку в кеше к предыдущему значению.
 * Вызывается при ошибке PATCH в MWS.
 */
export function rollbackCell(
  dstId: string,
  recordId: string,
  fieldId: string,
  previousValue: CellValue
): void {
  for (const entry of tables.values()) {
    if (entry.dstId !== dstId) continue;
    const row = entry.cells.get(recordId);
    if (!row) continue;
    row[fieldId] = previousValue;
    entry.cells.set(recordId, row);
  }
}
