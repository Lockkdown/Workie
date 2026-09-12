import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { persistCreatedTask } from "./boardActions";
import { COPY } from "./copy";
import { COPY as UI_COPY } from "../ui/copy";
import { TaskForm } from "./TaskForm";

vi.mock("./boardActions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./boardActions")>();
  return {
    ...actual,
    persistCreatedTask: vi.fn(),
  };
});

const persist = vi.mocked(persistCreatedTask);

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

function setInputValue(input: HTMLInputElement, value: string): void {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function buttonNamed(root: ParentNode, name: string): HTMLButtonElement {
  const found = [...root.querySelectorAll("button")].find(
    (button) => button.textContent?.replace(/\s+/g, " ").trim() === name,
  );
  if (found === undefined) {
    throw new Error(`No button named ${name}`);
  }
  return found;
}

function subtaskInputs(root: ParentNode): HTMLInputElement[] {
  return [...root.querySelectorAll('input[name^="subtask-"]')].filter(
    (node): node is HTMLInputElement => node instanceof HTMLInputElement,
  );
}

afterEach(() => {
  for (const item of mounted.splice(0)) {
    act(() => {
      item.root.unmount();
    });
    item.container.remove();
  }
});

describe("TaskForm interaction", () => {
  const onClose = vi.fn();
  const onCreated = vi.fn();

  beforeEach(() => {
    onClose.mockReset();
    onCreated.mockReset();
    persist.mockReset();
    persist.mockResolvedValue({
      task: {
        id: "created",
        kind: "task",
        title: "Created",
        status: "Waiting",
        createdAt: 1,
        updatedAt: 1,
        blockIds: [],
        focusHistory: [],
        subtasks: [],
        source: { kind: "user", accountId: "local" },
      },
      history: [],
    });
  });

  it("blocks submit when the title is empty or only whitespace", () => {
    const container = mount(
      createElement(TaskForm, { open: true, onClose, onCreated }),
    );
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    act(() => {
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(persist).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    const title = container.querySelector("#task-form-title");
    expect(title).toBeInstanceOf(HTMLInputElement);
    expect((title as HTMLInputElement).required).toBe(true);
    expect(title?.getAttribute("aria-required")).toBe("true");
    expect(title?.getAttribute("aria-invalid")).toBe("true");
    expect(title?.getAttribute("aria-describedby")).toBe(
      "task-form-title-constraint-message",
    );
    expect(
      container.querySelector("[data-field-message='true']")?.textContent,
    ).toBe(UI_COPY.valueMissing);
    expect(document.activeElement).toBe(title);

    setInputValue(title as HTMLInputElement, "   ");
    act(() => {
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(persist).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    expect(
      container.querySelector("[data-field-message='true']")?.textContent,
    ).toBe(COPY.titleRequired);
    expect(title?.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(title);
  });

  it("trims leading and trailing whitespace from the title on submit", async () => {
    const container = mount(
      createElement(TaskForm, { open: true, onClose, onCreated }),
    );
    const title = container.querySelector("#task-form-title");
    expect(title).toBeInstanceOf(HTMLInputElement);
    setInputValue(title as HTMLInputElement, "  Trimmed title  ");
    await act(async () => {
      buttonNamed(container, COPY.createTask).click();
    });
    expect(persist).toHaveBeenCalledTimes(1);
    const fields = persist.mock.calls[0]?.[1];
    expect(fields?.title).toBe("Trimmed title");
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it("adds and removes subtask rows", () => {
    const container = mount(
      createElement(TaskForm, { open: true, onClose, onCreated }),
    );
    expect(subtaskInputs(container)).toHaveLength(1);
    act(() => {
      buttonNamed(container, COPY.addSubtask).click();
    });
    expect(subtaskInputs(container)).toHaveLength(2);
    act(() => {
      buttonNamed(container, COPY.removeSubtask).click();
    });
    expect(subtaskInputs(container)).toHaveLength(1);
    act(() => {
      buttonNamed(container, COPY.addSubtask).click();
      buttonNamed(container, COPY.addSubtask).click();
    });
    expect(subtaskInputs(container)).toHaveLength(3);
    const secondRemove = container.querySelector(
      'button[aria-label="Remove subtask 2"]',
    );
    expect(secondRemove).toBeInstanceOf(HTMLButtonElement);
    act(() => {
      (secondRemove as HTMLButtonElement).click();
    });
    expect(subtaskInputs(container)).toHaveLength(2);
    expect(
      [...container.querySelectorAll('input[name^="subtask-"]')].map((input) =>
        input.getAttribute("name"),
      ),
    ).toEqual(["subtask-0", "subtask-1"]);
  });
});
