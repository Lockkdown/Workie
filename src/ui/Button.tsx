import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { OrnamentTier } from "./types";

export type ButtonVariant = "primary" | "secondary" | "quiet";
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
  const framed = variant !== "quiet";
  const classes = ["ui-button", framed ? "ui-ornament" : undefined, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      data-ornament={framed ? ornament : undefined}
      data-variant={variant}
      data-size={resolvedSize}
    >
      {framed ? (
        <span className="ui-ornament-content">{children}</span>
      ) : (
        children
      )}
    </button>
  );
}
