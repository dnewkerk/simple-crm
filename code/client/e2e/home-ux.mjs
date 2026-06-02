import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const shot = (name) => `/workspaces/simple-crm/code/client/e2e/${name}.png`;

const run = async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const fail = async (msg) => {
        await page.screenshot({ path: shot("home-ux-failure"), fullPage: true });
        throw new Error(msg);
    };

    await page.goto(BASE, { waitUntil: "networkidle" });

    // Table headings: left-aligned + bordered.
    const firstNameTh = page.getByRole("columnheader", { name: "First Name" });
    const thClass = (await firstNameTh.getAttribute("class")) || "";
    if (!thClass.includes("text-left")) await fail(`Heading not left-aligned (class="${thClass}")`);
    if (!thClass.includes("border")) await fail(`Heading missing border (class="${thClass}")`);
    console.log("✓ table headings left-aligned and bordered");

    // Edit -> blue pencil icon with the "Edit Lead" title, opening a MODAL (not inline).
    const editBtn = page.getByTitle("Edit Lead").first();
    await editBtn.waitFor({ timeout: 5000 }).catch(async () => await fail('Pencil "Edit Lead" button not found'));
    if ((await editBtn.locator("svg").count()) === 0) await fail("Edit button is not an icon");
    await editBtn.click();
    await page.getByRole("heading", { name: "Edit Lead" }).waitFor({ timeout: 5000 })
        .catch(async () => await fail("Edit Lead modal did not open"));
    // Scope to the modal — the Add Lead form on the same page also has a "First Name" input.
    const modal = page.locator("div.bg-white.shadow-lg");
    const firstNameVal = await modal.getByPlaceholder("First Name").inputValue();
    if (!firstNameVal) await fail("Edit modal not prefilled with the lead's first name");
    console.log("✓ pencil opens prefilled Edit Lead modal:", JSON.stringify(firstNameVal));
    // Cancel closes it.
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("heading", { name: "Edit Lead" }).waitFor({ state: "hidden", timeout: 5000 })
        .catch(async () => await fail("Edit modal did not close on Cancel"));
    console.log("✓ modal closes on Cancel");

    // Show Opportunities -> eye icon; once open it becomes a crossed-eye with "Hide Opportunities".
    const showBtn = page.getByTitle("Show Opportunities").first();
    await showBtn.waitFor({ timeout: 5000 }).catch(async () => await fail('"Show Opportunities" eye button not found'));
    await showBtn.click();
    await page.getByRole("heading", { name: "Opportunities" }).first().waitFor({ timeout: 5000 })
        .catch(async () => await fail("Opportunities did not reveal on eye click"));
    await page.getByTitle("Hide Opportunities").first().waitFor({ timeout: 5000 })
        .catch(async () => await fail('Eye did not switch to "Hide Opportunities"'));
    console.log('✓ eye toggle reveals opportunities and switches to "Hide Opportunities"');

    // Toggle back.
    await page.getByTitle("Hide Opportunities").first().click();
    await page.getByTitle("Show Opportunities").first().waitFor({ timeout: 5000 })
        .catch(async () => await fail('Eye did not switch back to "Show Opportunities"'));
    console.log('✓ eye toggles back to "Show Opportunities"');

    await page.screenshot({ path: shot("home-ux-success"), fullPage: true });
    await browser.close();
    console.log("ALL PLAYWRIGHT CHECKS PASSED");
};

run().catch((err) => {
    console.error("PLAYWRIGHT CHECK FAILED:", err.message);
    process.exit(1);
});
