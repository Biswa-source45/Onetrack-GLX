package domain

import (
	"context"
	"errors"
	"time"
)

// ErrBidNotFound is returned when the tender does not exist.
var ErrBidNotFound = errors.New("tender not found")

type ChatMessage struct {
	ID          string           `json:"id"`
	BidID       string           `json:"bid_id"`
	SenderID    string           `json:"sender_id"`
	SenderName  string           `json:"sender_name"`
	SenderRole  string           `json:"sender_role"`
	SenderEmail string           `json:"sender_email,omitempty"`
	Content     string           `json:"content"`
	MessageType string           `json:"message_type"` // 'CHAT', 'QUESTION', 'ANNOUNCEMENT'
	Mentions    []string         `json:"mentions"`     // user IDs or usernames or 'everyone'
	Attachments []AttachmentMeta `json:"attachments"`
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
}

type AttachmentMeta struct {
	Name string `json:"name"`
	Size string `json:"size,omitempty"`
	URL  string `json:"url,omitempty"`
}

type CreateMessageRequest struct {
	Content     string           `json:"content" binding:"required"`
	MessageType string           `json:"message_type"`
	Mentions    []string         `json:"mentions"`
	Attachments []AttachmentMeta `json:"attachments"`
}

type ChatMember struct {
	ID       string `json:"id"`
	FullName string `json:"full_name"`
	Username string `json:"username"`
	Role     string `json:"role"`
	IsOwner  bool   `json:"is_owner"`
	IsMember bool   `json:"is_member"`
}

type ChatRepository interface {
	CreateMessage(ctx context.Context, msg *ChatMessage) error
	GetMessagesByBidID(ctx context.Context, bidID string, limit, offset int) ([]*ChatMessage, error)
	GetEligibleMembers(ctx context.Context, bidID string) ([]*ChatMember, error)
	GetBidSummary(ctx context.Context, bidID string) (title string, bidNo string, createdBy string, stage string, err error)
}

type ChatService interface {
	SendMessage(ctx context.Context, bidID string, senderID string, req *CreateMessageRequest) (*ChatMessage, error)
	ListMessages(ctx context.Context, bidID string, limit, offset int) ([]*ChatMessage, error)
	GetMembers(ctx context.Context, bidID string) ([]*ChatMember, error)
}
