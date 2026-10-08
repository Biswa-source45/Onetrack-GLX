package service

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/onetrack/backend/internal/calendar/domain"
)

// coverageLogEvery limits the "nothing evaluated" diagnostic line to once an hour.
const coverageLogEvery = time.Hour

// maxIdle bounds how long the scheduler sleeps before re-reading the configured cadence.
const maxIdle = 10 * time.Second

// BackgroundScheduler runs the deadline evaluation on the default calendar's
// cadence (seconds or minutes). It is only constructed when CALENDAR_SCHEDULER_ENABLED=true.
type BackgroundScheduler struct {
	calSvc          domain.WorkingCalendarService
	repo            domain.WorkingCalendarRepository
	stopCh          chan struct{}
	wg              sync.WaitGroup
	mu              sync.Mutex
	running         bool
	lastCoverageLog time.Time
}

func NewBackgroundScheduler(calSvc domain.WorkingCalendarService, repo domain.WorkingCalendarRepository) *BackgroundScheduler {
	return &BackgroundScheduler{calSvc: calSvc, repo: repo}
}

// interval re-reads the configured cadence so admin changes apply from the next tick.
func (s *BackgroundScheduler) interval() time.Duration {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if cal, err := s.repo.GetDefaultCalendar(ctx); err == nil && cal != nil {
		return cal.SchedulerInterval()
	}
	return domain.DefaultSchedulerInterval
}

func (s *BackgroundScheduler) Start() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.running {
		return
	}
	s.running = true
	s.stopCh = make(chan struct{})
	s.wg.Add(1)

	go func() {
		defer s.wg.Done()
		log.Printf("[WorkingCalendar Scheduler] started (cadence: %v)", s.interval())

		s.safeEvaluate()
		last := time.Now()
		for {
			// The cadence is re-read at least every maxIdle, so an admin change (e.g. 10 minutes
			// to 5 seconds) takes effect within seconds instead of after the old timer expires.
			iv := s.interval()
			wait := time.Until(last.Add(iv))
			if wait > maxIdle {
				wait = maxIdle
			}
			s.calSvc.SetNextRun(last.Add(iv))
			select {
			case <-time.After(wait):
				if time.Since(last) >= iv {
					s.safeEvaluate()
					last = time.Now()
				}
			case <-s.stopCh:
				s.calSvc.SetNextRun(time.Time{})
				return
			}
		}
	}()
}

func (s *BackgroundScheduler) Stop() {
	s.mu.Lock()
	if !s.running {
		s.mu.Unlock()
		return
	}
	s.running = false
	close(s.stopCh)
	s.mu.Unlock()

	s.wg.Wait()
	log.Println("[WorkingCalendar Scheduler] stopped")
}

func (s *BackgroundScheduler) safeEvaluate() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[WorkingCalendar Scheduler] panic recovered: %v", r)
		}
	}()

	sum, err := s.calSvc.EvaluateActiveTenders(ctx, domain.RunTriggerScheduler)
	if err != nil {
		log.Printf("[WorkingCalendar Scheduler] evaluation error: %v", err)
		return
	}
	if sum.Notified > 0 || sum.Escalated > 0 || sum.Baselined {
		log.Printf("[WorkingCalendar Scheduler] evaluated %d tenders, %d in red zone, %d recipients alerted, %d escalated (baseline run: %v)",
			sum.Evaluated, sum.InRedZone, sum.Notified, sum.Escalated, sum.Baselined)
	}
	// Explain an idle engine, but at most once an hour so a seconds cadence never spams the log.
	if sum.Evaluated == 0 && !sum.Skipped && time.Since(s.lastCoverageLog) >= coverageLogEvery {
		s.lastCoverageLog = time.Now()
		c := sum.Coverage
		log.Printf("[WorkingCalendar Scheduler] 0 tenders evaluated (window %dd): %d active, %d without closing date, %d already closed, %d submitted/resolved, %d beyond window, %d in window",
			sum.WindowDays, c.TotalActive, c.NoClosingDate, c.AlreadyClosed, c.SubmittedOrResolved, c.BeyondWindow, c.InWindow)
	}
}
