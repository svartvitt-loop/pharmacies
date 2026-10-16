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
  await page.getByRole("button", { name: "Areas", exact: true }).click();
  await page.getByPlaceholder(/area/i).fill("kolon");
  await page.getByRole("option").first().click();
  await expect(page.locator("#result-count")).toHaveText("1 pharmacy");
  await expect(page).toHaveURL(/place=areas&areas=/);
  // Another place filter replaces the areas.
  await page.getByRole("button", { name: "Everywhere" }).click();
  await expect(page.locator("#result-count")).toHaveText("2 pharmacies");
  await expect(page).not.toHaveURL(/areas=/);
});

test("suggests only areas with pharmacies on duty in the window", async ({ page }) => {
  await page.goto("?lang=en&when=tomorrow");
  await page.getByRole("button", { name: "Areas", exact: true }).click();
  await page.getByPlaceholder(/area/i).focus();
  // Tomorrow only Plaka (area Athina) is on duty; Kolonaki has nobody.
  await expect(page.getByRole("option")).toHaveText(["Athina1"]);
});

test("reads area links from before the place filters", async ({ page }) => {
  await page.goto("?lang=en&areas=ΚΟΛΩΝΑΚΙ");
  await expect(page.locator("#result-count")).toHaveText("1 pharmacy");
  await expect(page.getByRole("button", { name: "Areas", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test.describe("near me", () => {
  // At Kolonaki pharmacy; Omonia is about 1.4 km away.
  test.use({ permissions: ["geolocation"], geolocation: { latitude: 37.9779, longitude: 23.7423 } });

  test("filters by distance with the radius slider", async ({ page }) => {
    await page.goto("?lang=en");
    await page.getByRole("button", { name: "Near me" }).click();
    await expect(page.locator(".card .distance").first()).toBeVisible();
    const slider = page.getByRole("slider", { name: "Radius" });
    await expect(slider).toHaveAttribute("aria-valuetext", "2 km"); // the default, left out of the URL
    await expect(page.locator("#result-count")).toHaveText("2 pharmacies");
    await expect(page).toHaveURL(/place=me$/);
    await slider.fill("0"); // the first step: 1 km
    await expect(page.locator("#result-count")).toHaveText("1 pharmacy");
    await expect(page).toHaveURL(/place=me&radius=1/);
    await slider.fill("4"); // the last step: any distance
    await expect(slider).toHaveAttribute("aria-valuetext", "Any distance");
    await expect(page).toHaveURL(/place=me&radius=any/);
  });

  test("locates on load when the link asks for it and access is already allowed", async ({ page }) => {
    await page.goto("?lang=en&place=me&radius=1");
    await expect(page.locator("#result-count")).toHaveText("1 pharmacy");
  });
});

test.describe("near me, far from every pharmacy", () => {
  // Kifisia, about 11 km north of the fixture's pharmacies.
  test.use({ permissions: ["geolocation"], geolocation: { latitude: 38.0739, longitude: 23.8111 } });

  test("moves the map to the radius, and stays there when the filter is turned off", async ({ page }) => {
    await page.goto("?lang=en");
    await expect(page.locator("#result-count")).toHaveText("2 pharmacies");
    await page.getByRole("button", { name: "Near me" }).click();
    await page.getByRole("slider", { name: "Radius" }).fill("0");
    await expect(page.locator("#list .empty")).toContainText("No on-duty pharmacies");
    await page.getByRole("button", { name: "Everywhere" }).click();
    // The map is still over Kifisia, so the list (which follows the map) has nobody.
    await expect(page.locator("#result-count")).toContainText("0 of 2 pharmacies in the map area", { timeout: 10_000 });
  });
});

test("filters by distance from an address", async ({ page }) => {
  let photonQuery: URLSearchParams | null = null;
  await page.route("https://photon.komoot.io/**", (route) => {
    photonQuery = new URL(route.request().url()).searchParams;
    return route.fulfill({
      json: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [23.7423, 37.9779] },
            properties: { street: "Skoufa", housenumber: "10", district: "Kolonaki", city: "Athens" },
          },
        ],
      },
    });
  });
  await page.goto("?lang=en");
  await page.getByRole("button", { name: "Address" }).click();
  await page.getByPlaceholder(/street/i).fill("skoufa 10");
  await page.getByRole("option", { name: "Skoufa 10, Kolonaki" }).click();
  expect(photonQuery!.get("q")).toBe("skoufa 10");
  expect(photonQuery!.get("bbox")).toMatch(/^[\d.]+,[\d.]+,[\d.]+,[\d.]+$/);
  await expect(page.locator("#result-count")).toHaveText("2 pharmacies");
  await page.getByRole("slider", { name: "Radius" }).fill("0");
  await expect(page.locator("#result-count")).toHaveText("1 pharmacy");
  await expect(page).toHaveURL(/place=address&addr=Skoufa\+10%2C\+Kolonaki&at=37\.97790%2C23\.74230&radius=1/);
  // The address survives a reload.
  await page.reload();
  await expect(page.locator("#result-count")).toHaveText("1 pharmacy");
  await expect(page.getByRole("button", { name: "Skoufa 10, Kolonaki ✕" })).toBeVisible();
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
