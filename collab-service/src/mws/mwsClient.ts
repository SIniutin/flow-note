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

interface MwsViewsResponse {
  data: {
    views: Array<{
      id: string;
      name: string;
      type: string;
    }>;
  };
}

export interface TableViewInfo {
  id: string;
  name: string;
  type: string;
}

function mwsAuthToken(): string {
  return config.mwsTableApiKey;
}

/**
 * Загружает ВСЕ записи датасета из MWS с пагинацией.
 * Каждый запрос имеет таймаут MWS_TIMEOUT_MS (AbortSignal.timeout).
 * При недоступности MWS бросает MwsUnavailableError — клиент получает tbl_unavailable.
 */
export async function getRecords(
  dstId: string,
  token: string,
  viewId?: string
): Promise<CellsMap> {
  const map: CellsMap = new Map();
  let pageNum = 1;

  while (true) {
    const params = new URLSearchParams({
      pageNum: String(pageNum),
      pageSize: String(config.mwsPageSize),
      fieldKey: "id",
    });
    if (viewId) {
      params.set("viewId", viewId);
    }
    const url = `${config.mwsApiBase}/datasheets/${dstId}/records?${params.toString()}`;

    let res: Response;
    try {
      res = await fetch(url, {
        signal:  AbortSignal.timeout(config.mwsTimeoutMs),
        headers: { Authorization: `Bearer ${mwsAuthToken()}` },
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

export async function getViews(dstId: string, token: string): Promise<TableViewInfo[]> {
  let res: Response;
  try {
    res = await fetch(`${config.mwsApiBase}/datasheets/${dstId}/views`, {
      signal: AbortSignal.timeout(config.mwsTimeoutMs),
      headers: { Authorization: `Bearer ${mwsAuthToken()}` },
    });
  } catch (err) {
    throw new MwsUnavailableError(dstId, err);
  }

  if (!res.ok) {
    throw new Error(`MWS GET views ${dstId} → HTTP ${res.status}`);
  }

  const body = (await res.json()) as MwsViewsResponse;
  return body.data.views.map((view) => ({
    id: view.id,
    name: view.name,
    type: view.type,
  }));
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
        Authorization:  `Bearer ${mwsAuthToken()}`,
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
