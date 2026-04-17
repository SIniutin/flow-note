#!/bin/bash
# Декодирует последний сохранённый snapshot через Go-декодер.
# Использование: bash mock-pages/decode-last.sh [page_id]

PAGE=${1:-"page-001"}
BIN="mock-pages/snapshots/${PAGE}.bin"

if [ ! -f "$BIN" ]; then
  echo "Снапшот не найден: $BIN"
  echo "Доступные страницы:"
  ls mock-pages/snapshots/*.bin 2>/dev/null | xargs -n1 basename | sed 's/.bin//'
  exit 1
fi

echo "=== Декодируем $BIN ==="
base64 "$BIN" | go run ../ydoc-tools/decoder/main.go
