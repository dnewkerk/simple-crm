import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const shot = (name) => `/workspaces/simple-crm/code/client/e2e/${name}.png`;

const run = async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const fail = async (msg) => {
        await page.screenshot({ path: shot("feature2-failure"), fullPage: true });
        throw new Error(msg);
    };

    await page.goto(BASE, { waitUntil: "networkidle" });

    // Expand the first lead's opportunities.
    await page.getByRole("button", { name: /Show Opps/i }).first().click();
    await page.getByRole("heading", { name: "Opportunities" }).first().waitFor();

    // --- Add button opens the modal with core + custom fields ---
    await page.getByRole("button", { name: /^Add$/ }).first().click();
    const heading = page.getByRole("heading", { name: "Add Opportunity" });
    await heading.waitFor({ timeout: 5000 }).catch(() => null);
    if (!(await heading.isVisible())) await fail("Add Opportunity modal did not open");

    // Wait for the async form load (stages + custom fields) to finish.
    await page.getByPlaceholder("Deal name").waitFor({ timeout: 5000 });

    // Opportunity-scoped custom field (seeded: region) should render.
    await page.getByText("Region", { exact: false }).first().waitFor({ timeout: 5000 })
        .catch(async () => await fail("Opportunity custom field (Region) not rendered in form"));

    // --- Error path: value below the minimum keeps the modal open with a message ---
    await page.locator('input[type="number"]').first().fill("100");
    await page.getByRole("button", { name: /^Add Opportunity$/ }).click();
    const errorMsg = page.locator("p.text-red-500");
    await errorMsg.first().waitFor({ timeout: 5000 });
    const errText = await errorMsg.first().textContent();
    if (!/at least/i.test(errText || "")) await fail(`Expected validation error, got: ${errText}`);
    if (!(await heading.isVisible())) await fail("Modal closed on validation error (should stay open)");
    console.log("✓ error path: inline validation shown, modal stayed open:", JSON.stringify(errText));

    // --- Happy path: valid value creates the opportunity ---
    const uniqueName = "E2E Deal " + (errText ? errText.length : 0) + Math.floor(performance.now());
    await page.getByPlaceholder("Deal name").fill(uniqueName);
    await page.locator('input[type="number"]').first().fill("12345");
    await page.getByRole("button", { name: /^Add Opportunity$/ }).click();

    // Modal closes and the new opp appears in the list.
    await heading.waitFor({ state: "hidden", timeout: 5000 }).catch(() => null);
    await page.getByText(uniqueName).first().waitFor({ timeout: 5000 });
    console.log("✓ happy path: created opportunity", JSON.stringify(uniqueName));

    // --- Edit button opens the prefilled modal ---
    const card = page.locator("div.bg-white.border.rounded", { hasText: uniqueName });
    await card.getByRole("button", { name: /^Edit$/ }).click();
    await page.getByRole("heading", { name: "Edit Opportunity" }).waitFor({ timeout: 5000 });
    const prefilled = await page.getByPlaceholder("Deal name").inputValue();
    if (prefilled !== uniqueName) await fail(`Edit form not prefilled. Expected ${uniqueName}, got ${prefilled}`);
    console.log("✓ edit path: modal opened prefilled with", JSON.stringify(prefilled));

    await page.screenshot({ path: shot("feature2-success"), fullPage: true });
    await browser.close();
    console.log("ALL PLAYWRIGHT CHECKS PASSED");
};

run().catch((err) => {
    console.error("PLAYWRIGHT CHECK FAILED:", err.message);
    process.exit(1);
});
