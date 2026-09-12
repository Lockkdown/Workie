import {
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
} from "react";
import { COPY } from "./copy";
import "./fileControl.css";

type FileControlProps = {
  label: string;
  id: string;
  "data-control"?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type">;

export function FileControl({
  label,
  id,
  className,
  onChange,
  "data-control": dataControl,
  ...rest
}: FileControlProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const triggerId = `${id}-trigger`;
  const messageId = `${id}-chosen`;

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    setChosen(file?.name);
    onChange?.(event);
  }

  return (
    <div className="ui-file-control">
      <label className="type-body-m" htmlFor={triggerId}>
        {label}
      </label>
      <input
        {...rest}
        ref={inputRef}
        id={id}
        type="file"
        className="ui-file-native"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleChange}
      />
      <button
        type="button"
        id={triggerId}
        className={["ui-field", className].filter(Boolean).join(" ")}
        data-control={dataControl}
        aria-describedby={messageId}
        onClick={() => {
          inputRef.current?.click();
        }}
      >
        {COPY.chooseFile}
      </button>
      <p id={messageId} className="type-body-s" data-file-chosen="true">
        {chosen ?? COPY.noFileSelected}
      </p>
    </div>
  );
}
