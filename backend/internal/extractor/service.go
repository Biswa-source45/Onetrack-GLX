package extractor

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"time"
)

type Service struct {
	pythonServiceURL string
	client           *http.Client
}

func NewService(openAIKey string) *Service {
	// Look for EXTRACTOR_SERVICE_URL or default to localhost:8000
	serviceURL := strings.TrimSpace(os.Getenv("EXTRACTOR_SERVICE_URL"))
	if serviceURL == "" {
		serviceURL = "http://localhost:8000/api/v1/extract-document"
	}

	return &Service{
		pythonServiceURL: serviceURL,
		client: &http.Client{
			Timeout: 180 * time.Second, // Allow ample time for large documents
		},
	}
}

// ExtractDocumentViaMicroservice forwards the document to the Python FastAPI microservice.
// mode can be "tender" or "lead".
func (s *Service) ExtractDocumentViaMicroservice(ctx context.Context, filename string, fileBytes []byte, mode string) (*ExtractionResponse, error) {
	if mode == "" {
		mode = "tender"
	}

	// Prepare multipart/form-data payload for Python microservice
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare multipart form file: %w", err)
	}

	if _, err := part.Write(fileBytes); err != nil {
		return nil, fmt.Errorf("failed to write file content to multipart body: %w", err)
	}

	if err := writer.WriteField("mode", mode); err != nil {
		return nil, fmt.Errorf("failed to write mode form field: %w", err)
	}

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("failed to finalize multipart body: %w", err)
	}

	// Construct request URL with mode query param as well
	targetURL := s.pythonServiceURL
	if strings.Contains(targetURL, "?") {
		targetURL = fmt.Sprintf("%s&mode=%s", targetURL, mode)
	} else {
		targetURL = fmt.Sprintf("%s?mode=%s", targetURL, mode)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, &body)
	if err != nil {
		return nil, fmt.Errorf("failed to create microservice request: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Python AI extraction microservice is not reachable at %s. Please ensure the Python service is running (e.g. uvicorn main:app --port 8000): %w", s.pythonServiceURL, err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response from Python AI microservice: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Python AI microservice returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var extractionResp ExtractionResponse
	if err := json.Unmarshal(respBody, &extractionResp); err != nil {
		return nil, fmt.Errorf("failed to parse Python microservice JSON response: %w", err)
	}

	return &extractionResp, nil
}
