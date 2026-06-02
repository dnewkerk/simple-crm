import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const shot = (name) => `/workspaces/simple-crm/code/client/e2e/${name}.png`;

const run = async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const fail = async (msg) => {
        await page.screenshot({ path: shot("feature4-failure"), fullPage: true });
        throw new Error(msg);
    };

    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Forecast" }).click();
    await page.getByRole("heading", { name: "Monthly Forecast" }).waitFor({ timeout: 5000 });

    // Group-by control is present and defaults to no grouping.
    const groupBy = page.getByLabel("Group by");
    await groupBy.waitFor({ timeout: 5000 }).catch(async () => await fail("Group by control not rendered"));
    console.log("✓ Group by control present");

    const futureCol = page
        .locator("div.bg-gray-100")
        .filter({ has: page.getByRole("heading", { name: "Future", exact: true }) });

    // No "No Region" group while ungrouped.
    if (await page.getByText("No Region", { exact: true }).first().isVisible()) {
        await fail('"No Region" group shown before grouping was selected');
    }

    // Select Region grouping.
    await groupBy.selectOption({ value: "region" });

    // Future column now shows an "NA" value heading containing the seeded NA opp.
    await futureCol.getByText("NA", { exact: true }).first().waitFor({ timeout: 5000 })
        .catch(async () => await fail('Region value heading "NA" not shown in Future column after grouping'));
    if (!(await futureCol.getByText("Long-Horizon Expansion").first().isVisible())) {
        await fail("Future-column opp missing after grouping");
    }
    console.log('✓ grouping by Region shows value headings (e.g. "NA")');

    // Opps without a region land in a visible "No Region" fallback group.
    await page.getByText("No Region", { exact: true }).first().waitFor({ timeout: 5000 })
        .catch(async () => await fail('"No Region" fallback group not shown'));
    console.log('✓ "No Region" fallback group shown for opps without a value');
    await page.screenshot({ path: shot("feature4-grouped"), fullPage: true });

    // Switching back to no grouping removes the value/fallback headings.
    await groupBy.selectOption({ value: "" });
    await page.waitForTimeout(200);
    if (await page.getByText("No Region", { exact: true }).first().isVisible()) {
        await fail('"No Region" group still shown after returning to No grouping');
    }
    console.log("✓ returning to No grouping clears the grouping");

    await page.screenshot({ path: shot("feature4-success"), fullPage: true });
    await browser.close();
    console.log("ALL PLAYWRIGHT CHECKS PASSED");
};

run().catch((err) => {
    console.error("PLAYWRIGHT CHECK FAILED:", err.message);
    process.exit(1);
});
