package domain

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
)

type Anchor struct {
	Kind          string `json:"kind"`
	BlockID       string `json:"block_id,omitempty"`
	StartOffset   *int   `json:"start_offset,omitempty"`
	EndOffset     *int   `json:"end_offset,omitempty"`
	SelectedText  string `json:"selected_text,omitempty"`
	ContextBefore string `json:"context_before,omitempty"`
	ContextAfter  string `json:"context_after,omitempty"`
	SnapshotID    string `json:"snapshot_id,omitempty"`
	TableID       string `json:"table_id,omitempty"`
	RowID         string `json:"row_id,omitempty"`
	ColumnID      string `json:"column_id,omitempty"`
}

func (a Anchor) Validate() error {
	switch a.Kind {
	case "text_range":
		if a.BlockID == "" || a.StartOffset == nil || a.EndOffset == nil {
			return errors.New("text_range anchor requires block_id, start_offset, end_offset")
		}
	case "table_cell":
		if a.TableID == "" || a.RowID == "" || a.ColumnID == "" {
			return errors.New("table_cell anchor requires table_id, row_id, column_id")
		}
	default:
		return errors.New("unsupported anchor kind")
	}
	return nil
}

func (a Anchor) Hash() (string, error) {
	body, err := json.Marshal(a)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:]), nil
}
