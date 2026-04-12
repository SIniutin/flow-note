/**
 * Обработчик tbl_op — операция над ячейкой таблицы MWS.
 *
 * Протокол (C→S):
 *   { type: "tbl_op", dst_id, op_id, record_id, field_id, value }
 *
 * Поведение:
 *   1. Broadcast сразу всем клиентам документа (optimistic, LWW).
 *   2. Async PATCH /datasheets/{dstId}/records в MWS.
 *   3. При ошибке — rollback кеша к previous value + broadcast tbl_rollback.
 */

import { CellValue } from "../mws/mwsClient";
import { patchRecord } from "../mws/mwsClient";
import { getCellValue, updateCell, rollbackCell } from "../mws/tableRegistry";

export interface TblOpMessage {
  type: "tbl_op";
  dst_id: string;
  op_id: string;
  record_id: string;
  field_id: string;
  value: CellValue;
}

export interface TblRollbackMessage {
  type: "tbl_rollback";
  op_id: string;
  reason: string;
}

/**
 * @param msg       - распарсенное tbl_op от клиента
 * @param token     - Bearer-токен пользователя (из WS-соединения)
 * @param broadcast - рассылает JSON всем клиентам документа
 */
export function handleTblOp(
  msg: TblOpMessage,
  token: string,
  broadcast: (payload: unknown) => void
): void {
  const { dst_id, op_id, record_id, field_id, value } = msg;

  // Сохраняем previous value ДО обновления для точного rollback
  const previousValue = getCellValue(dst_id, record_id, field_id);

  // 1. Broadcast клиентам немедленно (optimistic)
  broadcast({ type: "tbl_op", dst_id, op_id, record_id, field_id, value });

  // Optimistic update в кеше
  updateCell(dst_id, record_id, field_id, value);

  // 2. Async PATCH в MWS
  patchRecord(dst_id, record_id, field_id, value, token).catch((err) => {
    console.error(`[tbl_op] PATCH failed op_id=${op_id}:`, err);

    // 3. Rollback кеша к previous value
    rollbackCell(dst_id, record_id, field_id, previousValue);

    const rollback: TblRollbackMessage = {
      type: "tbl_rollback",
      op_id,
      reason: err instanceof Error ? err.message : String(err),
    };
    broadcast(rollback);
  });
}
