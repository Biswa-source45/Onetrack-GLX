package service

import "github.com/onetrack/backend/internal/bid/domain"

// allowedTransitions defines valid stage progressions for each creation mode.
// MANUAL mode skips AI-driven stages (UNDER_ANALYSIS, QUALIFICATION_PENDING).
// INTELLIGENCE mode uses all stages including AI processing stages.
// Both modes share all stages from QUALIFICATION_REVIEW onward.
var allowedTransitions = map[string]map[string][]string{
	domain.CreationModeManual: {
		domain.StageDiscovered:            {domain.StageQualificationReview, domain.StageCancelled},
		domain.StageQualificationReview:   {domain.StageDocumentCompilation, domain.StageCancelled},
		domain.StageDocumentCompilation:   {domain.StageOEMCoordination, domain.StageCommercialPreparation, domain.StageCancelled},
		domain.StageOEMCoordination:       {domain.StageCommercialPreparation, domain.StageCancelled},
		domain.StageCommercialPreparation: {domain.StageInternalReview},
		domain.StageInternalReview:        {domain.StageFinalApproval, domain.StageCommercialPreparation},
		domain.StageFinalApproval:         {domain.StageReadyForSubmission, domain.StageInternalReview},
		domain.StageReadyForSubmission:    {domain.StageSubmitted},
		domain.StageSubmitted:             {domain.StageRAActive, domain.StageAwaitingResult},
		domain.StageRAActive:              {domain.StageAwaitingResult},
		domain.StageAwaitingResult:        {domain.StageWon, domain.StageLost, domain.StageCancelled},
	},
	domain.CreationModeIntelligence: {
		// AI-mode entry: document upload triggers UNDER_ANALYSIS (set by orchestrator)
		domain.StageDiscovered:            {domain.StageUnderAnalysis, domain.StageCancelled},
		domain.StageUnderAnalysis:         {domain.StageQualificationPending, domain.StageCancelled},
		domain.StageQualificationPending:  {domain.StageQualificationReview, domain.StageCancelled},
		// Shared stages from here onward (identical to MANUAL)
		domain.StageQualificationReview:   {domain.StageDocumentCompilation, domain.StageCancelled},
		domain.StageDocumentCompilation:   {domain.StageOEMCoordination, domain.StageCommercialPreparation, domain.StageCancelled},
		domain.StageOEMCoordination:       {domain.StageCommercialPreparation, domain.StageCancelled},
		domain.StageCommercialPreparation: {domain.StageInternalReview},
		domain.StageInternalReview:        {domain.StageFinalApproval, domain.StageCommercialPreparation},
		domain.StageFinalApproval:         {domain.StageReadyForSubmission, domain.StageInternalReview},
		domain.StageReadyForSubmission:    {domain.StageSubmitted},
		domain.StageSubmitted:             {domain.StageRAActive, domain.StageAwaitingResult},
		domain.StageRAActive:              {domain.StageAwaitingResult},
		domain.StageAwaitingResult:        {domain.StageWon, domain.StageLost, domain.StageCancelled},
	},
}

// IsTransitionAllowed checks if moving from currentStage to targetStage is valid
// for the given creation mode. This is the single source of truth for transition
// validation, shared by both manual operator actions and AI orchestrator triggers.
func IsTransitionAllowed(creationMode, currentStage, targetStage string) bool {
	modeMap, ok := allowedTransitions[creationMode]
	if !ok {
		return false
	}
	allowed, ok := modeMap[currentStage]
	if !ok {
		return false
	}
	for _, s := range allowed {
		if s == targetStage {
			return true
		}
	}
	return false
}

// GetAllowedTransitions returns the list of stages a bid can transition to from
// its current state. Used by the frontend to render available actions.
func GetAllowedTransitions(creationMode, currentStage string) []string {
	modeMap, ok := allowedTransitions[creationMode]
	if !ok {
		return []string{}
	}
	allowed, ok := modeMap[currentStage]
	if !ok {
		return []string{}
	}
	return allowed
}

// terminalStages cannot be transitioned out of
var terminalStages = map[string]bool{
	domain.StageWon:       true,
	domain.StageLost:      true,
	domain.StageCancelled: true,
}

func IsTerminalStage(stage string) bool {
	return terminalStages[stage]
}
