// Shared flat-pie hover behavior for donut charts across Dashboard.jsx and
// AnalyticsPage.jsx: the hovered slice stays full-opacity, everything else
// dims — no 3D pop-out, no callout lines.
export function dimOtherSlices(index, activeIndex) {
  return activeIndex === null || activeIndex === index ? 1 : 0.35
}
