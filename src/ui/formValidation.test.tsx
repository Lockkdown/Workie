import { describe, expect, it } from "vitest";
import { COPY } from "./copy";
import {
  collectConstraintMessages,
  constraintMessage,
  constraintMessageId,
  isConstraintControl,
  preventNativeInvalid,
} from "./formValidation";

function textInput(required: boolean, value: string): HTMLInputElement {
  const input = document.createElement("input");
  input.id = "title";
  input.type = "text";
  if (required) {
    input.required = true;
    input.setAttribute("aria-required", "true");
  }
  input.value = value;
  return input;
}

function numberInput(attrs: {
  id: string;
  min?: string;
  max?: string;
  step?: string;
  value: string;
}): HTMLInputElement {
  const input = document.createElement("input");
  input.id = attrs.id;
  input.type = "number";
  if (attrs.min !== undefined) {
    input.min = attrs.min;
  }
  if (attrs.max !== undefined) {
    input.max = attrs.max;
  }
  if (attrs.step !== undefined) {
    input.step = attrs.step;
  }
  input.value = attrs.value;
  return input;
}

describe("constraint messages [D91] [D104]", () => {
  it("maps required, min, max, and step to Workie English", () => {
    expect(constraintMessage(textInput(true, ""))).toBe(COPY.valueMissing);
    expect(
      constraintMessage(numberInput({ id: "count", min: "5", value: "1" })),
    ).toBe(COPY.rangeUnderflow("5"));
    expect(
      constraintMessage(numberInput({ id: "hour", max: "23", value: "24" })),
    ).toBe(COPY.rangeOverflow("23"));
    expect(
      constraintMessage(
        numberInput({
          id: "minute",
          min: "0",
          max: "59",
          step: "5",
          value: "3",
        }),
      ),
    ).toBe(COPY.stepMismatch("5"));
    expect(
      constraintMessage(numberInput({ id: "ok", min: "5", value: "10" })),
    ).toBeUndefined();
  });

  it("skips hidden file inputs and keeps the first invalid id", () => {
    const form = document.createElement("form");
    const file = document.createElement("input");
    file.type = "file";
    file.id = "batch";
    file.setAttribute("aria-hidden", "true");
    const title = textInput(true, "");
    form.append(file, title);
    expect(isConstraintControl(file)).toBe(false);
    const collected = collectConstraintMessages(form);
    expect(collected.firstId).toBe("title");
    expect(collected.messages.title).toBe(COPY.valueMissing);
    expect(constraintMessageId("title")).toBe("title-constraint-message");
  });

  it("prevents the native invalid default", () => {
    const event = new Event("invalid", { cancelable: true });
    preventNativeInvalid(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
