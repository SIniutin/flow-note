// ─── src/editor/mwsTable/mwsTableCommand.ts ──────────────────────────────────
// Slash-команда, совместимая с интерфейсом SlashCommand из commands.ts.
// Поле `run(editor, range)` — в точности как у остальных команд проекта.

import type { SlashCommand } from "../slash/commands";
import { tablePickerStore } from "./tablePickerStore";

export const mwsTableCommand: SlashCommand = {
    title: "Таблица MWS",
    description: "Встроить MWS Table в документ",
    icon: "📋",
    keywords: ["table", "таблица", "mws", "grid", "db", "database", "данные"],

    run(editor, range) {
        // Открываем модальный пикер; после выбора он сам вставит узел.
        tablePickerStore.open(editor, range);
    },
};
