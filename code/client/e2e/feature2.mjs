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

    // Scope field interactions to the modal — the Add Lead form on the same page
    // also renders custom-field inputs (e.g. a "Region" input).
    const modal = page.locator("div.bg-white.shadow-lg");

    // Wait for the async form load (stages + custom fields) to finish.
    await page.getByPlaceholder("Deal name").waitFor({ timeout: 5000 });

    // Opportunity-scoped custom field (seeded: region) should render.
    await page.getByText("Region", { exact: false }).first().waitFor({ timeout: 5000 })
        .catch(async () => await fail("Opportunity custom field (Region) not rendered in form"));

    // --- Client validation: an empty name is blocked before any server call ---
    await modal.locator('input[type="number"]').first().fill("5000");
    await page.getByRole("button", { name: /^Add Opportunity$/ }).click();
    await page.getByText("Name is required").waitFor({ timeout: 5000 })
        .catch(async () => await fail("Empty name was not blocked client-side"));
    if (!(await heading.isVisible())) await fail("Modal closed on name validation (should stay open)");
    console.log("✓ client validation: empty name blocked inline, modal stayed open");

    // --- Server error path: value below the configured minimum ---
    await page.getByPlaceholder("Deal name").fill("Below Min Deal");
    await modal.locator('input[type="number"]').first().fill("100");
    await page.getByRole("button", { name: /^Add Opportunity$/ }).click();
    await page.getByText(/at least/i).first().waitFor({ timeout: 5000 })
        .catch(async () => await fail("Expected server minimum-value error message"));
    if (!(await heading.isVisible())) await fail("Modal closed on server validation (should stay open)");
    console.log("✓ server error path: minimum-value message shown, modal stayed open");

    // --- Happy path: valid name + value (+ custom field) creates the opportunity ---
    const uniqueName = "E2E Deal " + Math.floor(performance.now());
    const region = "APAC-" + Math.floor(performance.now());
    await page.getByPlaceholder("Deal name").fill(uniqueName);
    await modal.locator('input[type="number"]').first().fill("12345");
    await modal.getByPlaceholder("Region").fill(region);
    await page.getByRole("button", { name: /^Add Opportunity$/ }).click();

    // Modal closes and the new opp appears in the list.
    await heading.waitFor({ state: "hidden", timeout: 5000 }).catch(() => null);
    const newCard = page.locator("div.bg-white.border.rounded", { hasText: uniqueName });
    await newCard.waitFor({ timeout: 5000 });
    console.log("✓ happy path: created opportunity", JSON.stringify(uniqueName));

    // Custom field value renders on the card after Expected.
    await page.getByText(`Region: ${region}`).first().waitFor({ timeout: 5000 })
        .catch(async () => await fail("Opportunity custom field value not displayed on the card"));
    console.log("✓ custom field displayed on card:", JSON.stringify(`Region: ${region}`));

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
