import { expect, type Page, test } from "@playwright/test";

async function ready(page: Page) {
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === "true");
}

test("landing names Inbox Bodyguard and replays the scripted guard", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("with a bodyguard");
  await expect(page.getByText("Inbox Bodyguard").first()).toBeVisible();
  await page.getByRole("button", { name: "Replay the demo" }).click();
  await expect(page.getByText("Nothing was forwarded")).toBeVisible();
});

test("sample inbox blocks the poisoned invoice and records an approval locally", async ({ page }) => {
  await page.request.post("/api/inbox/reset");
  await page.goto("/inbox");
  await ready(page);
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  await page.getByRole("button", { name: /Invoice 1842 is overdue/ }).click();
  await expect(page.getByText("Blocked before any action ran")).toBeVisible();
  await expect(page.getByText("We removed hidden instructions")).toBeVisible();
  await page.getByRole("button", { name: /PO for invoice 1842/ }).click();
  const approve = page.getByRole("button", { name: /Approve & send/ });
  await expect(approve).toBeEnabled({ timeout: 15_000 });
  await approve.click();
  await expect(page.getByText("No mail was transmitted")).toBeVisible();
});

test("guard, memory, security, and missing pages render", async ({ page }) => {
  await page.goto("/guard/inv-1842-poison");
  await ready(page);
  await expect(page.getByRole("heading", { name: /Invoice 1842 is overdue/ })).toBeVisible();
  await expect(page.getByText("Tool calls denied")).toBeVisible();
  await page.goto("/memory");
  await ready(page);
  await expect(page.getByText("Priya Shah")).toBeVisible();
  await page.getByRole("button", { name: "Edit preference tone" }).click();
  await page.getByLabel("Preference value").fill("Shorter, still British spelling.");
  await page.getByRole("button", { name: "Save preference" }).click();
  await expect(page.getByText("Shorter, still British spelling.")).toBeVisible();
  await page.goto("/evidence/inv-1842-poison");
  await ready(page);
  await expect(page.getByText("No Token Factory call was made.").first()).toBeVisible();
  await page.goto("/brief");
  await ready(page);
  const followUp = page.locator("li").filter({ has: page.getByRole("link", { name: "Open the letter" }) }).first();
  const subject = (await followUp.locator("p").nth(1).innerText()).trim();
  await followUp.getByRole("link", { name: "Open the letter" }).click();
  await expect(page).toHaveURL(/\/inbox\?letter=/);
  await expect(page.getByRole("heading", { name: subject })).toBeVisible();
  await page.goto("/brief");
  await expect(page.getByRole("heading", { name: "Five lines before the inbox" })).toBeVisible();
  await page.goto("/queue");
  await expect(page.getByRole("heading", { name: "One tap. Nothing is transmitted." })).toBeVisible();
  await page.goto("/report");
  await expect(page.getByRole("heading", { name: "What the guard blocked" })).toBeVisible();
  await page.goto("/security");
  await expect(page.getByRole("heading", { name: "The guard is allowed to refuse." })).toBeVisible();
  await page.goto("/how");
  await expect(page.getByRole("heading", { name: "Two checks, then your approval." })).toBeVisible();
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "The sample inbox is fictional." })).toBeVisible();
  await page.goto("/missing-page");
  await expect(page.getByRole("heading", { name: "This page is not in Inbox Bodyguard." })).toBeVisible();
});

test("theme toggle follows the system, then remembers the choice", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("ib-theme"));
  await page.reload();
  await ready(page);
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Switch between light and dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ib-theme"))).toBe("dark");
  await page.reload();
  await ready(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
