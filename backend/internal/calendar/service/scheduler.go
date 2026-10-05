package service

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/onetrack/backend/internal/calendar/domain"
)

type BackgroundScheduler struct {
	calSvc   domain.WorkingCalendarService
	interval time.Duration
	stopCh   chan struct{}
	wg       sync.WaitGroup
	mu       sync.Mutex
	running  bool
}

func NewBackgroundScheduler(
	calSvc domain.WorkingCalendarService,
	interval time.Duration,
) *BackgroundScheduler {
	if interval <= 0 {
		interval = 10 * time.Minute
	}
	return &BackgroundScheduler{
		calSvc:   calSvc,
		interval: interval,
		stopCh:   make(chan struct{}),
	}
}

// Start kicks off the periodic deadline evaluation in a background goroutine.
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
		log.Printf("[WorkingCalendar Scheduler] Started background evaluator (interval: %v)", s.interval)

		// Run immediately at startup
		s.safeEvaluate()

		ticker := time.NewTicker(s.interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				s.safeEvaluate()
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
