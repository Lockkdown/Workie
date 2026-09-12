import { expect, test } from "@playwright/test";

test.describe("Pomodoro Now rail", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("prepares context then starts a timer from Daily Desk", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open Task Board" }).click();
    await page.getByRole("button", { name: "Create task" }).click();
    await page.getByLabel("Title").fill("Write tests");
    await page.getByRole("button", { name: "Create task" }).click();
    await page.getByRole("button", { name: "Close" }).click();

    await expect(page.getByRole("heading", { name: "Now" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Focus" })).toHaveCount(0);
    await expect(page.getByText("Nothing running.")).toBeVisible();

    await expect(page.getByTestId("now-task")).toBeVisible();
    await page.getByTestId("now-task").selectOption({ label: "Write tests" });
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByTestId("pomodoro-timer")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await expect(page.getByText("running")).toBeVisible();
    await expect(page.getByTestId("now-session-task")).toHaveText(
      "Write tests",
    );
    await expect(page.getByTestId("now-session-block")).toHaveText(
      "Unscheduled",
    );
  });
});
