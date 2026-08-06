package service

import (
	"context"
	"fmt"
	"log"

	"github.com/onetrack/backend/internal/alert/domain"
	emailService "github.com/onetrack/backend/internal/platform/email"
	userDomain "github.com/onetrack/backend/internal/user/domain"
)

type alertService struct {
	repo     domain.AlertRepository
	userRepo userDomain.UserRepository
	emailSvc *emailService.EmailService
}

func NewAlertService(repo domain.AlertRepository, userRepo userDomain.UserRepository, emailSvc *emailService.EmailService) domain.AlertService {
	return &alertService{
		repo:     repo,
		userRepo: userRepo,
		emailSvc: emailSvc,
	}
}

func (s *alertService) CreateAlert(ctx context.Context, alert *domain.Alert) error {
	err := s.repo.CreateAlert(ctx, alert)
	if err != nil {
		return err
	}

	// Trigger email dispatch if EmailService is present
	if s.emailSvc != nil {
		go s.dispatchAlertEmails(context.Background(), alert)
	}

	return nil
}

func (s *alertService) dispatchAlertEmails(ctx context.Context, alert *domain.Alert) {
	recipients := []string{}

	if s.userRepo != nil {
		if alert.UserID != nil && *alert.UserID != "" {
			u, err := s.userRepo.GetByID(ctx, *alert.UserID)
			if err == nil && u.Email != nil && *u.Email != "" {
				recipients = append(recipients, *u.Email)
			}
		} else if alert.TargetRole != "" {
			var roleToQuery string
			if alert.TargetRole != "ALL" {
				roleToQuery = alert.TargetRole
			}
			users, _, err := s.userRepo.List(ctx, userDomain.ListUsersParams{
				Role:  roleToQuery,
				Limit: 100,
			})
			if err == nil {
				for _, u := range users {
					if u.Email != nil && *u.Email != "" {
						recipients = append(recipients, *u.Email)
					}
				}
			}
			// If specific role returned no email addresses, query all active users
			if len(recipients) == 0 {
				allUsers, _, err := s.userRepo.List(ctx, userDomain.ListUsersParams{Limit: 100})
				if err == nil {
					for _, u := range allUsers {
						if u.Email != nil && *u.Email != "" {
							recipients = append(recipients, *u.Email)
						}
					}
				}
			}
		}
	}

	// Log attempt
	log.Printf("[AlertService] Dispatching alert '%s' to %d recipients (Role: %s)", alert.Title, len(recipients), alert.TargetRole)

	if len(recipients) > 0 {
		roleDisplay := alert.TargetRole
		if roleDisplay == "" || roleDisplay == "ALL" {
			roleDisplay = "All Department Personnel"
		}

		htmlBody := fmt.Sprintf(`
			<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
				<div style="background: linear-gradient(135deg, #4f46e5 0%%, #6366f1 100%%); padding: 16px 24px; border-radius: 8px; color: #ffffff;">
					<h2 style="margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.02em;">OneTrack Alert: %s</h2>
				</div>
				<div style="padding: 24px 4px 16px 4px;">
					<p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">%s</p>
					<div style="display: inline-block; background-color: #f1f5f9; border-radius: 6px; padding: 6px 12px; margin-top: 12px;">
						<span style="font-size: 12px; color: #64748b; font-weight: 500;">Target Role / Recipient: <strong style="color: #0f172a;">%s</strong></span>
					</div>
				</div>
				<div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">
					This is an automated system notification from OneTrack Enterprise Tender Management System.
				</div>
			</div>
		`, alert.Title, alert.Message, roleDisplay)

		_ = s.emailSvc.SendEmail(recipients, fmt.Sprintf("[OneTrack Alert] %s", alert.Title), htmlBody)
	}
}

func (s *alertService) GetUserAlerts(ctx context.Context, userID string, userRole string) ([]domain.Alert, error) {
	return s.repo.GetUserAlerts(ctx, userID, userRole)
}

func (s *alertService) MarkAsRead(ctx context.Context, alertID string, userID string) error {
	return s.repo.MarkAsRead(ctx, alertID, userID)
}

func (s *alertService) MarkAllAsRead(ctx context.Context, userID string, userRole string) error {
	return s.repo.MarkAllAsRead(ctx, userID, userRole)
}
