import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const shot = (name) => `/workspaces/simple-crm/code/client/e2e/${name}.png`;

const run = async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const fail = async (msg) => {
        await page.screenshot({ path: shot("pipeline-dnd-failure"), fullPage: true });
        throw new Error(msg);
    };

    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Pipeline" }).click();
    await page.getByRole("heading", { name: "Pipeline Report" }).waitFor({ timeout: 5000 });

    // A column's droppable container, located by its stage heading.
    const column = (name) =>
        page.locator("div.self-start").filter({ has: page.getByRole("heading", { name, exact: false }) });
    const countOf = async (name) => parseInt(await column(name).locator("span.pl-2").first().innerText(), 10);

    // Drag the first card from a source column into a target column.
    const drag = async (fromName, toName) => {
        const card = column(fromName).locator('[aria-label^="Drag"]').first();
        const src = await card.boundingBox();
        const dst = await column(toName).boundingBox();
        if (!src || !dst) await fail(`Could not locate boxes for ${fromName} -> ${toName}`);
        await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2);
        await page.mouse.down();
        // Exceed the 8px activation distance, then move into the target column.
        await page.mouse.move(src.x + src.width / 2 + 20, src.y + src.height / 2, { steps: 6 });
        await page.mouse.move(dst.x + dst.width / 2, dst.y + 70, { steps: 18 });
        await page.mouse.move(dst.x + dst.width / 2, dst.y + 90, { steps: 6 });
        await page.mouse.up();
    };

    // --- Scenario A: successful move persists and updates both column counts ---
    const FROM = "Cold Lead";
    const TO = "Warm Lead";
    if ((await countOf(FROM)) < 1) await fail(`No cards in "${FROM}" to drag`);
    const fromBefore = await countOf(FROM);
    const toBefore = await countOf(TO);

    await drag(FROM, TO);

    await page.waitForResponse(r => r.url().includes("/api/opportunities") && r.request().method() === "PUT", { timeout: 5000 })
        .catch(async () => await fail("No PUT request fired on drop"));
    await page.waitForLoadState("networkidle");

    const fromAfter = await countOf(FROM);
    const toAfter = await countOf(TO);
    if (fromAfter !== fromBefore - 1) await fail(`Source count expected ${fromBefore - 1}, got ${fromAfter}`);
    if (toAfter !== toBefore + 1) await fail(`Target count expected ${toBefore + 1}, got ${toAfter}`);
    console.log(`✓ Drag moved a card ${FROM} (${fromBefore}->${fromAfter}) -> ${TO} (${toBefore}->${toAfter}) and persisted`);
    await page.screenshot({ path: shot("pipeline-dnd-success"), fullPage: true });

    // --- Scenario B: server error reverts the optimistic move and shows a banner ---
    await page.route("**/api/opportunities/*", route =>
        route.request().method() === "PUT" ? route.fulfill({ status: 500, body: "boom" }) : route.continue(),
    );
    const errFrom = await countOf(TO); // drag back from the now-populated column
    await drag(TO, FROM);
    await page.getByText(/Could not move/i).waitFor({ timeout: 5000 })
        .catch(async () => await fail("Move-error banner not shown on server 500"));
    await page.waitForLoadState("networkidle");
    const errAfter = await countOf(TO);
    if (errAfter !== errFrom) await fail(`Failed move should revert: expected ${errFrom}, got ${errAfter}`);
    console.log("✓ Server error shows a banner and reverts the optimistic move");
    await page.unroute("**/api/opportunities/*");

    await browser.close();
    console.log("ALL PLAYWRIGHT CHECKS PASSED");
};

run().catch(err => {
    console.error("PLAYWRIGHT CHECK FAILED:", err.message);
    process.exit(1);
});
