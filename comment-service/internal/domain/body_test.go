package domain

import (
	"testing"

	"github.com/google/uuid"
)

func TestCommentBodyMentionedUserIDs(t *testing.T) {
	userID := uuid.New()
	body := CommentBody{
		{Type: "text", Text: "hello "},
		{Type: "mention", UserID: &userID, Label: "alice"},
		{Type: "mention", UserID: &userID, Label: "alice"},
	}

	got := body.MentionedUserIDs()
	if len(got) != 1 {
		t.Fatalf("expected 1 mention, got %d", len(got))
	}
	if got[0] != userID {
		t.Fatalf("expected %s, got %s", userID, got[0])
	}
}
