package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/onetrack/backend/internal/chat/domain"
)

type postgresChatRepo struct {
	pool *pgxpool.Pool
}

func NewPostgresRepository(pool *pgxpool.Pool) domain.ChatRepository {
	return &postgresChatRepo{pool: pool}
}

func (r *postgresChatRepo) CreateMessage(ctx context.Context, msg *domain.ChatMessage) error {
	mentionsJSON, err := json.Marshal(msg.Mentions)
	if err != nil {
		mentionsJSON = []byte("[]")
	}

	attachmentsJSON, err := json.Marshal(msg.Attachments)
	if err != nil {
		attachmentsJSON = []byte("[]")
	}

	query := `
		INSERT INTO bid.tender_chat_messages (bid_id, sender_id, content, message_type, mentions, attachments)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at
	`

	err = r.pool.QueryRow(ctx, query,
		msg.BidID,
		msg.SenderID,
		msg.Content,
		msg.MessageType,
		mentionsJSON,
		attachmentsJSON,
	).Scan(&msg.ID, &msg.CreatedAt, &msg.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert chat message: %w", err)
	}

	// Fetch sender details
	senderQuery := `
		SELECT COALESCE(u.full_name, u.username, 'User') as sender_name,
		       COALESCE(u.email, '') as sender_email,
		       COALESCE(
		         (SELECT r.name FROM auth.user_roles ur JOIN auth.roles r ON r.id = ur.role_id WHERE ur.user_id = u.id ORDER BY ur.is_primary DESC, ur.role_order ASC LIMIT 1),
		         'MEMBER'
		       ) as sender_role
		FROM auth.users u
		WHERE u.id = $1
	`
	_ = r.pool.QueryRow(ctx, senderQuery, msg.SenderID).Scan(&msg.SenderName, &msg.SenderEmail, &msg.SenderRole)

	return nil
}

func (r *postgresChatRepo) GetMessagesByBidID(ctx context.Context, bidID string, limit, offset int) ([]*domain.ChatMessage, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	// Newest page first (so a long chat shows the latest messages), re-sorted oldest-first for display.
	query := `
		SELECT * FROM (
			SELECT m.id, m.bid_id, m.sender_id,
			       COALESCE(u.full_name, u.username, 'User') as sender_name,
			       COALESCE(u.email, '') as sender_email,
			       COALESCE(
			         (SELECT r.name FROM auth.user_roles ur JOIN auth.roles r ON r.id = ur.role_id WHERE ur.user_id = u.id ORDER BY ur.is_primary DESC, ur.role_order ASC LIMIT 1),
			         'MEMBER'
			       ) as sender_role,
			       m.content, m.message_type, m.mentions, m.attachments, m.created_at, m.updated_at
			FROM bid.tender_chat_messages m
			LEFT JOIN auth.users u ON u.id = m.sender_id
			WHERE m.bid_id = $1
			ORDER BY m.created_at DESC, m.id DESC
			LIMIT $2 OFFSET $3
		) latest
		ORDER BY created_at ASC, id ASC
	`

	rows, err := r.pool.Query(ctx, query, bidID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query chat messages: %w", err)
	}
	defer rows.Close()

	var messages []*domain.ChatMessage
	for rows.Next() {
		var msg domain.ChatMessage
		var mentionsBytes, attachmentsBytes []byte

		err := rows.Scan(
			&msg.ID,
			&msg.BidID,
			&msg.SenderID,
			&msg.SenderName,
			&msg.SenderEmail,
			&msg.SenderRole,
			&msg.Content,
			&msg.MessageType,
			&mentionsBytes,
			&attachmentsBytes,
			&msg.CreatedAt,
			&msg.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan chat message: %w", err)
		}

		if len(mentionsBytes) > 0 {
			_ = json.Unmarshal(mentionsBytes, &msg.Mentions)
		}
		if msg.Mentions == nil {
			msg.Mentions = []string{}
		}

		if len(attachmentsBytes) > 0 {
			_ = json.Unmarshal(attachmentsBytes, &msg.Attachments)
		}
		if msg.Attachments == nil {
			msg.Attachments = []domain.AttachmentMeta{}
		}

		messages = append(messages, &msg)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to read chat messages: %w", err)
	}

	return messages, nil
}

func (r *postgresChatRepo) GetEligibleMembers(ctx context.Context, bidID string) ([]*domain.ChatMember, error) {
	// 1. Get bid owner
	var ownerID string
	_ = r.pool.QueryRow(ctx, "SELECT bid_owner_id FROM bid.bid_workspaces WHERE id = $1", bidID).Scan(&ownerID)

	// 2. Query all active users and determine if they are workspace members or owner
	query := `
		SELECT u.id,
		       COALESCE(u.full_name, u.username) as full_name,
		       u.username,
		       COALESCE(
		         (SELECT r.name FROM auth.user_roles ur JOIN auth.roles r ON r.id = ur.role_id WHERE ur.user_id = u.id ORDER BY (r.name IN ('MANAGING_DIRECTOR', 'MD')) DESC, ur.is_primary DESC, ur.role_order ASC LIMIT 1),
		         'USER'
		       ) as role,
		       (u.id = $2) as is_owner,
		       EXISTS(SELECT 1 FROM bid.bid_workspace_members wm WHERE wm.bid_id = $1 AND wm.user_id = u.id) as is_member
		FROM auth.users u
		WHERE u.is_active = true
		ORDER BY is_owner DESC, is_member DESC, full_name ASC
	`

	rows, err := r.pool.Query(ctx, query, bidID, ownerID)
	if err != nil {
		return nil, fmt.Errorf("failed to query eligible members: %w", err)
	}
	defer rows.Close()

	var members []*domain.ChatMember
	for rows.Next() {
		var m domain.ChatMember
		if err := rows.Scan(&m.ID, &m.FullName, &m.Username, &m.Role, &m.IsOwner, &m.IsMember); err != nil {
			return nil, fmt.Errorf("failed to scan eligible member: %w", err)
		}
		members = append(members, &m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to read members: %w", err)
	}

	return members, nil
}

func (r *postgresChatRepo) GetBidSummary(ctx context.Context, bidID string) (string, string, string, string, error) {
	query := `
		SELECT title, COALESCE(bid_no, gem_bid_no, 'N/A'), COALESCE(created_by::text, ''), COALESCE(workflow_stage, 'DISCOVERED')
		FROM bid.bid_workspaces
		WHERE id = $1
	`
	var title, bidNo, createdBy, stage string
	err := r.pool.QueryRow(ctx, query, bidID).Scan(&title, &bidNo, &createdBy, &stage)
	if errors.Is(err, pgx.ErrNoRows) {
		err = domain.ErrBidNotFound
	}
	return title, bidNo, createdBy, stage, err
}
