import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COPY } from "./copy";
import { ConstraintField, WorkieForm } from "./WorkieForm";

type Mounted = { root: Root; container: HTMLElement };
const mounted: Mounted[] = [];

function mount(ui: ReactElement): HTMLElement {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  mounted.push({ root, container });
  return container;
}

afterEach(() => {
  for (const item of mounted.splice(0)) {
    act(() => {
      item.root.unmount();
    });
    item.container.remove();
  }
});

describe("WorkieForm [D92] [D104]", () => {
  it("blocks submit, keeps constraints, links the message, and focuses the first invalid control", () => {
    const onValid = vi.fn();
    const container = mount(
      <WorkieForm onValidSubmit={onValid}>
        <ConstraintField fieldId="demo-title">
          <input name="title" required aria-required="true" />
        </ConstraintField>
        <ConstraintField fieldId="demo-count">
          <input
            name="count"
            type="number"
            min={5}
            max={10}
            step={5}
            defaultValue={1}
          />
        </ConstraintField>
        <button type="submit">Save</button>
      </WorkieForm>,
    );
    const form = container.querySelector("form");
    const title = container.querySelector("#demo-title");
    const count = container.querySelector("#demo-count");
    expect(form).toBeInstanceOf(HTMLFormElement);
    expect((form as HTMLFormElement).noValidate).toBe(true);
    expect(title).toBeInstanceOf(HTMLInputElement);
    expect((title as HTMLInputElement).required).toBe(true);
    expect(title?.getAttribute("aria-required")).toBe("true");
    expect((count as HTMLInputElement).min).toBe("5");
    expect((count as HTMLInputElement).max).toBe("10");
    expect((count as HTMLInputElement).step).toBe("5");

    act(() => {
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });

    expect(onValid).not.toHaveBeenCalled();
    expect(title?.getAttribute("aria-invalid")).toBe("true");
    expect(title?.getAttribute("aria-describedby")).toBe(
      "demo-title-constraint-message",
    );
    expect(
      container.querySelector("#demo-title-constraint-message")?.textContent,
    ).toBe(COPY.valueMissing);
    expect(document.activeElement).toBe(title);
    expect((title as HTMLInputElement).required).toBe(true);
    expect(title?.getAttribute("aria-required")).toBe("true");
    expect((count as HTMLInputElement).min).toBe("5");
    expect((count as HTMLInputElement).max).toBe("10");
    expect((count as HTMLInputElement).step).toBe("5");
  });

  it("preserves the submitter so named submit buttons still work", () => {
    const onValid = vi.fn();
    const container = mount(
      <WorkieForm onValidSubmit={onValid}>
        <button type="submit" name="resolution" value="keepConflict">
          Keep
        </button>
        <button type="submit" name="resolution" value="unscheduleBlock">
          Unschedule
        </button>
      </WorkieForm>,
    );

    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[value="unscheduleBlock"]')
        ?.click();
    });

    expect(onValid).toHaveBeenCalledTimes(1);
    const event = onValid.mock.calls[0]?.[0] as {
      nativeEvent: SubmitEvent;
    };
    expect(event.nativeEvent.submitter).toBeInstanceOf(HTMLButtonElement);
    expect((event.nativeEvent.submitter as HTMLButtonElement).value).toBe(
      "unscheduleBlock",
    );
  });

  it("swallows the native invalid event", () => {
    const container = mount(
      <WorkieForm onValidSubmit={() => undefined}>
        <input id="only" required />
      </WorkieForm>,
    );
    const input = container.querySelector("#only");
    expect(input).toBeInstanceOf(HTMLInputElement);
    const invalid = new Event("invalid", { bubbles: true, cancelable: true });
    input?.dispatchEvent(invalid);
    expect(invalid.defaultPrevented).toBe(true);
  });
});
