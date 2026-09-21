import { create } from 'zustand'

// Bridges the Ctrl+I global screenshot capture (fired from anywhere in the
// app, see Dashboard.jsx) to the Feedback page it navigates to — a client-
// side route change can't pass a Blob any other way. FeedbackPage reads and
// clears this once on mount, so a later plain visit to /feedback doesn't
// resurrect a stale capture.
export const useFeedbackDraftStore = create((set, get) => ({
  screenshotBlob: null,
  screenshotDataUrl: null,
  suggestedCategory: '',

  setDraft: (screenshotBlob, screenshotDataUrl, suggestedCategory) =>
    set({ screenshotBlob, screenshotDataUrl, suggestedCategory }),

  // Returns the current draft and clears the store in one call, so a
  // consumer can't read it twice.
  consumeDraft: () => {
    const draft = {
      screenshotBlob: get().screenshotBlob,
      screenshotDataUrl: get().screenshotDataUrl,
      suggestedCategory: get().suggestedCategory,
    }
    set({ screenshotBlob: null, screenshotDataUrl: null, suggestedCategory: '' })
    return draft
  },
}))
