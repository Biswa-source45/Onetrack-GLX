package email

import (
	"crypto/tls"
	"fmt"
	"log"
	"net/smtp"
	"strings"

	"github.com/onetrack/backend/internal/platform/config"
)

type EmailService struct {
	cfg config.EmailConfig
}

func NewEmailService(cfg config.EmailConfig) *EmailService {
	return &EmailService{cfg: cfg}
}

func (s *EmailService) SendEmail(to []string, subject string, htmlBody string) error {
	if len(to) == 0 {
		return nil
	}
	if s.cfg.Username == "" || s.cfg.Password == "" {
		log.Printf("[EmailService] SMTP credentials missing, skipping dispatch for subject: %s", subject)
		return nil
	}

	from := s.cfg.Username
	headers := make(map[string]string)
	headers["From"] = fmt.Sprintf("OneTrack Support <%s>", from)
	headers["To"] = strings.Join(to, ",")
	headers["Subject"] = subject
	headers["MIME-Version"] = "1.0"
	headers["Content-Type"] = "text/html; charset=UTF-8"

	message := ""
	for k, v := range headers {
		message += fmt.Sprintf("%s: %s\r\n", k, v)
	}
	message += "\r\n" + htmlBody

	addr := fmt.Sprintf("%s:%s", s.cfg.SMTPServer, s.cfg.SMTPPort)
	auth := smtp.PlainAuth("", s.cfg.Username, s.cfg.Password, s.cfg.SMTPServer)

	// Send via standard TLS/STARTTLS
	go func() {
		// Use TLS connection if port 465, else standard STARTTLS
		var err error
		if s.cfg.SMTPPort == "465" {
			tlsconfig := &tls.Config{
				InsecureSkipVerify: true,
				ServerName:         s.cfg.SMTPServer,
			}
			conn, connErr := tls.Dial("tcp", addr, tlsconfig)
			if connErr != nil {
				log.Printf("[EmailService] Failed TLS connect to %s: %v", addr, connErr)
				return
			}
			client, clientErr := smtp.NewClient(conn, s.cfg.SMTPServer)
			if clientErr != nil {
				log.Printf("[EmailService] Failed smtp client: %v", clientErr)
				return
			}
			if err = client.Auth(auth); err != nil {
				log.Printf("[EmailService] Auth failed: %v", err)
				return
			}
			if err = client.Mail(from); err != nil {
				log.Printf("[EmailService] Mail from failed: %v", err)
				return
			}
			for _, recipient := range to {
				if err = client.Rcpt(recipient); err != nil {
					log.Printf("[EmailService] Rcpt failed for %s: %v", recipient, err)
					return
				}
			}
			w, err := client.Data()
			if err != nil {
				log.Printf("[EmailService] Data write failed: %v", err)
				return
			}
			_, _ = w.Write([]byte(message))
			_ = w.Close()
			client.Quit()
			log.Printf("[EmailService] Successfully sent email '%s' to %v via TLS 465", subject, to)
		} else {
			err = smtp.SendMail(addr, auth, from, to, []byte(message))
			if err != nil {
				log.Printf("[EmailService] Failed to send email '%s' to %v: %v", subject, to, err)
			} else {
				log.Printf("[EmailService] Successfully sent email '%s' to %v", subject, to)
			}
		}
	}()

	return nil
}
