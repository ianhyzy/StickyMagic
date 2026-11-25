// StickyMagic in a real Google Doc, driven in the Chrome on the ci-browser VM on Tower.
// The doc "StickyMagic CI" belongs to the test account ian@appsscript.club; CI pushes script/ to its bound script first.
//
// Simple tabs (hand-made):
//   Story: "Alice checked the engines before dawn." / "Nobody aboard had seen Bob since the storm."
//   Metadata: a "Characters" heading, a blank line, an Alice entry (properties, an image, a _spoiler line),
//   then a Bob entry whose last line, "Status: ...", is the last line of the tab. The reload test rewrites it.
// Complex tabs (tests/fixture/BuildComplexDoc.js plus the hand-added features in tests/fixture/README.md):
//   Novel (29 pages) with subtab Appendix; Codex with subtab Places.
//
// Tests marked test.fail() are known add-on bugs: each says why. When a fix lands, that test "unexpectedly
// passes" and goes red: delete its test.fail() line.
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
    await page.bringToFront(); // background tabs throttle the sidebar's 2 s poll
    const menu = page.locator("#docs-menubar").getByText("Sticky Magic", { exact: true });
    await menu.waitFor({ timeout: 60000 }); // added by onOpen
    await menu.click();
    await page.getByText("Open Sticky Magic", { exact: true }).click();
    let sidebar;
    await expect.poll(() => (sidebar = page.frames().find((f) => f.name() === "userHtmlFrame")), { timeout: 60000 }).toBeTruthy();
    await sidebar.waitForFunction(() => typeof fetchMetadata === "function", null, { timeout: 60000 });
    await useSource(sidebar, "Metadata"); // the source tab is remembered in localStorage across runs
    await use({ page, sidebar });
    await page.close();
  }, { scope: "worker" }],
});
test.describe.configure({ mode: "serial" });

// Same effect as picking a Source Tab in the sidebar's settings (whose picker is empty: see the first test).
async function useSource(sidebar, tab) {
  await sidebar.evaluate((tab) => {
    isMetadataLoaded = false;
    selectedTabTitle = tab;
    localStorage.setItem("novelHelper_selectedTab", tab);
    fetchMetadata();
  }, tab);
  await sidebar.waitForFunction(() => isMetadataLoaded || /Error/.test(document.getElementById("status-indicator").textContent), null, { timeout: 60000 });
}

async function openTab(page, name, where) {
  await page.getByRole("treeitem", { name, exact: true }).click();
  await page.waitForTimeout(1000);
  if (where) await page.keyboard.press(where); // Control+Home or Control+End
}

// Selects the first match of text in the current tab with Docs' own Find. The selection stays: the add-on then
// reads the selected text element, which is the whole paragraph unless a chip or inline image splits it.
async function select(page, text) {
  await page.keyboard.press("Control+f");
  await page.keyboard.press("Control+a");
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
  await expect(page.getByText(/^[1-9]\d* of \d+$/).first()).toBeVisible(); // counts while typing, before Enter jumps
  await page.waitForTimeout(1000);
  await page.keyboard.press("Escape");
}

// Selects text and waits until the sidebar's own poll reports that paragraph. Docs sometimes doesn't tell
// Apps Script about a selection for a long time; shrinking and regrowing it by one character resends it.
async function moveTo(page, sidebar, text) {
  await select(page, text);
  await expect.poll(async () => {
    const ctx = await sidebar.evaluate(() => currentContextText);
    if (!ctx.includes(text)) { await page.keyboard.press("Shift+ArrowLeft"); await page.keyboard.press("Shift+ArrowRight"); }
    return ctx;
  }, { timeout: 45000, intervals: [3000] }).toContain(text);
}

const cardNames = (sidebar) => sidebar.locator(".card h4");
const card = (sidebar, name) => sidebar.locator(".card").filter({ has: sidebar.locator("h4", { hasText: new RegExp(`^${name}$`) }) });

test("lists the document tabs", async ({ doc: { sidebar } }) => {
  // Known bug: getTabList asks Docs for includeTabsContent: false, which leaves Document.tabs unset,
  // so it returns [] and the Source Tab picker is empty.
  test.fail();
  await expect(sidebar.locator("#tab-selector option")).toHaveText(["Story", "Metadata", "Novel", "Appendix", "Codex", "Places"], { timeout: 5000 });
});

test.describe("simple tabs", () => {
  test("shows the card for the name in the cursor paragraph", async ({ doc: { page, sidebar } }) => {
    await openTab(page, "Story", "Control+Home");
    const alice = card(sidebar, "Alice");
    await expect(alice).toBeVisible({ timeout: 30000 });
    await expect(alice.locator("p")).toHaveText("Engineer, ex-navy");
    await expect(alice.locator(".card-category")).toHaveText("Characters");
    await expect(alice).toContainText("Age:");
    await expect(alice).toContainText("The Gull");
    await expect(alice).not.toContainText("mole"); // after the _spoiler line
    // The image comes back from getImageDataUri as a data: URI.
    await expect(alice.locator(".card-image img")).toHaveAttribute("src", /^data:image\//, { timeout: 30000 });
  });

  test("follows the cursor to another paragraph", async ({ doc: { page, sidebar } }) => {
    await page.keyboard.press("Control+End");
    await expect(cardNames(sidebar)).toHaveText(["Bob"], { timeout: 30000 });
  });

  test("reloads metadata after the Metadata tab is edited and left", async ({ doc: { page, sidebar } }) => {
    const stamp = `run-${Date.now()}`;
    await openTab(page, "Metadata", "Control+End"); // end of the "Status: ..." line
    await page.keyboard.press("Shift+Home");
    await page.keyboard.type(`Status: ${stamp}`);
    await openTab(page, "Story", "Control+End"); // back on Bob's paragraph
    await expect(card(sidebar, "Bob")).toContainText(stamp, { timeout: 60000 });
  });
});

test.describe("complex tabs: Novel with Codex as the source", () => {
  test("loads the Codex from a 37-page doc", async ({ doc: { page, sidebar } }) => {
    await openTab(page, "Novel");
    await useSource(sidebar, "Codex");
    await expect(sidebar.locator("#status-indicator")).not.toContainText("Error");
  });

  // [where the cursor goes in the Novel, the cards that must show (name or name[img])]
  const spots = [
    ["stood at the rail of The Gull", ["Ilse Varga[img]", "The Gull[img]"]], // wrapped positioned image in the text
    ["Roster of The Gull", ["The Gull[img]"]], // merged table cell
    ["the one Pell drew", ["Pell"]], // nested list item, level 3
    ["Stow the Brass Sextant", ["Brass Sextant[img]"]], // checkbox item; entry six heading levels deep
    ["copied it phonetically", ["Pell"]], // right-to-left paragraph
    ["witness: Pell", ["Halcyon", "Pell"]], // monospace paragraph
    ["keeps this tally", ["Mateo Alvarez", "Halcyon"]], // code block
  ];
  for (const [text, expected] of spots) {
    test(`cards at "${text}"`, async ({ doc: { page, sidebar } }) => {
      await moveTo(page, sidebar, text);
      await expect.poll(() => sidebar.evaluate(() => [...document.querySelectorAll(".card")]
        .map((c) => c.querySelector("h4").innerText + (c.querySelector(".card-image img") ? "[img]" : ""))), { timeout: 30000 })
        .toEqual(expect.arrayContaining(expected));
    });
  }

  test("nests an entry six heading levels deep", async ({ doc: { page, sidebar } }) => {
    await moveTo(page, sidebar, "Stow the Brass Sextant");
    await expect(card(sidebar, "Brass Sextant").locator(".card-category"))
      .toHaveText("Items › Instruments › Navigation › Celestial › Antique › Provenance unknown", { timeout: 30000 });
  });

  test("shows every card for a paragraph that names everyone", async ({ doc: { page, sidebar } }) => {
    await moveTo(page, sidebar, "Saint Brendan, Halcyon, Port Ruin");
    await expect(cardNames(sidebar)).toHaveCount(11, { timeout: 30000 });
  });

  test("reads a pending suggestion as the accepted text", async ({ doc: { page, sidebar } }) => {
    // Known bug: Docs.Documents.get returns suggestions inline by default, so the suggested "Age: 53"
    // and the original "Age: 52" run together as "53Age: 52". Pass suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS".
    test.fail();
    await moveTo(page, sidebar, "stood at the rail of The Gull");
    await expect(card(sidebar, "Ilse Varga").locator(".property-row", { hasText: "Age:" }).locator(".property-value")).toHaveText("52", { timeout: 10000 });
  });

  test("keeps the text of smart chips in properties", async ({ doc: { sidebar } }) => {
    // Known bug: parseBodyContent only reads textRun elements, so person, date and dropdown chips vanish
    // and Harbor Office's Contact, Filed and Status lines have no value.
    test.fail();
    expect(await sidebar.evaluate(() => Object.keys(cachedMetadata["Harbor Office"].properties))).toEqual(["Contact", "Filed", "Status"]);
  });

  test("splits an entry typed with soft line breaks (Shift+Enter)", async ({ doc: { sidebar } }) => {
    // Known bug: lines split with Shift+Enter are one paragraph, so "Halvard Sund\vSoft line breaks…\vAge: 40"
    // becomes one entry name instead of a name, a description and a property.
    test.fail();
    expect(await sidebar.evaluate(() => Object.keys(cachedMetadata))).toContain("Halvard Sund");
  });

  test("scans the whole paragraph when the selection follows a chip", async ({ doc: { page, sidebar } }) => {
    // Known bug: with text selected after a smart chip, getCurrentContext only sees the Text element after the
    // chip, so 李娜, earlier in the same paragraph, gets no card.
    test.fail();
    await moveTo(page, sidebar, "filed under Ilse Varga");
    await expect(cardNames(sidebar)).toContainText(["李娜"], { timeout: 10000 });
  });

  test("can use a subtab as the source", async ({ doc: { page, sidebar } }) => {
    // Known bug: getMetadataContent only searches top-level tabs, so the Places subtab is "not found".
    test.fail();
    await useSource(sidebar, "Places");
    await expect(sidebar.locator("#status-indicator")).not.toContainText("Error", { timeout: 5000 });
  });

  test.afterAll(async ({ doc: { sidebar } }) => useSource(sidebar, "Metadata"));
});
