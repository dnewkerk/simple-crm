import { chromium } from "playwright";

// Fast-lane dry-run check for confirm-on-delete. Non-destructive: it asserts the
// native confirm dialog fires with the right message on an opportunity Delete,
// and that DISMISSING it leaves the opportunity in place.
const BASE = process.env.BASE_URL || "http://localhost:5173";
const shot = (name) => `/workspaces/simple-crm/code/client/e2e/${name}.png`;

const run = async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const fail = async (msg) => {
        await page.screenshot({ path: shot("confirm-delete-failure"), fullPage: true });
        throw new Error(msg);
    };

    await page.goto(BASE, { waitUntil: "networkidle" });

    // Expand leads one at a time until an opportunity Delete button appears.
    const del = page.getByRole("button", { name: "Delete" }).first();
    for (let i = 0; i < 20; i++) {
        if (await del.count()) break;
        const eye = page.getByTitle("Show Opportunities").first();
        if (!(await eye.count())) break;
        await eye.click();
        await page.waitForTimeout(150);
    }
    await del.waitFor({ timeout: 5000 }).catch(async () => await fail("No opportunity Delete button found (need seed opps)"));

    // Capture and DISMISS the confirm dialog (cancel path).
    let dialogMsg = null;
    page.once("dialog", async (d) => {
        dialogMsg = d.message();
        await d.dismiss();
    });
    await del.click();
    await page.waitForTimeout(300);

    if (dialogMsg === null) await fail("Clicking Delete did NOT trigger a confirm dialog");
    if (dialogMsg !== "Delete this opportunity?") await fail(`Unexpected dialog message: ${JSON.stringify(dialogMsg)}`);
    console.log("✓ Delete triggers confirm with message:", JSON.stringify(dialogMsg));

    // After dismiss, the same Delete button must still be present (nothing deleted).
    await del.waitFor({ state: "visible", timeout: 3000 })
        .catch(async () => await fail("Opportunity row disappeared after DISMISSING the confirm"));
    console.log("✓ dismissing the dialog leaves the opportunity in place");

    await page.screenshot({ path: shot("confirm-delete-success"), fullPage: true });
    await browser.close();
    console.log("ALL PLAYWRIGHT CHECKS PASSED");
};

run().catch((err) => {
    console.error("PLAYWRIGHT CHECK FAILED:", err.message);
    process.exit(1);
});
