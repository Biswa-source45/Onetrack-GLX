package domain

import (
	"encoding/json"
	"time"
)

// Known configuration keys
const (
	ConfigKeyStage2RequireAmPresales = "stage2_require_am_presales"
)

// SystemConfig represents a dynamic platform configuration entry in auth.system_configurations.
type SystemConfig struct {
	Key         string          `json:"key"`
	Value       json.RawMessage `json:"value"`
	Description *string         `json:"description,omitempty"`
	UpdatedBy   *string         `json:"updated_by,omitempty"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

// UpdateConfigRequest represents the payload to update a configuration key's value.
type UpdateConfigRequest struct {
	Value json.RawMessage `json:"value" binding:"required"`
}
