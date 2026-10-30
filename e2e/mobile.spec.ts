import { expect, type Page, test } from "@playwright/test";

const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 1024 },
];
const ROUTES = ["/", "/how", "/security", "/inbox", "/brief", "/queue", "/memory", "/guard/inv-1842-poison"];

async function ready(page: Page) {
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === "true");
}

async function noSideScroll(page: Page) {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(extra, "page scrolls sideways").toBeLessThanOrEqual(1);
}

async function minTarget(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  expect(box, `${selector} is on screen`).not.toBeNull();
  expect(Math.round(box!.height), `${selector} height`).toBeGreaterThanOrEqual(44);
  expect(Math.round(box!.width), `${selector} width`).toBeGreaterThanOrEqual(44);
}

for (const viewport of VIEWPORTS) {
  test.describe(`mobile ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    test("no route scrolls sideways", async ({ page }) => {
      for (const route of ROUTES) {
        await page.goto(route);
        await ready(page);
        await noSideScroll(page);
      }
    });

    test("header controls are thumb-sized and show one theme icon", async ({ page }) => {
      await page.goto("/");
      await ready(page);
      await minTarget(page, ".ib-theme-toggle");
      if (viewport.width < 768) await minTarget(page, 'header button[aria-controls="site-menu"]');
      const icons = await page.locator(".ib-theme-toggle svg").evaluateAll((nodes) =>
        nodes.filter((node) => getComputedStyle(node).display !== "none").length,
      );
      expect(icons).toBe(1);
      await minTarget(page, 'main a:has-text("Open the sample inbox")');
    });
  });
}

test.describe("phone flows", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("the header stays uncluttered at 360", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/");
    await ready(page);
    await expect(page.locator("header").getByRole("link", { name: "Open the sample inbox" })).toBeHidden();
  });

  test("menu opens and links are full-height", async ({ page }) => {
    await page.goto("/");
    await ready(page);
    await page.locator('header button[aria-controls="site-menu"]').click();
    const link = page.locator("#site-menu a").first();
    await expect(link).toBeVisible();
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });

  test("form inputs use 16px text so iOS does not zoom", async ({ page }) => {
    await page.goto("/memory");
    await ready(page);
    const sizes = await page.locator("input.ib-input").evaluateAll((nodes) =>
      nodes.map((node) => parseFloat(getComputedStyle(node).fontSize)),
    );
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(16);
    const heights = await page.locator("input.ib-input").evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().height),
    );
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
  });

  test("the poisoned invoice is blocked on a phone", async ({ page }) => {
    await page.request.post("/api/inbox/reset");
    await page.goto("/inbox");
    await ready(page);
    await page.getByRole("button", { name: /Invoice 1842 is overdue/ }).click();
    await expect(page.getByText("Blocked before any action ran")).toBeVisible();
    await noSideScroll(page);
  });

  test("the landing demo view toggle works", async ({ page }) => {
    await page.goto("/");
    await ready(page);
    const ai = page.getByRole("button", { name: "What the AI reads" });
    await ai.click();
    await expect(ai).toHaveAttribute("aria-pressed", "true");
  });
});
