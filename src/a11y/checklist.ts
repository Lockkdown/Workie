/** WCAG 2.2 AA floor plus the two [D92] enhancements. Not full-application AAA. */

export const CONFORMANCE_CLAIM =
  "Web v1 meets WCAG 2.2 Level AA. Two enhancements sit on top of that floor: 44×44 primary/touch targets, and Focus Appearance (AAA) for the keyboard focus indicator. This is not a full-application AAA claim.";

export type CriterionLevel = "AA" | "AAA";

export type Criterion = {
  id: string;
  name: string;
  level: CriterionLevel;
  role: "mandatory-floor" | "selected-enhancement" | "not-applicable";
  note: string;
};

export const AA_FLOOR: readonly Criterion[] = [
  {
    id: "1.1.1",
    name: "Non-text Content",
    level: "AA",
    role: "mandatory-floor",
    note: "Icons are decorative with visible labels; status uses label plus icon.",
  },
  {
    id: "1.3.1",
    name: "Info and Relationships",
    level: "AA",
    role: "mandatory-floor",
    note: "Headings, labels, lists, and dialog names come from the DOM.",
  },
  {
    id: "1.3.2",
    name: "Meaningful Sequence",
    level: "AA",
    role: "mandatory-floor",
    note: "Source order follows Daily Desk, Plan Tomorrow, then Reports.",
  },
  {
    id: "1.3.3",
    name: "Sensory Characteristics",
    level: "AA",
    role: "mandatory-floor",
    note: "No instruction relies on colour, shape, or sound alone.",
  },
  {
    id: "1.3.4",
    name: "Orientation",
    level: "AA",
    role: "mandatory-floor",
    note: "Layout reflows; it is not locked to one orientation.",
  },
  {
    id: "1.4.1",
    name: "Use of Color",
    level: "AA",
    role: "mandatory-floor",
    note: "Every state has a visible English label in addition to colour.",
  },
  {
    id: "1.4.3",
    name: "Contrast (Minimum)",
    level: "AA",
    role: "mandatory-floor",
    note: "Body text tokens are tested at 4.5:1 in Dark and Light.",
  },
  {
    id: "1.4.4",
    name: "Resize Text",
    level: "AA",
    role: "mandatory-floor",
    note: "Text uses rem/CSS tokens; zoom keeps behavior.",
  },
  {
    id: "1.4.5",
    name: "Images of Text",
    level: "AA",
    role: "mandatory-floor",
    note: "UI copy is real text, not bitmaps.",
  },
  {
    id: "1.4.10",
    name: "Reflow",
    level: "AA",
    role: "mandatory-floor",
    note: "No page-level horizontal scroll at the four locked widths.",
  },
  {
    id: "1.4.11",
    name: "Non-text Contrast",
    level: "AA",
    role: "mandatory-floor",
    note: "Focus indicator and borders meet 3:1 against adjacent surfaces.",
  },
  {
    id: "1.4.12",
    name: "Text Spacing",
    level: "AA",
    role: "mandatory-floor",
    note: "Layout uses wrapping flex/grid with min-width 0.",
  },
  {
    id: "1.4.13",
    name: "Content on Hover or Focus",
    level: "AA",
    role: "mandatory-floor",
    note: "No hover-only content; details and dialogs stay until dismissed.",
  },
  {
    id: "2.1.1",
    name: "Keyboard",
    level: "AA",
    role: "mandatory-floor",
    note: "Every drag has a labelled keyboard path with the same result.",
  },
  {
    id: "2.1.2",
    name: "No Keyboard Trap",
    level: "AA",
    role: "mandatory-floor",
    note: "Dialogs expose an explicit close or cancel control.",
  },
  {
    id: "2.2.1",
    name: "Timing Adjustable",
    level: "AA",
    role: "mandatory-floor",
    note: "Pomodoro is a user-started budget, not a session timeout.",
  },
  {
    id: "2.2.2",
    name: "Pause, Stop, Hide",
    level: "AA",
    role: "mandatory-floor",
    note: "Ritual flourishes are skippable; dense areas have no idle motion.",
  },
  {
    id: "2.3.1",
    name: "Three Flashes or Below Threshold",
    level: "AA",
    role: "mandatory-floor",
    note: "No flashing content.",
  },
  {
    id: "2.4.1",
    name: "Bypass Blocks",
    level: "AA",
    role: "mandatory-floor",
    note: "Skip to main content is the first focusable control.",
  },
  {
    id: "2.4.2",
    name: "Page Titled",
    level: "AA",
    role: "mandatory-floor",
    note: "Document title is Workie.",
  },
  {
    id: "2.4.3",
    name: "Focus Order",
    level: "AA",
    role: "mandatory-floor",
    note: "Chrome, then main; destinations stay in nav order.",
  },
  {
    id: "2.4.4",
    name: "Link Purpose (In Context)",
    level: "AA",
    role: "mandatory-floor",
    note: "The skip link names its destination.",
  },
  {
    id: "2.4.5",
    name: "Multiple Ways",
    level: "AA",
    role: "mandatory-floor",
    note: "The three destinations are always in app navigation.",
  },
  {
    id: "2.4.6",
    name: "Headings and Labels",
    level: "AA",
    role: "mandatory-floor",
    note: "Controls have visible English names from the spec.",
  },
  {
    id: "2.4.7",
    name: "Focus Visible",
    level: "AA",
    role: "mandatory-floor",
    note: "A 2px outline plus 2px offset is always on :focus-visible.",
  },
  {
    id: "2.4.11",
    name: "Focus Not Obscured (Minimum)",
    level: "AA",
    role: "mandatory-floor",
    note: "Ornament does not clip the focus ring; overlays portal above the desk.",
  },
  {
    id: "2.5.1",
    name: "Pointer Gestures",
    level: "AA",
    role: "mandatory-floor",
    note: "No path-based multi-point gesture is required.",
  },
  {
    id: "2.5.2",
    name: "Pointer Cancellation",
    level: "AA",
    role: "mandatory-floor",
    note: "Buttons activate on click/up, not pointer down.",
  },
  {
    id: "2.5.3",
    name: "Label in Name",
    level: "AA",
    role: "mandatory-floor",
    note: "Accessible names include the visible English label.",
  },
  {
    id: "2.5.4",
    name: "Motion Actuation",
    level: "AA",
    role: "mandatory-floor",
    note: "No device-motion control exists.",
  },
  {
    id: "2.5.7",
    name: "Dragging Movements",
    level: "AA",
    role: "mandatory-floor",
    note: "Each drag has a single-pointer labelled control and a keyboard path.",
  },
  {
    id: "2.5.8",
    name: "Target Size (Minimum)",
    level: "AA",
    role: "mandatory-floor",
    note: "Compact controls are at least 24×24 CSS px.",
  },
  {
    id: "3.1.1",
    name: "Language of Page",
    level: "AA",
    role: "mandatory-floor",
    note: "html lang is en.",
  },
  {
    id: "3.2.1",
    name: "On Focus",
    level: "AA",
    role: "mandatory-floor",
    note: "Focus does not change context.",
  },
  {
    id: "3.2.2",
    name: "On Input",
    level: "AA",
    role: "mandatory-floor",
    note: "Changing a control does not teleport destination.",
  },
  {
    id: "3.2.3",
    name: "Consistent Navigation",
    level: "AA",
    role: "mandatory-floor",
    note: "Nav is Daily Desk, Plan Tomorrow, Reports on every surface.",
  },
  {
    id: "3.2.4",
    name: "Consistent Identification",
    level: "AA",
    role: "mandatory-floor",
    note: "Canonical names stay un-reworded.",
  },
  {
    id: "3.2.6",
    name: "Consistent Help",
    level: "AA",
    role: "mandatory-floor",
    note: "System states name the cause, kept data, and recovery.",
  },
  {
    id: "3.3.1",
    name: "Error Identification",
    level: "AA",
    role: "mandatory-floor",
    note: "Errors are literal English text on the affected item.",
  },
  {
    id: "3.3.2",
    name: "Labels or Instructions",
    level: "AA",
    role: "mandatory-floor",
    note: "Inputs have visible labels.",
  },
  {
    id: "3.3.3",
    name: "Error Suggestion",
    level: "AA",
    role: "mandatory-floor",
    note: "Validation names the field and the recovery.",
  },
  {
    id: "3.3.4",
    name: "Error Prevention (Legal, Financial, Data)",
    level: "AA",
    role: "mandatory-floor",
    note: "Import confirm is atomic; destructive task closes ask first.",
  },
  {
    id: "3.3.7",
    name: "Redundant Entry",
    level: "AA",
    role: "mandatory-floor",
    note: "Review drafts restore edited fields after reload.",
  },
  {
    id: "4.1.2",
    name: "Name, Role, Value",
    level: "AA",
    role: "mandatory-floor",
    note: "Buttons, radios, dialogs, and status use native or ARIA roles.",
  },
  {
    id: "4.1.3",
    name: "Status Messages",
    level: "AA",
    role: "mandatory-floor",
    note: "Offline, loading, and errors use status or alert roles.",
  },
] as const;

export const AA_NOT_APPLICABLE: readonly Criterion[] = [
  {
    id: "1.2.x",
    name: "Time-based Media",
    level: "AA",
    role: "not-applicable",
    note: "Web v1 has no prerecorded video or captions track.",
  },
  {
    id: "1.3.5",
    name: "Identify Input Purpose",
    level: "AA",
    role: "not-applicable",
    note: "No personal-data autocomplete fields.",
  },
  {
    id: "1.4.2",
    name: "Audio Control",
    level: "AA",
    role: "not-applicable",
    note: "Audio never autoplays; cues are opt-in after a user gesture.",
  },
  {
    id: "2.1.4",
    name: "Character Key Shortcuts",
    level: "AA",
    role: "not-applicable",
    note: "No single-character shortcuts.",
  },
  {
    id: "3.3.8",
    name: "Accessible Authentication (Minimum)",
    level: "AA",
    role: "not-applicable",
    note: "No login in Web v1.",
  },
] as const;

/** Selected on top of the AA floor. These are not claimed for the whole app. */
export const D92_ENHANCEMENTS: readonly Criterion[] = [
  {
    id: "2.5.5",
    name: "Target Size (Enhanced)",
    level: "AAA",
    role: "selected-enhancement",
    note: "Primary and touch controls aim for 44×44 CSS px.",
  },
  {
    id: "2.4.13",
    name: "Focus Appearance",
    level: "AAA",
    role: "selected-enhancement",
    note: "Focus indicator aims for Focus Appearance AAA: 2px outline, 2px offset, 3:1, unclipped.",
  },
] as const;

export const SKIP_TO_MAIN = "Skip to main content";
export const MAIN_CONTENT_ID = "main-content";

export function claimsFullApplicationAaa(text: string): boolean {
  return (
    /full-application AAA(?! claim)/i.test(text) || /blanket AAA/i.test(text)
  );
}
