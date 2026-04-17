// ─── src/editor/persistence/useSaveStatus.ts ─────────────────────────────────
// Хук управляет статусом автосохранения документа.
// Заменяет голый saveTimer из App.tsx — добавляет состояние и обратную связь.
//
// Состояния:
//   idle    — нет несохранённых изменений
//   saving  — debounce запущен, ждём паузы в наборе
//   saved   — только что сохранили, показываем «Сохранено» 2с
//   error   — сохранение упало (quota exceeded и т.п.)

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { saveDoc } from "./storage";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS  = 500;   // ждём паузу в печати
const SAVED_TTL_MS = 2500;  // «Сохранено» показываем 2.5с, потом idle

export function useSaveStatus(editor: Editor | null, pageId?: string): SaveStatus {
    const [status, setStatus] = useState<SaveStatus>("idle");

    const debounceRef  = useRef<number | null>(null);
    const savedTtlRef  = useRef<number | null>(null);

    const clearTimers = useCallback(() => {
        if (debounceRef.current)  window.clearTimeout(debounceRef.current);
        if (savedTtlRef.current)  window.clearTimeout(savedTtlRef.current);
    }, []);

    useEffect(() => {
        if (!editor) return;

        const onUpdate = () => {
            // Любое изменение: показываем «сохраняю» и сбрасываем таймер
            clearTimers();
            setStatus("saving");

            debounceRef.current = window.setTimeout(() => {
                try {
                    saveDoc(editor.getHTML(), pageId);
                    setStatus("saved");
                    savedTtlRef.current = window.setTimeout(
                        () => setStatus("idle"),
                        SAVED_TTL_MS,
                    );
                } catch (e) {
                    console.warn("useSaveStatus: save failed", e);
                    setStatus("error");
                }
            }, DEBOUNCE_MS);
        };

        editor.on("update", onUpdate);
        return () => {
            editor.off("update", onUpdate);
            clearTimers();
        };
    }, [editor, pageId, clearTimers]);

    return status;
}
