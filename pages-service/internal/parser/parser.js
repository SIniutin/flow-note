#!/usr/bin/env node

import * as readline from 'node:readline'
import { Buffer } from 'node:buffer'
import * as Y from 'yjs'

/**
 * Вход:
 *   {"id":"req-1","snapshot_b64":"..."}
 *
 * Выход:
 *   {"id":"req-1","ok":true,"result":{...}}
 *   {"id":"req-1","ok":false,"error":"..."}
 */

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
})

rl.on('line', (line) => {
  void handleLine(line)
})

rl.on('close', () => {
  process.exit(0)
})

async function handleLine(line) {
  let req
  try {
    req = JSON.parse(line)
  } catch (err) {
    write({
      id: '',
      ok: false,
      error: `invalid json: ${stringifyErr(err)}`,
    })
    return
  }

  const id = typeof req.id === 'string' ? req.id : ''

  try {
    if (!req || typeof req.snapshot_b64 !== 'string') {
      throw new Error('snapshot_b64 is required')
    }

    const update = Uint8Array.from(Buffer.from(req.snapshot_b64, 'base64'))
    const result = parseSnapshot(update)

    write({
      id,
      ok: true,
      result,
    })
  } catch (err) {
    write({
      id,
      ok: false,
      error: stringifyErr(err),
    })
  }
}

function write(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

function stringifyErr(err) {
  return err instanceof Error ? err.message : String(err)
}

function parseSnapshot(update) {
  const doc = new Y.Doc()

  // encoded Y.Doc update -> применяем в документ
  Y.applyUpdate(doc, update)

  const title = doc.getText('title').toString()
  const content = doc.getXmlFragment('content')

  const parsed = parseContent(content)

  return {
    title,
    blocks: parsed.blocks,
    page_refs: parsed.page_refs,
    table_refs: parsed.table_refs,
    mentions: parsed.mentions,
    plain_text: parsed.plain_text,
  }
}

/**
 * Ожидаем Tiptap/ProseMirror-подобную схему:
 * - content: Y.XmlFragment
 * - block nodes: paragraph, heading, mws_table, ...
 * - inline nodes: mention, page_link
 * - text: Y.XmlText
 */
function parseContent(root) {
  const blocks = []
  const pageRefs = []
  const tableRefsSet = new Set()
  const mentions = []
  const plainTextParts = []

  walk(root, null)

  return {
    blocks,
    page_refs: pageRefs,
    table_refs: [...tableRefsSet],
    mentions,
    plain_text: plainTextParts.join('\n').trim(),
  }

  function walk(node, currentBlockId) {
    for (const child of node.toArray()) {
      if (child instanceof Y.XmlText) {
        const text = child.toString()
        if (text.trim()) {
          plainTextParts.push(text)
        }
        continue
      }

      if (!(child instanceof Y.XmlElement)) {
        continue
      }

      const nodeName = child.nodeName
      const blockId = attr(child, 'block_id') || currentBlockId

      if (isBlockNode(nodeName)) {
        const block = {
          block_id: attr(child, 'block_id') || '',
          type: nodeName,
        }

        if (nodeName === 'mws_table') {
          const dstId = attr(child, 'dst_id')
          if (dstId) {
            block.attrs = { dst_id: dstId }
            tableRefsSet.add(dstId)
          }
        } else {
          const text = collectText(child)
          if (text) {
            block.text = text
            plainTextParts.push(text)
          }
        }

        blocks.push(block)
      }

      if (nodeName === 'page_link') {
        const pageId = attr(child, 'page_id')
        if (pageId && blockId) {
          pageRefs.push({
            source_block_id: blockId,
            target_page_id: pageId,
          })
        }
      }

      if (nodeName === 'mention') {
        const label =
          attr(child, 'label') ||
          attr(child, 'name') ||
          child.toString() ||
          ''
        if (label && blockId) {
          mentions.push({
            source_block_id: blockId,
            id: attr(child, 'id') || '',
            label,
            kind: attr(child, 'kind') || 'user',
          })
        }
      }

      walk(child, blockId)
    }
  }
}

function isBlockNode(nodeName) {
  return new Set([
    'paragraph',
    'heading',
    'blockquote',
    'bulletList',
    'orderedList',
    'listItem',
    'codeBlock',
    'mws_table',
  ]).has(nodeName)
}

function collectText(node) {
  let out = ''

  for (const child of node.toArray()) {
    if (child instanceof Y.XmlText) {
      out += child.toString()
      continue
    }

    if (child instanceof Y.XmlElement) {
      if (child.nodeName === 'mention') {
        const label =
          attr(child, 'label') ||
          attr(child, 'name') ||
          child.toString() ||
          ''
        out += label.startsWith('@') ? label : `@${label}`
      } else {
        out += collectText(child)
      }
    }
  }

  return out.trim()
}

function attr(node, name) {
  const value = node.getAttribute(name)
  return typeof value === 'string' ? value : ''
}