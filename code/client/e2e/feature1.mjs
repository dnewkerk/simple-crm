import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const shot = (name) => `/workspaces/simple-crm/code/client/e2e/${name}.png`;

const run = async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const fail = async (msg) => {
        await page.screenshot({ path: shot("feature1-failure"), fullPage: true });
        throw new Error(msg);
    };

    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.getByTitle("Show Opportunities").first().click();
    await page.getByRole("heading", { name: "Opportunities" }).first().waitFor();

    // Open the Add modal.
    await page.getByRole("button", { name: /^Add$/ }).first().click();
    const heading = page.getByRole("heading", { name: "Add Opportunity" });
    await heading.waitFor({ timeout: 5000 });
    const modal = page.locator("div.bg-white.shadow-lg");
    await page.getByPlaceholder("Deal name").waitFor({ timeout: 5000 });

    const dateInput = modal.getByPlaceholder("No close date set");

    // Empty state: the date field starts blank.
    await dateInput.waitFor({ timeout: 5000 }).catch(async () => await fail("Date picker not rendered in the form"));
    if ((await dateInput.inputValue()) !== "") await fail("Date picker should start empty for a new opportunity");
    console.log("✓ empty state: close date starts blank");

    // Happy path: create with a close date.
    const uniqueName = "Dated Deal " + Math.floor(performance.now());
    await page.getByPlaceholder("Deal name").fill(uniqueName);
    await modal.locator('input[type="number"]').first().fill("20000");
    await dateInput.fill("2026-07-20");
    await dateInput.press("Enter");
    await page.getByRole("button", { name: /^Add Opportunity$/ }).click();

    await heading.waitFor({ state: "hidden", timeout: 5000 }).catch(() => null);
    const card = page.locator("div.bg-white.border.rounded", { hasText: uniqueName });
    await card.waitFor({ timeout: 5000 });
    console.log("✓ happy path: created opportunity with a close date", JSON.stringify(uniqueName));

    // The card shows the close date after Expected.
    if (!(await card.getByText("Expected Close: 2026-07-20").isVisible())) {
        await fail("Card did not display 'Expected Close: 2026-07-20'");
    }
    console.log("✓ display: card shows 'Expected Close: 2026-07-20'");

    // Persistence round-trip: reopen edit and confirm the date prefills.
    await card.getByRole("button", { name: /^Edit$/ }).click();
    await page.getByRole("heading", { name: "Edit Opportunity" }).waitFor({ timeout: 5000 });
    const prefilledDate = await modal.getByPlaceholder("No close date set").inputValue();
    if (prefilledDate !== "2026-07-20") await fail(`Close date not persisted/prefilled. Expected 2026-07-20, got ${prefilledDate}`);
    console.log("✓ round-trip: edit form prefilled close date", JSON.stringify(prefilledDate));

    // Clear the date and save -> persists null.
    await modal.locator("button.react-datepicker__close-icon").click();
    if ((await modal.getByPlaceholder("No close date set").inputValue()) !== "") await fail("Clear button did not empty the date field");
    await page.getByRole("button", { name: /^Save Changes$/ }).click();
    await page.getByRole("heading", { name: "Edit Opportunity" }).waitFor({ state: "hidden", timeout: 5000 }).catch(() => null);

    // Empty state on the card: a cleared date shows N/A.
    await card.getByText("Expected Close: N/A").waitFor({ timeout: 5000 })
        .catch(async () => await fail("Card did not show 'Expected Close: N/A' after clearing"));
    console.log("✓ display empty state: card shows 'Expected Close: N/A'");

    await card.getByRole("button", { name: /^Edit$/ }).click();
    await page.getByRole("heading", { name: "Edit Opportunity" }).waitFor({ timeout: 5000 });
    const afterClear = await modal.getByPlaceholder("No close date set").inputValue();
    if (afterClear !== "") await fail(`Cleared date did not persist as empty, got ${afterClear}`);
    console.log("✓ clear path: emptied close date persisted as null");

    await page.screenshot({ path: shot("feature1-success"), fullPage: true });
    await browser.close();
    console.log("ALL PLAYWRIGHT CHECKS PASSED");
};

run().catch((err) => {
    console.error("PLAYWRIGHT CHECK FAILED:", err.message);
    process.exit(1);
});
