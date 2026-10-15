import { expect, test } from "@playwright/test";

// The scraped data is not in git and changes every few hours, so the tests serve a small fixed
// dataset and freeze the clock inside it: on 16 October at noon two pharmacies are on duty
// (Omonia, Kolonaki) and one is not until the next day (Plaka).
const NOW = new Date("2026-10-16T12:00:00+03:00");

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.route("**/data/duties.json", (route) => route.fulfill({ path: "e2e/fixtures/duties.json" }));
});

test("lists the pharmacies on duty now", async ({ page }) => {
  await page.goto("?lang=en");
  await expect(page).toHaveTitle("On-duty pharmacies");
  await expect(page.locator("#result-count")).toHaveText("2 pharmacies");
  await expect(page.locator(".card h2")).toHaveText(["Farmakeio Omonoias", "Farmakeio Kolonakiou"], { ignoreCase: true });
});

test("switches language", async ({ page }) => {
  await page.goto("?lang=en");
  await page.getByRole("button", { name: "Ελληνικά" }).click();
  await expect(page).toHaveTitle("Εφημερεύοντα φαρμακεία");
  await expect(page.locator("#result-count")).toHaveText("2 φαρμακεία");
  await expect(page).toHaveURL(/lang=el/);
});

test("filters by area", async ({ page }) => {
  await page.goto("?lang=en");
  await page.getByPlaceholder(/area/i).fill("kolon");
  await page.getByRole("option").first().click();
  await expect(page.locator("#result-count")).toHaveText("1 pharmacy");
  await expect(page).toHaveURL(/areas=/);
});

test("shows pharmacies not on duty on request", async ({ page }) => {
  await page.goto("?lang=en");
  await page.getByRole("button", { name: "Also show closed" }).click();
  await expect(page.getByRole("heading", { name: "Not on duty" })).toBeVisible();
  await expect(page.locator(".card")).toHaveCount(3);
});

test("shows tomorrow's pharmacies", async ({ page }) => {
  await page.goto("?lang=en");
  await page.getByRole("button", { name: "Tomorrow" }).click();
  await expect(page.locator("#result-count")).toHaveText("1 pharmacy");
});

test("opens a pharmacy on the map", async ({ page }) => {
  await page.goto("?lang=en");
  await expect(page.locator("#map canvas")).toBeVisible();
  await page.locator("#pharmacy-kolonaki").getByRole("button", { name: "On map" }).click();
  await expect(page.locator(".maplibregl-popup")).toContainText(/kolonakiou/i, { timeout: 15_000 });
});

test("keeps the list when the map can't start", async ({ page }) => {
  // MapLibre needs WebGL 2 and throws without it. A string, as this file has no DOM types.
  await page.addInitScript({
    content: `{
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return type === "webgl2" ? null : getContext.call(this, type, ...args);
      };
    }`,
  });
  await page.goto("?lang=en");
  await expect(page.locator("#result-count")).toHaveText("2 pharmacies");
  await expect(page.locator(".map-pane")).toContainText("The map can't be shown");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("switches between list and map", async ({ page }) => {
    await page.goto("?lang=en");
    await expect(page.locator("#list")).toBeVisible();
    await page.getByRole("tab", { name: "Map" }).click();
    await expect(page.locator("#map canvas")).toBeVisible();
    await expect(page.locator("#list")).toBeHidden();
    await expect(page).toHaveURL(/view=map/);
  });
});

test("directions open Google Maps in a new tab on the desktop", async ({ page }) => {
  await page.goto("?lang=en");
  const link = page.locator(".card").first().getByRole("link", { name: "Directions" });
  await expect(link).toHaveAttribute("href", "https://www.google.com/maps/dir/?api=1&destination=37.9841%2C23.7281");
  await expect(link).toHaveAttribute("target", "_blank");
});

test.describe("on an Android phone", () => {
  test.use({ userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile", viewport: { width: 390, height: 844 } });

  test("directions open the default maps app", async ({ page }) => {
    await page.goto("?lang=en");
    const link = page.locator(".card").first().getByRole("link", { name: "Directions" });
    await expect(link).toHaveAttribute("href", /^geo:37\.9841,23\.7281\?q=37\.9841,23\.7281\(/);
    await expect(link).not.toHaveAttribute("target");
  });
});
