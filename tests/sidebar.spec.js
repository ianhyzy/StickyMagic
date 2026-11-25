// Sidebar.html on its own, with google.script.run faked. Fast checks of the client logic;
// tests/doc.spec.js covers the real Google Doc.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "../script/Sidebar.html"), "utf8");
const URL = "https://sidebar.test/";

// Fake google.script.run: each server call resolves on the next tick from window.server,
// which the test edits. window.calls records the calls.
function fakeRun() {
  window.calls = [];
  window.google = { script: {} };
  Object.defineProperty(window.google.script, "run", {
    get() {
      let ok = () => {}, fail = () => {};
      const runner = new Proxy({}, {
        get(_, name) {
          if (name === "withSuccessHandler") return (f) => ((ok = f), runner);
          if (name === "withFailureHandler") return (f) => ((fail = f), runner);
          return (...args) => {
            window.calls.push(name);
            setTimeout(() => {
              try { ok(window.server[name](...args)); } catch (e) { fail(e.message); }
            }, 0);
          };
        },
      });
      return runner;
    },
  });
  window.server = {
    getTabList: () => [{ title: "Story" }, { title: "Metadata" }],
    getMetadataContent: () => ({ items: window.items }),
    getCurrentContext: () => window.context,
    getImageDataUri: () => "",
  };
  window.items = { Alice: { description: "Ship's engineer", properties: { Age: "34" }, category: "Crew" } };
  window.context = { contextText: "Alice checked the engines.", revisionId: "r1", activeTabTitle: "Story" };
}

test.beforeEach(async ({ page }) => {
  await page.route("https://fonts.googleapis.com/**", (r) => r.abort());
  await page.route(URL, (r) => r.fulfill({ contentType: "text/html", body: html }));
  await page.addInitScript(fakeRun);
  await page.goto(URL);
});

test("shows the card for a name in the cursor paragraph", async ({ page }) => {
  const card = page.locator(".card", { hasText: "Alice" });
  await expect(card).toContainText("Ship's engineer");
  await expect(card).toContainText("Age:");
  await expect(card.locator(".card-category")).toHaveText("Crew");
});

test("reloads metadata after the source tab is edited and left", async ({ page }) => {
  await expect(page.locator(".card")).toContainText("Ship's engineer");

  // Edit on the Metadata tab: new revision while it is active. No reload yet.
  await page.evaluate(() => {
    window.items = { Alice: { description: "Chief engineer", properties: {}, category: "Crew" } };
    window.context = { contextText: "", revisionId: "r2", activeTabTitle: "Metadata" };
  });
  await page.waitForTimeout(2500); // one 2 s poll
  expect(await page.evaluate(() => window.calls.filter((c) => c === "getMetadataContent").length)).toBe(1);

  // Back on the story tab: one silent reload, and the card shows the edit.
  await page.evaluate(() => {
    window.context = { contextText: "Alice checked the engines.", revisionId: "r2", activeTabTitle: "Story" };
  });
  await expect(page.locator(".card")).toContainText("Chief engineer");
  expect(await page.evaluate(() => window.calls.filter((c) => c === "getMetadataContent").length)).toBe(2);
});
