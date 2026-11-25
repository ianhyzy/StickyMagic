// Playwright comes from nixpkgs in CI (see .tangled/workflows/test.yml), so there is no package.json.
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests",
  workers: 1,
  reporter: "list",
  projects: [
    // Playwright's bundled Chromium headless shell crashes on Sidebar.html; Firefox doesn't.
    { name: "sidebar", testMatch: "sidebar.spec.js", use: { browserName: "firefox" } },
    { name: "doc", testMatch: "doc.spec.js", timeout: 120000 },
  ],
});
