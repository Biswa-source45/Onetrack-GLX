package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/onetrack/backend/internal/calendar/domain"
)

type postgresCalendarRepo struct {
	db *pgxpool.Pool
}

func NewPostgresCalendarRepository(db *pgxpool.Pool) domain.WorkingCalendarRepository {
	return &postgresCalendarRepo{db: db}
}

// ── Calendars ────────────────────────────────────────────────────────────────

func (r *postgresCalendarRepo) GetDefaultCalendar(ctx context.Context) (*domain.WorkingCalendar, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, name, description, is_default, timezone, working_start_time, working_end_time,
		       saturday_1_working, saturday_2_working, saturday_3_working, saturday_4_working, saturday_5_working,
		       sunday_working, monday_working, tuesday_working, wednesday_working, thursday_working, friday_working,
		       escalation_delay_hours, created_at, updated_at
		FROM calendar.working_calendars
		WHERE is_default = true
		LIMIT 1
	`)
	return r.scanCalendar(row)
}

func (r *postgresCalendarRepo) GetCalendarByID(ctx context.Context, id string) (*domain.WorkingCalendar, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, name, description, is_default, timezone, working_start_time, working_end_time,
		       saturday_1_working, saturday_2_working, saturday_3_working, saturday_4_working, saturday_5_working,
		       sunday_working, monday_working, tuesday_working, wednesday_working, thursday_working, friday_working,
		       escalation_delay_hours, created_at, updated_at
		FROM calendar.working_calendars
		WHERE id = $1
	`, id)
	return r.scanCalendar(row)
}

func (r *postgresCalendarRepo) ListCalendars(ctx context.Context) ([]domain.WorkingCalendar, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, name, description, is_default, timezone, working_start_time, working_end_time,
		       saturday_1_working, saturday_2_working, saturday_3_working, saturday_4_working, saturday_5_working,
		       sunday_working, monday_working, tuesday_working, wednesday_working, thursday_working, friday_working,
		       escalation_delay_hours, created_at, updated_at
		FROM calendar.working_calendars
		ORDER BY is_default DESC, name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var calendars []domain.WorkingCalendar
	for rows.Next() {
		cal, err := r.scanCalendar(rows)
		if err != nil {
			return nil, err
		}
		calendars = append(calendars, *cal)
	}
	return calendars, nil
}

func (r *postgresCalendarRepo) UpdateCalendar(ctx context.Context, id string, req *domain.UpdateCalendarRequest) (*domain.WorkingCalendar, error) {
	_, err := r.db.Exec(ctx, `
		UPDATE calendar.working_calendars
		SET name = $2, description = $3, working_start_time = $4, working_end_time = $5,
		    saturday_1_working = $6, saturday_2_working = $7, saturday_3_working = $8,
		    saturday_4_working = $9, saturday_5_working = $10,
		    sunday_working = $11, monday_working = $12, tuesday_working = $13,
		    wednesday_working = $14, thursday_working = $15, friday_working = $16,
		    escalation_delay_hours = $17, updated_at = NOW()
		WHERE id = $1
	`, id, req.Name, req.Description, req.WorkingStartTime, req.WorkingEndTime,
		req.Saturday1Working, req.Saturday2Working, req.Saturday3Working,
		req.Saturday4Working, req.Saturday5Working,
		req.SundayWorking, req.MondayWorking, req.TuesdayWorking,
		req.WednesdayWorking, req.ThursdayWorking, req.FridayWorking,
		req.EscalationDelayHours)
	if err != nil {
		return nil, fmt.Errorf("failed to update working calendar: %w", err)
	}
	return r.GetCalendarByID(ctx, id)
}

func (r *postgresCalendarRepo) scanCalendar(row pgx.Row) (*domain.WorkingCalendar, error) {
	var c domain.WorkingCalendar
	var desc sql.NullString
	err := row.Scan(
		&c.ID, &c.Name, &desc, &c.IsDefault, &c.Timezone, &c.WorkingStartTime, &c.WorkingEndTime,
		&c.Saturday1Working, &c.Saturday2Working, &c.Saturday3Working, &c.Saturday4Working, &c.Saturday5Working,
		&c.SundayWorking, &c.MondayWorking, &c.TuesdayWorking, &c.WednesdayWorking, &c.ThursdayWorking, &c.FridayWorking,
		&c.EscalationDelayHours, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if desc.Valid {
		c.Description = &desc.String
	}
	return &c, nil
}

// ── Holidays ─────────────────────────────────────────────────────────────────

func (r *postgresCalendarRepo) ListHolidays(ctx context.Context, calendarID string, year int) ([]domain.Holiday, error) {
	query := `
		SELECT id, calendar_id, holiday_date::text, holiday_name, holiday_type, working_status,
		       priority, source, source_event_id, source_calendar_id, is_admin_override, is_active,
		       description, created_by, updated_by, created_at, updated_at, last_synced_at
		FROM calendar.holidays
		WHERE calendar_id = $1
	`
	var args []interface{}
	args = append(args, calendarID)

	if year > 0 {
		query += ` AND EXTRACT(YEAR FROM holiday_date) = $2`
		args = append(args, year)
	}
	query += ` ORDER BY holiday_date ASC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var holidays []domain.Holiday
	for rows.Next() {
		h, err := r.scanHoliday(rows)
		if err != nil {
			return nil, err
		}
		holidays = append(holidays, *h)
	}
	return holidays, nil
}

func (r *postgresCalendarRepo) GetHolidayByID(ctx context.Context, id string) (*domain.Holiday, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, calendar_id, holiday_date::text, holiday_name, holiday_type, working_status,
		       priority, source, source_event_id, source_calendar_id, is_admin_override, is_active,
		       description, created_by, updated_by, created_at, updated_at, last_synced_at
		FROM calendar.holidays
		WHERE id = $1
	`, id)
	return r.scanHoliday(row)
}

func (r *postgresCalendarRepo) GetHolidayByDate(ctx context.Context, calendarID string, date string) (*domain.Holiday, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, calendar_id, holiday_date::text, holiday_name, holiday_type, working_status,
		       priority, source, source_event_id, source_calendar_id, is_admin_override, is_active,
		       description, created_by, updated_by, created_at, updated_at, last_synced_at
		FROM calendar.holidays
		WHERE calendar_id = $1 AND holiday_date = $2::date AND is_active = true
		LIMIT 1
	`, calendarID, date)
	return r.scanHoliday(row)
}

func (r *postgresCalendarRepo) CreateHoliday(ctx context.Context, h *domain.Holiday) (*domain.Holiday, error) {
	var id string
	err := r.db.QueryRow(ctx, `
		INSERT INTO calendar.holidays (
			calendar_id, holiday_date, holiday_name, holiday_type, working_status,
			priority, source, is_admin_override, is_active, description, created_by
		) VALUES (
			$1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11
		) RETURNING id
	`, h.CalendarID, h.HolidayDate, h.HolidayName, h.HolidayType, h.WorkingStatus,
		h.Priority, h.Source, h.IsAdminOverride, h.IsActive, h.Description, h.CreatedBy).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("failed to create holiday: %w", err)
	}
	return r.GetHolidayByID(ctx, id)
}

func (r *postgresCalendarRepo) UpdateHoliday(ctx context.Context, id string, req *domain.UpdateHolidayRequest, updatedBy string) (*domain.Holiday, error) {
	// If an Admin updates any imported or manual holiday, mark is_admin_override = true!
	_, err := r.db.Exec(ctx, `
		UPDATE calendar.holidays
		SET holiday_name = COALESCE($2, holiday_name),
		    holiday_type = COALESCE($3, holiday_type),
		    working_status = COALESCE($4, working_status),
		    priority = COALESCE($5, priority),
		    is_active = COALESCE($6, is_active),
		    description = COALESCE($7, description),
		    is_admin_override = true,
		    updated_by = $8,
		    updated_at = NOW()
		WHERE id = $1
	`, id, req.HolidayName, req.HolidayType, req.WorkingStatus, req.Priority, req.IsActive, req.Description, updatedBy)
	if err != nil {
		return nil, fmt.Errorf("failed to update holiday: %w", err)
	}
	return r.GetHolidayByID(ctx, id)
}

func (r *postgresCalendarRepo) DeleteHoliday(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, "DELETE FROM calendar.holidays WHERE id = $1", id)
	return err
}

func (r *postgresCalendarRepo) UpsertGoogleHolidays(ctx context.Context, calendarID string, holidays []domain.Holiday) (*domain.SyncResult, error) {
	res := &domain.SyncResult{Status: "SUCCESS"}
	now := time.Now().UTC()

	for _, h := range holidays {
		// Check existing record
		var existingID string
		var isAdminOverride bool
		err := r.db.QueryRow(ctx, `
			SELECT id, is_admin_override FROM calendar.holidays
			WHERE calendar_id = $1 AND holiday_date = $2::date
			LIMIT 1
		`, calendarID, h.HolidayDate).Scan(&existingID, &isAdminOverride)

		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			res.FailedCount++
			continue
		}

		if errors.Is(err, pgx.ErrNoRows) {
			// Insert new holiday
			_, err = r.db.Exec(ctx, `
				INSERT INTO calendar.holidays (
					calendar_id, holiday_date, holiday_name, holiday_type, working_status,
					priority, source, source_event_id, source_calendar_id, is_admin_override,
					is_active, description, last_synced_at
				) VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, false, true, $10, $11)
			`, calendarID, h.HolidayDate, h.HolidayName, h.HolidayType, h.WorkingStatus,
				h.Priority, domain.SourceGoogleCalendar, h.SourceEventID, h.SourceCalendarID, h.Description, now)
			if err != nil {
				res.FailedCount++
			} else {
				res.ImportedCount++
			}
		} else {
			// Record already exists
			if isAdminOverride {
				// Section 6 & 23: NEVER overwrite Admin decisions! Keep is_admin_override untouched!
				res.SkippedCount++
				// Just update last_synced_at
				_, _ = r.db.Exec(ctx, "UPDATE calendar.holidays SET last_synced_at = $1 WHERE id = $2", now, existingID)
			} else {
				// Update existing Google holiday
				_, err = r.db.Exec(ctx, `
					UPDATE calendar.holidays
					SET holiday_name = $2, holiday_type = $3, working_status = $4,
					    source = $5, source_event_id = $6, source_calendar_id = $7,
					    description = $8, last_synced_at = $9, updated_at = NOW()
					WHERE id = $1
				`, existingID, h.HolidayName, h.HolidayType, h.WorkingStatus,
					domain.SourceGoogleCalendar, h.SourceEventID, h.SourceCalendarID, h.Description, now)
				if err != nil {
					res.FailedCount++
				} else {
					res.UpdatedCount++
				}
			}
		}
	}

	return res, nil
}

func (r *postgresCalendarRepo) scanHoliday(row pgx.Row) (*domain.Holiday, error) {
	var h domain.Holiday
	var srcEvt, srcCal, desc, createdBy, updatedBy sql.NullString
	var lastSynced sql.NullTime

	err := row.Scan(
		&h.ID, &h.CalendarID, &h.HolidayDate, &h.HolidayName, &h.HolidayType, &h.WorkingStatus,
		&h.Priority, &h.Source, &srcEvt, &srcCal, &h.IsAdminOverride, &h.IsActive,
		&desc, &createdBy, &updatedBy, &h.CreatedAt, &h.UpdatedAt, &lastSynced,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if srcEvt.Valid {
		h.SourceEventID = &srcEvt.String
	}
	if srcCal.Valid {
		h.SourceCalendarID = &srcCal.String
	}
	if desc.Valid {
		h.Description = &desc.String
	}
	if createdBy.Valid {
		h.CreatedBy = &createdBy.String
	}
	if updatedBy.Valid {
		h.UpdatedBy = &updatedBy.String
	}
	if lastSynced.Valid {
		h.LastSyncedAt = &lastSynced.Time
	}
	return &h, nil
}

// ── Exceptions ───────────────────────────────────────────────────────────────

func (r *postgresCalendarRepo) ListExceptions(ctx context.Context, calendarID string) ([]domain.CalendarException, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, calendar_id, exception_date::text, exception_type, reason, created_by, created_at
		FROM calendar.calendar_exceptions
		WHERE calendar_id = $1
		ORDER BY exception_date ASC
	`, calendarID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var exceptions []domain.CalendarException
	for rows.Next() {
		var e domain.CalendarException
		var cb sql.NullString
		if err := rows.Scan(&e.ID, &e.CalendarID, &e.ExceptionDate, &e.ExceptionType, &e.Reason, &cb, &e.CreatedAt); err != nil {
			return nil, err
		}
		if cb.Valid {
			e.CreatedBy = &cb.String
		}
		exceptions = append(exceptions, e)
	}
	return exceptions, nil
}

func (r *postgresCalendarRepo) GetExceptionByDate(ctx context.Context, calendarID string, date string) (*domain.CalendarException, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, calendar_id, exception_date::text, exception_type, reason, created_by, created_at
		FROM calendar.calendar_exceptions
		WHERE calendar_id = $1 AND exception_date = $2::date
		LIMIT 1
	`, calendarID, date)

	var e domain.CalendarException
	var cb sql.NullString
	err := row.Scan(&e.ID, &e.CalendarID, &e.ExceptionDate, &e.ExceptionType, &e.Reason, &cb, &e.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if cb.Valid {
		e.CreatedBy = &cb.String
	}
	return &e, nil
}

func (r *postgresCalendarRepo) CreateException(ctx context.Context, exc *domain.CalendarException) (*domain.CalendarException, error) {
	var id string
	err := r.db.QueryRow(ctx, `
		INSERT INTO calendar.calendar_exceptions (
			calendar_id, exception_date, exception_type, reason, created_by
		) VALUES ($1, $2::date, $3, $4, $5)
		ON CONFLICT (calendar_id, exception_date) DO UPDATE
		SET exception_type = EXCLUDED.exception_type, reason = EXCLUDED.reason
		RETURNING id
	`, exc.CalendarID, exc.ExceptionDate, exc.ExceptionType, exc.Reason, exc.CreatedBy).Scan(&id)
	if err != nil {
		return nil, err
	}
	exc.ID = id
	return exc, nil
}

func (r *postgresCalendarRepo) DeleteException(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, "DELETE FROM calendar.calendar_exceptions WHERE id = $1", id)
	return err
}

// ── Google Calendar Integration ──────────────────────────────────────────────

func (r *postgresCalendarRepo) GetGoogleIntegration(ctx context.Context, calendarID string) (*domain.GoogleCalendarIntegration, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, calendar_id, google_calendar_id, google_calendar_name, api_key,
		       sync_enabled, sync_interval_hours, last_sync_at, sync_status, last_error,
		       created_at, updated_at
		FROM calendar.google_calendar_integrations
		WHERE calendar_id = $1
		LIMIT 1
	`, calendarID)

	var g domain.GoogleCalendarIntegration
	var apiKey, lastErr sql.NullString
	var lastSync sql.NullTime

	err := row.Scan(&g.ID, &g.CalendarID, &g.GoogleCalendarID, &g.GoogleCalendarName, &apiKey,
		&g.SyncEnabled, &g.SyncIntervalHours, &lastSync, &g.SyncStatus, &lastErr, &g.CreatedAt, &g.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if apiKey.Valid {
		g.APIKey = &apiKey.String
	}
	if lastErr.Valid {
		g.LastError = &lastErr.String
	}
	if lastSync.Valid {
		g.LastSyncAt = &lastSync.Time
	}
	return &g, nil
}

func (r *postgresCalendarRepo) SaveGoogleIntegration(ctx context.Context, g *domain.GoogleCalendarIntegration) (*domain.GoogleCalendarIntegration, error) {
	var id string
	err := r.db.QueryRow(ctx, `
		INSERT INTO calendar.google_calendar_integrations (
			calendar_id, google_calendar_id, google_calendar_name, api_key,
			sync_enabled, sync_interval_hours, last_sync_at, sync_status, last_error, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
		ON CONFLICT (calendar_id) DO UPDATE
		SET google_calendar_id = EXCLUDED.google_calendar_id,
		    google_calendar_name = EXCLUDED.google_calendar_name,
		    api_key = COALESCE(EXCLUDED.api_key, calendar.google_calendar_integrations.api_key),
		    sync_enabled = EXCLUDED.sync_enabled,
		    sync_interval_hours = EXCLUDED.sync_interval_hours,
		    last_sync_at = EXCLUDED.last_sync_at,
		    sync_status = EXCLUDED.sync_status,
		    last_error = EXCLUDED.last_error,
		    updated_at = NOW()
		RETURNING id
	`, g.CalendarID, g.GoogleCalendarID, g.GoogleCalendarName, g.APIKey,
		g.SyncEnabled, g.SyncIntervalHours, g.LastSyncAt, g.SyncStatus, g.LastError).Scan(&id)
	if err != nil {
		return nil, err
	}
	return r.GetGoogleIntegration(ctx, g.CalendarID)
}

func (r *postgresCalendarRepo) CreateSyncLog(ctx context.Context, l *domain.GoogleCalendarSyncLog) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO calendar.google_calendar_sync_logs (
			integration_id, status, imported_count, updated_count, skipped_count,
			failed_count, error_details, synced_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, l.IntegrationID, l.Status, l.ImportedCount, l.UpdatedCount, l.SkippedCount, l.FailedCount, l.ErrorDetails, l.SyncedBy)
	return err
}

func (r *postgresCalendarRepo) ListSyncLogs(ctx context.Context, integrationID string, limit int) ([]domain.GoogleCalendarSyncLog, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := r.db.Query(ctx, `
		SELECT l.id, l.integration_id, l.status, l.imported_count, l.updated_count, l.skipped_count,
		       l.failed_count, l.error_details, l.synced_by, u.full_name, l.created_at
		FROM calendar.google_calendar_sync_logs l
		LEFT JOIN auth.users u ON l.synced_by = u.id
		WHERE l.integration_id = $1
		ORDER BY l.created_at DESC
		LIMIT $2
	`, integrationID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []domain.GoogleCalendarSyncLog
	for rows.Next() {
		var l domain.GoogleCalendarSyncLog
		var errDet, sb, sbName sql.NullString
		if err := rows.Scan(&l.ID, &l.IntegrationID, &l.Status, &l.ImportedCount, &l.UpdatedCount,
			&l.SkippedCount, &l.FailedCount, &errDet, &sb, &sbName, &l.CreatedAt); err != nil {
			return nil, err
		}
		if errDet.Valid {
			l.ErrorDetails = &errDet.String
		}
		if sb.Valid {
			l.SyncedBy = &sb.String
		}
		if sbName.Valid {
			l.SyncedByName = &sbName.String
		}
		logs = append(logs, l)
	}
	return logs, nil
}

// ── Notifications & Escalations ──────────────────────────────────────────────

func (r *postgresCalendarRepo) HasNotificationBeenSent(ctx context.Context, tenderID string, checklistID *string, notifType string) (bool, error) {
	var count int
	var err error
	if checklistID != nil {
		err = r.db.QueryRow(ctx, `
			SELECT COUNT(*) FROM calendar.task_notifications
			WHERE tender_id = $1 AND checklist_id = $2 AND notification_type = $3
		`, tenderID, *checklistID, notifType).Scan(&count)
	} else {
		err = r.db.QueryRow(ctx, `
			SELECT COUNT(*) FROM calendar.task_notifications
			WHERE tender_id = $1 AND checklist_id IS NULL AND notification_type = $2
		`, tenderID, notifType).Scan(&count)
	}
	return count > 0, err
}

func (r *postgresCalendarRepo) HasRedZoneNotificationBeenSent(ctx context.Context, tenderID string, deadline time.Time) (bool, error) {
	var count int
	var err error
	if !deadline.IsZero() {
		// Only consider it sent if recorded within ±24 hours of the calculated 3-working-day deadline.
		// If tender due date was extended/changed, previous deadlines will not block the new deadline alert.
		windowStart := deadline.Add(-24 * time.Hour)
		windowEnd := deadline.Add(24 * time.Hour)
		err = r.db.QueryRow(ctx, `
			SELECT COUNT(*) FROM calendar.task_notifications
			WHERE tender_id = $1 
			  AND notification_type IN ('RED_ZONE_72H', '72_HOUR_REMINDER')
			  AND delivery_status = 'SENT'
			  AND scheduled_at >= $2
			  AND scheduled_at <= $3
		`, tenderID, windowStart, windowEnd).Scan(&count)
	} else {
		err = r.db.QueryRow(ctx, `
			SELECT COUNT(*) FROM calendar.task_notifications
			WHERE tender_id = $1 
			  AND notification_type IN ('RED_ZONE_72H', '72_HOUR_REMINDER')
			  AND delivery_status = 'SENT'
		`, tenderID).Scan(&count)
	}
	return count > 0, err
}

func (r *postgresCalendarRepo) RecordNotification(ctx context.Context, notif *domain.TaskNotification) error {
	var query string
	if notif.ChecklistID == nil {
		query = `
			INSERT INTO calendar.task_notifications (
				tender_id, checklist_id, recipient_user_id, recipient_role, notification_type,
				scheduled_at, triggered_at, sent_at, delivery_status, subject, message,
				error_message, retry_count
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
			ON CONFLICT (tender_id, recipient_user_id, notification_type) WHERE checklist_id IS NULL
			DO UPDATE SET
				recipient_role = EXCLUDED.recipient_role,
				scheduled_at = EXCLUDED.scheduled_at,
				triggered_at = EXCLUDED.triggered_at,
				sent_at = EXCLUDED.sent_at,
				delivery_status = EXCLUDED.delivery_status,
				subject = EXCLUDED.subject,
				message = EXCLUDED.message,
				error_message = EXCLUDED.error_message,
				retry_count = EXCLUDED.retry_count
		`
	} else {
		query = `
			INSERT INTO calendar.task_notifications (
				tender_id, checklist_id, recipient_user_id, recipient_role, notification_type,
				scheduled_at, triggered_at, sent_at, delivery_status, subject, message,
				error_message, retry_count
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
			ON CONFLICT (tender_id, checklist_id, recipient_user_id, notification_type) WHERE checklist_id IS NOT NULL
			DO UPDATE SET
				recipient_role = EXCLUDED.recipient_role,
				scheduled_at = EXCLUDED.scheduled_at,
				triggered_at = EXCLUDED.triggered_at,
				sent_at = EXCLUDED.sent_at,
				delivery_status = EXCLUDED.delivery_status,
				subject = EXCLUDED.subject,
				message = EXCLUDED.message,
				error_message = EXCLUDED.error_message,
				retry_count = EXCLUDED.retry_count
		`
	}

	_, err := r.db.Exec(ctx, query,
		notif.TenderID, notif.ChecklistID, notif.RecipientUserID, notif.RecipientRole, notif.NotificationType,
		notif.ScheduledAt, notif.TriggeredAt, notif.SentAt, notif.DeliveryStatus,
		notif.Subject, notif.Message, notif.ErrorMessage, notif.RetryCount)
	if err != nil {
		// Fallback without ON CONFLICT if constraints are older
		fallbackQuery := `
			INSERT INTO calendar.task_notifications (
				tender_id, checklist_id, recipient_user_id, notification_type,
				scheduled_at, triggered_at, sent_at, delivery_status, subject, message,
				error_message, retry_count
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		`
		_, err = r.db.Exec(ctx, fallbackQuery,
			notif.TenderID, notif.ChecklistID, notif.RecipientUserID, notif.NotificationType,
			notif.ScheduledAt, notif.TriggeredAt, notif.SentAt, notif.DeliveryStatus,
			notif.Subject, notif.Message, notif.ErrorMessage, notif.RetryCount)
	}
	return err
}

func (r *postgresCalendarRepo) ListNotificationsByTender(ctx context.Context, tenderID string) ([]domain.TaskNotification, error) {
	rows, err := r.db.Query(ctx, `
		SELECT n.id, n.tender_id, n.checklist_id, n.recipient_user_id, u.full_name, u.email,
		       COALESCE(n.recipient_role, ''), n.notification_type, n.scheduled_at, n.triggered_at, 
		       n.sent_at, n.delivery_status, n.subject, n.message, n.error_message, n.retry_count, n.created_at
		FROM calendar.task_notifications n
		LEFT JOIN auth.users u ON n.recipient_user_id = u.id
		WHERE n.tender_id = $1
		ORDER BY n.created_at DESC
	`, tenderID)
	if err != nil {
		// Fallback without recipient_role
		rows, err = r.db.Query(ctx, `
			SELECT n.id, n.tender_id, n.checklist_id, n.recipient_user_id, u.full_name, u.email,
			       '', n.notification_type, n.scheduled_at, n.triggered_at, 
			       n.sent_at, n.delivery_status, n.subject, n.message, n.error_message, n.retry_count, n.created_at
			FROM calendar.task_notifications n
			LEFT JOIN auth.users u ON n.recipient_user_id = u.id
			WHERE n.tender_id = $1
			ORDER BY n.created_at DESC
		`, tenderID)
		if err != nil {
			return nil, err
		}
	}
	defer rows.Close()

	var notifs []domain.TaskNotification
	for rows.Next() {
		var n domain.TaskNotification
		var clID, rName, rEmail, rRole, errStr sql.NullString
		var sentAt sql.NullTime
		if err := rows.Scan(&n.ID, &n.TenderID, &clID, &n.RecipientUserID, &rName, &rEmail,
			&rRole, &n.NotificationType, &n.ScheduledAt, &n.TriggeredAt, &sentAt, &n.DeliveryStatus,
			&n.Subject, &n.Message, &errStr, &n.RetryCount, &n.CreatedAt); err != nil {
			return nil, err
		}
		if clID.Valid {
			n.ChecklistID = &clID.String
		}
		if rName.Valid {
			n.RecipientName = &rName.String
		}
		if rEmail.Valid {
			n.RecipientEmail = &rEmail.String
		}
		if rRole.Valid && rRole.String != "" {
			n.RecipientRole = &rRole.String
		}
		if sentAt.Valid {
			n.SentAt = &sentAt.Time
		}
		if errStr.Valid {
			n.ErrorMessage = &errStr.String
		}
		notifs = append(notifs, n)
	}
	return notifs, nil
}

func (r *postgresCalendarRepo) HasEscalationBeenSent(ctx context.Context, tenderID string, checklistID *string) (bool, error) {
	var count int
	var err error
	if checklistID != nil {
		err = r.db.QueryRow(ctx, `
			SELECT COUNT(*) FROM calendar.task_escalations
			WHERE tender_id = $1 AND checklist_id = $2
		`, tenderID, *checklistID).Scan(&count)
	} else {
		err = r.db.QueryRow(ctx, `
			SELECT COUNT(*) FROM calendar.task_escalations
			WHERE tender_id = $1 AND checklist_id IS NULL
		`, tenderID).Scan(&count)
	}
	return count > 0, err
}

func (r *postgresCalendarRepo) RecordEscalation(ctx context.Context, esc *domain.TaskEscalation) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO calendar.task_escalations (
			tender_id, checklist_id, manager_user_id, escalation_reason, escalated_at, status
		) VALUES ($1, $2, $3, $4, $5, $6)
	`, esc.TenderID, esc.ChecklistID, esc.ManagerUserID, esc.EscalationReason, esc.EscalatedAt, esc.Status)
	return err
}

func (r *postgresCalendarRepo) ListEscalationsByTender(ctx context.Context, tenderID string) ([]domain.TaskEscalation, error) {
	rows, err := r.db.Query(ctx, `
		SELECT e.id, e.tender_id, e.checklist_id, e.manager_user_id, u.full_name, u.email,
		       e.escalation_reason, e.escalated_at, e.status, e.created_at
		FROM calendar.task_escalations e
		LEFT JOIN auth.users u ON e.manager_user_id = u.id
		WHERE e.tender_id = $1
		ORDER BY e.created_at DESC
	`, tenderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var escs []domain.TaskEscalation
	for rows.Next() {
		var e domain.TaskEscalation
		var clID, mName, mEmail sql.NullString
		if err := rows.Scan(&e.ID, &e.TenderID, &clID, &e.ManagerUserID, &mName, &mEmail,
			&e.EscalationReason, &e.EscalatedAt, &e.Status, &e.CreatedAt); err != nil {
			return nil, err
		}
		if clID.Valid {
			e.ChecklistID = &clID.String
		}
		if mName.Valid {
			e.ManagerName = &mName.String
		}
		if mEmail.Valid {
			e.ManagerEmail = &mEmail.String
		}
		escs = append(escs, e)
	}
	return escs, nil
}

// ── Checklist & Tender Deadline Queries ──────────────────────────────────────

func (r *postgresCalendarRepo) GetNextPendingChecklist(ctx context.Context, tenderID string) (*domain.NextActionableTask, error) {
	// Section 14 & 15: Select the highest-priority actionable item (HIGH > MEDIUM > LOW),
	// ordered by sequence/sort_order, ignoring completed/cancelled items.
	row := r.db.QueryRow(ctx, `
		SELECT c.id, c.title, c.priority, c.assigned_to, u.full_name, c.assigned_role,
		       c.sort_order, c.due_at, c.status
		FROM bid.bid_checklists c
		LEFT JOIN auth.users u ON c.assigned_to = u.id
		WHERE c.bid_id = $1
		  AND c.is_done = false
		  AND c.status NOT IN ('COMPLETED', 'CANCELLED')
		ORDER BY
		    CASE c.priority
		        WHEN 'HIGH' THEN 1
		        WHEN 'MEDIUM' THEN 2
		        WHEN 'LOW' THEN 3
		        ELSE 4
		    END ASC,
		    c.sort_order ASC,
		    c.created_at ASC
		LIMIT 1
	`, tenderID)

	var t domain.NextActionableTask
	var assignedTo, assignedName, assignedRole sql.NullString
	var dueAt sql.NullTime

	err := row.Scan(&t.ChecklistID, &t.Title, &t.Priority, &assignedTo, &assignedName,
		&assignedRole, &t.SortOrder, &dueAt, &t.Status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if assignedTo.Valid {
		t.AssignedToID = &assignedTo.String
	}
	if assignedName.Valid {
		t.AssignedToName = &assignedName.String
	}
	if assignedRole.Valid {
		t.AssignedRole = &assignedRole.String
	}
	if dueAt.Valid {
		t.DueAt = &dueAt.Time
	}
	return &t, nil
}

func (r *postgresCalendarRepo) UpdateChecklistPriorityAndAssignment(ctx context.Context, checklistID string, req *domain.UpdateChecklistPriorityRequest) error {
	query := "UPDATE bid.bid_checklists SET priority = $2"
	args := []interface{}{checklistID, req.Priority}

	argIdx := 3
	if req.AssignedToID != nil {
		query += fmt.Sprintf(", assigned_to = $%d", argIdx)
		args = append(args, *req.AssignedToID)
		argIdx++
	}
	if req.AssignedRole != nil {
		query += fmt.Sprintf(", assigned_role = $%d", argIdx)
		args = append(args, *req.AssignedRole)
		argIdx++
	}
	if req.Status != nil {
		query += fmt.Sprintf(", status = $%d", argIdx)
		args = append(args, *req.Status)
		argIdx++
	}

	query += fmt.Sprintf(" WHERE id = $1")
	_, err := r.db.Exec(ctx, query, args...)
	return err
}

func (r *postgresCalendarRepo) MarkChecklistDelayed(ctx context.Context, checklistID string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE bid.bid_checklists
		SET status = 'DELAYED'
		WHERE id = $1 AND is_done = false AND status != 'COMPLETED'
	`, checklistID)
	return err
}

func (r *postgresCalendarRepo) UpdateTenderDeadlineCache(ctx context.Context, tenderID string, deadline time.Time, remainingHours float64) error {
	_, err := r.db.Exec(ctx, `
		UPDATE bid.bid_workspaces
		SET calculated_72h_deadline = $2,
		    deadline_remaining_working_hours = $3,
		    deadline_last_computed_at = NOW()
		WHERE id = $1
	`, tenderID, deadline, remainingHours)
	return err
}

func (r *postgresCalendarRepo) GetActiveTendersForDeadlineCheck(ctx context.Context) ([]domain.TenderDeadlineCandidate, error) {
	rows, err := r.db.Query(ctx, `
		SELECT b.id, b.title, b.bid_no, b.gem_bid_no, b.workflow_stage, 
		       COALESCE(b.closing_date, b.end_date) AS closing_date,
		       b.calendar_id, b.bid_owner_id, b.reporting_manager_id,
		       b.account_manager_id, b.presales_id,
		       u_owner.email, u_owner.full_name,
		       u_mgr.email, u_mgr.full_name,
		       b.organization_name, b.department_name, b.estimated_value
		FROM bid.bid_workspaces b
		LEFT JOIN auth.users u_owner ON b.bid_owner_id = u_owner.id
		LEFT JOIN auth.users u_mgr ON b.reporting_manager_id = u_mgr.id
		WHERE b.bid_status = 'ACTIVE'
		  AND b.archived_at IS NULL
		  AND (b.closing_date IS NOT NULL OR b.end_date IS NOT NULL)
		  AND b.workflow_stage NOT IN ('WON', 'LOST', 'CANCELLED', 'AWARD_HANDOVER')
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var candidates []domain.TenderDeadlineCandidate
	for rows.Next() {
		var c domain.TenderDeadlineCandidate
		var bidNo, gemBidNo, calID, rmMgrID, amID, psID, ownerEmail, ownerName, mgrEmail, mgrName sql.NullString
		var orgName, deptName sql.NullString
		var estVal sql.NullFloat64
		if err := rows.Scan(&c.ID, &c.Title, &bidNo, &gemBidNo, &c.WorkflowStage, &c.ClosingDate,
			&calID, &c.BidOwnerID, &rmMgrID, &amID, &psID,
			&ownerEmail, &ownerName, &mgrEmail, &mgrName,
			&orgName, &deptName, &estVal); err != nil {
			return nil, err
		}
		if bidNo.Valid {
			c.BidNo = &bidNo.String
		}
		if gemBidNo.Valid {
			c.GemBidNo = &gemBidNo.String
		}
		if calID.Valid {
			c.CalendarID = &calID.String
		}
		if rmMgrID.Valid {
			c.ReportingManagerID = &rmMgrID.String
		}
		if amID.Valid {
			c.AccountManagerID = &amID.String
		}
		if psID.Valid {
			c.PresalesID = &psID.String
		}
		if ownerEmail.Valid {
			c.BidOwnerEmail = &ownerEmail.String
		}
		if ownerName.Valid {
			c.BidOwnerName = &ownerName.String
		}
		if mgrEmail.Valid {
			c.ManagerEmail = &mgrEmail.String
		}
		if mgrName.Valid {
			c.ManagerName = &mgrName.String
		}
		if orgName.Valid {
			c.OrganizationName = &orgName.String
		}
		if deptName.Valid {
			c.DepartmentName = &deptName.String
		}
		if estVal.Valid {
			c.EstimatedValue = &estVal.Float64
		}
		candidates = append(candidates, c)
	}
	return candidates, nil
}

func (r *postgresCalendarRepo) GetTenderStakeholders(ctx context.Context, tenderID string) ([]domain.TenderStakeholder, error) {
	rows, err := r.db.Query(ctx, `
		WITH raw_stakeholders AS (
			-- 1. Tender Bid Owner
			SELECT b.bid_owner_id AS user_id, 'Bid Owner' AS role_name
			FROM bid.bid_workspaces b
			WHERE b.id = $1 AND b.bid_owner_id IS NOT NULL

			UNION ALL

			-- 2. Tender Creator
			SELECT b.created_by AS user_id, 'Tender Creator' AS role_name
			FROM bid.bid_workspaces b
			WHERE b.id = $1 AND b.created_by IS NOT NULL

			UNION ALL

			-- 3. Reporting Manager
			SELECT b.reporting_manager_id AS user_id, 'Reporting Manager' AS role_name
			FROM bid.bid_workspaces b
			WHERE b.id = $1 AND b.reporting_manager_id IS NOT NULL

			UNION ALL

			-- 4. Account Manager
			SELECT b.account_manager_id AS user_id, 'Account Manager' AS role_name
			FROM bid.bid_workspaces b
			WHERE b.id = $1 AND b.account_manager_id IS NOT NULL

			UNION ALL

			-- 5. Pre-Sales Executive
			SELECT b.presales_id AS user_id, 'Pre-Sales' AS role_name
			FROM bid.bid_workspaces b
			WHERE b.id = $1 AND b.presales_id IS NOT NULL

			UNION ALL

			-- 6. Team Workspace Members
			SELECT m.user_id,
				   CASE 
					   WHEN m.role = 'OWNER' THEN 'Bid Owner'
					   WHEN m.role = 'MANAGER' THEN 'Bid Manager'
					   WHEN m.role = 'ACCOUNT_MANAGER' THEN 'Account Manager'
					   WHEN m.role = 'PRESALES' THEN 'Pre-Sales'
					   WHEN m.role = 'REVIEWER' THEN 'Reviewer'
					   WHEN m.role = 'OBSERVER' THEN 'Observer'
					   ELSE 'Team Member'
				   END AS role_name
			FROM bid.bid_workspace_members m
			WHERE m.bid_id = $1 AND m.user_id IS NOT NULL

			UNION ALL

			-- 7. Assigned Checklist Task Owners
			SELECT c.assigned_to AS user_id, 'Task Assignee' AS role_name
			FROM bid.bid_checklists c
			WHERE c.bid_id = $1 AND c.assigned_to IS NOT NULL
		)
		SELECT u.id, 
		       COALESCE(NULLIF(TRIM(u.full_name), ''), u.username) AS full_name, 
		       u.email, 
		       COALESCE(string_agg(DISTINCT s.role_name, ', '), 'Stakeholder') AS roles
		FROM raw_stakeholders s
		JOIN auth.users u ON s.user_id = u.id
		WHERE u.is_active = true 
		  AND u.email IS NOT NULL 
		  AND TRIM(u.email) != ''
		GROUP BY u.id, u.full_name, u.username, u.email
		ORDER BY full_name ASC
	`, tenderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stakeholders []domain.TenderStakeholder
	for rows.Next() {
		var s domain.TenderStakeholder
		if err := rows.Scan(&s.UserID, &s.FullName, &s.Email, &s.Roles); err != nil {
			return nil, err
		}
		stakeholders = append(stakeholders, s)
	}
	return stakeholders, nil
}
