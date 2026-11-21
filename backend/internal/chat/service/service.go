package service

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	alertDomain "github.com/onetrack/backend/internal/alert/domain"
	"github.com/onetrack/backend/internal/chat/domain"
)

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

	msgType := strings.ToUpper(strings.TrimSpace(req.MessageType))
	if msgType == "" {
		if strings.HasSuffix(content, "?") {
			msgType = "QUESTION"
		} else {
			msgType = "CHAT"
		}
	}

	// Auto-extract mentions from content if not explicitly passed
	mentions := req.Mentions
	if len(mentions) == 0 {
		mentions = extractMentions(content)
	}

	msg := &domain.ChatMessage{
		BidID:       bidID,
		SenderID:    senderID,
		Content:     content,
		MessageType: msgType,
		Mentions:    mentions,
		Attachments: req.Attachments,
	}

	if err := s.repo.CreateMessage(ctx, msg); err != nil {
		return nil, fmt.Errorf("failed to save chat message: %w", err)
	}

	// Dispatch alerts for mentions if alert service is available
	go s.notifyMentions(context.Background(), bidID, msg)

	return msg, nil
}

func (s *chatService) ListMessages(ctx context.Context, bidID string, limit, offset int) ([]*domain.ChatMessage, error) {
	messages, err := s.repo.GetMessagesByBidID(ctx, bidID, limit, offset)
	if err != nil {
		return nil, err
	}

	// If tender has no messages yet, seed an initial database record so there's no hardcoding
	if len(messages) == 0 && offset == 0 {
		title, bidNo, createdBy, _, bErr := s.repo.GetBidSummary(ctx, bidID)
		if bErr == nil && title != "" {
			initSenderID := createdBy
			if initSenderID == "" {
				// Fallback to first user in system
				members, mErr := s.repo.GetEligibleMembers(ctx, bidID)
				if mErr == nil && len(members) > 0 {
					initSenderID = members[0].ID
				}
			}

			if initSenderID != "" {
				initContent := fmt.Sprintf("Welcome to the dedicated discussion channel for %s (%s). Team members can collaborate, ask tender questions, and mention colleagues using @name or @everyone.", title, bidNo)
				initMsg := &domain.ChatMessage{
					BidID:       bidID,
					SenderID:    initSenderID,
					Content:     initContent,
					MessageType: "ANNOUNCEMENT",
					Mentions:    []string{"everyone"},
					Attachments: []domain.AttachmentMeta{},
				}
				if createErr := s.repo.CreateMessage(ctx, initMsg); createErr == nil {
					messages = append(messages, initMsg)
				}
			}
		}
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
	"FINANCIAL_EVALUATION":          10,
	"AWARD_HANDOVER":                11,
}

func isAfterStage5(stage string) bool {
	upper := strings.ToUpper(strings.TrimSpace(stage))
	order, ok := stageOrderMap[upper]
	if ok {
		return order > 5
	}
	return upper == "EMD_PROCESSING" ||
		upper == "INTERNAL_APPROVAL" ||
		upper == "GEM_SUBMISSION" ||
		upper == "TECHNICAL_EVALUATION" ||
		upper == "FINANCIAL_EVALUATION" ||
		upper == "AWARD_HANDOVER" ||
		upper == "COMPLETED" ||
		upper == "CLOSED"
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
	afterStage5 := isAfterStage5(stage)

	allLabel := "all (All Team Members · excludes MD in Stages 1-5)"
	if afterStage5 {
		allLabel = "all (All Team Members · includes MD)"
	}

	allMember := &domain.ChatMember{
		ID:       "all",
		FullName: allLabel,
		Username: "all",
		Role:     "ALL",
		IsOwner:  false,
		IsMember: true,
	}

	return append([]*domain.ChatMember{allMember}, members...), nil
}

func extractMentions(text string) []string {
	re := regexp.MustCompile(`@([\w\.\-]+)`)
	matches := re.FindAllStringSubmatch(text, -1)
	seen := make(map[string]bool)
	var list []string
	for _, m := range matches {
		if len(m) > 1 {
			mentionKey := strings.ToLower(m[1])
			if !seen[mentionKey] {
				seen[mentionKey] = true
				list = append(list, m[1])
			}
		}
	}
	return list
}

func (s *chatService) notifyMentions(ctx context.Context, bidID string, msg *domain.ChatMessage) {
	if s.alertSvc == nil || len(msg.Mentions) == 0 {
		return
	}

	members, err := s.repo.GetEligibleMembers(ctx, bidID)
	if err != nil {
		return
	}

	title, bidNo, _, stage, _ := s.repo.GetBidSummary(ctx, bidID)
	afterStage5 := isAfterStage5(stage)

	tenderRef := title
	if bidNo != "" {
		tenderRef = fmt.Sprintf("%s (%s)", title, bidNo)
	}

	isEveryone := false
	mentionSet := make(map[string]bool)
	for _, m := range msg.Mentions {
		low := strings.ToLower(m)
		if low == "everyone" || low == "all" || low == "team" {
			isEveryone = true
		}
		mentionSet[low] = true
	}

	for _, member := range members {
		if member.ID == msg.SenderID {
			continue // Do not self-notify
		}

		isMD := isMDRole(member.Role)

		// Broadcast mention (@all / @everyone):
		// - After stage 5 (stage 6+: EMD, Internal Approval, etc.): MD is INCLUDED
		// - Before or at stage 5 (stages 1-5): MD is EXCLUDED
		shouldNotifyEveryone := isEveryone
		if isEveryone && isMD && !afterStage5 {
			shouldNotifyEveryone = false
		}

		// Direct individual mention (e.g. explicitly mentioning the MD user by username/name) still notifies
		isDirectMention := mentionSet[strings.ToLower(member.Username)] ||
			mentionSet[strings.ToLower(member.FullName)] ||
			mentionSet[strings.ToLower(member.ID)]

		if shouldNotifyEveryone || isDirectMention {
			alertTitle := fmt.Sprintf("%s mentioned you in %s", msg.SenderName, tenderRef)
			if msg.MessageType == "QUESTION" {
				alertTitle = fmt.Sprintf("%s asked a question in %s", msg.SenderName, tenderRef)
			}
			link := fmt.Sprintf("/dashboard/tenders/%s?tab=chat-history", bidID)

			alert := &alertDomain.Alert{
				UserID:  &member.ID,
				BidID:   &bidID,
				Type:    "TENDER_CHAT_MENTION",
				Title:   alertTitle,
				Message: msg.Content,
				Link:    link,
			}
			_ = s.alertSvc.CreateAlert(ctx, alert)
		}
	}
}
