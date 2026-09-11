export const DESTINATIONS = ["Daily Desk", "Plan Tomorrow", "Reports"] as const;

export type Destination = (typeof DESTINATIONS)[number];

export const DEFAULT_DESTINATION: Destination = "Daily Desk";

export const DESK_MODES = ["Tasks", "Day", "Now"] as const;

export type DeskMode = (typeof DESK_MODES)[number];

export const DEFAULT_DESK_MODE: DeskMode = "Day";
