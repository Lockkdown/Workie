import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { OrnamentTier } from "./types";

export type ButtonVariant = "primary" | "secondary" | "destructive";
export type ButtonSize = "primary" | "compact";

type ButtonProps = {
  children: ReactNode;
  ornament?: OrnamentTier;
  variant?: ButtonVariant;
  size?: ButtonSize;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  children,
  ornament = "dense",
  variant = "secondary",
  size,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  const resolvedSize = size ?? "primary";
  const classes = ["ui-button", "ui-ornament", className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      data-ornament={ornament}
      data-variant={variant}
      data-size={resolvedSize}
    >
      <span className="ui-ornament-content">{children}</span>
    </button>
  );
}
