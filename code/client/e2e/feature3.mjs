import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const shot = (name) => `/workspaces/simple-crm/code/client/e2e/${name}.png`;

const run = async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const fail = async (msg) => {
        await page.screenshot({ path: shot("feature3-failure"), fullPage: true });
        throw new Error(msg);
    };

    await page.goto(BASE, { waitUntil: "networkidle" });

    // Navigate to the Forecast page.
    await page.getByRole("button", { name: "Forecast" }).click();
    await page.getByRole("heading", { name: "Monthly Forecast" }).waitFor({ timeout: 5000 });

    // Current month column + the two special columns must be present.
    const currentMonth = new Date().toLocaleString("en-US", { month: "long" });
    await page.getByRole("heading", { name: currentMonth, exact: true }).first().waitFor({ timeout: 5000 })
        .catch(async () => await fail(`Current month column "${currentMonth}" not rendered`));
    await page.getByRole("heading", { name: "Past / No Date Set", exact: true }).waitFor({ timeout: 5000 })
        .catch(async () => await fail("Past / No Date Set column not rendered"));
    await page.getByRole("heading", { name: "Future", exact: true }).waitFor({ timeout: 5000 })
        .catch(async () => await fail("Future column not rendered"));
    console.log(`✓ columns rendered (incl. ${currentMonth}, Past / No Date Set, Future)`);

    // Per-column "Total Expected Value" line is shown.
    if (!(await page.getByText("Total Expected Value:").first().isVisible())) {
        await fail("Total Expected Value line not shown");
    }
    console.log("✓ per-column Total Expected Value shown");

    // The seeded guaranteed-future open opp lands in the Future column.
    const futureCol = page
        .locator("div.bg-gray-100")
        .filter({ has: page.getByRole("heading", { name: "Future", exact: true }) });
    await futureCol.getByText("Long-Horizon Expansion").first().waitFor({ timeout: 5000 })
        .catch(async () => await fail("Future-dated opp not bucketed into the Future column"));
    console.log("✓ future-dated opp bucketed into Future column");

    // The guaranteed past opp lands under the "Past" sub-group of Past / No Date Set.
    const pastCol = page
        .locator("div.bg-gray-100")
        .filter({ has: page.getByRole("heading", { name: "Past / No Date Set", exact: true }) });
    await pastCol.getByText("Past", { exact: true }).first().waitFor({ timeout: 5000 })
        .catch(async () => await fail('"Past" sub-group heading not shown'));
    await pastCol.getByText("Past-Due Renewal").first().waitFor({ timeout: 5000 })
        .catch(async () => await fail("Past-dated opp not bucketed into the Past / No Date Set column"));
    console.log("✓ past-dated opp bucketed under the Past sub-group");

    // Cards show Stage, and the "More" toggle reveals/hides custom fields.
    const futureCard = futureCol.locator("div.bg-white.border").filter({ hasText: "Long-Horizon Expansion" });
    if (!(await futureCard.getByText(/^Stage:/).first().isVisible())) await fail("Card does not show Stage");
    console.log("✓ card shows Stage");

    const moreBtn = futureCard.getByRole("button", { name: /More/ });
    await moreBtn.waitFor({ timeout: 5000 }).catch(async () => await fail("More toggle not present on a card with custom fields"));
    await moreBtn.click();
    await futureCard.getByText("Region: NA").first().waitFor({ timeout: 5000 })
        .catch(async () => await fail("More toggle did not reveal custom field (Region)"));
    console.log("✓ More toggle reveals custom fields (Region)");

    // Toggle collapses again.
    await futureCard.getByRole("button", { name: /Less/ }).click();
    if (await futureCard.getByText("Region: NA").first().isVisible()) await fail("Less toggle did not hide custom fields");
    console.log("✓ toggle collapses custom fields again");

    await page.screenshot({ path: shot("feature3-success"), fullPage: true });
    await browser.close();
    console.log("ALL PLAYWRIGHT CHECKS PASSED");
};

run().catch((err) => {
    console.error("PLAYWRIGHT CHECK FAILED:", err.message);
    process.exit(1);
});
