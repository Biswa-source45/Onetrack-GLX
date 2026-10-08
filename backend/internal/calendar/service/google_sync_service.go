package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/onetrack/backend/internal/calendar/domain"
	systemlogDomain "github.com/onetrack/backend/internal/systemlog/domain"
)

const googleAPIBase = "https://www.googleapis.com/calendar/v3"

type googleSyncService struct {
	repo       domain.WorkingCalendarRepository
	systemLog  systemlogDomain.Recorder
	httpClient *http.Client
	baseURL    string
	envAPIKey  string // GOOGLE_CALENDAR_API_KEY; wins over a key stored in the DB
	now        func() time.Time
}

func NewGoogleSyncService(
	repo domain.WorkingCalendarRepository,
	systemLog systemlogDomain.Recorder,
	envAPIKey string,
) domain.GoogleSyncService {
	return &googleSyncService{
		repo:       repo,
		systemLog:  systemLog,
		httpClient: &http.Client{Timeout: 15 * time.Second},
		baseURL:    googleAPIBase,
		envAPIKey:  envAPIKey,
		now:        time.Now,
	}
}

// Google Calendar API v3 event representation
type googleEventsResponse struct {
	Items []struct {
		ID          string `json:"id"`
		Summary     string `json:"summary"`
		Description string `json:"description"`
		Start       struct {
			Date     string `json:"date"`     // YYYY-MM-DD
			DateTime string `json:"dateTime"` // RFC3339
		} `json:"start"`
	} `json:"items"`
}

func (s *googleSyncService) SyncHolidays(ctx context.Context, calendarID string, actorID *string) (*domain.SyncResult, error) {
	integration, err := s.repo.GetGoogleIntegration(ctx, calendarID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve google calendar integration config: %w", err)
	}
	if integration == nil {
		integration, err = s.repo.SaveGoogleIntegration(ctx, domain.DefaultIntegration(calendarID))
		if err != nil {
			return nil, err
		}
	}

	// From the start of last year to the end of year+2.
	year := s.now().UTC().Year()
	timeMin := time.Date(year-1, 1, 1, 0, 0, 0, 0, time.UTC).Format(time.RFC3339)
	timeMax := time.Date(year+2, 12, 31, 23, 59, 59, 0, time.UTC).Format(time.RFC3339)

	holidays, fetchErr := s.fetchHolidays(ctx, integration, timeMin, timeMax)
	if fetchErr != nil {
		// Existing holidays stay authoritative; nothing is invented on failure.
		errStr := fetchErr.Error()
		log.Printf("[GoogleSync] calendar %s failed: %v", calendarID, fetchErr)
		integration.SyncStatus = "FAILED"
		integration.LastError = &errStr
		_, _ = s.repo.SaveGoogleIntegration(ctx, integration)
		_ = s.repo.CreateSyncLog(ctx, &domain.GoogleCalendarSyncLog{
			IntegrationID: integration.ID,
			Status:        "FAILED",
			FailedCount:   1,
			ErrorDetails:  &errStr,
			SyncedBy:      actorID,
		})
		return &domain.SyncResult{
			Status:      "FAILED",
			Message:     fmt.Sprintf("Google Calendar sync failed: %v. Existing OneTrack holidays are unchanged.", fetchErr),
			FailedCount: 1,
		}, nil
	}

	res, err := s.repo.UpsertGoogleHolidays(ctx, calendarID, holidays)
	if err != nil {
		errStr := err.Error()
		integration.SyncStatus = "FAILED"
		integration.LastError = &errStr
		_, _ = s.repo.SaveGoogleIntegration(ctx, integration)
		return nil, err
	}

	synced := s.now().UTC()
	integration.SyncStatus = "SUCCESS"
	integration.LastSyncAt = &synced
	integration.LastError = nil
	_, _ = s.repo.SaveGoogleIntegration(ctx, integration)

	_ = s.repo.CreateSyncLog(ctx, &domain.GoogleCalendarSyncLog{
		IntegrationID: integration.ID,
		Status:        "SUCCESS",
		ImportedCount: res.ImportedCount,
		UpdatedCount:  res.UpdatedCount,
		SkippedCount:  res.SkippedCount,
		FailedCount:   res.FailedCount,
		SyncedBy:      actorID,
	})

	if s.systemLog != nil {
		actID := ""
		if actorID != nil {
			actID = *actorID
		}
		s.systemLog.Record(ctx, "CALENDAR", "GOOGLE_CALENDAR_HOLIDAYS_SYNCED", actID, nil,
			fmt.Sprintf("Google Calendar holidays synced (%d imported, %d updated, %d skipped)", res.ImportedCount, res.UpdatedCount, res.SkippedCount),
			map[string]interface{}{
				"integration_id": integration.ID,
				"imported":       res.ImportedCount,
				"updated":        res.UpdatedCount,
				"skipped":        res.SkippedCount,
				"failed":         res.FailedCount,
			},
		)
	}

	res.Message = fmt.Sprintf("Successfully synced %d holidays from Google Calendar (%d imported, %d updated, %d admin-managed dates preserved).",
		res.ImportedCount+res.UpdatedCount, res.ImportedCount, res.UpdatedCount, res.SkippedCount)
	return res, nil
}

// fetchHolidays returns the feed's holidays or an error; it never substitutes
// data of its own. The key comes from GOOGLE_CALENDAR_API_KEY, falling back to
// a key stored on the integration.
func (s *googleSyncService) fetchHolidays(
	ctx context.Context,
	integration *domain.GoogleCalendarIntegration,
	timeMin, timeMax string,
) ([]domain.Holiday, error) {
	apiKey := s.envAPIKey
	if apiKey == "" && integration.APIKey != nil {
		apiKey = *integration.APIKey
	}
	if apiKey == "" {
		return nil, errors.New("no Google Calendar API key configured (set GOOGLE_CALENDAR_API_KEY)")
	}

	calID := integration.GoogleCalendarID
	if calID == "" {
		calID = domain.DefaultGoogleCalendarID
	}
	apiURL := fmt.Sprintf(
		"%s/calendars/%s/events?timeMin=%s&timeMax=%s&singleEvents=true&orderBy=startTime&maxResults=2500&key=%s",
		s.baseURL, url.PathEscape(calID), url.QueryEscape(timeMin), url.QueryEscape(timeMax), url.QueryEscape(apiKey),
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "OneTrack-HolidaySync/1.0")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		// The URL carries the key; report only the failure kind.
		return nil, errors.New("could not reach the Google Calendar API")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("google calendar API returned status %d", resp.StatusCode)
	}

	var data googleEventsResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("failed to decode google calendar response: %w", err)
	}

	var holidays []domain.Holiday
	seen := map[string]bool{} // one holiday per date; the feed's first event wins
	for _, item := range data.Items {
		date := item.Start.Date
		if date == "" && len(item.Start.DateTime) >= 10 {
			date = item.Start.DateTime[:10]
		}
		name := strings.TrimSpace(item.Summary)
		if date == "" || name == "" || seen[date] {
			continue
		}

		// Google marks each event "Public holiday" or "Observance". Observances
		// (e.g. Valentine's Day) are not days off, so they are skipped. Marked
		// public holidays are GOVERNMENT/HIGH; any other event is imported as a
		// lower-priority REGIONAL holiday.
		desc := strings.ToLower(item.Description)
		if strings.Contains(desc, "observance") {
			continue
		}
		hType, prio := domain.HolidayTypeRegional, domain.PriorityMedium
		if strings.Contains(desc, "public holiday") {
			hType, prio = domain.HolidayTypeGovernment, domain.PriorityHigh
		}

		seen[date] = true
		id, description, srcCal := item.ID, item.Description, integration.GoogleCalendarID
		holidays = append(holidays, domain.Holiday{
			CalendarID:       integration.CalendarID,
			HolidayDate:      date,
			HolidayName:      name,
			HolidayType:      hType,
			WorkingStatus:    domain.WorkingStatusNonWorking,
			Priority:         prio,
			Source:           domain.SourceGoogleCalendar,
			SourceEventID:    &id,
			SourceCalendarID: &srcCal,
			IsActive:         true,
			Description:      &description,
		})
	}

	if len(holidays) == 0 {
		return nil, errors.New("google calendar returned no public holidays for the sync range")
	}
	return holidays, nil
}
