/**
 * In-memory кеш таблиц MWS.
 * При idle-таймауте данные выгружаются; при следующем join — перечитываются из MWS.
 */

import { CellsMap, CellValue, getRecords } from "./mwsClient";
import { config } from "../config";

interface TableEntry {
  cells: CellsMap;
  idleTimer: ReturnType<typeof setTimeout>;
}

// dst_id → TableEntry
const tables = new Map<string, TableEntry>();

function scheduleEviction(dstId: string): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    tables.delete(dstId);
    console.log(`[tableRegistry] evicted ${dstId}`);
  }, config.tableIdleMs);
}

/** Проверяет, загружена ли таблица в кеш (не делает HTTP-запроса). */
export function hasTable(dstId: string): boolean {
  return tables.has(dstId);
}

/**
 * Шаг 6 / Шаг 9: возвращает кеш для dst_id.
 * Если кеша нет — загружает из MWS с токеном пользователя.
 * Сбрасывает idle-таймер при каждом обращении.
 */
export async function loadTable(
  dstId: string,
  token: string
): Promise<CellsMap> {
  const existing = tables.get(dstId);
  if (existing) {
    clearTimeout(existing.idleTimer);
    existing.idleTimer = scheduleEviction(dstId);
    return existing.cells;
  }

  const cells = await getRecords(dstId, token);
  tables.set(dstId, {
    cells,
    idleTimer: scheduleEviction(dstId),
  });
  console.log(`[tableRegistry] loaded ${dstId}, ${cells.size} records`);
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
  const entry = tables.get(dstId);
  if (!entry) return;

  const row = entry.cells.get(recordId) ?? {};
  row[fieldId] = value;
  entry.cells.set(recordId, row);

  clearTimeout(entry.idleTimer);
  entry.idleTimer = scheduleEviction(dstId);
}

/**
 * Возвращает текущее значение ячейки из кеша (или undefined если нет).
 */
export function getCellValue(
  dstId: string,
  recordId: string,
  fieldId: string
): CellValue | undefined {
  return tables.get(dstId)?.cells.get(recordId)?.[fieldId];
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
  const entry = tables.get(dstId);
  if (!entry) return;

  const row = entry.cells.get(recordId) ?? {};
  row[fieldId] = previousValue;
  entry.cells.set(recordId, row);
}
