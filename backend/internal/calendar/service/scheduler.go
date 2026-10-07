package service

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/onetrack/backend/internal/calendar/domain"
)

const defaultSchedulerInterval = 10 * time.Minute

// BackgroundScheduler runs the deadline evaluation on the default calendar's
// cadence (minutes). It is only constructed when CALENDAR_SCHEDULER_ENABLED=true.
type BackgroundScheduler struct {
	calSvc  domain.WorkingCalendarService
	repo    domain.WorkingCalendarRepository
	stopCh  chan struct{}
	wg      sync.WaitGroup
	mu      sync.Mutex
	running bool
}

func NewBackgroundScheduler(calSvc domain.WorkingCalendarService, repo domain.WorkingCalendarRepository) *BackgroundScheduler {
	return &BackgroundScheduler{calSvc: calSvc, repo: repo}
}

// interval re-reads the configured cadence so admin changes apply from the next tick.
func (s *BackgroundScheduler) interval() time.Duration {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if cal, err := s.repo.GetDefaultCalendar(ctx); err == nil && cal != nil && cal.SchedulerIntervalValue > 0 {
		return time.Duration(cal.SchedulerIntervalValue) * time.Minute
	}
	return defaultSchedulerInterval
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
		timer := time.NewTimer(s.interval())
		defer timer.Stop()
		for {
			select {
			case <-timer.C:
				s.safeEvaluate()
				timer.Reset(s.interval())
			case <-s.stopCh:
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

	sum, err := s.calSvc.EvaluateActiveTenders(ctx)
	if err != nil {
		log.Printf("[WorkingCalendar Scheduler] evaluation error: %v", err)
		return
	}
	if sum.Notified > 0 || sum.Baselined {
		log.Printf("[WorkingCalendar Scheduler] evaluated %d tenders, %d in red zone, %d recipients alerted (baseline run: %v)",
			sum.Evaluated, sum.InRedZone, sum.Notified, sum.Baselined)
	}
}
