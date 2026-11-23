package service

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	alertDomain "github.com/onetrack/backend/internal/alert/domain"
	"github.com/onetrack/backend/internal/chat/domain"
)

const maxContentRunes = 4000

type chatService struct {
	repo     domain.ChatRepository
	alertSvc alertDomain.AlertService
}

func NewChatService(repo domain.ChatRepository, alertSvc alertDomain.AlertService) domain.ChatService {
	return &chatService{
		repo:     repo,
		alertSvc: alertSvc,
	}
}

func (s *chatService) SendMessage(ctx context.Context, bidID string, senderID string, req *domain.CreateMessageRequest) (*domain.ChatMessage, error) {
	content := strings.TrimSpace(req.Content)
	if content == "" {
		return nil, fmt.Errorf("message content cannot be empty")
	}
	if utf8.RuneCountInString(content) > maxContentRunes {
		return nil, fmt.Errorf("message is too long (max %d characters)", maxContentRunes)
	}

	// ANNOUNCEMENT is reserved for the system, so clients can only post these two.
	msgType := strings.ToUpper(strings.TrimSpace(req.MessageType))
	switch msgType {
	case "":
		msgType = "CHAT"
		if strings.HasSuffix(content, "?") {
			msgType = "QUESTION"
		}
	case "CHAT", "QUESTION":
	default:
		return nil, fmt.Errorf("invalid message type %q", req.MessageType)
	}

	// Also proves the tender exists (ErrBidNotFound) before anything is written.
	title, bidNo, _, stage, err := s.repo.GetBidSummary(ctx, bidID)
	if err != nil {
		return nil, err
	}
	members, err := s.repo.GetEligibleMembers(ctx, bidID)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve mentions: %w", err)
	}

	// Mentions are always resolved server-side from the text; the client list is ignored
	// (a client-side substring match turned "@alice" into an @all).
	labels, recipients := resolveMentions(content, senderID, members, isAfterStage5(stage))

	msg := &domain.ChatMessage{
		BidID:       bidID,
		SenderID:    senderID,
		Content:     content,
		MessageType: msgType,
		Mentions:    labels,
		Attachments: []domain.AttachmentMeta{}, // ponytail: uploads aren't wired in the UI, ignore client-sent attachments
	}
	if err := s.repo.CreateMessage(ctx, msg); err != nil {
		return nil, fmt.Errorf("failed to save chat message: %w", err)
	}

	if len(recipients) > 0 {
		tenderRef := title
		if bidNo != "" {
			tenderRef = fmt.Sprintf("%s (%s)", title, bidNo)
		}
		go s.notify(bidID, tenderRef, msg.SenderName, msgType, content, recipients)
	}

	return msg, nil
}

func (s *chatService) ListMessages(ctx context.Context, bidID string, limit, offset int) ([]*domain.ChatMessage, error) {
	messages, err := s.repo.GetMessagesByBidID(ctx, bidID, limit, offset)
	if err != nil {
		return nil, err
	}
	if messages == nil {
		messages = []*domain.ChatMessage{}
	}
	return messages, nil
}

var stageOrderMap = map[string]int{
	"DISCOVERED":                     1,
	"PRIMARY_REVIEW":                 2,
	"OEM_AUTHORIZATION_REQUEST":      3,
	"PRICING_REQUEST":                4,
	"DOCUMENT_CHECKLIST_PREPARATION": 5,
	"EMD_PROCESSING":                 6,
	"INTERNAL_APPROVAL":              7,
	"GEM_SUBMISSION":                 8,
	"TECHNICAL_EVALUATION":           9,
	"FINANCIAL_EVALUATION":           10,
	"AWARD_HANDOVER":                 11,
}

func isAfterStage5(stage string) bool {
	upper := strings.ToUpper(strings.TrimSpace(stage))
	if order, ok := stageOrderMap[upper]; ok {
		return order > 5
	}
	// Terminal states that are not part of the ordered workflow.
	return upper == "COMPLETED" || upper == "CLOSED"
}

func isMDRole(role string) bool {
	r := strings.ToUpper(strings.TrimSpace(role))
	return r == "MANAGING_DIRECTOR" || r == "MD" || strings.Contains(r, "MANAGING DIRECTOR")
}

func (s *chatService) GetMembers(ctx context.Context, bidID string) ([]*domain.ChatMember, error) {
	members, err := s.repo.GetEligibleMembers(ctx, bidID)
	if err != nil {
		return nil, err
	}

	_, _, _, stage, _ := s.repo.GetBidSummary(ctx, bidID)

	allLabel := "all (All Team Members · excludes MD in Stages 1-5)"
	if isAfterStage5(stage) {
		allLabel = "all (All Team Members · includes MD)"
	}

	allMember := &domain.ChatMember{
		ID:       "all",
		FullName: allLabel,
		Username: "all",
		Role:     "ALL",
		IsMember: true,
	}

	return append([]*domain.ChatMember{allMember}, members...), nil
}

// hasMention reports whether text contains "@name" as a whole token (case-insensitive),
// so "@alice" does not match "@ali", and an email like "a@ali.com" is not a mention.
func hasMention(text, name string) bool {
	name = strings.TrimSpace(name)
	if name == "" {
		return false
	}
	re, err := regexp.Compile(`(?i)(?:^|[^\w@])@` + regexp.QuoteMeta(name) + `(?:$|[^\w])`)
	return err == nil && re.MatchString(text)
}

// resolveMentions returns the labels to store on the message and the members to alert.
//
// @all / @everyone / @team alerts the tender team (owner + workspace members), never every
// user in the system. The MD is not on the team by default: @all reaches them only from
// Stage 6 onwards. A direct @name always reaches that person, MD included.
func resolveMentions(content, senderID string, members []*domain.ChatMember, afterStage5 bool) ([]string, []*domain.ChatMember) {
	labels := []string{}
	everyone := hasMention(content, "all") || hasMention(content, "everyone") || hasMention(content, "team")
	if everyone {
		labels = append(labels, "all")
	}

	var recipients []*domain.ChatMember
	for _, m := range members {
		if m.ID == senderID {
			continue
		}
		direct := hasMention(content, m.Username) || hasMention(content, m.FullName)
		viaAll := everyone && (m.IsOwner || m.IsMember)
		if isMDRole(m.Role) {
			viaAll = everyone && afterStage5
		}
		if direct {
			labels = append(labels, m.Username)
		}
		if direct || viaAll {
			recipients = append(recipients, m)
		}
	}
	return labels, recipients
}

func (s *chatService) notify(bidID, tenderRef, senderName, msgType, content string, recipients []*domain.ChatMember) {
	if s.alertSvc == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	title := fmt.Sprintf("%s mentioned you in %s", senderName, tenderRef)
	if msgType == "QUESTION" {
		title = fmt.Sprintf("%s asked a question in %s", senderName, tenderRef)
	}
	link := fmt.Sprintf("/dashboard/tenders/%s?tab=chat-history", bidID)

	for _, m := range recipients {
		uid := m.ID
		bid := bidID
		_ = s.alertSvc.CreateAlert(ctx, &alertDomain.Alert{
			UserID:  &uid,
			BidID:   &bid,
			Type:    "TENDER_CHAT_MENTION",
			Title:   title,
			Message: content,
			Link:    link,
		})
	}
}
