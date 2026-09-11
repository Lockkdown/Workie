import type { BlockType, SemanticState } from "./types";
import { statusSlug } from "./types";

type StatusIconProps = {
  status: SemanticState;
};

const svgProps = {
  viewBox: "0 0 16 16",
  width: 16,
  height: 16,
  "aria-hidden": true as const,
  focusable: false as const,
};

export function StatusIcon({ status }: StatusIconProps) {
  const icon = statusSlug(status);
  switch (status) {
    case "Waiting":
      return (
        <svg {...svgProps} data-icon={icon}>
          <circle
            cx="8"
            cy="8"
            r="5.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
    case "In Progress":
      return (
        <svg {...svgProps} data-icon={icon}>
          <circle
            cx="8"
            cy="8"
            r="5.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M8 2.5a5.5 5.5 0 0 1 0 11Z" fill="currentColor" />
        </svg>
      );
    case "Deferred":
      return (
        <svg {...svgProps} data-icon={icon}>
          <circle
            cx="7"
            cy="8.5"
            r="4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M7 6.5v2l1.5 1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="square"
          />
          <path
            d="M10.5 3.5a4.5 4.5 0 0 1 3 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M12.2 5.2 13.5 7 11.3 7.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="miter"
          />
        </svg>
      );
    case "Completed":
      return (
        <svg {...svgProps} data-icon={icon}>
          <path
            d="M3.5 8.5 6.5 11.5 12.5 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </svg>
      );
    case "Abandoned":
      return (
        <svg {...svgProps} data-icon={icon}>
          <path
            d="M2 8h4M10 8h4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="square"
          />
          <path
            d="M7 6.5 9 9.5M9 6.5 7 9.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
    case "Cancelled":
      return (
        <svg {...svgProps} data-icon={icon}>
          <path
            d="M4 4l8 8M12 4l-8 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="square"
          />
        </svg>
      );
    case "Conflict":
      return (
        <svg {...svgProps} data-icon={icon}>
          <path
            d="M8 2.5 14.5 13.5H1.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="miter"
          />
          <path
            d="M8 6.5v3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="square"
          />
          <path d="M8 12.2h.01" stroke="currentColor" strokeWidth="2" />
          <path
            d="M4.5 12.2 7 8M6.2 13 9.2 7.2M10.2 13 12.4 9.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        </svg>
      );
  }
}

export function BlockTypeIcon({ blockType }: { blockType: BlockType }) {
  if (blockType === "fixed") {
    return (
      <svg {...svgProps} data-icon="anchor">
        <circle
          cx="8"
          cy="4.5"
          r="1.75"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M8 6.2v6.2M4.5 9.5H6M10 9.5h1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="square"
        />
        <path
          d="M4.2 10.8a4 4 0 0 0 7.6 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    );
  }
  return (
    <svg {...svgProps} data-icon="chain">
      <rect
        x="1.5"
        y="5"
        width="6.5"
        height="4"
        rx="1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        transform="rotate(-22 4.75 7)"
      />
      <rect
        x="8"
        y="7"
        width="6.5"
        height="4"
        rx="1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        transform="rotate(-22 11.25 9)"
      />
    </svg>
  );
}
