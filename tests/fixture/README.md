# Complex test doc

The tabs **Novel** (subtab **Appendix**) and **Codex** (subtab **Places**) of the *StickyMagic CI* doc
(ian@appsscript.club) are the complex case for `tests/doc.spec.js`. About 37 pages across the four tabs.

## Built by `BuildComplexDoc.js`

- Novel: title and subtitle, eight chapters of generated prose (H1–H3), header with an inline image, footer,
  page breaks, a two-column section, justified, indented and right-to-left paragraphs, Arabic, Hebrew, Chinese
  and emoji text, bold, italic, underline, strikethrough, super- and subscript, sizes, colours, highlight,
  fonts, an external link and a link to a bookmark, a paragraph with soft line breaks, horizontal rules.
- Lists: bullets nested three levels with three glyphs, numbered with a lettered sublevel, roman numerals,
  checkboxes.
- Tables: a crew roster with a merged title row, shaded header, portrait in each row and a nested table;
  a glossary; a 3×3 image grid.
- Images: inline (in their own paragraph, mid-sentence, two side by side, in table cells, in a list item,
  in the header) and positioned with every layout (wrap text, break both, break left, break right, in front of
  text), as PNG, JPEG, GIF and PNG with transparency, from 12 px to 620 px wide.
- 44 footnotes.
- Codex and Places: entries under headings nested six levels deep, entries with inline or positioned images,
  properties whose values contain colons and URLs, spoiler lines, a duplicate name, a bulleted entry, an entry
  typed with soft line breaks, an entry inside a table, a description containing a colon.

## Added by hand in the Docs UI

Neither DocumentApp nor the Docs API can create these:

- Novel: a table of contents (blue links style) under the banner, page numbers in the footer, a JavaScript
  code block after the `LEDGER` line, and a person chip and a date chip in the paragraph ending
  "filed under Ilse Varga.".
- Appendix: an equation, R = h<sub>max</sub> − h<sub>min</sub>, at the end.
- Codex: a **Harbor Office** entry whose Contact, Filed and Status values are a person chip, a date chip and a
  "Project status" dropdown chip; a comment on *Ilse Varga*; a pending suggestion changing her "Age: 52" to "53".

## Rebuilding

1. `python3 -I make_images.py > images.json`
2. Push `script/*` and `BuildComplexDoc.js` to the test doc's bound script with clasp, as the CI workflow does.
3. Open the doc and the sidebar, then from the sidebar frame call
   `google.script.run.ciBuildComplexDoc({ tabs: { novel, appendix, codex, places }, images })` with the four
   tab IDs (the `?tab=` value in the URL) and the JSON from step 1. It rewrites those four tabs in about 30 s.
4. Redo the hand-added features above. The next CI run's clasp push removes `BuildComplexDoc.js` again.
