package handler

import "testing"

// TestValidateImageUpload covers the feedback-attachment gate: real content
// sniffing (never trusting a claimed extension), the size cap, and that
// SVG — a real stored-XSS vector — is never accepted no matter how it's
// labeled.
func TestValidateImageUpload(t *testing.T) {
	jpegHead := []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46}
	pngHead := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}

	t.Run("a real JPEG is accepted", func(t *testing.T) {
		ext, err := validateImageUpload(1024, jpegHead)
		if err != nil || ext != ".jpg" {
			t.Fatalf("expected .jpg with no error, got ext=%q err=%v", ext, err)
		}
	})

	t.Run("a real PNG is accepted", func(t *testing.T) {
		ext, err := validateImageUpload(1024, pngHead)
		if err != nil || ext != ".png" {
			t.Fatalf("expected .png with no error, got ext=%q err=%v", ext, err)
		}
	})

	t.Run("oversized file is rejected regardless of content", func(t *testing.T) {
		if _, err := validateImageUpload(maxImageBytes+1, jpegHead); err == nil {
			t.Fatal("expected an error for a file over the size cap")
		}
	})

	t.Run("SVG is rejected even though it's an image format", func(t *testing.T) {
		svg := []byte("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>")
		if _, err := validateImageUpload(100, svg); err == nil {
			t.Fatal("expected SVG to be rejected")
		}
	})

	t.Run("a renamed non-image file is rejected by real content, not extension", func(t *testing.T) {
		// Plain text pretending to be an image — no magic bytes match.
		if _, err := validateImageUpload(100, []byte("just some text, not an image")); err == nil {
			t.Fatal("expected non-image content to be rejected")
		}
	})
}
