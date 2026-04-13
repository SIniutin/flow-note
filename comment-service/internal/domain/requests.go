package domain

type CreateThreadRequest struct {
	Anchor Anchor      `json:"anchor"`
	Body   CommentBody `json:"body"`
}

type CreateReplyRequest struct {
	Body CommentBody `json:"body"`
}
