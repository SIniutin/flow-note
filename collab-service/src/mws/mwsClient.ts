/**
 * HTTP-клиент к MWS Tables API.
 * MWS Tables — source of truth для ячеек; Collab держит только in-memory кеш.
 */

import { config } from "../config";

export type CellValue = unknown;

/** Одна запись: record_id → { field_id → value } */
export type RecordRow = Record<string, CellValue>;

/** Весь датасет: record_id → RecordRow */
export type CellsMap = Map<string, RecordRow>;

interface MwsRecordsResponse {
  data: {
    pageNum:  number;
    pageSize: number;
    total:    number;
    records: Array<{
      recordId: string;
      fields:   Record<string, CellValue>;
    }>;
  };
}

/**
 * Загружает ВСЕ записи датасета из MWS с пагинацией.
 * Каждый запрос имеет таймаут MWS_TIMEOUT_MS (AbortSignal.timeout).
 * При недоступности MWS бросает MwsUnavailableError — клиент получает tbl_unavailable.
 */
export async function getRecords(
  dstId: string,
  token: string
): Promise<CellsMap> {
  const map: CellsMap = new Map();
  let pageNum = 1;

  while (true) {
    const url = `${config.mwsApiBase}/datasheets/${dstId}/records?pageNum=${pageNum}&pageSize=${config.mwsPageSize}&fieldKey=id`;

    let res: Response;
    try {
      res = await fetch(url, {
        signal:  AbortSignal.timeout(config.mwsTimeoutMs),
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      throw new MwsUnavailableError(dstId, err);
    }

    if (!res.ok) {
      throw new Error(`MWS GET records ${dstId} → HTTP ${res.status}`);
    }

    const body = (await res.json()) as MwsRecordsResponse;
    for (const rec of body.data.records) {
      map.set(rec.recordId, { ...rec.fields });
    }

    const { total, pageSize } = body.data;
    if (pageNum * pageSize >= total) break;
    pageNum++;
  }

  return map;
}

/**
 * Обновляет одну ячейку в MWS.
 */
export async function patchRecord(
  dstId: string,
  recordId: string,
  fieldId: string,
  value: CellValue,
  token: string
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${config.mwsApiBase}/datasheets/${dstId}/records`, {
      method:  "PATCH",
      signal:  AbortSignal.timeout(config.mwsTimeoutMs),
      headers: {
        Authorization:  `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        records:  [{ recordId, fields: { [fieldId]: value } }],
        fieldKey: "id",
      }),
    });
  } catch (err) {
    throw new MwsUnavailableError(dstId, err);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MWS PATCH record ${dstId}/${recordId} → HTTP ${res.status}: ${text}`);
  }
}

/** Бросается когда MWS недоступен (таймаут / сеть). */
export class MwsUnavailableError extends Error {
  constructor(dstId: string, cause: unknown) {
    super(`MWS unavailable for ${dstId}: ${(cause as Error)?.message ?? cause}`);
    this.name = "MwsUnavailableError";
  }
}
