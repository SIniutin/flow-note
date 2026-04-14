/**
 * Парсит бинарный Y.Doc snapshot и извлекает метаданные страницы.
 *
 * Ожидаемая структура TipTap/hocuspocus:
 *   doc.get("content", Y.XmlFragment)
 *     → paragraph, heading(level), bulletList, orderedList, listItem,
 *       blockquote, codeBlock, mws_table(dst_id), ...
 */

import * as Y from "yjs";

export interface PageMetadata {
  title:       string;         // первый heading или первый paragraph (plain text)
  contentText: string;         // весь plain text (для полнотекстового поиска)
  wordCount:   number;
  tables:      PageTableRef[];
}

export interface PageTableRef {
  dstId: string;
  blockId: string;
}

export function parseSnapshot(blob: Uint8Array): PageMetadata {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, blob);

  // title хранится как отдельный Y.Text (doc-contract.yaml: document_model.title)
  const titleFromDoc = doc.getText("title").toString().trim();

  const root = doc.get("content", Y.XmlFragment);
  const collector = new TextCollector();
  walkFragment(root, collector);

  doc.destroy();

  // Используем doc.title если он заполнен; иначе fallback на первый блок контента
  const resolvedTitle = titleFromDoc || collector.firstBlockText;
  const words = collector.fullText.trim().split(/\s+/).filter(Boolean);

  return {
    title:       resolvedTitle,
    contentText: collector.fullText.trim(),
    wordCount:   words.length,
    tables:      [...collector.tables.values()],
  };
}

// ── Internal ──────────────────────────────────────────────────────────────────

class TextCollector {
  firstBlockText = "";   // fallback title — первый непустой блок контента
  fullText       = "";
  tables         = new Map<string, PageTableRef>();

  private firstBlockSet = false;

  addText(text: string): void {
    this.fullText += text + " ";
    if (!this.firstBlockSet && text.trim().length > 0) {
      this.firstBlockText = text.trim();
      this.firstBlockSet  = true;
    }
  }

  addTable(dstId: string, blockId: string): void {
    this.tables.set(`${dstId}::${blockId}`, { dstId, blockId });
  }
}

function walkFragment(node: Y.XmlFragment | Y.XmlElement, col: TextCollector): void {
  const children = (node as Y.XmlFragment).toArray();

  for (const child of children) {
    if (child instanceof Y.XmlText) {
      col.addText(child.toString());
      continue;
    }

    if (!(child instanceof Y.XmlElement)) continue;

    const name = child.nodeName;

    if (name === "mws_table") {
      const dstId = child.getAttribute("dst_id");
      const blockId = child.getAttribute("block_id");
      if (
        typeof dstId === "string" && dstId.length > 0 &&
        typeof blockId === "string" && blockId.length > 0
      ) {
        col.addTable(dstId, blockId);
      }
      continue; // внутри mws_table текста нет
    }

    if (name === "heading" || name === "paragraph") {
      const blockText = extractTextFromElement(child);
      if (blockText.trim()) col.addText(blockText);
      continue;
    }

    // Для вложенных структур (bulletList, listItem, blockquote, etc.) — рекурсия
    walkFragment(child, col);
  }
}

function extractTextFromElement(el: Y.XmlElement): string {
  let text = "";
  for (const child of el.toArray()) {
    if (child instanceof Y.XmlText) {
      text += child.toString();
    } else if (child instanceof Y.XmlElement) {
      const n = child.nodeName;
      if (n === "hardBreak") {
        text += " ";
      } else if (n === "mention") {
        // mention хранит текст в атрибуте label (doc-contract.yaml)
        const label = child.getAttribute("label");
        if (typeof label === "string") text += "@" + label;
      } else if (n === "page_link") {
        // page_link хранит текст в атрибуте label
        const label = child.getAttribute("label");
        if (typeof label === "string") text += label;
      } else {
        text += extractTextFromElement(child);
      }
    }
  }
  return text;
}
