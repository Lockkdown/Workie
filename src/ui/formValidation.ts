import { COPY } from "./copy";

export const CONSTRAINT_MESSAGE_SUFFIX = "-constraint-message";

export function constraintMessageId(fieldId: string): string {
  return `${fieldId}${CONSTRAINT_MESSAGE_SUFFIX}`;
}

export function isConstraintControl(
  element: Element,
): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  if (!(
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  )) {
    return false;
  }
  if (element.disabled) {
    return false;
  }
  if (element instanceof HTMLInputElement) {
    if (
      element.type === "hidden" ||
      element.type === "button" ||
      element.type === "submit" ||
      element.type === "reset" ||
      element.type === "image"
    ) {
      return false;
    }
    if (element.getAttribute("aria-hidden") === "true") {
      return false;
    }
  }
  return true;
}

export function constraintMessage(
  control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): string | undefined {
  const { validity } = control;
  if (validity.valid) {
    return undefined;
  }
  if (validity.valueMissing) {
    return COPY.valueMissing;
  }
  if (control instanceof HTMLInputElement) {
    if (validity.rangeUnderflow) {
      return COPY.rangeUnderflow(control.min);
    }
    if (validity.rangeOverflow) {
      return COPY.rangeOverflow(control.max);
    }
    if (validity.stepMismatch) {
      return COPY.stepMismatch(control.step);
    }
    if (validity.badInput) {
      return COPY.badInput;
    }
  }
  return COPY.valueMissing;
}

export function collectConstraintMessages(form: HTMLFormElement): {
  messages: Record<string, string>;
  firstId: string | undefined;
} {
  const messages: Record<string, string> = {};
  let firstId: string | undefined;
  for (const element of form.elements) {
    if (!isConstraintControl(element) || element.id.length === 0) {
      continue;
    }
    const message = constraintMessage(element);
    if (message) {
      messages[element.id] = message;
      firstId ??= element.id;
    }
  }
  return { messages, firstId };
}

export function preventNativeInvalid(event: {
  preventDefault: () => void;
}): void {
  event.preventDefault();
}

export function focusControl(form: HTMLFormElement, fieldId: string): void {
  const escape =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape
      : (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  form.querySelector<HTMLElement>(`#${escape(fieldId)}`)?.focus();
}
