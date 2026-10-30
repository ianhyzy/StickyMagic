# StickyMagic
A simple solution for creative writing

<img width="1488" height="1593" alt="image" src="https://github.com/user-attachments/assets/b6ec2fc3-50eb-4f4f-8915-554756bf98f5" />

## Installing

1. In your Google Doc: **Extensions → Apps Script**.
2. Replace everything in `Code.gs` with [`script/Code.js`](script/Code.js).
3. **+ → HTML**, name it `Sidebar` (no `.html`), paste in [`script/Sidebar.html`](script/Sidebar.html).
4. **Services +** (left panel) → **Google Docs API** → **Add**. Leave the identifier as `Docs`; nothing works without this.
5. Save (Ctrl/⌘+S), then reload the doc. The **Sticky Magic** menu takes a few seconds to appear.
6. First run shows *"Google hasn't verified this app"*. Click **Advanced → Go to … (unsafe) → Allow**. It's your own copy of the script, running only on your doc. The "external service" permission is how it loads entry images into the sidebar.
7. Add a document tab named `Metadata` (Tabs panel → **+**).

The script lives inside that one doc. To reuse it, **File → Make a copy** of the doc, which copies the script too.

## Writing your Metadata tab

Put your notes in a document tab named **Metadata** (or pick another tab in ⚙ Settings → Source Tab).

```
Alice                      ← name (what gets matched in your text)
Ship's engineer, ex-navy   ← description: line 2, only if it has no ":"
Age: 34                    ← "Key: Value" lines become properties
Ship: The Gull
_spoiler: she's the mole   ← a line starting with "_" ends the entry; the rest stays hidden
                           ← blank line = next entry
```

- **Headings are entries too**, and nest everything below them into a breadcrumb path (`Characters › Crew`). A heading with no description lists its children automatically.
- **A description containing `:` becomes a property instead.** Rephrase it or it vanishes from the card.
- **One image per entry**: the first inline or anchored image in it.
- **Matching is a case-insensitive substring search** — no word boundaries, no aliases. `Al` will also fire on "also"; add nicknames as separate entries.

## Using the sidebar

- Edits to the Metadata tab apply when you switch back to another tab. Turn off **Auto-reload on Edit** in ⚙ Settings to only reload when you click **Reload Metadata**.
- The sidebar re-scans your cursor about every 2 s. Select text to scan more than one paragraph, or raise **Context Range** (0–5 paragraphs either side).
- Settings are saved in your browser, not the document — they don't follow you to another computer.

## Development

- Pushing to `main` deploys via `clasp push` only when files under `script/` change.
- The workflow needs a `CLASPRC_JSON` repo secret: the contents of `~/.clasprc.json` after `clasp login` with the account that owns the script.
- `.clasp.json` sits at the repo root with `rootDir: "."`, so Apps Script file names carry a `script/` prefix — that's why `showSidebar` loads `script/Sidebar`. Don't move files without updating it.
- The **Docs** advanced service (v1) must stay enabled in `appsscript.json`; tab reading depends on it.
