package email

import (
	"mime"
	"net"
	"strings"
	"testing"
	"time"

	"github.com/onetrack/backend/internal/platform/config"
)

// A server that accepts the connection and then says nothing must not hold SendNow (and so a whole bulk
// batch) forever.
func TestSendNowGivesUpOnASilentServer(t *testing.T) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	go func() {
		for {
			c, err := l.Accept()
			if err != nil {
				return
			}
			defer c.Close()
		}
	}()

	old := sendTimeout
	sendTimeout = 300 * time.Millisecond
	defer func() { sendTimeout = old }()

	host, port, _ := net.SplitHostPort(l.Addr().String())
	svc := NewEmailService(config.EmailConfig{SMTPServer: host, SMTPPort: port, Username: "a@b.in", Password: "x"})

	start := time.Now()
	err = svc.SendNow([]string{"to@x.in"}, "hi", "<p>hi</p>")
	if err == nil {
		t.Fatal("expected an error from a silent server")
	}
	if time.Since(start) > 3*time.Second {
		t.Fatalf("took %v", time.Since(start))
	}
}

func TestSendNowRefusesWhenNotConfigured(t *testing.T) {
	svc := NewEmailService(config.EmailConfig{})
	if svc.Configured() {
		t.Fatal("empty credentials must not count as configured")
	}
	if err := svc.SendNow([]string{"to@x.in"}, "s", "b"); err == nil || !strings.Contains(err.Error(), "not configured") {
		t.Fatalf("got %v", err)
	}
}

func TestHeaderSafeStripsLineBreaks(t *testing.T) {
	if got := headerSafe("Hi\r\nBcc: evil@x.in"); strings.ContainsAny(got, "\r\n") {
		t.Fatalf("header injection possible: %q", got)
	}
}

func TestNonASCIISubjectSurvivesAsAnEncodedWord(t *testing.T) {
	enc := mime.QEncoding.Encode("UTF-8", "Welcome to OneTrack – Your Login Credentials")
	if strings.ContainsRune(enc, '–') {
		t.Fatalf("header must be ASCII on the wire: %q", enc)
	}
	dec, err := new(mime.WordDecoder).DecodeHeader(enc)
	if err != nil || dec != "Welcome to OneTrack – Your Login Credentials" {
		t.Fatalf("round trip failed: %q %v", dec, err)
	}
}
