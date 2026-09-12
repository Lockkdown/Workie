import { expect, test, type Page } from "@playwright/test";

const batch = {
  version: "workie-batch.v1",
  sourceName: "Vault roadmap",
  sourceMark: "vault:roadmap",
  tasks: [
    {
      itemKey: "item-1",
      order: 0,
      title: "Write the spec",
      description: "Produce the locked spec from the source note.",
      subtasks: [],
    },
  ],
};

async function openIdleImport(page: Page) {
  await page.goto("/");
  await expect(page.getByLabel("Import batch")).toBeVisible();
  await expect(page.locator(".import-drop")).toHaveAttribute(
    "data-state",
    "empty",
  );
}

test.describe("AI import boundary", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("selecting a batch opens review and confirm creates the task", async ({
    page,
  }) => {
    await openIdleImport(page);
    await page.setInputFiles("#import-batch-file", {
      name: "workie-batch.v1.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(batch)),
    });
    await expect(
      page.getByRole("heading", { name: "Review import" }),
    ).toBeVisible();
    await expect(page.getByText("Claude Cowork")).toBeVisible();
    const confirm = page.getByRole("button", { name: "Confirm import" });
    await expect(confirm).toHaveAttribute("data-variant", "primary");
    await confirm.click();
    await expect(
      page.getByRole("heading", { name: "Review import" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Open Task Board" }).click();
    await expect(page.getByText("Write the spec")).toBeVisible();
    await expect(page.getByText("Waiting").first()).toBeVisible();
  });

  test("a review draft survives reload until confirm", async ({ page }) => {
    await openIdleImport(page);
    await page.setInputFiles("#import-batch-file", {
      name: "workie-batch.v1.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(batch)),
    });
    await expect(
      page.getByRole("heading", { name: "Review import" }),
    ).toBeVisible();
    const saved = page.locator("[data-draft-saved]");
    await expect(saved).toBeVisible();
    const before = await saved.getAttribute("data-draft-saved");
    const titleField = page.getByRole("textbox", { name: "Title" });
    await titleField.fill("Edited draft title");
    await expect(saved).not.toHaveAttribute("data-draft-saved", before ?? "");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Review import" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue(
      "Edited draft title",
    );
  });

  test("an unsupported version is rejected and creates no task", async ({
    page,
  }) => {
    await openIdleImport(page);
    await page.setInputFiles("#import-batch-file", {
      name: "workie-batch.v1.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({ ...batch, version: "workie-batch.v0" }),
      ),
    });
    await expect(page.getByRole("alert")).toContainText("Unsupported version");
    await page.getByRole("button", { name: "Open Task Board" }).click();
    await expect(page.getByText("Write the spec")).toHaveCount(0);
  });

  test("nav stays three destinations with no Import item", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "App" });
    await expect(nav.getByRole("button")).toHaveCount(3);
    await expect(nav.getByRole("button", { name: "Import batch" })).toHaveCount(
      0,
    );
  });
});
