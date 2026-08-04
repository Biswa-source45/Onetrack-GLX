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
		htmlBody := fmt.Sprintf(`
			<div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px;">
				<div style="background-color: #4f46e5; padding: 12px 20px; border-radius: 6px 6px 0 0; color: white;">
					<h2 style="margin: 0; font-size: 18px;">OneTrack Alert: %s</h2>
				</div>
				<div style="padding: 20px 0;">
					<p style="font-size: 14px; line-height: 1.6;">%s</p>
					<p style="font-size: 12px; color: #666; margin-top: 20px;">Target Role/Recipient: <strong>%s</strong></p>
				</div>
				<div style="border-top: 1px solid #eee; pt: 10px; font-size: 11px; color: #999;">
					This is an automated notification from OneTrack Enterprise Tender Management System.
				</div>
			</div>
		`, alert.Title, alert.Message, alert.TargetRole)

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
