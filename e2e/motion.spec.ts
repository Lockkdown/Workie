import { expect, test, type Page } from "@playwright/test";

const THEMES = ["dark", "light"] as const;
const TIERS = ["primary", "secondary", "quiet"] as const;
const FIELD_CONTROLS = [
  "text",
  "textarea",
  "select",
  "checkbox",
  "radio",
  "number",
] as const;

function parseMsList(value: string): number[] {
  return value.split(",").map((part) => {
    const token = part.trim();
    if (token.endsWith("ms")) {
      return Number.parseFloat(token);
    }
    if (token.endsWith("s")) {
      return Number.parseFloat(token) * 1000;
    }
    return 0;
  });
}

function maxMs(value: string): number {
  return Math.max(0, ...parseMsList(value));
}

async function tokenMs(page: Page, name: string): Promise<number> {
  const raw = await page.evaluate((token) => {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(token)
      .trim();
  }, name);
  return maxMs(raw);
}

async function createTask(page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: "Open Task Board" }).click();
  await page.getByRole("button", { name: "Create task" }).click();
  await page.getByLabel("Title").fill(title);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create task" })
    .click();
  await expect(page.getByText(title)).toBeVisible();
}

test.describe("motion tokens and micro [D89] [D109] [D103]", () => {
  test("harness: micro, panel, and field focus in both themes", async ({
    page,
  }) => {
    await page.goto("/harness.html");
    await expect(page.getByTestId("primitives-harness")).toBeVisible();

    expect(await tokenMs(page, "--duration-micro")).toBe(120);
    expect(await tokenMs(page, "--duration-move")).toBe(180);
    expect(await tokenMs(page, "--duration-panel")).toBe(240);
    expect(await tokenMs(page, "--duration-ritual")).toBe(600);

    for (const theme of THEMES) {
      const board = page.locator(
        `[data-surface="theme-board"][data-theme="${theme}"]`,
      );
      await expect(board).toBeVisible();

      for (const tier of TIERS) {
        const button = board
          .locator(`.ui-button[data-variant="${tier}"]`)
          .first();
        await expect(button).toBeVisible();
        const motion = await button.evaluate((el) => {
          const styles = getComputedStyle(el);
          return {
            property: styles.transitionProperty,
            duration: styles.transitionDuration,
          };
        });
        const properties = motion.property
          .split(",")
          .map((part) => part.trim());
        expect(properties).toEqual(
          expect.arrayContaining(["filter", "outline-color", "outline-offset"]),
        );
        expect(parseMsList(motion.duration)).toContain(120);
        await button.hover();
        const hovered = await button.evaluate(
          (el) => getComputedStyle(el).filter,
        );
        expect(hovered).not.toBe("none");
      }

      const panel = board.locator(".ui-panel").first();
      const panelMotion = await panel.evaluate((el) => {
        const styles = getComputedStyle(el);
        return {
          name: styles.animationName,
          duration: styles.animationDuration,
        };
      });
      expect(panelMotion.name).toContain("panel-enter");
      expect(maxMs(panelMotion.duration)).toBe(240);

      for (const control of FIELD_CONTROLS) {
        const node = board.locator(`[data-control="${control}"]`).first();
        await expect(node).toBeVisible();
        const field = await node.evaluate((el) => {
          const styles = getComputedStyle(el);
          return {
            property: styles.transitionProperty,
            duration: styles.transitionDuration,
          };
        });
        expect(field.property).toContain("outline");
        expect(parseMsList(field.duration)).toContain(120);
      }
      const fileInput = board.locator('input[type="file"]').first();
      const fileMotion = await fileInput.evaluate((el) => {
        const styles = getComputedStyle(el);
        return {
          property: styles.transitionProperty,
          duration: styles.transitionDuration,
        };
      });
      expect(fileMotion.property).toContain("outline");
      expect(parseMsList(fileMotion.duration)).toContain(120);
    }
  });
});

test.describe("positional movement and ritual peaks [D14] [D28] [D89]", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("card move, pushed block, and skippable peaks in both themes", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Daily Desk" }),
    ).toBeVisible();

    for (const theme of THEMES) {
      await page
        .getByRole("radio", { name: theme === "dark" ? "Dark" : "Light" })
        .check();

      await createTask(page, `Motion ${theme}`);
      const card = page.locator(".task-board-card").first();
      await expect(card).toBeVisible();
      const cardMotion = await card.evaluate((el) => {
        const styles = getComputedStyle(el);
        return {
          property: styles.transitionProperty,
          duration: styles.transitionDuration,
        };
      });
      expect(cardMotion.property).toContain("transform");
      expect(parseMsList(cardMotion.duration)).toContain(180);

      await page.getByRole("button", { name: "Move to In Progress" }).click();
      const moved = page
        .locator('[data-column="In Progress"] .task-board-card')
        .filter({ hasText: `Motion ${theme}` });
      await expect(moved).toContainText(`Motion ${theme}`);
      await expect(moved).toContainText("In Progress");

      await page.getByRole("button", { name: "Complete" }).click();
      await expect(page.getByText("Completed").first()).toBeVisible();
      const skip = page.getByRole("button", { name: "Skip animation" });
      await expect(skip).toBeVisible();
      const flourish = page.locator(
        ".task-complete-flourish[data-active='true']",
      );
      const ritualMs = await flourish.evaluate(
        (el) => getComputedStyle(el).animationDuration,
      );
      expect(maxMs(ritualMs)).toBeLessThanOrEqual(600);
      expect(maxMs(ritualMs)).toBe(600);
      await skip.click();
      await expect(skip).toHaveCount(0);
      await expect(
        page
          .locator('[data-subgroup="Completed"] .task-board-card')
          .filter({ hasText: `Motion ${theme}` }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Close" }).click();
    }

    await createTask(page, "Motion commit");
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Plan Tomorrow" }).click();
    await page.getByLabel(/Motion commit/).check();
    await page.getByRole("button", { name: "Continue to place" }).click();
    await page.getByRole("button", { name: "Add flexible block" }).click();
    await page.getByRole("button", { name: "Place flexible block" }).click();
    await page.getByRole("button", { name: "Continue to review" }).click();
    await page.getByRole("button", { name: "Commit Tomorrow" }).click();
    const planSkip = page.getByRole("button", { name: "Skip animation" });
    await expect(planSkip).toBeVisible();
    const planPeak = page.locator(".plan-flourish[data-active='true']");
    expect(
      maxMs(
        await planPeak.evaluate((el) => getComputedStyle(el).animationDuration),
      ),
    ).toBe(600);
    await expect(page.getByText("No conflict or overload.")).toBeVisible();
    await planSkip.click();
    await expect(planSkip).toHaveCount(0);
    await expect(page.getByText("No conflict or overload.")).toBeVisible();

    await page.getByRole("button", { name: "Daily Desk" }).click();
    await page.getByRole("button", { name: "Create reserve" }).click();
    await page.getByRole("button", { name: "Fixed" }).click();
    await page.getByRole("button", { name: "Apply preview" }).click();
    const block = page.locator(".timeline-block--moved").first();
    await expect(block).toBeVisible();
    const blockMotion = await block.evaluate((el) => {
      const styles = getComputedStyle(el);
      return {
        property: styles.transitionProperty,
        duration: styles.transitionDuration,
      };
    });
    expect(blockMotion.property.split(",").map((p) => p.trim())).toEqual(
      expect.arrayContaining(["top", "height"]),
    );
    expect(parseMsList(blockMotion.duration)).toContain(180);
  });

  test("timer reaching zero is skippable and readable without waiting", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.clock.install({ time: new Date(2026, 8, 12, 12, 0, 0) });
    await page.goto("/");
    await page.getByRole("radio", { name: "Dark" }).check();
    await createTask(page, "Timer peak");
    await page.getByRole("button", { name: "Close" }).click();
    const duration = page.getByLabel("Default duration (minutes)");
    await duration.fill("1");
    await expect(duration).toHaveValue("1");
    await page.getByTestId("now-task").selectOption({ label: "Timer peak" });
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByTestId("pomodoro-timer")).toHaveText("01:00");
    await page.clock.runFor(61_000);
    await expect(page.getByText("Take a 5-minute break?")).toBeVisible();
    await expect(page.getByText("Nothing running.")).toBeVisible();
    const skip = page.getByRole("button", { name: "Skip animation" });
    await expect(skip).toBeVisible();
    expect(await tokenMs(page, "--duration-ritual")).toBe(600);
    await skip.click();
    await expect(skip).toHaveCount(0);
    await expect(page.getByText("Take a 5-minute break?")).toBeVisible();
    await expect(page.getByText("Nothing running.")).toBeVisible();
  });
});

test.describe("reduced motion [D89]", () => {
  test.use({
    viewport: { width: 1366, height: 768 },
    reducedMotion: "reduce",
  });

  test("collapses every token-driven animation, peaks included", async ({
    page,
  }) => {
    await page.goto("/harness.html");
    expect(await tokenMs(page, "--duration-micro")).toBe(0);
    expect(await tokenMs(page, "--duration-move")).toBe(0);
    expect(await tokenMs(page, "--duration-panel")).toBe(0);
    expect(await tokenMs(page, "--duration-ritual")).toBe(0);
    expect(await tokenMs(page, "--duration-opacity")).toBe(120);

    const panel = page.locator(".ui-panel").first();
    const panelMs = maxMs(
      await panel.evaluate((el) => getComputedStyle(el).animationDuration),
    );
    expect(panelMs).toBeLessThanOrEqual(120);

    const button = page.locator(".ui-button").first();
    await button.hover();
    const filter = await button.evaluate((el) => getComputedStyle(el).filter);
    expect(filter).toBe("none");

    await page.goto("/");
    await createTask(page, "Reduced motion task");
    await page.getByRole("button", { name: "Complete" }).click();
    await expect(page.getByText("Completed").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Skip animation" }),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-subgroup="Completed"] .task-board-card'),
    ).toContainText("Reduced motion task");
  });
});
