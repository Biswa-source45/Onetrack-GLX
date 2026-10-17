package email

import (
	"crypto/tls"
	"fmt"
	"log"
	"mime"
	"net"
	"net/smtp"
	"strings"
	"time"

	"github.com/onetrack/backend/internal/platform/config"
)

// Without these a stalled SMTP server would hang a goroutine (or, for SendNow, a whole bulk batch) forever.
var (
	dialTimeout = 10 * time.Second
	sendTimeout = 30 * time.Second // whole conversation; a var so the test can shorten it
)

type EmailService struct {
	cfg config.EmailConfig
}

func NewEmailService(cfg config.EmailConfig) *EmailService {
	return &EmailService{cfg: cfg}
}

// Configured says whether SMTP credentials are set. Without them SendEmail silently does nothing, which is
// right for alerts but wrong for a bulk send that must record sent/failed.
func (s *EmailService) Configured() bool {
	return s.cfg.Username != "" && s.cfg.Password != ""
}

func uniqueNonEmpty(emails []string) []string {
	seen := make(map[string]bool)
	var res []string
	for _, e := range emails {
		trimmed := strings.TrimSpace(e)
		if trimmed != "" && !seen[trimmed] {
			seen[trimmed] = true
			res = append(res, trimmed)
		}
	}
	return res
}

// headerSafe stops a value that ends up in a mail header from adding headers of its own.
func headerSafe(v string) string {
	return strings.NewReplacer("\r", " ", "\n", " ").Replace(v)
}

func (s *EmailService) SendEmail(to []string, subject string, htmlBody string) error {
	return s.SendEmailWithCC(to, nil, subject, htmlBody)
}

// SendEmailWithCC hands the mail to a background goroutine and returns at once; delivery problems are only
// logged. Alerts and OTP codes use this. Use SendNow when the caller needs the outcome.
func (s *EmailService) SendEmailWithCC(to []string, cc []string, subject string, htmlBody string) error {
	cleanTo := uniqueNonEmpty(to)
	cleanCc := uniqueNonEmpty(cc)

	if len(cleanTo) == 0 && len(cleanCc) == 0 {
		return nil
	}
	if !s.Configured() {
		log.Printf("[EmailService] SMTP credentials missing, skipping dispatch for subject: %s", subject)
		return nil
	}

	go func() {
		if err := s.deliver(cleanTo, cleanCc, subject, htmlBody); err != nil {
			log.Printf("[EmailService] Failed to send email '%s' to TO:%v CC:%v: %v", subject, cleanTo, cleanCc, err)
			return
		}
		log.Printf("[EmailService] Successfully sent email '%s' to TO:%v CC:%v", subject, cleanTo, cleanCc)
	}()

	return nil
}

// SendNow sends one mail and waits for the SMTP server's answer (bounded by the timeouts above).
func (s *EmailService) SendNow(to []string, subject string, htmlBody string) error {
	cleanTo := uniqueNonEmpty(to)
	if len(cleanTo) == 0 {
		return fmt.Errorf("no recipient")
	}
	if !s.Configured() {
		return fmt.Errorf("email is not configured on this server")
	}
	return s.deliver(cleanTo, nil, subject, htmlBody)
}

func (s *EmailService) deliver(to, cc []string, subject, htmlBody string) error {
	from := s.cfg.Username
	headers := []string{
		"From: " + headerSafe(fmt.Sprintf("OneTrack Support <%s>", from)),
		"Subject: " + mime.QEncoding.Encode("UTF-8", headerSafe(subject)), // plain ASCII stays as is
		"MIME-Version: 1.0",
		"Content-Type: text/html; charset=UTF-8",
	}
	if len(to) > 0 {
		headers = append(headers, "To: "+headerSafe(strings.Join(to, ", ")))
	}
	if len(cc) > 0 {
		headers = append(headers, "Cc: "+headerSafe(strings.Join(cc, ", ")))
	}
	message := strings.Join(headers, "\r\n") + "\r\n\r\n" + htmlBody

	addr := net.JoinHostPort(s.cfg.SMTPServer, s.cfg.SMTPPort)
	dialer := &net.Dialer{Timeout: dialTimeout}

	// Port 465 is TLS from the first byte; anything else starts plain and upgrades with STARTTLS.
	var conn net.Conn
	var err error
	if s.cfg.SMTPPort == "465" {
		conn, err = tls.DialWithDialer(dialer, "tcp", addr, &tls.Config{InsecureSkipVerify: true, ServerName: s.cfg.SMTPServer})
	} else {
		conn, err = dialer.Dial("tcp", addr)
	}
	if err != nil {
		return fmt.Errorf("connect %s: %w", addr, err)
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(sendTimeout))

	client, err := smtp.NewClient(conn, s.cfg.SMTPServer)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer client.Close()

	if s.cfg.SMTPPort != "465" {
		if ok, _ := client.Extension("STARTTLS"); ok {
			if err := client.StartTLS(&tls.Config{ServerName: s.cfg.SMTPServer}); err != nil {
				return fmt.Errorf("starttls: %w", err)
			}
		}
	}
	if err := client.Auth(smtp.PlainAuth("", s.cfg.Username, s.cfg.Password, s.cfg.SMTPServer)); err != nil {
		return fmt.Errorf("auth: %w", err)
	}
	if err := client.Mail(from); err != nil {
		return fmt.Errorf("mail from: %w", err)
	}
	for _, recipient := range uniqueNonEmpty(append(append([]string{}, to...), cc...)) {
		if err := client.Rcpt(recipient); err != nil {
			return fmt.Errorf("recipient %s: %w", recipient, err)
		}
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("data: %w", err)
	}
	if _, err := w.Write([]byte(message)); err != nil {
		return fmt.Errorf("write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("finish: %w", err)
	}
	_ = client.Quit()
	return nil
}
