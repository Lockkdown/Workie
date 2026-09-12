import { expect, test, type Page } from "@playwright/test";

const EVENING = new Date(2026, 8, 14, 20, 0, 0, 0);
const AFTER_MIDNIGHT = new Date(2026, 8, 15, 0, 30, 0, 0);

const batch = {
  version: "workie-batch.v1",
  sourceName: "Vault roadmap",
  sourceMark: "vault:full-flow",
  tasks: [
    {
      itemKey: "item-flow-1",
      order: 0,
      title: "Imported from Vault",
      description: "One-shot copy from the batch file.",
      subtasks: [],
    },
  ],
};

async function createTask(page: Page, title: string) {
  await page.getByRole("button", { name: "Open Task Board" }).click();
  await page.getByRole("button", { name: "Create task" }).click();
  await page.getByLabel("Title").fill(title);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create task" })
    .click();
  await expect(page.getByText(title)).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
}

test.describe("Web v1 full flow [CURSOR-GOAL N]", () => {
  test.use({ viewport: { width: 1366, height: 768 } });
  test.setTimeout(120_000);

  test("create, plan, commit, Pomodoro across two tasks, conflict, day close, Reports, import", async ({
    page,
  }) => {
    await page.clock.install({ time: EVENING });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Daily Desk" }),
    ).toBeVisible();

    await createTask(page, "Alpha");
    await createTask(page, "Beta");

    await page.getByRole("button", { name: "Plan Tomorrow" }).click();
    await expect(
      page.getByRole("heading", { name: "Plan Tomorrow" }),
    ).toBeVisible();
    await page.getByLabel(/Alpha/).check();
    await page.getByRole("button", { name: "Continue to place" }).click();
    await page.getByRole("button", { name: "Add flexible block" }).click();
    await page.getByRole("button", { name: "Place flexible block" }).click();
    await page.getByRole("button", { name: "Continue to review" }).click();
    await page.getByRole("button", { name: "Commit Tomorrow" }).click();
    const planSkip = page.getByRole("button", { name: "Skip animation" });
    if ((await planSkip.count()) > 0) {
      await planSkip.click();
    }
    await expect(
      page.getByRole("button", { name: "Commit Tomorrow" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Daily Desk" }).click();
    await expect(page.getByTestId("now-task")).toBeVisible();
    await page.getByTestId("now-task").selectOption({ label: "Alpha" });
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByTestId("pomodoro-timer")).toBeVisible();
    await expect(page.getByText("running")).toBeVisible();
    await page.getByRole("button", { name: "Switch task" }).click();
    await expect(page.getByText("awaiting task selection")).toBeVisible();
    await page.getByTestId("now-task").selectOption({ label: "Beta" });
    await page.getByRole("button", { name: "Resume" }).click();
    await expect(page.getByText("running")).toBeVisible();
    await expect(page.getByTestId("pomodoro-timer")).toBeVisible();
    const stopEarly = page.getByRole("button", { name: "Stopped early" });
    await expect(stopEarly).toBeEnabled();
    await stopEarly.evaluate((el) => {
      (el as HTMLButtonElement).click();
    });
    await expect(page.getByText("Nothing running.")).toBeVisible();

    await page.getByRole("button", { name: "Create reserve" }).click();
    const schedule = page.getByRole("dialog", { name: "Schedule on timeline" });
    await schedule.getByRole("button", { name: "Fixed" }).click();
    await schedule.getByLabel("Start hour").fill("10");
    await schedule.getByLabel("Start minute").fill("0");
    await schedule.getByLabel("Duration (minutes)").fill("60");
    await schedule.getByRole("button", { name: "Apply preview" }).click();

    await page
      .locator(".timeline-tray-item", { hasText: "Beta" })
      .getByRole("button", { name: "Schedule on timeline" })
      .click();
    const flex = page.getByRole("dialog", { name: "Schedule on timeline" });
    await flex.getByRole("button", { name: "Flexible" }).click();
    await flex.getByLabel("Duration (minutes)").fill("720");
    await flex.getByRole("button", { name: "Apply preview" }).click();
    const conflictMark = page.getByText("Conflict", { exact: true }).first();
    await expect(conflictMark).toBeVisible();
    await page.getByRole("button", { name: "Keep Anyway" }).first().click();
    const confirm = page.getByRole("dialog", { name: "Confirm change" });
    if (await confirm.isVisible()) {
      await confirm.getByRole("button", { name: "Apply preview" }).click();
    }
    await expect(conflictMark).toBeVisible();

    await page.clock.setSystemTime(AFTER_MIDNIGHT);
    await page.reload();
    await expect(page.getByText("The day has closed.")).toBeVisible();
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByText("The day has closed.")).toHaveCount(0);

    await page.getByRole("button", { name: "Reports" }).click();
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Working time" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Task outcomes" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Contribution" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Daily Desk" }).click();
    await page.setInputFiles("#import-batch-file", {
      name: "workie-batch.v1.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(batch)),
    });
    await expect(
      page.getByRole("heading", { name: "Review import" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirm import" }).click();
    await expect(
      page.getByRole("heading", { name: "Review import" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Open Task Board" }).click();
    await expect(page.getByText("Imported from Vault")).toBeVisible();
    await expect(page.getByText("Waiting").first()).toBeVisible();
  });
});
