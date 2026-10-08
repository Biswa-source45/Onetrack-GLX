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

const calendarCols = `id, name, description, is_default, timezone, working_start_time, working_end_time,
	saturday_1_working, saturday_2_working, saturday_3_working, saturday_4_working, saturday_5_working,
	sunday_working, monday_working, tuesday_working, wednesday_working, thursday_working, friday_working,
	deadline_trigger_value, deadline_trigger_unit, scheduler_interval_value, created_at, updated_at`

func (r *postgresCalendarRepo) GetDefaultCalendar(ctx context.Context) (*domain.WorkingCalendar, error) {
	return r.scanCalendar(r.db.QueryRow(ctx, `SELECT `+calendarCols+` FROM calendar.working_calendars WHERE is_default = true LIMIT 1`))
}

func (r *postgresCalendarRepo) GetCalendarByID(ctx context.Context, id string) (*domain.WorkingCalendar, error) {
	return r.scanCalendar(r.db.QueryRow(ctx, `SELECT `+calendarCols+` FROM calendar.working_calendars WHERE id = $1`, id))
}

func (r *postgresCalendarRepo) ListCalendars(ctx context.Context) ([]domain.WorkingCalendar, error) {
	rows, err := r.db.Query(ctx, `SELECT `+calendarCols+` FROM calendar.working_calendars ORDER BY is_default DESC, name ASC`)
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
	return calendars, rows.Err()
}

// UpdateCalendar applies a partial update: nil request fields keep the stored value.
func (r *postgresCalendarRepo) UpdateCalendar(ctx context.Context, id string, req *domain.UpdateCalendarRequest) (*domain.WorkingCalendar, error) {
	_, err := r.db.Exec(ctx, `
		UPDATE calendar.working_calendars
		SET name = COALESCE($2, name), description = COALESCE($3, description),
		    working_start_time = COALESCE($4, working_start_time), working_end_time = COALESCE($5, working_end_time),
		    saturday_1_working = COALESCE($6, saturday_1_working), saturday_2_working = COALESCE($7, saturday_2_working),
		    saturday_3_working = COALESCE($8, saturday_3_working), saturday_4_working = COALESCE($9, saturday_4_working),
		    saturday_5_working = COALESCE($10, saturday_5_working), sunday_working = COALESCE($11, sunday_working),
		    monday_working = COALESCE($12, monday_working), tuesday_working = COALESCE($13, tuesday_working),
		    wednesday_working = COALESCE($14, wednesday_working), thursday_working = COALESCE($15, thursday_working),
		    friday_working = COALESCE($16, friday_working),
		    deadline_trigger_value = COALESCE($17, deadline_trigger_value),
		    deadline_trigger_unit = COALESCE($18, deadline_trigger_unit),
		    scheduler_interval_value = COALESCE($19, scheduler_interval_value),
		    updated_at = NOW()
		WHERE id = $1
	`, id, req.Name, req.Description, req.WorkingStartTime, req.WorkingEndTime,
		req.Saturday1Working, req.Saturday2Working, req.Saturday3Working, req.Saturday4Working, req.Saturday5Working,
		req.SundayWorking, req.MondayWorking, req.TuesdayWorking, req.WednesdayWorking, req.ThursdayWorking, req.FridayWorking,
		req.DeadlineTriggerValue, req.DeadlineTriggerUnit, req.SchedulerIntervalValue)
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
		&c.DeadlineTriggerValue, &c.DeadlineTriggerUnit, &c.SchedulerIntervalValue,
		&c.CreatedAt, &c.UpdatedAt,
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

const holidayCols = `id, calendar_id, holiday_date::text, holiday_name, holiday_type, working_status,
	priority, source, source_event_id, source_calendar_id, is_admin_override, is_active,
	description, created_by, updated_by, created_at, updated_at, last_synced_at`

// ListHolidays orders so the first row of a date is the one that applies:
// admin-created first, then HIGH priority, then id (deterministic).
func (r *postgresCalendarRepo) ListHolidays(ctx context.Context, calendarID string, year int) ([]domain.Holiday, error) {
	query := `SELECT ` + holidayCols + ` FROM calendar.holidays WHERE calendar_id = $1`
	args := []interface{}{calendarID}
	if year > 0 {
		query += ` AND EXTRACT(YEAR FROM holiday_date) = $2`
		args = append(args, year)
	}
	query += ` ORDER BY holiday_date ASC, is_admin_override DESC, (source = 'ADMIN') DESC,
		CASE priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, id`

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
	return holidays, rows.Err()
}

func (r *postgresCalendarRepo) GetHolidayByID(ctx context.Context, id string) (*domain.Holiday, error) {
	return r.scanHoliday(r.db.QueryRow(ctx, `SELECT `+holidayCols+` FROM calendar.holidays WHERE id = $1`, id))
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
	// An admin edit of any imported or manual holiday protects it from later syncs.
	_, err := r.db.Exec(ctx, `
		UPDATE calendar.holidays
		SET holiday_name = COALESCE($2, holiday_name),
		    holiday_type = COALESCE($3, holiday_type),
		    working_status = COALESCE($4, working_status),
		    priority = COALESCE($5, priority),
		    is_active = COALESCE($6, is_active),
		    description = COALESCE($7, description),
		    is_admin_override = true,
		    updated_by = NULLIF($8, '')::uuid,
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

// UpsertGoogleHolidays never touches a date an admin owns: admin-created rows
// (source ADMIN) and any row an admin has edited (is_admin_override) are skipped.
func (r *postgresCalendarRepo) UpsertGoogleHolidays(ctx context.Context, calendarID string, holidays []domain.Holiday) (*domain.SyncResult, error) {
	res := &domain.SyncResult{Status: "SUCCESS"}
	now := time.Now().UTC()

	for _, h := range holidays {
		var existingID, source string
		var isAdminOverride bool
		err := r.db.QueryRow(ctx, `
			SELECT id, is_admin_override, source FROM calendar.holidays
			WHERE calendar_id = $1 AND holiday_date = $2::date
			ORDER BY is_admin_override DESC, (source <> $3) DESC, id
			LIMIT 1
		`, calendarID, h.HolidayDate, domain.SourceGoogleCalendar).Scan(&existingID, &isAdminOverride, &source)

		switch {
		case errors.Is(err, pgx.ErrNoRows):
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
		case err != nil:
			res.FailedCount++
		case isAdminOverride || source != domain.SourceGoogleCalendar:
			res.SkippedCount++
		default:
			_, err = r.db.Exec(ctx, `
				UPDATE calendar.holidays
				SET holiday_name = $2, holiday_type = $3, working_status = $4, priority = $5,
				    source_event_id = $6, source_calendar_id = $7,
				    description = $8, last_synced_at = $9, updated_at = NOW()
				WHERE id = $1
			`, existingID, h.HolidayName, h.HolidayType, h.WorkingStatus, h.Priority,
				h.SourceEventID, h.SourceCalendarID, h.Description, now)
			if err != nil {
				res.FailedCount++
			} else {
				res.UpdatedCount++
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
	return exceptions, rows.Err()
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
	_, err := r.db.Exec(ctx, `
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
	`, g.CalendarID, g.GoogleCalendarID, g.GoogleCalendarName, g.APIKey,
		g.SyncEnabled, g.SyncIntervalHours, g.LastSyncAt, g.SyncStatus, g.LastError)
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
	return logs, rows.Err()
}

// ── Notifications ────────────────────────────────────────────────────────────

// HasRedZoneNotificationBeenSent reports a notification row (sent, failed or
// baseline) within ±24h of this deadline, so an extended closing date alerts afresh.
func (r *postgresCalendarRepo) HasRedZoneNotificationBeenSent(ctx context.Context, tenderID string, deadline time.Time) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM calendar.task_notifications
			WHERE tender_id = $1 AND notification_type = $2
			  AND scheduled_at BETWEEN $3 AND $4
		)
	`, tenderID, domain.NotificationTypeRedZoneDueDate, deadline.Add(-24*time.Hour), deadline.Add(24*time.Hour)).Scan(&exists)
	return exists, err
}

// ClaimNotification inserts the dedup row before anything is sent. It returns
// the row id, or "" when a row for the same deadline (±24h) already exists;
// force re-claims regardless.
func (r *postgresCalendarRepo) ClaimNotification(ctx context.Context, n *domain.TaskNotification, force bool) (string, error) {
	var id string
	err := r.db.QueryRow(ctx, `
		INSERT INTO calendar.task_notifications (
			tender_id, recipient_user_id, recipient_role, notification_type,
			scheduled_at, triggered_at, sent_at, delivery_status, subject, message
		) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), 'SENT', $6, $7)
		ON CONFLICT (tender_id, recipient_user_id, notification_type) WHERE checklist_id IS NULL
		DO UPDATE SET
			recipient_role = EXCLUDED.recipient_role,
			scheduled_at = EXCLUDED.scheduled_at,
			triggered_at = NOW(),
			sent_at = NOW(),
			delivery_status = 'SENT',
			subject = EXCLUDED.subject,
			message = EXCLUDED.message,
			error_message = NULL
		WHERE $8::boolean
		   OR ABS(EXTRACT(EPOCH FROM (calendar.task_notifications.scheduled_at - EXCLUDED.scheduled_at))) > 86400
		RETURNING id
	`, n.TenderID, n.RecipientUserID, n.RecipientRole, n.NotificationType, n.ScheduledAt, n.Subject, n.Message, force).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return id, err
}

func (r *postgresCalendarRepo) ReleaseNotification(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM calendar.task_notifications WHERE id = $1`, id)
	return err
}

func (r *postgresCalendarRepo) ListNotificationsByTender(ctx context.Context, tenderID string) ([]domain.TaskNotification, error) {
	rows, err := r.db.Query(ctx, `
		SELECT n.id, n.tender_id, n.recipient_user_id, u.full_name, u.email,
		       COALESCE(n.recipient_role, ''), n.notification_type, n.scheduled_at, n.triggered_at,
		       n.sent_at, n.delivery_status, n.subject, n.message, n.error_message, n.created_at
		FROM calendar.task_notifications n
		LEFT JOIN auth.users u ON n.recipient_user_id = u.id
		WHERE n.tender_id = $1
		ORDER BY n.created_at DESC
	`, tenderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notifs []domain.TaskNotification
	for rows.Next() {
		var n domain.TaskNotification
		var rName, rEmail, rRole, errStr sql.NullString
		var sentAt sql.NullTime
		if err := rows.Scan(&n.ID, &n.TenderID, &n.RecipientUserID, &rName, &rEmail,
			&rRole, &n.NotificationType, &n.ScheduledAt, &n.TriggeredAt, &sentAt, &n.DeliveryStatus,
			&n.Subject, &n.Message, &errStr, &n.CreatedAt); err != nil {
			return nil, err
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
	return notifs, rows.Err()
}

// ── Engine baseline & evaluation lock ────────────────────────────────────────

func (r *postgresCalendarRepo) IsEngineBaselined(ctx context.Context) (bool, error) {
	var done bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM calendar.engine_baseline)`).Scan(&done)
	return done, err
}

func (r *postgresCalendarRepo) MarkEngineBaselined(ctx context.Context) error {
	_, err := r.db.Exec(ctx, `INSERT INTO calendar.engine_baseline DEFAULT VALUES ON CONFLICT DO NOTHING`)
	return err
}

const evaluationLockKey = 7261726172 // arbitrary app-wide advisory lock id

// TryLockEvaluation takes a session advisory lock on a dedicated connection so
// only one instance evaluates at a time; the lock also dies with the connection.
func (r *postgresCalendarRepo) TryLockEvaluation(ctx context.Context) (func(), bool, error) {
	conn, err := r.db.Acquire(ctx)
	if err != nil {
		return nil, false, err
	}
	var ok bool
	if err := conn.QueryRow(ctx, `SELECT pg_try_advisory_lock($1)`, evaluationLockKey).Scan(&ok); err != nil || !ok {
		conn.Release()
		return nil, false, err
	}
	return func() {
		uctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, _ = conn.Exec(uctx, `SELECT pg_advisory_unlock($1)`, evaluationLockKey)
		conn.Release()
	}, true, nil
}

// ── Checklist & Tender Deadline Queries ──────────────────────────────────────

func (r *postgresCalendarRepo) GetNextPendingChecklist(ctx context.Context, tenderID string) (*domain.NextActionableTask, error) {
	// Highest-priority open item (HIGH > MEDIUM > LOW), then sort order.
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

	if req.AssignedToID != nil {
		args = append(args, *req.AssignedToID)
		query += fmt.Sprintf(", assigned_to = $%d", len(args))
	}
	if req.AssignedRole != nil {
		args = append(args, *req.AssignedRole)
		query += fmt.Sprintf(", assigned_role = $%d", len(args))
	}

	_, err := r.db.Exec(ctx, query+" WHERE id = $1", args...)
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

// candidateSelect is the eligibility rule for deadline tracking. A tender that
// the app already counts as submitted (derivedStatusExpr in the bid repository:
// submission stages, submission_done, submission_status) or resolved is excluded.
const candidateSelect = `
	SELECT b.id, b.title, b.bid_no, b.gem_bid_no, b.workflow_stage,
	       COALESCE(b.closing_date, b.end_date) AS closing_date, b.calendar_id,
	       b.organization_name, b.department_name,
	       b.calculated_72h_deadline, b.deadline_remaining_working_hours
	FROM bid.bid_workspaces b
	WHERE b.bid_status = 'ACTIVE'
	  AND b.archived_at IS NULL
	  AND b.bid_outcome IS NULL
	  AND COALESCE(b.closing_date, b.end_date) IS NOT NULL
	  AND b.workflow_stage NOT IN ('WON', 'LOST', 'CANCELLED', 'GEM_SUBMISSION', 'TECHNICAL_EVALUATION', 'FINANCIAL_EVALUATION', 'AWARD_HANDOVER')
	  AND b.submission_done = false
	  AND COALESCE(b.submission_status, '') <> 'SUBMITTED'
	  AND COALESCE(b.technical_result, '') <> 'DISQUALIFIED'`

func (r *postgresCalendarRepo) GetActiveTendersForDeadlineCheck(ctx context.Context, from, to time.Time) ([]domain.TenderDeadlineCandidate, error) {
	rows, err := r.db.Query(ctx, candidateSelect+`
	  AND COALESCE(b.closing_date, b.end_date) > $1 AND COALESCE(b.closing_date, b.end_date) <= $2
	ORDER BY closing_date ASC`, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var candidates []domain.TenderDeadlineCandidate
	for rows.Next() {
		c, err := scanCandidate(rows)
		if err != nil {
			return nil, err
		}
		candidates = append(candidates, *c)
	}
	return candidates, rows.Err()
}

func (r *postgresCalendarRepo) GetTenderCandidate(ctx context.Context, tenderID string) (*domain.TenderDeadlineCandidate, error) {
	c, err := scanCandidate(r.db.QueryRow(ctx, candidateSelect+` AND b.id = $1`, tenderID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return c, err
}

func scanCandidate(row pgx.Row) (*domain.TenderDeadlineCandidate, error) {
	var c domain.TenderDeadlineCandidate
	var bidNo, gemBidNo, calID, orgName, deptName sql.NullString
	var cachedDeadline sql.NullTime
	var cachedHours sql.NullFloat64
	if err := row.Scan(&c.ID, &c.Title, &bidNo, &gemBidNo, &c.WorkflowStage, &c.ClosingDate, &calID,
		&orgName, &deptName, &cachedDeadline, &cachedHours); err != nil {
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
	if orgName.Valid {
		c.OrganizationName = &orgName.String
	}
	if deptName.Valid {
		c.DepartmentName = &deptName.String
	}
	if cachedDeadline.Valid {
		c.CachedDeadline = &cachedDeadline.Time
	}
	if cachedHours.Valid {
		c.CachedRemainingHours = &cachedHours.Float64
	}
	return &c, nil
}

func (r *postgresCalendarRepo) GetTenderStakeholders(ctx context.Context, tenderID string) ([]domain.TenderStakeholder, error) {
	rows, err := r.db.Query(ctx, `
		WITH raw_stakeholders AS (
			SELECT b.bid_owner_id AS user_id, 'Bid Owner' AS role_name
			FROM bid.bid_workspaces b WHERE b.id = $1 AND b.bid_owner_id IS NOT NULL

			UNION ALL
			SELECT b.created_by, 'Tender Creator'
			FROM bid.bid_workspaces b WHERE b.id = $1 AND b.created_by IS NOT NULL

			UNION ALL
			SELECT b.reporting_manager_id, 'Reporting Manager'
			FROM bid.bid_workspaces b WHERE b.id = $1 AND b.reporting_manager_id IS NOT NULL

			UNION ALL
			SELECT b.account_manager_id, 'Account Manager'
			FROM bid.bid_workspaces b WHERE b.id = $1 AND b.account_manager_id IS NOT NULL

			UNION ALL
			SELECT b.presales_id, 'Pre-Sales'
			FROM bid.bid_workspaces b WHERE b.id = $1 AND b.presales_id IS NOT NULL

			UNION ALL
			SELECT m.user_id,
			       CASE
			           WHEN m.role = 'OWNER' THEN 'Bid Owner'
			           WHEN m.role = 'MANAGER' THEN 'Bid Manager'
			           WHEN m.role = 'ACCOUNT_MANAGER' THEN 'Account Manager'
			           WHEN m.role = 'PRESALES' THEN 'Pre-Sales'
			           WHEN m.role = 'REVIEWER' THEN 'Reviewer'
			           WHEN m.role = 'OBSERVER' THEN 'Observer'
			           ELSE 'Team Member'
			       END
			FROM bid.bid_workspace_members m WHERE m.bid_id = $1 AND m.user_id IS NOT NULL

			UNION ALL
			SELECT c.assigned_to, 'Task Assignee'
			FROM bid.bid_checklists c WHERE c.bid_id = $1 AND c.assigned_to IS NOT NULL
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
	return stakeholders, rows.Err()
}
