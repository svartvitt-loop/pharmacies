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
