import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const shot = (name) => `/workspaces/simple-crm/code/client/e2e/${name}.png`;

const run = async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const fail = async (msg) => {
        await page.screenshot({ path: shot("pipeline-kanban-failure"), fullPage: true });
        throw new Error(msg);
    };

    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Pipeline" }).click();
    await page.getByRole("heading", { name: "Pipeline Report" }).waitFor({ timeout: 5000 });
    console.log("✓ Pipeline Report page loaded");

    // Summary cards survive the redesign.
    for (const label of ["Total Pipeline Value", "Expected Close Value"]) {
        if (!(await page.getByText(label, { exact: true }).first().isVisible())) {
            await fail(`Summary card "${label}" not rendered`);
        }
    }
    console.log("✓ Summary cards present");

    // Board renders one column per seeded stage, in order, including won/lost.
    const stageNames = ["Cold Lead", "Warm Lead", "First Contact", "Completed Demo", "Negotiation", "Deal Signed", "Ghosted Me"];
    for (const name of stageNames) {
        await page.getByRole("heading", { name, exact: false }).first().waitFor({ timeout: 5000 })
            .catch(async () => await fail(`Stage column "${name}" not rendered`));
    }
    console.log("✓ All stage columns rendered as Kanban headers");

    // The won column carries the green tint + status badge.
    const wonCol = page
        .locator("div.bg-green-50")
        .filter({ has: page.getByRole("heading", { name: "Deal Signed", exact: false }) });
    await wonCol.first().waitFor({ timeout: 5000 })
        .catch(async () => await fail("Won stage column missing green tint"));
    console.log("✓ Won column tinted green");

    // At least one opportunity card is visible (cards show "Stage:" / "Expected:").
    const anyCard = page.locator("div.bg-white.border.rounded").filter({ hasText: "Expected:" });
    if ((await anyCard.count()) < 1) {
        await fail("No opportunity cards rendered on the board");
    }
    console.log(`✓ Opportunity cards rendered (${await anyCard.count()} found)`);

    // Empty per-column state is wired ("No opportunities" appears for any empty stage).
    // Not asserted as required (seed may fill every stage), just logged if present.
    const emptyCols = await page.getByText("No opportunities", { exact: true }).count();
    console.log(`• ${emptyCols} empty stage column(s) showing the empty state`);

    await page.screenshot({ path: shot("pipeline-kanban-success"), fullPage: true });
    await browser.close();
    console.log("ALL PLAYWRIGHT CHECKS PASSED");
};

run().catch((err) => {
    console.error("PLAYWRIGHT CHECK FAILED:", err.message);
    process.exit(1);
});
