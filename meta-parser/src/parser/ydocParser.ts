/**
 * Парсит бинарный Y.Doc snapshot и извлекает метаданные страницы.
 *
 * Ожидаемая структура TipTap/hocuspocus:
 *   doc.getMap("meta")           → title, description
 *   doc.get("default", Y.XmlFragment)
 *     → paragraph, heading(level), bulletList, orderedList, listItem,
 *       blockquote, codeBlock, mws_table(dst_id), ...
 */

import * as Y from "yjs";

export interface PageMetadata {
  title:       string;         // первый heading или первый paragraph (plain text)
  contentText: string;         // весь plain text (для полнотекстового поиска)
  wordCount:   number;
  links:       PageLinkRef[];
  mentions:    PageMentionRef[];
  tables:      PageTableRef[];
}

export interface PageLinkRef {
  toPageId: string;
  blockId: string;
}

export interface PageMentionRef {
  userId: string;
  blockId: string;
}

export interface PageTableRef {
  dstId: string;
  blockId: string;
}

export function parseSnapshot(blob: Uint8Array): PageMetadata {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, blob);

  // title хранится в Y.Map("meta"), ключ "title" — так же как на фронтенде (collabProvider.ts)
  const titleFromDoc = (doc.getMap("meta") as Y.Map<string>).get("title")?.trim() ?? "";

  // Контент хранится в XmlFragment("default") — имя по умолчанию TipTap/Hocuspocus
  const root = doc.get("default", Y.XmlFragment);
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
    links:       [...collector.links.values()],
    mentions:    [...collector.mentions.values()],
    tables:      [...collector.tables.values()],
  };
}

// ── Internal ──────────────────────────────────────────────────────────────────

class TextCollector {
  firstBlockText = "";   // fallback title — первый непустой блок контента
  fullText       = "";
  links          = new Map<string, PageLinkRef>();
  mentions       = new Map<string, PageMentionRef>();
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

  addLink(toPageId: string, blockId: string): void {
    this.links.set(`${toPageId}::${blockId}`, { toPageId, blockId });
  }

  addMention(userId: string, blockId: string): void {
    this.mentions.set(`${userId}::${blockId}`, { userId, blockId });
  }
}

function walkFragment(node: Y.XmlFragment | Y.XmlElement, col: TextCollector, currentBlockId = ""): void {
  const children = (node as Y.XmlFragment).toArray();

  for (const child of children) {
    if (child instanceof Y.XmlText) {
      col.addText(child.toString());
      continue;
    }

    if (!(child instanceof Y.XmlElement)) continue;

    const name = child.nodeName;
    const blockIdAttr = child.getAttribute("block_id");
    const blockId =
      typeof blockIdAttr === "string" && blockIdAttr.length > 0
        ? blockIdAttr
        : currentBlockId;

    if (name === "mws_table" || name === "mwsTable") {
      const dstId = child.getAttribute("dst_id");
      if (
        typeof dstId === "string" && dstId.length > 0 &&
        blockId.length > 0
      ) {
        col.addTable(dstId, blockId);
      }
      continue; // внутри mws_table текста нет
    }

    if (name === "mention") {
      const id = child.getAttribute("id");
      const kind = child.getAttribute("kind");
      const label = child.getAttribute("label");
      if (
        typeof id === "string" && id.length > 0 &&
        typeof kind === "string" && kind === "user" &&
        blockId.length > 0
      ) {
        col.addMention(id, blockId);
      }
      if (typeof label === "string" && label.length > 0) {
        col.addText("@" + label);
      }
      continue;
    }

    if (name === "page_link" || name === "pageLink") {
      const toPageId = child.getAttribute("page_id");
      const label = child.getAttribute("label");
      if (
        typeof toPageId === "string" && toPageId.length > 0 &&
        blockId.length > 0
      ) {
        col.addLink(toPageId, blockId);
      }
      if (typeof label === "string" && label.length > 0) {
        col.addText(label);
      }
      continue;
    }

    if (name === "hardBreak") {
      col.addText(" ");
      continue;
    }

    // Для вложенных структур (bulletList, listItem, blockquote, etc.) — рекурсия
    walkFragment(child, col, blockId);
  }
}
