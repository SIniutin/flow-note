package domain

import (
	"encoding/json"
	"strings"

	"github.com/google/uuid"
)

type BodyNode struct {
	Type   string     `json:"type"`
	Text   string     `json:"text,omitempty"`
	UserID *uuid.UUID `json:"user_id,omitempty"`
	Label  string     `json:"label,omitempty"`
}

type CommentBody []BodyNode

func (b CommentBody) Validate() bool {
	if len(b) == 0 {
		return false
	}
	for _, node := range b {
		switch node.Type {
		case "text":
			if node.Text == "" {
				return false
			}
		case "mention":
			if node.UserID == nil {
				return false
			}
		default:
			return false
		}
	}
	return true
}

func (b CommentBody) MentionedUserIDs() []uuid.UUID {
	seen := map[uuid.UUID]struct{}{}
	out := make([]uuid.UUID, 0)
	for _, node := range b {
		if node.Type == "mention" && node.UserID != nil {
			if _, ok := seen[*node.UserID]; ok {
				continue
			}
			seen[*node.UserID] = struct{}{}
			out = append(out, *node.UserID)
		}
	}
	return out
}

func (b CommentBody) PlainTextPreview(limit int) string {
	var sb strings.Builder
	for _, node := range b {
		if node.Type == "text" {
			sb.WriteString(node.Text)
			continue
		}
		if node.Type == "mention" {
			sb.WriteString("@")
			sb.WriteString(node.Label)
		}
	}
	text := strings.TrimSpace(sb.String())
	if limit > 0 && len(text) > limit {
		return text[:limit]
	}
	return text
}

func (b CommentBody) JSON() ([]byte, error) {
	return json.Marshal(b)
}
