const svgProps = {
  viewBox: "0 0 16 16",
  width: 16,
  height: 16,
  "aria-hidden": true as const,
  focusable: false as const,
};

export function OfflineIcon() {
  return (
    <svg {...svgProps} data-icon="offline">
      <path
        d="M3 11.5c2.2-2 4.8-3 5-3M8 8.5c.2 0 2.8 1 5 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M4 4l8 8" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function WarningIcon() {
  return (
    <svg {...svgProps} data-icon="warning">
      <path
        d="M8 2.5 14.5 13.5H1.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 6.5v3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M8 12.2h.01" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
