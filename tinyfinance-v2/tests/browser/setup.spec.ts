import { test, expect } from "@playwright/test";
test("unconfigured installation explains required settings and blocks financial data", async ({
  page,
  request,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Geschützter Zugang" }),
  ).toBeVisible();
  await expect(
    page.getByText("Die Supabase-Konfiguration fehlt.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Anmelden/ })).toBeDisabled();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/setup$/);
  await expect(
    page.getByRole("heading", { name: "Konfiguration fehlt" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Fehlt oder ist leer", exact: true }),
  ).toHaveCount(2);
  const response = await request.get("/api/documents");
  expect(response.status()).toBe(503);
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  const crossSite = await request.post("/api/documents", {
    headers: { origin: "https://untrusted.example" },
  });
  expect(crossSite.status()).toBe(403);
});
test("login is usable on a phone without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/login");
  await expect(page.getByLabel("E-Mail")).toBeVisible();
  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(fits).toBe(true);
});
