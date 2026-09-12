import { expect, test, type Page } from "@playwright/test";

const BROWSER_STRINGS = [
  "No file chosen",
  "Choose File",
  "Chọn tệp",
  "Không có tệp nào được chọn",
  "Vui lòng điền vào trường này",
  "Hãy điền vào trường này",
  "Please fill out this field",
] as const;

const USER_TITLE = "Họp với khách hàng";

const batch = {
  version: "workie-batch.v1",
  sourceName: "Vault roadmap",
  sourceMark: "vault:roadmap-vi",
  tasks: [
    {
      itemKey: "item-1",
      order: 0,
      title: "Viết spec từ Vault",
      description: "Produce the locked spec from the source note.",
      subtasks: [],
    },
  ],
};

async function assertNoBrowserStrings(page: Page) {
  const body = await page.locator("body").innerText();
  for (const phrase of BROWSER_STRINGS) {
    expect(body).not.toContain(phrase);
  }
  await expect(page.getByText("No file chosen", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText("Choose File", { exact: true })).toHaveCount(0);
}

test.describe("no browser-supplied strings [D78] [D92] [D104]", () => {
  test.use({
    locale: "vi-VN",
    viewport: { width: 1366, height: 768 },
  });

  test("blocked submit, hidden file input, English UI on a Vietnamese browser", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Daily Desk" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Workie" })).toBeVisible();
    const nativeFile = page.locator("#import-batch-file");
    await expect(nativeFile).toHaveCount(1);
    await expect(nativeFile).toHaveAttribute("aria-hidden", "true");
    await expect(nativeFile).toHaveAttribute("tabindex", "-1");
    const nativeBox = await nativeFile.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const styles = getComputedStyle(el);
      return {
        width: box.width,
        height: box.height,
        opacity: styles.opacity,
      };
    });
    expect(nativeBox.width).toBeLessThanOrEqual(1);
    expect(nativeBox.height).toBeLessThanOrEqual(1);
    expect(nativeBox.opacity).toBe("0");
    await expect(
      page.getByRole("button", { name: "Import batch" }),
    ).toBeVisible();
    await expect(page.getByText("Choose file", { exact: true })).toBeVisible();
    await expect(page.getByText("No file selected.")).toBeVisible();
    await assertNoBrowserStrings(page);

    await page.getByRole("button", { name: "Open Task Board" }).click();
    await page.getByRole("button", { name: "Create task" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Create task" }).click();
    const title = page.locator("#task-form-title");
    await expect(title).toBeFocused();
    await expect(title).toHaveAttribute("required", "");
    await expect(title).toHaveAttribute("aria-required", "true");
    await expect(title).toHaveAttribute("aria-invalid", "true");
    await expect(title).toHaveAttribute(
      "aria-describedby",
      "task-form-title-constraint-message",
    );
    const workieMessage = page.locator("#task-form-title-constraint-message");
    await expect(workieMessage).toHaveText("This field is required.");
    const nativeMessage = await title.evaluate(
      (el) => (el as HTMLInputElement).validationMessage,
    );
    expect(await workieMessage.innerText()).not.toBe(nativeMessage);
    await assertNoBrowserStrings(page);

    await title.fill(USER_TITLE);
    await dialog.getByRole("button", { name: "Create task" }).click();
    await expect(page.getByText(USER_TITLE)).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    await page.getByRole("button", { name: "Plan Tomorrow" }).click();
    await expect(
      page.getByRole("heading", { name: "Plan Tomorrow" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Live tasks" }),
    ).toBeVisible();
    await page.getByLabel(new RegExp(USER_TITLE)).check();
    await page.getByRole("button", { name: "Continue to place" }).click();
    await page.getByRole("button", { name: "Add fixed block" }).click();
    const duration = page.getByLabel("Duration (minutes)");
    await duration.fill("1");
    await page.getByRole("button", { name: "Place fixed block" }).click();
    await expect(duration).toBeFocused();
    await expect(duration).toHaveAttribute("min", "5");
    await expect(duration).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Enter a value of at least 5.")).toBeVisible();
    await expect(page.getByText(USER_TITLE)).toBeVisible();
    await assertNoBrowserStrings(page);

    await page.getByRole("button", { name: "Reports" }).click();
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
    await assertNoBrowserStrings(page);

    await page.getByRole("button", { name: "Daily Desk" }).click();
    await expect(
      page.getByRole("heading", { name: "Daily Desk" }),
    ).toBeVisible();
    await page.setInputFiles("#import-batch-file", {
      name: "workie-batch.v1.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(batch)),
    });
    await expect(page.locator("#import-batch-file-chosen")).toHaveText(
      "workie-batch.v1.json",
    );
    await expect(
      page.getByRole("heading", { name: "Review import" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue(
      "Viết spec từ Vault",
    );
    await expect(
      page.getByRole("button", { name: "Confirm import" }),
    ).toBeVisible();
    await expect(page.getByText("No file selected.")).toHaveCount(0);
    await assertNoBrowserStrings(page);
  });
});
