// StickyMagic in a real Google Doc, driven in the Chrome on the ci-browser VM on Tower.
// The doc "StickyMagic CI" belongs to the test account ian@appsscript.club; CI pushes script/ to its bound script first.
// Story tab: "Alice checked the engines before dawn." / "Nobody aboard had seen Bob since the storm."
// Metadata tab: a "Characters" heading, a blank line, an Alice entry (properties, an image, a _spoiler line),
// then a Bob entry whose last line, "Status: ...", is the last line of the tab. The reload test rewrites it.
const { test: base, expect } = require("@playwright/test");

const CDP = process.env.CI_BROWSER || "http://192.168.86.47:9223";
const DOC = "https://docs.google.com/document/d/1eO99TzF0tZXCB4v8FEgZLacoqmA9_3Hhh4dfSKbnPNI/edit?tab=t.0";

// One doc page and its sidebar for all tests, in the signed-in Chrome on the VM.
const test = base.extend({
  doc: [async ({ playwright }, use) => {
    const browser = await playwright.chromium.connectOverCDP(CDP);
    const page = await browser.contexts()[0].newPage();
    // The VM's Chrome has 1Password installed; its popups sit on top of Docs and swallow clicks.
    await page.addInitScript(() => {
      new MutationObserver(() => document
        .querySelectorAll("com-1password-notification, com-1password-button, com-1password-menu")
        .forEach((e) => e.remove())).observe(document, { childList: true, subtree: true });
    });
    await page.goto(DOC);
    const menu = page.locator("#docs-menubar").getByText("Sticky Magic", { exact: true });
    await menu.waitFor({ timeout: 60000 }); // added by onOpen
    await menu.click();
    await page.getByText("Open Sticky Magic", { exact: true }).click();
    let sidebar;
    await expect.poll(() => (sidebar = page.frames().find((f) => f.name() === "userHtmlFrame")), { timeout: 60000 }).toBeTruthy();
    await use({ page, sidebar });
    await page.close();
  }, { scope: "worker" }],
});
test.describe.configure({ mode: "serial" });

async function openTab(page, name, where) {
  await page.getByRole("treeitem", { name }).click();
  await page.waitForTimeout(1000);
  await page.keyboard.press(where); // Control+Home or Control+End
}

test("lists the document tabs", async ({ doc: { sidebar } }) => {
  // Known bug: getTabList asks Docs for includeTabsContent: false, which leaves Document.tabs unset,
  // so it returns [] and the Source Tab picker is empty. Delete this line once that is fixed.
  test.fail();
  await expect(sidebar.locator("#tab-selector option")).toHaveText(["Story", "Metadata"], { timeout: 15000 });
});

test("shows the card for the name in the cursor paragraph", async ({ doc: { page, sidebar } }) => {
  await openTab(page, "Story", "Control+Home");
  const card = sidebar.locator(".card", { hasText: "Alice" });
  await expect(card).toBeVisible({ timeout: 30000 });
  await expect(card.locator("p")).toHaveText("Engineer, ex-navy");
  await expect(card.locator(".card-category")).toHaveText("Characters");
  await expect(card).toContainText("Age:");
  await expect(card).toContainText("The Gull");
  await expect(card).not.toContainText("mole"); // after the _spoiler line
  // The image comes back from getImageDataUri as a data: URI.
  await expect(card.locator(".card-image img")).toHaveAttribute("src", /^data:image\//, { timeout: 30000 });
});

test("follows the cursor to another paragraph", async ({ doc: { page, sidebar } }) => {
  await page.keyboard.press("Control+End");
  await expect(sidebar.locator(".card h4")).toHaveText(["Bob"], { timeout: 30000 });
});

test("reloads metadata after the Metadata tab is edited and left", async ({ doc: { page, sidebar } }) => {
  const stamp = `run-${Date.now()}`;
  await openTab(page, "Metadata", "Control+End"); // end of the "Status: ..." line
  await page.keyboard.press("Shift+Home");
  await page.keyboard.type(`Status: ${stamp}`);
  await openTab(page, "Story", "Control+End"); // back on Bob's paragraph
  await expect(sidebar.locator(".card", { hasText: "Bob" })).toContainText(stamp, { timeout: 60000 });
});
