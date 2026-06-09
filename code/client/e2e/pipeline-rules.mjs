import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const shot = (name) => `/workspaces/simple-crm/code/client/e2e/${name}.png`;
const NAME = "RuleCheck NoDate";

const run = async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    let createdId = null;
    const fail = async (msg) => {
        await page.screenshot({ path: shot("pipeline-rules-failure"), fullPage: true });
        throw new Error(msg);
    };

    await page.goto(BASE, { waitUntil: "networkidle" });

    // Seed a deterministic dateless opportunity in the first (intake) stage.
    const leads = await (await page.request.get(`${BASE}/api/leads`)).json();
    const stages = (await (await page.request.get(`${BASE}/api/stages`)).json()).sort((a, b) => a.order - b.order);
    const firstStage = stages[0]; // rule-free intake column
    const laterStage = stages[1]; // requires an expected close date
    const created = await page.request.post(`${BASE}/api/opportunities`, {
        data: { leadId: leads[0].id, stageId: firstStage.id, value: 50000, name: NAME }, // no expectedCloseDate
    });
    createdId = (await created.json()).id;

    try {
        await page.getByRole("button", { name: "Pipeline" }).click();
        await page.getByRole("heading", { name: "Pipeline Report" }).waitFor({ timeout: 5000 });

        const column = (name) =>
            page.locator("div.self-start").filter({ has: page.getByRole("heading", { name, exact: false }) });
        const countOf = async (name) => parseInt(await column(name).locator("span.pl-2").first().innerText(), 10);
        const cardRoot = () => column(firstStage.name).locator("div.p-2.mb-2").filter({ hasText: NAME });

        await cardRoot().first().waitFor({ timeout: 5000 }).catch(async () => await fail("Seeded dateless card not visible in first stage"));
        const firstBefore = await countOf(firstStage.name);
        const laterBefore = await countOf(laterStage.name);

        // Drag the dateless card into a later stage that requires a close date.
        const handle = column(firstStage.name).locator(`[aria-label^="Drag ${NAME}"]`).first();
        await handle.scrollIntoViewIfNeeded();
        const src = await handle.boundingBox();
        const dst = await column(laterStage.name).boundingBox();
        if (!src || !dst) await fail("Could not measure drag boxes");
        await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2);
        await page.mouse.down();
        await page.mouse.move(src.x + src.width / 2 + 16, src.y + src.height / 2, { steps: 6 });
        await page.mouse.move(dst.x + dst.width / 2, dst.y + 70, { steps: 18 });
        await page.mouse.move(dst.x + dst.width / 2, dst.y + 90, { steps: 6 });
        await page.mouse.up();

        // Toast lists the failed rule.
        await page.getByText(/Can.t move this opportunity/i).waitFor({ timeout: 5000 })
            .catch(async () => await fail("Move-blocked toast did not appear"));
        await page.getByText(/Expected close date is required/i).waitFor({ timeout: 2000 })
            .catch(async () => await fail("Toast did not list the failed rule"));
        console.log("✓ Blocked move raised a toast listing the failed rule");

        // Move was blocked: counts unchanged and the card stayed in the first stage.
        if ((await countOf(firstStage.name)) !== firstBefore || (await countOf(laterStage.name)) !== laterBefore) {
            await fail("Counts changed — the move was not blocked");
        }
        // The card is highlighted light yellow.
        const cls = await cardRoot().first().getAttribute("class");
        if (!/yellow/.test(cls || "")) await fail(`Card not highlighted yellow; class="${cls}"`);
        console.log("✓ Move blocked, card stayed put and is highlighted yellow");
        await page.screenshot({ path: shot("pipeline-rules-success"), fullPage: true });

        // Highlight and toast both clear automatically after ~10s.
        await page.getByText(/Expected close date is required/i).waitFor({ state: "hidden", timeout: 12000 })
            .catch(async () => await fail("Toast did not auto-dismiss within ~10s"));
        await page.waitForTimeout(300);
        const clsAfter = await cardRoot().first().getAttribute("class");
        if (/yellow/.test(clsAfter || "")) await fail("Highlight was not removed after 10s");
        console.log("✓ Toast auto-dismissed and highlight cleared after 10s");

        console.log("ALL PLAYWRIGHT CHECKS PASSED");
    } finally {
        if (createdId != null) await page.request.delete(`${BASE}/api/opportunities/${createdId}`);
        await browser.close();
    }
};

run().catch((err) => {
    console.error("PLAYWRIGHT CHECK FAILED:", err.message);
    process.exit(1);
});
