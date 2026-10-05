package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/onetrack/backend/internal/calendar/domain"
	calendarRepo "github.com/onetrack/backend/internal/calendar/repository"
	calendarService "github.com/onetrack/backend/internal/calendar/service"
	"github.com/onetrack/backend/internal/platform/config"
	"github.com/onetrack/backend/internal/platform/database"
	emailService "github.com/onetrack/backend/internal/platform/email"
	"github.com/onetrack/backend/migrations"
)

func main() {
	log.Println("==========================================================")
	log.Println(">>> Starting 72-Hour Working Deadline Mail Test Runner <<<")
	log.Println("==========================================================")

	// 1. Load configuration from .env
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("[FATAL] Failed to load configuration: %v", err)
	}

	log.Printf("[Config] SMTP Server: %s:%s", cfg.Email.SMTPServer, cfg.Email.SMTPPort)
	log.Printf("[Config] Sender Account: %s", cfg.Email.Username)

	// 2. Initialize Email Service
	emailSvc := emailService.NewEmailService(cfg.Email)

	// 3. Connect to PostgreSQL
	ctx := context.Background()
	dbPool, err := database.NewPostgresPool(ctx, cfg.Database)
	if err != nil {
		log.Fatalf("[FATAL] Failed to connect to database: %v", err)
	}
	defer dbPool.Close()
	log.Println("[Database] Connected to PostgreSQL successfully")

	// Run automatic database migrations
	if err := migrations.RunAutoMigrations(ctx, dbPool); err != nil {
		log.Fatalf("[FATAL] Failed to run database migrations: %v", err)
	}
	log.Println("[Database] Auto-migrations executed successfully")

	// 4. Check for active tenders in DB
	calRepo := calendarRepo.NewPostgresCalendarRepository(dbPool)
	tenders, err := calRepo.GetActiveTendersForDeadlineCheck(ctx)
	if err != nil {
		log.Printf("[Warning] Failed to fetch active tenders: %v", err)
	} else {
		log.Printf("[Database] Found %d active candidate tenders for deadline evaluation", len(tenders))
		for i, t := range tenders {
			log.Printf("   [%d] Tender ID: %s | Title: %s | Closing: %s", i+1, t.ID, t.Title, t.ClosingDate.Format(time.RFC3339))
			// Fetch stakeholders for this tender
			shs, _ := calRepo.GetTenderStakeholders(ctx, t.ID)
			log.Printf("       Stakeholders involved (%d):", len(shs))
			for _, sh := range shs {
				log.Printf("         - %s (%s) <%s>", sh.FullName, sh.Roles, sh.Email)
			}
		}
	}

	// 5. Test Live 72-Hour Email Dispatch
	recipientEmail := cfg.Email.Username // e.g. support@globx.co.in
	if len(tenders) > 0 && tenders[0].BidOwnerEmail != nil && *tenders[0].BidOwnerEmail != "" {
		recipientEmail = *tenders[0].BidOwnerEmail
	}

	testTenderTitle := "High-Speed Rail Corridor Signalling & Telecommunication Package"
	testRef := "GEM/2026/B/8941029"
	testStage := "TECHNICAL_EVALUATION"
	testTask := "Final Compliance Matrix & OEM Undertaking Verification"
	testPriority := "HIGH"
	testResponsible := "Bid Manager (Tender Operations)"
	testClosing := time.Now().Add(50 * time.Hour)
	test72hDeadline := time.Now().Add(-22 * time.Hour)
	remainingHours := 48.5

	subject := fmt.Sprintf("🚨 URGENT: Tender Action Required – 72 Working Hours Remaining (%s)", testTenderTitle)

	htmlBody := fmt.Sprintf(`
		<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; max-width: 600px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
			<div style="background-color: #dc2626; color: white; padding: 8px 16px; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block; margin-bottom: 16px; letter-spacing: 0.5px;">
				🚨 HIGH PRIORITY — 72 WORKING HOURS DEADLINE
			</div>
			<h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px;">Action Required: %s</h2>
			<p style="font-size: 14px; line-height: 1.6; color: #334155;">
				<strong>72 working hours</strong> remain before this tender closes. The next actionable task has been identified by the OneTrack Working Calendar Engine and requires immediate attention.
			</p>
			<table style="width: 100%%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
				<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; font-weight: 600; color: #64748b; width: 40%%;">Tender</td><td style="padding: 10px 0; font-weight: 600; color: #0f172a;">%s (%s)</td></tr>
				<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; font-weight: 600; color: #64748b;">Current Stage</td><td style="padding: 10px 0; color: #0f172a;"><span style="background: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">%s</span></td></tr>
				<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; font-weight: 600; color: #64748b;">Next Action / Task</td><td style="padding: 10px 0; font-weight: 700; color: #2563eb;">%s</td></tr>
				<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; font-weight: 600; color: #64748b;">Priority</td><td style="padding: 10px 0;"><span style="background: #fee2e2; color: #991b1b; padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 11px;">%s</span></td></tr>
				<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; font-weight: 600; color: #64748b;">Responsible</td><td style="padding: 10px 0; color: #0f172a; font-weight: 600;">%s</td></tr>
				<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; font-weight: 600; color: #64748b;">Tender Closing Date</td><td style="padding: 10px 0; color: #0f172a;">%s</td></tr>
				<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; font-weight: 600; color: #64748b;">72h Working Deadline</td><td style="padding: 10px 0; font-weight: 700; color: #b91c1c;">%s</td></tr>
				<tr><td style="padding: 10px 0; font-weight: 600; color: #64748b;">Remaining Working Hours</td><td style="padding: 10px 0; font-weight: 700; color: #059669; font-size: 15px;">%.1f hrs</td></tr>
			</table>
			<div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 12px; margin-top: 16px;">
				<p style="margin: 0; font-size: 12px; color: #64748b;">
					💡 <strong>Policy Note:</strong> Calculated using the backward working hours engine (09:00 - 18:00 daily operational interval, excluding 2nd & 4th Saturdays, Sundays, and Gazetted Holidays).
				</p>
			</div>
			<p style="font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
				This test notification was generated automatically by the OneTrack Working Calendar Engine test runner.
			</p>
		</div>
	`, testTask, testTenderTitle, testRef, testStage, testTask, testPriority, testResponsible,
		testClosing.Format("02-Jan-2006 15:04 MST"),
		test72hDeadline.Format("02-Jan-2006 15:04 MST"),
		remainingHours,
	)

	log.Println("[EmailService] Dispatching 72-hour priority email...")
	log.Printf("   TO: %s", recipientEmail)
	log.Printf("   Subject: %s", subject)

	err = emailSvc.SendEmailWithCC([]string{recipientEmail}, []string{"support@globx.co.in"}, subject, htmlBody)
	if err != nil {
		log.Fatalf("[FATAL] Email dispatch failed: %v", err)
	}

	log.Println("[EmailService] Email dispatched asynchronously. Waiting 3 seconds for SMTP completion...")
	time.Sleep(3 * time.Second)

	// 6. Test Service Evaluation Engine
	log.Println("[Engine] Testing calendarService.EvaluateActiveTenders()...")
	calSvc := calendarService.NewWorkingCalendarService(calRepo, nil, emailSvc, nil)
	evalErr := calSvc.EvaluateActiveTenders(ctx)
	if evalErr != nil {
		log.Printf("[Engine] EvaluateActiveTenders returned: %v", evalErr)
	} else {
		log.Println("[Engine] EvaluateActiveTenders completed with 0 errors!")
	}

	// 7. Check task_notifications table
	var notifCount int
	_ = dbPool.QueryRow(ctx, "SELECT count(*) FROM calendar.task_notifications WHERE notification_type = $1", domain.NotificationType72HourReminder).Scan(&notifCount)
	log.Printf("[Database] Total 72_HOUR_REMINDER records in audit log: %d", notifCount)

	log.Println("==========================================================")
	log.Println(">>> 72-Hour Mail Test Completed Successfully! <<<")
	log.Println("==========================================================")
}
