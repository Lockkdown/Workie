import { expect, test } from "@playwright/test";

test.describe("Plan Tomorrow", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("shows three tray groups and commits with keyboard-only placement", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open Task Board" }).click();
    await page.getByRole("button", { name: "Create task" }).click();
    await page.getByLabel("Title").fill("Draft the brief");
    await page.getByRole("button", { name: "Create task" }).click();
    await page.getByRole("button", { name: "Close" }).click();

    await page.getByRole("button", { name: "Plan Tomorrow" }).click();
    await expect(
      page.getByRole("heading", { name: "Plan Tomorrow" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Unfinished today" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Repeating tomorrow" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Live tasks" }),
    ).toBeVisible();
    await expect(page.getByText("Why:")).toBeVisible();

    await page.getByLabel(/Draft the brief/).check();
    await page.getByRole("button", { name: "Continue to place" }).click();
    await page.getByRole("button", { name: "Add flexible block" }).click();
    await page.getByRole("button", { name: "Place flexible block" }).click();
    await expect(
      page.getByText("Selected, with no block — not a commitment."),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Continue to review" }).click();
    await expect(page.getByRole("button", { name: "Keep Anyway" })).toHaveCount(
      0,
    );
    const commit = page.getByRole("button", { name: "Commit Tomorrow" });
    await expect(commit).toBeVisible();
    await expect(commit).toHaveAttribute("data-variant", "primary");
    await commit.click();

    await page.reload();
    await page.getByRole("button", { name: "Plan Tomorrow" }).click();
    await expect(
      page.getByRole("button", { name: "Commit Tomorrow" }),
    ).toBeVisible();
  });
});
