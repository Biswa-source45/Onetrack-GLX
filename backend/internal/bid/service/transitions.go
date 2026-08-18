package service

import "github.com/onetrack/backend/internal/bid/domain"

// allowedTransitions defines valid stage progressions for each creation mode.
// MANUAL mode skips AI-driven stages (UNDER_ANALYSIS, QUALIFICATION_PENDING).
// INTELLIGENCE mode uses all stages including AI processing stages.
// Both modes share all stages from QUALIFICATION_REVIEW onward.
var allowedTransitions = map[string]map[string][]string{
	domain.CreationModeManual: {
		domain.StageDiscovered:              {domain.StageEligibilityAssessment, domain.StageOEMAuthorizationRequest, domain.StageCancelled},
		domain.StageEligibilityAssessment:   {domain.StageOEMAuthorizationRequest, domain.StagePricingRequest, domain.StageCancelled},
		domain.StageOEMAuthorizationRequest: {domain.StagePricingRequest, domain.StageDocumentChecklistPrep, domain.StageCancelled},
		domain.StagePricingRequest:          {domain.StageDocumentChecklistPrep, domain.StageEMDProcessing, domain.StageCancelled},
		domain.StageDocumentChecklistPrep:   {domain.StageEMDProcessing, domain.StageInternalApproval, domain.StageCancelled},
		domain.StageEMDProcessing:           {domain.StageInternalApproval, domain.StageGeMSubmission, domain.StageCancelled},
		domain.StageInternalApproval:        {domain.StageGeMSubmission, domain.StageCancelled},
		domain.StageGeMSubmission:           {domain.StageTechnicalEvaluation, domain.StageCancelled},
		domain.StageTechnicalEvaluation:     {domain.StageFinancialEvaluation, domain.StageLost, domain.StageCancelled},
		domain.StageFinancialEvaluation:     {domain.StageAwardHandover, domain.StageLost, domain.StageCancelled},
		domain.StageAwardHandover:           {},
	},
	domain.CreationModeIntelligence: {
		domain.StageDiscovered:              {domain.StageEligibilityAssessment, domain.StageCancelled},
		domain.StageEligibilityAssessment:   {domain.StageOEMAuthorizationRequest, domain.StagePricingRequest, domain.StageCancelled},
		domain.StageOEMAuthorizationRequest: {domain.StagePricingRequest, domain.StageDocumentChecklistPrep, domain.StageCancelled},
		domain.StagePricingRequest:          {domain.StageDocumentChecklistPrep, domain.StageEMDProcessing, domain.StageCancelled},
		domain.StageDocumentChecklistPrep:   {domain.StageEMDProcessing, domain.StageInternalApproval, domain.StageCancelled},
		domain.StageEMDProcessing:           {domain.StageInternalApproval, domain.StageGeMSubmission, domain.StageCancelled},
		domain.StageInternalApproval:        {domain.StageGeMSubmission, domain.StageCancelled},
		domain.StageGeMSubmission:           {domain.StageTechnicalEvaluation, domain.StageCancelled},
		domain.StageTechnicalEvaluation:     {domain.StageFinancialEvaluation, domain.StageLost, domain.StageCancelled},
		domain.StageFinancialEvaluation:     {domain.StageAwardHandover, domain.StageLost, domain.StageCancelled},
		domain.StageAwardHandover:           {},
	},
}

// IsTransitionAllowed checks if moving from currentStage to targetStage is valid
// for the given creation mode. It allows forward progression, backward transitions (Undo/Revert),
// and terminal states (WON, LOST, CANCELLED).
func IsTransitionAllowed(creationMode, currentStage, targetStage string) bool {
	if currentStage == targetStage {
		return true
	}
	// Allow revoking cancellation to any active stage
	if currentStage == domain.StageCancelled && !IsTerminalStage(targetStage) {
		return true
	}
	if IsTerminalStage(currentStage) {
		return false
	}
	if IsTerminalStage(targetStage) {
		return true
	}

	modeMap, ok := allowedTransitions[creationMode]
	if !ok {
		// Fallback to manual mode transitions if mode not found
		modeMap = allowedTransitions[domain.CreationModeManual]
	}

	// Check forward allowed transitions map
	if allowed, ok := modeMap[currentStage]; ok {
		for _, s := range allowed {
			if s == targetStage {
				return true
			}
		}
	}

	// Allow backward transitions (Undo/Revert to any previous stage)
	currIdx := -1
	targetIdx := -1
	for i, s := range domain.OrderedWorkflowStages {
		if s == currentStage {
			currIdx = i
		}
		if s == targetStage {
			targetIdx = i
		}
	}

	if currIdx != -1 && targetIdx != -1 && targetIdx < currIdx {
		// Backward movement is always allowed as an Undo/Revert operation
		return true
	}

	return false
}

// GetAllowedTransitions returns the list of stages a bid can transition to from
// its current state, including preceding stages for Undo/Revert operations.
func GetAllowedTransitions(creationMode, currentStage string) []string {
	if IsTerminalStage(currentStage) {
		return []string{}
	}
	modeMap, ok := allowedTransitions[creationMode]
	if !ok {
		modeMap = allowedTransitions[domain.CreationModeManual]
	}
	res := []string{}
	if allowed, ok := modeMap[currentStage]; ok {
		res = append(res, allowed...)
	}

	// Also append preceding stage if available (for Undo/Revert)
	for i, s := range domain.OrderedWorkflowStages {
		if s == currentStage && i > 0 {
			prevStage := domain.OrderedWorkflowStages[i-1]
			// Check if already in res
			alreadyIn := false
			for _, r := range res {
				if r == prevStage {
					alreadyIn = true
					break
				}
			}
			if !alreadyIn {
				res = append(res, prevStage)
			}
			break
		}
	}

	return res
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
