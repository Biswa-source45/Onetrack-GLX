package service

import (
	"context"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/onetrack/backend/internal/calendar/domain"
)

type BackgroundScheduler struct {
	calSvc   domain.WorkingCalendarService
	repo     domain.WorkingCalendarRepository
	interval time.Duration
	stopCh   chan struct{}
	resetCh  chan struct{}
	wg       sync.WaitGroup
	mu       sync.Mutex
	running  bool
}

func NewBackgroundScheduler(
	calSvc domain.WorkingCalendarService,
	repo domain.WorkingCalendarRepository,
	defaultInterval time.Duration,
) *BackgroundScheduler {
	if defaultInterval <= 0 {
		defaultInterval = 10 * time.Minute
	}
	return &BackgroundScheduler{
		calSvc:   calSvc,
		repo:     repo,
		interval: defaultInterval,
		stopCh:   make(chan struct{}),
		resetCh:  make(chan struct{}, 1),
	}
}

// GetActiveInterval queries the repository for the user-configured cadence in the default calendar.
// Falls back to the in-memory default if no configuration is present.
func (s *BackgroundScheduler) GetActiveInterval() time.Duration {
	if s.repo != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		cal, err := s.repo.GetDefaultCalendar(ctx)
		if err == nil && cal != nil && cal.SchedulerIntervalValue > 0 {
			val := cal.SchedulerIntervalValue
			unit := strings.ToUpper(strings.TrimSpace(cal.SchedulerIntervalUnit))
			var dur time.Duration
			switch unit {
			case "SECONDS":
				dur = time.Duration(val) * time.Second
			case "HOURS":
				dur = time.Duration(val) * time.Hour
			case "DAYS":
				dur = time.Duration(val) * 24 * time.Hour
			case "MINUTES":
				fallthrough
			default:
				dur = time.Duration(val) * time.Minute
			}
			// Safe lower bound: minimum 5 seconds to avoid tight spinloops
			if dur < 5*time.Second {
				dur = 5 * time.Second
			}
			return dur
		}
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if s.interval > 0 {
		return s.interval
	}
	return 10 * time.Minute
}

// TriggerReset notifies the scheduler to re-read the configuration and reset its timer immediately.
func (s *BackgroundScheduler) TriggerReset() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.running {
		return
	}
	select {
	case s.resetCh <- struct{}{}:
	default:
	}
}

// Start kicks off the periodic deadline evaluation in a background goroutine with dynamic interval.
func (s *BackgroundScheduler) Start() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.running {
		return
	}
	s.running = true
	s.stopCh = make(chan struct{})
	s.resetCh = make(chan struct{}, 1)
	s.wg.Add(1)

	go func() {
		defer s.wg.Done()

		curInterval := s.GetActiveInterval()
		log.Printf("[WorkingCalendar Scheduler] Started background evaluator (cadence: %v)", curInterval)

		// Run immediately at startup
		s.safeEvaluate()

		timer := time.NewTimer(curInterval)
		defer timer.Stop()

		for {
			select {
			case <-timer.C:
				s.safeEvaluate()
				// Read latest user-configured interval dynamically
				curInterval = s.GetActiveInterval()
				timer.Reset(curInterval)

			case <-s.resetCh:
				curInterval = s.GetActiveInterval()
				if !timer.Stop() {
					select {
					case <-timer.C:
					default:
					}
				}
				log.Printf("[WorkingCalendar Scheduler] Interval updated to %v", curInterval)
				timer.Reset(curInterval)

			case <-s.stopCh:
				log.Println("[WorkingCalendar Scheduler] Shutting down...")
				return
			}
		}
	}()
}

// Stop cleanly terminates the background evaluator.
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
	log.Println("[WorkingCalendar Scheduler] Stopped")
}

func (s *BackgroundScheduler) safeEvaluate() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	defer func() {
		if r := recover(); r != nil {
			log.Printf("[WorkingCalendar Scheduler] Panic recovered: %v", r)
		}
	}()

	if err := s.calSvc.EvaluateActiveTenders(ctx); err != nil {
		log.Printf("[WorkingCalendar Scheduler] Evaluation error: %v", err)
	}
}
