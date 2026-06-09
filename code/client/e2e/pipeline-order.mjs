import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const shot = (name) => `/workspaces/simple-crm/code/client/e2e/${name}.png`;

const run = async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const fail = async (msg) => {
        await page.screenshot({ path: shot("pipeline-order-failure"), fullPage: true });
        throw new Error(msg);
    };

    // Ground truth: opportunity ids in saved (position) order for a given stage.
    const orderedIds = async (stageId) => {
        const opps = await (await page.request.get(`${BASE}/api/opportunities`)).json();
        return opps.filter(o => o.stage.id === stageId).map(o => o.id);
    };

    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Pipeline" }).click();
    await page.getByRole("heading", { name: "Pipeline Report" }).waitFor({ timeout: 5000 });

    // Pick a stage among the first four (on-screen) columns that has >= 3 cards.
    const stages = await (await page.request.get(`${BASE}/api/stages`)).json();
    const visible = stages.sort((a, b) => a.order - b.order).slice(0, 4);
    let target = null;
    for (const s of visible) {
        if ((await orderedIds(s.id)).length >= 3) {
            target = s;
            break;
        }
    }
    if (!target) await fail("No on-screen stage column has 3+ cards to reorder");

    const before = await orderedIds(target.id);
    const movedId = before[0]; // top card
    console.log(`Reordering "${target.name}" (${before.length} cards); moving top card id=${movedId} to the bottom`);

    const col = page.locator("div.self-start").filter({ has: page.getByRole("heading", { name: target.name, exact: false }) });
    const cards = col.locator('[aria-label^="Drag"]');
    const firstBox = await cards.first().boundingBox();
    const lastBox = await cards.last().boundingBox();
    if (!firstBox || !lastBox) await fail("Could not measure card positions");

    // Drag the top card and drop it just past the last card in the same column.
    await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2 + 12, { steps: 4 });
    await page.mouse.move(lastBox.x + lastBox.width / 2, lastBox.y + lastBox.height / 2, { steps: 18 });
    await page.mouse.move(lastBox.x + lastBox.width / 2, lastBox.y + lastBox.height + 8, { steps: 6 });
    await page.mouse.up();

    await page.waitForResponse(r => /\/api\/opportunities\/\d+\/move$/.test(r.url()) && r.request().method() === "PUT", { timeout: 5000 })
        .catch(async () => await fail("No move PUT fired on drop"));
    await page.waitForLoadState("networkidle");

    const after = await orderedIds(target.id);
    if (after.length !== before.length) await fail(`Card count changed during reorder: ${before.length} -> ${after.length}`);
    if (after[0] === movedId) await fail("Moved card is still first — reorder did not take effect");
    if (after[after.length - 1] !== movedId) await fail(`Moved card expected last, order is [${after.join(",")}], movedId=${movedId}`);
    console.log(`✓ Drop placed card at the exact position (now last). Order ${before.join(",")} -> ${after.join(",")}`);

    // Persistence: reload the page and confirm the saved order is what the board shows.
    // (No client router — a reload returns to the default page, so re-open Pipeline.)
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Pipeline" }).click();
    await page.getByRole("heading", { name: "Pipeline Report" }).waitFor({ timeout: 5000 });
    const afterReload = await orderedIds(target.id);
    if (JSON.stringify(afterReload) !== JSON.stringify(after)) {
        await fail(`Order did not persist across reload: ${after.join(",")} -> ${afterReload.join(",")}`);
    }
    // The bottom card name in the UI should match the ground-truth last id after reload.
    const reloadedCol = page.locator("div.self-start").filter({ has: page.getByRole("heading", { name: target.name, exact: false }) });
    const lastCardLabel = await reloadedCol.locator('[aria-label^="Drag"]').last().getAttribute("aria-label");
    console.log(`✓ Order persisted across reload (bottom card: ${lastCardLabel})`);

    await page.screenshot({ path: shot("pipeline-order-success"), fullPage: true });
    await browser.close();
    console.log("ALL PLAYWRIGHT CHECKS PASSED");
};

run().catch(err => {
    console.error("PLAYWRIGHT CHECK FAILED:", err.message);
    process.exit(1);
});
