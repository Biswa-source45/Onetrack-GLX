package handler

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/onetrack/backend/internal/bid/domain"
	"github.com/onetrack/backend/internal/platform/response"
)

// maxTenderDocBytes caps one document. Under nginx's client_max_body_size (30m)
// with room for the multipart framing.
const maxTenderDocBytes = 25 << 20

const (
	maxDocNameRunes   = 60
	errDocTypeMessage = "Only PDF, DOCX or TXT files are allowed"
)

// validateTenderDoc checks size and the file's real bytes (never the filename
// alone) and returns the content type to store. PDF by magic bytes; DOCX is a
// ZIP so its extension picks it; TXT must sniff as text and carry .txt.
func validateTenderDoc(size int64, filename string, head []byte) (string, error) {
	if size > maxTenderDocBytes {
		return "", fmt.Errorf("file exceeds the %d MB limit", maxTenderDocBytes>>20)
	}
	if size == 0 {
		return "", errors.New("file is empty")
	}
	ext := strings.ToLower(filepath.Ext(filename))
	sniffed := http.DetectContentType(head)
	switch {
	case sniffed == "application/pdf" && ext == ".pdf":
		return "application/pdf", nil
	case sniffed == "application/zip" && ext == ".docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document", nil
	case strings.HasPrefix(sniffed, "text/plain") && ext == ".txt" && !bytes.Contains(head, []byte{0}):
		return "text/plain; charset=utf-8", nil
	}
	return "", errors.New(errDocTypeMessage)
}

// cleanDocName trims a user label and caps it; "" means missing.
func cleanDocName(v string) string {
	v = strings.TrimSpace(v)
	if r := []rune(v); len(r) > maxDocNameRunes {
		v = strings.TrimSpace(string(r[:maxDocNameRunes]))
	}
	return v
}

// safeName keeps a filesystem-safe version of a user-supplied name: letters,
// digits, dot, dash, underscore; everything else becomes "_".
func safeName(name string) string {
	var b strings.Builder
	for _, c := range name {
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '.' || c == '-' || c == '_' {
			b.WriteRune(c)
		} else {
			b.WriteByte('_')
		}
	}
	s := strings.Trim(b.String(), "._")
	if s == "" {
		s = "file"
	}
	if len(s) > 100 {
		ext := filepath.Ext(s)
		if len(ext) > 10 {
			ext = ""
		}
		s = s[:100-len(ext)] + ext
	}
	return s
}

// folderSlug: lowercase ASCII letters/digits joined by single hyphens, capped
// at 50 chars; "tender" when nothing usable is left.
func folderSlug(name string) string {
	var b strings.Builder
	dash := false
	for _, c := range strings.ToLower(name) {
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') {
			b.WriteRune(c)
			dash = false
		} else if !dash && b.Len() > 0 {
			b.WriteByte('-')
			dash = true
		}
		if b.Len() >= 50 {
			break
		}
	}
	if s := strings.Trim(b.String(), "-"); s != "" {
		return s
	}
	return "tender"
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// readTenderDoc validates one uploaded file and returns it open + its content
// type. Caller closes.
func readTenderDoc(fh *multipart.FileHeader) (multipart.File, string, error) {
	f, err := fh.Open()
	if err != nil {
		return nil, "", errors.New("could not read the uploaded file")
	}
	head := make([]byte, 512)
	n, _ := io.ReadFull(f, head)
	ct, err := validateTenderDoc(fh.Size, fh.Filename, head[:n])
	if err != nil {
		f.Close()
		return nil, "", err
	}
	return f, ct, nil
}

// writeTenderDoc copies f into <root>/<folder>/<name>/<random>_<file> and
// returns the path relative to the folder.
func (h *BidHandler) writeTenderDoc(f io.ReadSeeker, folder, name, original string) (string, error) {
	rel := filepath.ToSlash(filepath.Join(safeName(name), randomHex(4)+"_"+safeName(filepath.Base(original))))
	full := h.docPath(folder, rel)
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		return "", errors.New("could not prepare storage for the file")
	}
	out, err := os.Create(full)
	if err != nil {
		return "", errors.New("could not save the file")
	}
	_, err = f.Seek(0, io.SeekStart)
	if err == nil {
		_, err = io.Copy(out, f)
	}
	if cerr := out.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		_ = os.Remove(full)
		return "", errors.New("could not save the file")
	}
	return rel, nil
}

func (h *BidHandler) docPath(folder, rel string) string {
	return filepath.Join(h.docsDir, folder, filepath.FromSlash(rel))
}

// logDocEvent writes the audit-trail entry for a document change. Best effort:
// a failed log line never undoes the upload.
func (h *BidHandler) logDocEvent(c *gin.Context, bidID, eventType, reason string) {
	bid, err := h.svc.GetBid(c.Request.Context(), bidID)
	if err != nil {
		return
	}
	from := bid.WorkflowStage
	_, err = h.svc.AddMicroEvent(c.Request.Context(), bidID, &domain.AddMicroEventRequest{
		FromStage:        &from,
		ToStage:          bid.WorkflowStage,
		EventType:        eventType,
		TransitionReason: &reason,
	}, c.GetString("user_id"))
	if err != nil {
		log.Printf("[tender-docs] could not log %s for %s: %v", eventType, bidID, err)
	}
}

// docsBidOK answers 400/404 itself and reports whether the tender id is usable.
func (h *BidHandler) docsBidOK(c *gin.Context) (string, bool) {
	bidID := c.Param("id")
	if !bidIDRe.MatchString(bidID) {
		response.BadRequest(c, "Invalid tender id", nil)
		return "", false
	}
	if _, err := h.svc.GetBid(c.Request.Context(), bidID); err != nil {
		response.NotFound(c, "Tender not found")
		return "", false
	}
	return bidID, true
}

func (h *BidHandler) ListDocuments(c *gin.Context) {
	bidID, ok := h.docsBidOK(c)
	if !ok {
		return
	}
	docs, err := h.docs.List(c.Request.Context(), bidID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, http.StatusOK, "Documents retrieved", docs)
}

// UploadDocument: multipart "file" + "name".
func (h *BidHandler) UploadDocument(c *gin.Context) {
	bidID, ok := h.docsBidOK(c)
	if !ok {
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxTenderDocBytes+(1<<20))
	name := cleanDocName(c.PostForm("name"))
	if name == "" {
		response.BadRequest(c, "Document name is required (e.g. RFP)", nil)
		return
	}
	fh, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, fmt.Sprintf("Attach one PDF, DOCX or TXT file up to %d MB", maxTenderDocBytes>>20), nil)
		return
	}
	doc, err := h.storeNewDoc(c, bidID, "", name, fh)
	if err != nil {
		response.BadRequest(c, err.Error(), nil)
		return
	}
	h.logDocEvent(c, bidID, "DOCUMENT_UPLOADED", fmt.Sprintf("Document added: %s (%s)", doc.Name, doc.OriginalName))
	response.Success(c, http.StatusCreated, "Document uploaded", doc)
}

// storeNewDoc validates and saves a file, then records it. Used by both the
// documents endpoint and CreateBid. On a DB failure the file is removed.
// titleHint names the folder when the tender has none yet; "" looks the title up.
func (h *BidHandler) storeNewDoc(c *gin.Context, bidID, titleHint, name string, fh *multipart.FileHeader) (*domain.TenderDocument, error) {
	f, ct, err := readTenderDoc(fh)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	ctx := c.Request.Context()
	if titleHint == "" {
		if b, err := h.svc.GetBid(ctx, bidID); err == nil {
			titleHint = b.Title
		}
	}
	folder, err := h.docs.EnsureFolder(ctx, bidID, folderSlug(titleHint)+"-"+randomHex(3))
	if err != nil {
		return nil, errors.New("could not prepare the tender's document folder")
	}
	rel, err := h.writeTenderDoc(f, folder, name, fh.Filename)
	if err != nil {
		return nil, err
	}
	doc, err := h.docs.Add(ctx, &domain.TenderDocument{
		BidID: bidID, Name: name, OriginalName: filepath.Base(fh.Filename), StoredPath: rel,
		ContentType: ct, SizeBytes: fh.Size, UploadedBy: c.GetString("user_id"),
	})
	if err != nil {
		_ = os.Remove(h.docPath(folder, rel))
		return nil, errors.New("could not record the document")
	}
	return doc, nil
}

// UpdateDocument: multipart with optional "name" (rename) and optional "file"
// (replace). Renaming moves the file into the new name's sub-folder.
func (h *BidHandler) UpdateDocument(c *gin.Context) {
	bidID, ok := h.docsBidOK(c)
	if !ok {
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxTenderDocBytes+(1<<20))
	ctx := c.Request.Context()
	doc, err := h.docs.Get(ctx, bidID, c.Param("docId"))
	if errors.Is(err, domain.ErrNotFound) {
		response.NotFound(c, "Document not found")
		return
	}
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	folder, err := h.docs.Folder(ctx, bidID)
	if err != nil || folder == "" {
		response.InternalError(c, "document folder is missing")
		return
	}

	oldRel, oldName := doc.StoredPath, doc.Name
	newName := doc.Name
	if v, has := c.GetPostForm("name"); has {
		if newName = cleanDocName(v); newName == "" {
			response.BadRequest(c, "Document name cannot be empty", nil)
			return
		}
	}
	fh, ferr := c.FormFile("file")
	replacing := ferr == nil
	if !replacing && newName == doc.Name {
		response.BadRequest(c, "Nothing to change: send a new name or a new file", nil)
		return
	}

	var newRel string
	if replacing {
		f, ct, err := readTenderDoc(fh)
		if err != nil {
			response.BadRequest(c, err.Error(), nil)
			return
		}
		defer f.Close()
		if newRel, err = h.writeTenderDoc(f, folder, newName, fh.Filename); err != nil {
			response.BadRequest(c, err.Error(), nil)
			return
		}
		doc.OriginalName, doc.ContentType, doc.SizeBytes = filepath.Base(fh.Filename), ct, fh.Size
	} else {
		// Rename only: move the existing file under the new label's folder.
		newRel = filepath.ToSlash(filepath.Join(safeName(newName), filepath.Base(oldRel)))
		to := h.docPath(folder, newRel)
		if err := os.MkdirAll(filepath.Dir(to), 0o755); err != nil {
			response.InternalError(c, "could not prepare storage for the file")
			return
		}
		if err := os.Rename(h.docPath(folder, oldRel), to); err != nil {
			response.BadRequest(c, "The file is missing from storage; replace it with a new upload", nil)
			return
		}
	}
	doc.Name, doc.StoredPath = newName, newRel
	if err := h.docs.Update(ctx, doc); err != nil {
		// Undo the file move/write so disk and DB agree.
		if replacing {
			_ = os.Remove(h.docPath(folder, newRel))
		} else {
			_ = os.Rename(h.docPath(folder, newRel), h.docPath(folder, oldRel))
		}
		response.InternalError(c, err.Error())
		return
	}
	if replacing {
		_ = os.Remove(h.docPath(folder, oldRel))
	}
	reason := fmt.Sprintf("Document updated: %s", newName)
	if newName != oldName {
		reason = fmt.Sprintf("Document renamed: %s to %s", oldName, newName)
	}
	if replacing {
		reason += fmt.Sprintf(" (new file %s)", doc.OriginalName)
	}
	h.logDocEvent(c, bidID, "DOCUMENT_UPDATED", reason)
	response.Success(c, http.StatusOK, "Document updated", doc)
}

func (h *BidHandler) DeleteDocument(c *gin.Context) {
	bidID, ok := h.docsBidOK(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()
	doc, err := h.docs.Get(ctx, bidID, c.Param("docId"))
	if errors.Is(err, domain.ErrNotFound) {
		response.NotFound(c, "Document not found")
		return
	}
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	folder, _ := h.docs.Folder(ctx, bidID)
	if err := h.docs.Delete(ctx, bidID, doc.ID); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	// Row first, file second: a failed file delete leaves a harmless orphan on
	// disk rather than a listed document that 404s.
	if folder != "" {
		_ = os.Remove(h.docPath(folder, doc.StoredPath))
	}
	h.logDocEvent(c, bidID, "DOCUMENT_DELETED", fmt.Sprintf("Document deleted: %s (%s)", doc.Name, doc.OriginalName))
	response.Success(c, http.StatusOK, "Document deleted", nil)
}

// GetDocumentFile serves the file: inline for the in-app preview (?inline=1),
// as an attachment otherwise.
func (h *BidHandler) GetDocumentFile(c *gin.Context) {
	bidID := c.Param("id")
	if !bidIDRe.MatchString(bidID) {
		response.NotFound(c, "Document not found")
		return
	}
	ctx := c.Request.Context()
	doc, err := h.docs.Get(ctx, bidID, c.Param("docId"))
	if err != nil {
		response.NotFound(c, "Document not found")
		return
	}
	folder, _ := h.docs.Folder(ctx, bidID)
	if folder == "" {
		response.NotFound(c, "File is missing from storage")
		return
	}
	full := h.docPath(folder, doc.StoredPath)
	if _, err := os.Stat(full); err != nil {
		response.NotFound(c, "File is missing from storage")
		return
	}
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Content-Type", doc.ContentType)
	if c.Query("inline") == "1" {
		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=%q", safeName(doc.OriginalName)))
		c.File(full)
		return
	}
	c.FileAttachment(full, doc.OriginalName)
}
