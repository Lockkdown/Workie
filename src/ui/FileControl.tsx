import type { InputHTMLAttributes } from "react";

type FileControlProps = {
  label: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function FileControl({
  label,
  id,
  className,
  ...rest
}: FileControlProps) {
  const classes = ["ui-field", className].filter(Boolean).join(" ");
  return (
    <div className="ui-file-control">
      <label className="type-body-m" htmlFor={id}>
        {label}
      </label>
      <input id={id} type="file" className={classes} {...rest} />
    </div>
  );
}
