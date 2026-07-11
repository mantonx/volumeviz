package volumes

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/mantonx/volumeviz/internal/audit"
	"github.com/mantonx/volumeviz/internal/models"
	"github.com/mantonx/volumeviz/internal/repo"
	"github.com/mantonx/volumeviz/internal/store"
)

// fakeVolumesRepo implements repo.VolumesRepo, but only the two methods
// deleteOneVolume actually calls (GetVolumeByVolumeID, HardDeleteVolume) do
// anything real — every other method panics if called, so a test that
// accidentally exercises a new dependency fails loudly instead of silently
// returning a zero value.
type fakeVolumesRepo struct {
	repo.VolumesRepo
	getVolumeByVolumeID func(ctx context.Context, orgID int64, volumeID string) (*models.Volume, error)
	hardDeleteVolume    func(ctx context.Context, orgID int64, volumeID string) error
	hardDeleteCalls     int
}

func (f *fakeVolumesRepo) GetVolumeByVolumeID(ctx context.Context, orgID int64, volumeID string) (*models.Volume, error) {
	if f.getVolumeByVolumeID != nil {
		return f.getVolumeByVolumeID(ctx, orgID, volumeID)
	}
	return nil, errors.New("not found")
}

func (f *fakeVolumesRepo) HardDeleteVolume(ctx context.Context, orgID int64, volumeID string) error {
	f.hardDeleteCalls++
	if f.hardDeleteVolume != nil {
		return f.hardDeleteVolume(ctx, orgID, volumeID)
	}
	return nil
}

// fakeStore implements store.Store, delegating Volumes() to a
// fakeVolumesRepo. Every other method panics if called — deleteOneVolume
// only ever needs Volumes().
type fakeStore struct {
	store.Store
	volumesRepo *fakeVolumesRepo
}

func (f *fakeStore) Volumes() repo.VolumesRepo {
	return f.volumesRepo
}

func orgPtr(id int64) *int64 { return &id }

func newTestOrgID() int64 { return 1 }

// spyAuditLogger records every LogEvent call so tests can assert
// destructive operations are actually audited, not just that the HTTP
// response looks right.
type spyAuditLogger struct {
	events []audit.Event
}

func (s *spyAuditLogger) LogEvent(ctx context.Context, event audit.Event) error {
	s.events = append(s.events, event)
	return nil
}

func (s *spyAuditLogger) GetEvents(ctx context.Context, filters audit.EventFilters) ([]*audit.Event, error) {
	return nil, nil
}

func (s *spyAuditLogger) SearchEvents(ctx context.Context, filters audit.SearchFilters) ([]*audit.Event, int64, error) {
	return nil, 0, nil
}

func TestHandler_DeleteVolume(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("not found when store lookup fails", func(t *testing.T) {
		fakeRepo := &fakeVolumesRepo{
			getVolumeByVolumeID: func(ctx context.Context, orgID int64, volumeID string) (*models.Volume, error) {
				return nil, errors.New("no rows")
			},
		}
		mockService := &mockDockerService{}
		h := &Handler{
			dockerService: mockService,
			store:         &fakeStore{volumesRepo: fakeRepo},
			auditLogger:   audit.NewNoopLogger(),
		}

		router := gin.New()
		router.DELETE("/volumes/:name", h.DeleteVolume)

		req := httptest.NewRequest(http.MethodDelete, "/volumes/missing-vol", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("DeleteVolume() status = %d, want %d, body=%s", w.Code, http.StatusNotFound, w.Body.String())
		}
		if fakeRepo.hardDeleteCalls != 0 {
			t.Errorf("HardDeleteVolume should not be called when volume not found, got %d calls", fakeRepo.hardDeleteCalls)
		}
	})

	t.Run("conflict when volume still attached", func(t *testing.T) {
		orgID := newTestOrgID()
		fakeRepo := &fakeVolumesRepo{
			getVolumeByVolumeID: func(ctx context.Context, o int64, volumeID string) (*models.Volume, error) {
				return &models.Volume{VolumeID: volumeID, OrganizationID: orgPtr(orgID)}, nil
			},
		}
		var removeCalled bool
		mockService := &mockDockerService{
			getVolumeContainers: func(ctx context.Context, volumeName string) ([]models.VolumeContainer, error) {
				return []models.VolumeContainer{{Name: "my-container"}}, nil
			},
			removeVolume: func(ctx context.Context, volumeID string, force bool) error {
				removeCalled = true
				return nil
			},
		}
		h := &Handler{
			dockerService: mockService,
			store:         &fakeStore{volumesRepo: fakeRepo},
			auditLogger:   audit.NewNoopLogger(),
		}

		router := gin.New()
		router.DELETE("/volumes/:name", h.DeleteVolume)

		req := httptest.NewRequest(http.MethodDelete, "/volumes/attached-vol", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusConflict {
			t.Errorf("DeleteVolume() status = %d, want %d, body=%s", w.Code, http.StatusConflict, w.Body.String())
		}
		if removeCalled {
			t.Error("RemoveVolume must not be called when the live in-use guard trips")
		}
		if fakeRepo.hardDeleteCalls != 0 {
			t.Errorf("HardDeleteVolume should not be called on conflict, got %d calls", fakeRepo.hardDeleteCalls)
		}
	})

	t.Run("conflict when Docker itself rejects removal", func(t *testing.T) {
		orgID := newTestOrgID()
		fakeRepo := &fakeVolumesRepo{
			getVolumeByVolumeID: func(ctx context.Context, o int64, volumeID string) (*models.Volume, error) {
				return &models.Volume{VolumeID: volumeID, OrganizationID: orgPtr(orgID)}, nil
			},
		}
		mockService := &mockDockerService{
			getVolumeContainers: func(ctx context.Context, volumeName string) ([]models.VolumeContainer, error) {
				return nil, nil // guard sees no attachments (race), Docker itself catches it
			},
			removeVolume: func(ctx context.Context, volumeID string, force bool) error {
				return &dockerConflictError{}
			},
		}
		h := &Handler{
			dockerService: mockService,
			store:         &fakeStore{volumesRepo: fakeRepo},
			auditLogger:   audit.NewNoopLogger(),
		}

		router := gin.New()
		router.DELETE("/volumes/:name", h.DeleteVolume)

		req := httptest.NewRequest(http.MethodDelete, "/volumes/race-vol", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusConflict {
			t.Errorf("DeleteVolume() status = %d, want %d, body=%s", w.Code, http.StatusConflict, w.Body.String())
		}
		if fakeRepo.hardDeleteCalls != 0 {
			t.Errorf("HardDeleteVolume should not be called when Docker rejects removal, got %d calls", fakeRepo.hardDeleteCalls)
		}
	})

	t.Run("success deletes volume and cleans up DB row", func(t *testing.T) {
		orgID := newTestOrgID()
		fakeRepo := &fakeVolumesRepo{
			getVolumeByVolumeID: func(ctx context.Context, o int64, volumeID string) (*models.Volume, error) {
				return &models.Volume{VolumeID: volumeID, OrganizationID: orgPtr(orgID)}, nil
			},
		}
		var removeCalledWith struct {
			volumeID string
			force    bool
		}
		mockService := &mockDockerService{
			getVolumeContainers: func(ctx context.Context, volumeName string) ([]models.VolumeContainer, error) {
				return nil, nil
			},
			removeVolume: func(ctx context.Context, volumeID string, force bool) error {
				removeCalledWith.volumeID = volumeID
				removeCalledWith.force = force
				return nil
			},
		}
		h := &Handler{
			dockerService: mockService,
			store:         &fakeStore{volumesRepo: fakeRepo},
			auditLogger:   audit.NewNoopLogger(),
		}

		router := gin.New()
		router.DELETE("/volumes/:name", h.DeleteVolume)

		req := httptest.NewRequest(http.MethodDelete, "/volumes/clean-vol", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("DeleteVolume() status = %d, want %d, body=%s", w.Code, http.StatusOK, w.Body.String())
		}
		if removeCalledWith.volumeID != "clean-vol" {
			t.Errorf("RemoveVolume called with volumeID %q, want %q", removeCalledWith.volumeID, "clean-vol")
		}
		if removeCalledWith.force != false {
			t.Error("RemoveVolume must always be called with force=false")
		}
		if fakeRepo.hardDeleteCalls != 1 {
			t.Errorf("HardDeleteVolume called %d times, want 1", fakeRepo.hardDeleteCalls)
		}
	})

	t.Run("idempotent when Docker reports already gone", func(t *testing.T) {
		orgID := newTestOrgID()
		fakeRepo := &fakeVolumesRepo{
			getVolumeByVolumeID: func(ctx context.Context, o int64, volumeID string) (*models.Volume, error) {
				return &models.Volume{VolumeID: volumeID, OrganizationID: orgPtr(orgID)}, nil
			},
		}
		mockService := &mockDockerService{
			getVolumeContainers: func(ctx context.Context, volumeName string) ([]models.VolumeContainer, error) {
				return nil, nil
			},
			removeVolume: func(ctx context.Context, volumeID string, force bool) error {
				return &dockerNotFoundError{}
			},
		}
		h := &Handler{
			dockerService: mockService,
			store:         &fakeStore{volumesRepo: fakeRepo},
			auditLogger:   audit.NewNoopLogger(),
		}

		router := gin.New()
		router.DELETE("/volumes/:name", h.DeleteVolume)

		req := httptest.NewRequest(http.MethodDelete, "/volumes/already-gone", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("DeleteVolume() status = %d, want %d (idempotent), body=%s", w.Code, http.StatusOK, w.Body.String())
		}
		if fakeRepo.hardDeleteCalls != 1 {
			t.Errorf("HardDeleteVolume called %d times, want 1 (cleanup should still happen)", fakeRepo.hardDeleteCalls)
		}
	})
}

func TestHandler_DeleteVolume_Audit(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("success writes a success audit event", func(t *testing.T) {
		orgID := newTestOrgID()
		fakeRepo := &fakeVolumesRepo{
			getVolumeByVolumeID: func(ctx context.Context, o int64, volumeID string) (*models.Volume, error) {
				return &models.Volume{VolumeID: volumeID, OrganizationID: orgPtr(orgID)}, nil
			},
		}
		mockService := &mockDockerService{
			getVolumeContainers: func(ctx context.Context, volumeName string) ([]models.VolumeContainer, error) {
				return nil, nil
			},
			removeVolume: func(ctx context.Context, volumeID string, force bool) error {
				return nil
			},
		}
		spy := &spyAuditLogger{}
		h := &Handler{
			dockerService: mockService,
			store:         &fakeStore{volumesRepo: fakeRepo},
			auditLogger:   spy,
		}

		router := gin.New()
		router.DELETE("/volumes/:name", h.DeleteVolume)
		req := httptest.NewRequest(http.MethodDelete, "/volumes/audited-vol", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("DeleteVolume() status = %d, want %d, body=%s", w.Code, http.StatusOK, w.Body.String())
		}
		if len(spy.events) != 1 {
			t.Fatalf("expected exactly 1 audit event, got %d", len(spy.events))
		}
		e := spy.events[0]
		if e.Action != "VOLUME_DELETE" {
			t.Errorf("audit Action = %q, want VOLUME_DELETE", e.Action)
		}
		if e.ResourceType != "volume" {
			t.Errorf("audit ResourceType = %q, want volume", e.ResourceType)
		}
		if e.ResourceID != "audited-vol" {
			t.Errorf("audit ResourceID = %q, want audited-vol", e.ResourceID)
		}
		if e.Status != "success" {
			t.Errorf("audit Status = %q, want success", e.Status)
		}
		if e.OrganizationID != orgID {
			t.Errorf("audit OrganizationID = %d, want %d", e.OrganizationID, orgID)
		}
	})

	t.Run("conflict writes a failure audit event with attached container names", func(t *testing.T) {
		orgID := newTestOrgID()
		fakeRepo := &fakeVolumesRepo{
			getVolumeByVolumeID: func(ctx context.Context, o int64, volumeID string) (*models.Volume, error) {
				return &models.Volume{VolumeID: volumeID, OrganizationID: orgPtr(orgID)}, nil
			},
		}
		mockService := &mockDockerService{
			getVolumeContainers: func(ctx context.Context, volumeName string) ([]models.VolumeContainer, error) {
				return []models.VolumeContainer{{Name: "web-1"}}, nil
			},
		}
		spy := &spyAuditLogger{}
		h := &Handler{
			dockerService: mockService,
			store:         &fakeStore{volumesRepo: fakeRepo},
			auditLogger:   spy,
		}

		router := gin.New()
		router.DELETE("/volumes/:name", h.DeleteVolume)
		req := httptest.NewRequest(http.MethodDelete, "/volumes/attached-audit-vol", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusConflict {
			t.Fatalf("DeleteVolume() status = %d, want %d, body=%s", w.Code, http.StatusConflict, w.Body.String())
		}
		if len(spy.events) != 1 {
			t.Fatalf("expected exactly 1 audit event, got %d", len(spy.events))
		}
		e := spy.events[0]
		if e.Status != "failure" {
			t.Errorf("audit Status = %q, want failure", e.Status)
		}
		names, ok := e.Details["attached_containers"].([]string)
		if !ok || len(names) != 1 || names[0] != "web-1" {
			t.Errorf("audit Details[attached_containers] = %v, want [web-1]", e.Details["attached_containers"])
		}
	})
}

func TestHandler_BulkDeleteVolumes(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("partial failure: one succeeds, one is attached", func(t *testing.T) {
		orgID := newTestOrgID()
		fakeRepo := &fakeVolumesRepo{
			getVolumeByVolumeID: func(ctx context.Context, o int64, volumeID string) (*models.Volume, error) {
				return &models.Volume{VolumeID: volumeID, OrganizationID: orgPtr(orgID)}, nil
			},
		}
		mockService := &mockDockerService{
			getVolumeContainers: func(ctx context.Context, volumeName string) ([]models.VolumeContainer, error) {
				if volumeName == "attached-vol" {
					return []models.VolumeContainer{{Name: "c1"}}, nil
				}
				return nil, nil
			},
			removeVolume: func(ctx context.Context, volumeID string, force bool) error {
				return nil
			},
		}
		h := &Handler{
			dockerService: mockService,
			store:         &fakeStore{volumesRepo: fakeRepo},
			auditLogger:   audit.NewNoopLogger(),
		}

		router := gin.New()
		router.POST("/volumes/bulk-delete", h.BulkDeleteVolumes)

		body, _ := json.Marshal(BulkDeleteVolumesRequest{VolumeIDs: []string{"clean-vol", "attached-vol"}})
		req := httptest.NewRequest(http.MethodPost, "/volumes/bulk-delete", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("BulkDeleteVolumes() status = %d, want %d, body=%s", w.Code, http.StatusOK, w.Body.String())
		}

		var resp BulkDeleteVolumesResponse
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to unmarshal response: %v", err)
		}
		if len(resp.Succeeded) != 1 || resp.Succeeded[0] != "clean-vol" {
			t.Errorf("Succeeded = %v, want [clean-vol]", resp.Succeeded)
		}
		if len(resp.Failed) != 1 || resp.Failed[0].VolumeID != "attached-vol" {
			t.Errorf("Failed = %v, want one entry for attached-vol", resp.Failed)
		}
		if fakeRepo.hardDeleteCalls != 1 {
			t.Errorf("HardDeleteVolume called %d times, want 1 (only for the succeeded volume)", fakeRepo.hardDeleteCalls)
		}
	})

	t.Run("empty volume_ids is a bad request", func(t *testing.T) {
		h := &Handler{
			dockerService: &mockDockerService{},
			store:         &fakeStore{volumesRepo: &fakeVolumesRepo{}},
			auditLogger:   audit.NewNoopLogger(),
		}

		router := gin.New()
		router.POST("/volumes/bulk-delete", h.BulkDeleteVolumes)

		body, _ := json.Marshal(BulkDeleteVolumesRequest{VolumeIDs: []string{}})
		req := httptest.NewRequest(http.MethodPost, "/volumes/bulk-delete", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("BulkDeleteVolumes() status = %d, want %d, body=%s", w.Code, http.StatusBadRequest, w.Body.String())
		}
	})
}

// dockerConflictError and dockerNotFoundError satisfy the containerd
// errdefs typed-error interfaces (IsConflict/IsNotFound check for a
// Conflict()/NotFound() bool method via errors.As), letting tests exercise
// deleteOneVolume's cerrdefs classification without needing a real Docker
// daemon.
type dockerConflictError struct{}

func (e *dockerConflictError) Error() string { return "volume is in use" }
func (e *dockerConflictError) Conflict()     {}

type dockerNotFoundError struct{}

func (e *dockerNotFoundError) Error() string { return "no such volume" }
func (e *dockerNotFoundError) NotFound()     {}
