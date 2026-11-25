/**
 * Builds the complex tabs of the StickyMagic CI test doc: Novel (+ Appendix subtab) and Codex (+ Places subtab).
 * Not part of the add-on. To rebuild: push it to the test doc's bound script next to script/*, then call
 *   google.script.run.ciBuildComplexDoc({ tabs: {novel, appendix, codex, places}, images: {name: base64 PNG} })
 * from the open sidebar (images from make_images.py). The next CI run's clasp push removes it again.
 * Things neither DocumentApp nor the Docs API can create (TOC, equations, chips, comments, suggestions,
 * page numbers) are added by hand afterwards; see tests/fixture/README.md.
 */
function ciBuildComplexDoc(spec) {
  var log = [];
  var doc = DocumentApp.getActiveDocument();
  var docId = doc.getId();
  var img = {};
  Object.keys(spec.images).forEach(function (k) {
    img[k] = function () { return Utilities.newBlob(Utilities.base64Decode(spec.images[k]), "image/png", k + ".png"); };
  });
  var jpeg = function (k) { return img[k]().getAs("image/jpeg").setName(k + ".jpg"); };
  var gif = function (k) { return img[k]().getAs("image/gif").setName(k + ".gif"); };
  var footnotes = [];
  var fn = function (text) { footnotes.push(text); return "⟦fn" + (footnotes.length - 1) + "⟧"; };

  // ---------- deterministic prose ----------
  var seed = 1234567;
  var rnd = function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  var pick = function (a) { return a[Math.floor(rnd() * a.length)]; };
  var crew = ["Ilse Varga", "Teodor Brask", "Zoë Lindqvist", "Mateo Alvarez", "李娜", "Ægir Holm", "Nkechi Obi", "Pell"];
  var ships = ["The Gull", "Saint Brendan", "Halcyon"];
  var places = ["Port Ruin", "The Narrows", "Skarra Light", "Kelp Market"];
  var items = ["Brass Sextant", "Tide Ledger", "Storm Lantern"];
  var verbs = ["watched", "cursed", "followed", "trusted", "doubted", "signalled", "carried", "remembered", "ignored", "answered"];
  var objs = ["the rigging", "the tide tables", "a salt-stained map", "the lamp", "the far shore", "the bilge pump", "a coil of rope", "the compass rose", "the cargo manifest", "the sounding line"];
  var advs = ["slowly", "without a word", "for the third time that night", "as the swell rose", "against every instinct", "before the bell", "under a low sky"];
  var tails = ["The wind veered west.", "Nobody spoke of the debt.", "Somewhere below, a hatch banged twice.", "The fog thinned and closed again.", "It was not the first warning.", "Rain hissed on the deck.", "The bell rang eight times."];
  var sentence = function () {
    var r = rnd();
    if (r < 0.15) return pick(tails);
    var who = rnd() < 0.7 ? pick(crew) : "the mate";
    var s = who + " " + pick(verbs) + " " + pick(objs) + " " + pick(advs);
    if (rnd() < 0.35) s += " near " + pick(places);
    if (rnd() < 0.25) s += " aboard " + pick(ships);
    if (rnd() < 0.12) s += ", holding the " + pick(items);
    return s.charAt(0).toUpperCase() + s.slice(1) + ".";
  };
  var prose = function (n) { var out = []; for (var i = 0; i < n; i++) out.push(sentence()); return out.join(" "); };
  var H = DocumentApp.ParagraphHeading, A = DocumentApp.HorizontalAlignment, L = DocumentApp.PositionedLayout, G = DocumentApp.GlyphType;
  var first = function (b, text, heading) { var p = b.getParagraphs()[0]; p.setText(text); p.setHeading(heading); return p; };
  var para = function (body, text, heading) { var p = body.appendParagraph(text); if (heading) p.setHeading(heading); return p; };
  var styleWord = function (p, word, fnc) { var t = p.editAsText(), s = p.getText().indexOf(word); if (s >= 0) fnc(t, s, s + word.length - 1); };

  // ---------- Novel ----------
  var novelTab = doc.getTab(spec.tabs.novel).asDocumentTab();
  var body = novelTab.getBody();
  body.clear();
  var header = novelTab.getHeader() || novelTab.addHeader();
  header.clear();
  var hp = header.appendParagraph("The Gull's Last Crossing — working draft ");
  hp.appendInlineImage(img.icon()).setWidth(14).setHeight(14);
  hp.setAlignment(A.RIGHT);
  var footer = novelTab.getFooter() || novelTab.addFooter();
  footer.clear();
  footer.appendParagraph("StickyMagic CI fixture · do not edit by hand outside the Story/Metadata tabs").setAlignment(A.CENTER);

  first(body, "The Gull's Last Crossing", H.TITLE).setAlignment(A.CENTER);
  para(body, "A novel in eight chapters, with a codex", H.SUBTITLE).setAlignment(A.CENTER);
  var epi = para(body, "“The sea keeps no ledger, so we keep it for her.” — from the Tide Ledger");
  epi.setAlignment(A.CENTER).editAsText().setItalic(true);
  body.appendImage(img.banner()).setWidth(620).setHeight(93);
  para(body, "⟦toc⟧");
  body.appendPageBreak();

  var chapters = ["The Debt", "Fog at The Narrows", "The Roster", "Two Watches", "Skarra Light", "Voices", "The Ledger Opens", "Landfall"];
  var bookmarkId = null;
  for (var c = 0; c < chapters.length; c++) {
    var h1 = para(body, "Chapter " + (c + 1) + ": " + chapters[c], H.HEADING1);
    if (c === 4) bookmarkId = novelTab.addBookmark(novelTab.newPosition(h1.editAsText(), 0)).getId();
    for (var s = 0; s < 3; s++) {
      para(body, "Scene " + (c + 1) + "." + (s + 1), H.HEADING2);
      if (s === 2) para(body, "An aside", H.HEADING3);
      for (var k = 0; k < 6; k++) {
        var text = prose(5 + Math.floor(rnd() * 4));
        if (rnd() < 0.3) text += fn("Note on " + pick(crew) + ": " + prose(1));
        var p = para(body, text);
        if (k === 0 && s === 0) p.setIndentFirstLine(36);
        if (rnd() < 0.2) p.setAlignment(A.JUSTIFY);
        if (rnd() < 0.3) styleWord(p, pick(crew), function (t, a, b) { t.setBold(a, b, true); });
        if (rnd() < 0.15) styleWord(p, pick(places), function (t, a, b) { t.setItalic(a, b, true).setForegroundColor(a, b, "#1155cc"); });
      }
      chapterExtras(c, s);
    }
    if (c < chapters.length - 1) body.appendPageBreak();
  }

  function chapterExtras(c, s) {
    if (c === 0 && s === 0) {
      var p = para(body, "Ilse Varga stood at the rail of The Gull. " + prose(8));
      p.addPositionedImage(jpeg("sunset")).setLayout(L.WRAP_TEXT).setWidth(260).setHeight(146).setLeftOffset(0).setTopOffset(0);
      para(body, prose(6));
    }
    if (c === 1 && s === 0) {
      para(body, "What Zoë Lindqvist packed:");
      var a = body.appendListItem("Oilskins and a spare knife").setGlyphType(G.BULLET);
      body.appendListItem("Charts of The Narrows").setNestingLevel(1).setGlyphType(G.HOLLOW_BULLET).setListId(a);
      body.appendListItem("The older chart, the one Pell drew").setNestingLevel(2).setGlyphType(G.SQUARE_BULLET).setListId(a);
      body.appendListItem("Letters for Port Ruin").setGlyphType(G.BULLET).setListId(a);
      var li = body.appendListItem("A lamp wick ").setGlyphType(G.BULLET).setListId(a);
      li.appendInlineImage(img.icon()).setWidth(16).setHeight(16);
      li.appendText(" and the Storm Lantern itself");
      para(body, "The watch order, as Teodor Brask set it:");
      var n = body.appendListItem("First watch: Teodor Brask").setGlyphType(G.NUMBER);
      body.appendListItem("Middle watch: Nkechi Obi").setGlyphType(G.NUMBER).setListId(n);
      body.appendListItem("Relief, if the wind backs").setNestingLevel(1).setGlyphType(G.LATIN_LOWER).setListId(n);
      body.appendListItem("Morning watch: Ægir Holm").setGlyphType(G.NUMBER).setListId(n);
      body.appendListItem("Unassigned").setGlyphType(G.ROMAN_UPPER);
      para(body, "Before the crossing:");
      para(body, "⟦cb⟧Stow the Brass Sextant");
      para(body, "⟦cb⟧Pay Mateo Alvarez what he is owed");
      para(body, "⟦cb⟧Sound the bilge at Skarra Light");
    }
    if (c === 1 && s === 1) {
      var q = para(body, "A small sun ");
      q.appendInlineImage(img.icon()).setWidth(12).setHeight(12);
      q.appendText(" sat in the margin of the Tide Ledger, drawn by 李娜, beside the entry for Halcyon" + fn("The ledger uses Halcyon's old name in two places.") + ".");
    }
    if (c === 2 && s === 0) {
      var rows = [["Roster of The Gull", "", "", ""], ["Name", "Role", "Portrait", "Notes"]];
      crew.forEach(function (name, i) { rows.push([name, pick(["Captain", "Mate", "Cook", "Bosun", "Navigator", "Deckhand"]), "", prose(1)]); });
      var t = body.appendTable(rows);
      t.setBorderColor("#888888");
      for (var col = 0; col < 4; col++) { t.getRow(1).getCell(col).setBackgroundColor("#dde7f5"); t.getRow(1).getCell(col).editAsText().setBold(true); }
      t.getRow(0).getCell(0).setBackgroundColor("#1f3b63").editAsText().setForegroundColor("#ffffff").setBold(true);
      crew.forEach(function (name, i) {
        var cell = t.getRow(i + 2).getCell(2);
        cell.getChild(0).asParagraph().appendInlineImage(img["portrait" + i]()).setWidth(40).setHeight(52);
      });
      var nested = t.getRow(2).getCell(3).appendTable([["Watch", "Hours"], ["First", "20:00–00:00"], ["Morning", "04:00–08:00"]]);
      nested.getRow(0).getCell(0).setBackgroundColor("#f4f4f4");
      para(body, "The roster above is the one Ilse Varga posted by the galley" + fn("The roster is merged across its first row in the fixture.") + ".");
    }
    if (c === 3 && s === 0) {
      para(body, "⟦cols2⟧");
      for (var i = 0; i < 6; i++) para(body, prose(5)).setAlignment(A.JUSTIFY);
      para(body, "⟦cols1⟧");
    }
    if (c === 4) {
      var layouts = [[L.BREAK_BOTH, "checker", 160, 160], [L.BREAK_LEFT, "portrait3", 100, 130], [L.BREAK_RIGHT, "portrait5", 100, 130], [L.ABOVE_TEXT, "disc_alpha", 120, 120], [L.WRAP_TEXT, "stripes_tall", 60, 240]];
      var lay = layouts[s] || layouts[0];
      var lp = para(body, "At Skarra Light, Nkechi Obi counted the flashes. " + prose(7));
      lp.addPositionedImage(img[lay[1]]()).setLayout(lay[0]).setWidth(lay[2]).setHeight(lay[3]).setLeftOffset(40 * s).setTopOffset(10);
      if (s === 2) {
        var lp2 = para(body, "Ægir Holm said nothing about the second light. " + prose(7));
        lp2.addPositionedImage(gif("disc_alpha")).setLayout(L.ABOVE_TEXT).setWidth(80).setHeight(80).setLeftOffset(300).setTopOffset(0);
        lp2.addPositionedImage(img.stripes_tall()).setLayout(L.WRAP_TEXT).setWidth(50).setHeight(200).setLeftOffset(520).setTopOffset(0);
      }
    }
    if (c === 5 && s === 0) {
      var r1 = para(body, "قال البحار: البحر لا يحتفظ بدفتر. Pell copied it phonetically.");
      r1.setLeftToRight(false).setAlignment(A.RIGHT);
      para(body, "הים אינו שומר פנקס — Ægir Holm's grandmother, quoted.").setLeftToRight(false);
      para(body, "李娜在潮汐账簿上写道：雾在黎明前散去。Then, in English: the fog lifted before dawn.");
      para(body, "🌊 ⚓ 🕯️ Zoë Lindqvist drew these in the margin: a wave, an anchor, a candle. 🧭");
      var st = para(body, "Bold, italic, underline, strikethrough, H2O, x2, small text, big text, highlighted, red, Courier, linked.");
      var t2 = st.editAsText(), tx = st.getText();
      var span = function (w) { var i = tx.indexOf(w); return [i, i + w.length - 1]; };
      var b = span("Bold"); t2.setBold(b[0], b[1], true);
      b = span("italic"); t2.setItalic(b[0], b[1], true);
      b = span("underline"); t2.setUnderline(b[0], b[1], true);
      b = span("strikethrough"); t2.setStrikethrough(b[0], b[1], true);
      t2.setTextAlignment(tx.indexOf("H2O") + 1, tx.indexOf("H2O") + 1, DocumentApp.TextAlignment.SUBSCRIPT);
      t2.setTextAlignment(tx.indexOf("x2") + 1, tx.indexOf("x2") + 1, DocumentApp.TextAlignment.SUPERSCRIPT);
      b = span("small text"); t2.setFontSize(b[0], b[1], 7);
      b = span("big text"); t2.setFontSize(b[0], b[1], 20);
      b = span("highlighted"); t2.setBackgroundColor(b[0], b[1], "#fff176");
      b = span("red"); t2.setForegroundColor(b[0], b[1], "#cc0000");
      b = span("Courier"); t2.setFontFamily(b[0], b[1], "Courier New");
      b = span("linked"); t2.setLinkUrl(b[0], b[1], "https://example.org/the-gull");
      var il = para(body, "See Chapter 5 for Skarra Light.");
      if (bookmarkId) il.editAsText().setLinkUrl(4, 12, "#bookmark=" + bookmarkId);
      para(body, "Line one of a note from Teodor Brask\nline two, same paragraph\nline three: signed, T.B.");
      body.appendHorizontalRule();
    }
    if (c === 6 && s === 0) {
      var two = para(body, "");
      two.appendInlineImage(img.portrait1()).setWidth(90).setHeight(117);
      two.appendText("  ");
      two.appendInlineImage(img.portrait2()).setWidth(90).setHeight(117);
      two.appendText("  Teodor Brask and Zoë Lindqvist, sketched by Pell.");
      body.appendImage(img.stripes_tall()).setWidth(60).setHeight(240);
      var quote = para(body, "“Every page of the Tide Ledger is a promise someone failed to keep,” Mateo Alvarez said.");
      quote.setIndentStart(48).setIndentEnd(48).editAsText().setItalic(true);
      var code = para(body, "LEDGER 1887-03-14  Halcyon  owed: 40 sovereigns  paid: 0  witness: Pell");
      code.editAsText().setFontFamily("Roboto Mono").setFontSize(9);
      body.appendHorizontalRule();
    }
    if (c === 7 && s === 0) {
      var longText = [];
      for (var i = 0; i < 40; i++) longText.push(sentence());
      para(body, longText.join(" "));
      para(body, "Ilse Varga, Teodor Brask, Zoë Lindqvist, Mateo Alvarez, 李娜, Ægir Holm, Nkechi Obi, Pell, The Gull, Saint Brendan, Halcyon, Port Ruin, The Narrows, Skarra Light, Kelp Market.");
      para(body, "THE END").setAlignment(A.CENTER).setHeading(H.HEADING1);
    }
  }
  log.push("novel paragraphs: " + body.getParagraphs().length);

  // ---------- Appendix (subtab of Novel) ----------
  var app = doc.getTab(spec.tabs.appendix).asDocumentTab().getBody();
  app.clear();
  first(app, "Appendix", H.HEADING1);
  para(app, "Glossary", H.HEADING2);
  var gl = [["Term", "Meaning"]];
  ["bilge", "bosun", "dog watch", "fathom", "lee shore", "sounding", "sextant", "tide ledger"].forEach(function (w) { gl.push([w, prose(1)]); });
  app.appendTable(gl).getRow(0).editAsText().setBold(true);
  para(app, "Ports of call", H.HEADING2);
  var firstPort = app.appendListItem(places[0]).setGlyphType(G.NUMBER);
  for (var i = 1; i < 30; i++) app.appendListItem(pick(places) + " — " + prose(1)).setGlyphType(G.NUMBER).setListId(firstPort);
  para(app, "Portrait grid", H.HEADING2);
  var grid = app.appendTable([["", "", ""], ["", "", ""], ["", "", ""]]);
  for (var g = 0; g < 9; g++) grid.getRow(Math.floor(g / 3)).getCell(g % 3).getChild(0).asParagraph().appendInlineImage(img["portrait" + g]()).setWidth(60).setHeight(78);
  para(app, "Sources" + fn("Invented for the StickyMagic test fixture."), H.HEADING2);
  para(app, prose(6));

  // ---------- Codex (metadata source for the complex case) ----------
  var cx = doc.getTab(spec.tabs.codex).asDocumentTab().getBody();
  cx.clear();
  first(cx, "Codex", H.TITLE);
  para(cx, "");
  var entry = function (b, name, lines, image) {
    var np = para(b, name);
    if (image && image.positioned) np.addPositionedImage(image.blob).setLayout(image.layout || L.WRAP_TEXT).setWidth(image.w || 60).setHeight(image.h || 78);
    lines.forEach(function (l) { para(b, l); });
    if (image && !image.positioned) { var ip = para(b, ""); ip.appendInlineImage(image.blob).setWidth(image.w || 60).setHeight(image.h || 78); }
    para(b, "");
    return np;
  };
  para(cx, "Characters", H.HEADING1); para(cx, "");
  para(cx, "Crew", H.HEADING2); para(cx, "");
  entry(cx, "Ilse Varga", ["Captain of The Gull", "Age: 52", "Home: Port Ruin", "_spoiler: she sold the Halcyon's papers"], { blob: img.portrait0(), positioned: true });
  entry(cx, "Teodor Brask", ["First mate, keeps the watch order", "Watch: 20:00–00:00", "Wiki: https://example.org/teodor"], { blob: jpeg("portrait1"), w: 80, h: 104 });
  entry(cx, "Zoë Lindqvist", ["Navigator" + fn("Trained at the Skarra school."), "Instrument: Brass Sextant"], { blob: img.portrait2(), positioned: true, layout: L.BREAK_BOTH });
  entry(cx, "Mateo Alvarez", ["Bosun. Owed money by everyone.", "Debt: 40 sovereigns"]);
  entry(cx, "李娜", ["Cook and keeper of the Tide Ledger", "Languages: Mandarin, English"], { blob: img.portrait4() });
  entry(cx, "Ægir Holm", ["Deckhand", "Born: 1861"], { blob: gif("portrait5"), positioned: true, layout: L.ABOVE_TEXT, w: 40, h: 52 });
  entry(cx, "Nkechi Obi", ["Lamp keeper at Skarra Light, later crew", "Ratio of lamps to keepers: 3:1"]);
  entry(cx, "Pell", ["Ship's boy who draws everything", "_note: short name, also matches spell and Pellucid"]);
  para(cx, "Passengers", H.HEADING2); para(cx, "");
  var li1 = cx.appendListItem("Mira 🌙").setGlyphType(G.BULLET);
  cx.appendListItem("Passenger with a moon in her name").setGlyphType(G.BULLET).setListId(li1);
  para(cx, "");
  entry(cx, "Teodor Brask", ["Duplicate entry under Passengers: should it overwrite the crew one?"]);
  var soft = para(cx, "Halvard Sund\nSoft line breaks instead of new paragraphs\nAge: 40"); // one paragraph, three lines
  para(cx, "");
  para(cx, "Ships", H.HEADING1); para(cx, "");
  entry(cx, "The Gull", ["Two-masted schooner", "Tonnage: 120", "Captain: Ilse Varga"], { blob: jpeg("sunset"), w: 160, h: 90 });
  entry(cx, "Saint Brendan", ["Pilot boat out of Port Ruin"], { blob: img.banner(), positioned: true, layout: L.BREAK_BOTH, w: 300, h: 45 });
  entry(cx, "Halcyon", ["Lost with her papers", "Status: missing"]);
  var tbl = cx.appendTable([["Kelp Market Ferry", "Entry written inside a table cell"], ["Tonnage: 15", ""]]);
  para(cx, "");
  para(cx, "Items", H.HEADING1); para(cx, "");
  para(cx, "Instruments", H.HEADING2); para(cx, "");
  para(cx, "Navigation", H.HEADING3); para(cx, "");
  para(cx, "Celestial", H.HEADING4); para(cx, "");
  para(cx, "Antique", H.HEADING5); para(cx, "");
  para(cx, "Provenance unknown", H.HEADING6); para(cx, "");
  entry(cx, "Brass Sextant", ["Zoë Lindqvist's sextant, dented", "Maker: unknown"], { blob: img.checker(), w: 50, h: 50 });
  para(cx, "Records", H.HEADING2); para(cx, "");
  entry(cx, "Tide Ledger", ["Debts owed to and by the sea", "Pages: 312"], { blob: img.stripes_tall(), positioned: true, layout: L.WRAP_TEXT, w: 30, h: 120 });
  entry(cx, "Storm Lantern", ["Description with a colon: it never goes out"]);

  // ---------- Places (subtab of Codex) ----------
  var pl = doc.getTab(spec.tabs.places).asDocumentTab().getBody();
  pl.clear();
  first(pl, "Places", H.HEADING1);
  para(pl, "");
  entry(pl, "Port Ruin", ["Home port, half flooded", "Population: 2,300"], { blob: img.sunset(), w: 160, h: 90 });
  entry(pl, "The Narrows", ["Strait with fog most mornings"], { blob: img.checker(), positioned: true, layout: L.WRAP_TEXT });
  entry(pl, "Skarra Light", ["Lighthouse on a skerry", "Flash: every 7 s"]);
  entry(pl, "Kelp Market", ["Floating market"]);

  doc.saveAndClose();
  log.push("footnote markers: " + footnotes.length);

  // ---------- Docs API passes ----------
  var tabIds = [spec.tabs.novel, spec.tabs.appendix, spec.tabs.codex, spec.tabs.places];
  var tabBody = function (d, id) {
    var found = null;
    (function walk(ts) { (ts || []).forEach(function (t) { if (t.tabProperties.tabId === id) found = t; walk(t.childTabs); }); })(d.tabs);
    return found.documentTab.body.content;
  };
  var paragraphs = function (content) {
    var out = [];
    (function walk(els) {
      (els || []).forEach(function (e) {
        if (e.paragraph) out.push(e);
        if (e.table) e.table.tableRows.forEach(function (r) { r.tableCells.forEach(function (c) { walk(c.content); }); });
      });
    })(content);
    return out;
  };
  var d = Docs.Documents.get(docId, { includeTabsContent: true });
  var ops = []; // {tab, index, reqs}
  tabIds.forEach(function (tabId) {
    paragraphs(tabBody(d, tabId)).forEach(function (pe) {
      pe.paragraph.elements.forEach(function (el) {
        var t = el.textRun && el.textRun.content; if (!t) return;
        var re = /⟦(fn(\d+)|cb|cols2|cols1|toc)⟧/g, m;
        while ((m = re.exec(t))) {
          var start = el.startIndex + m.index, end = start + m[0].length;
          var del = { deleteContentRange: { range: { startIndex: start, endIndex: end, tabId: tabId } } };
          if (m[2] !== undefined) ops.push({ tab: tabId, index: start, reqs: [del, { createFootnote: { location: { index: start, tabId: tabId } } }], fn: +m[2] });
          else if (m[1] === "cb") ops.push({ tab: tabId, index: start, reqs: [del, { createParagraphBullets: { range: { startIndex: pe.startIndex, endIndex: pe.endIndex - m[0].length, tabId: tabId }, bulletPreset: "BULLET_CHECKBOX" } }] });
          else if (m[1] === "cols2" || m[1] === "cols1") ops.push({ tab: tabId, index: start, reqs: [del, { insertSectionBreak: { location: { index: start, tabId: tabId }, sectionType: "CONTINUOUS" } }], cols: m[1] });
          // ⟦toc⟧ stays: the table of contents is inserted there by hand
        }
      });
    });
  });
  ops.sort(function (a, b) { return a.tab === b.tab ? b.index - a.index : (a.tab < b.tab ? -1 : 1); });
  var reqs = [], fnOrder = [];
  ops.forEach(function (o) { o.reqs.forEach(function (r) { reqs.push(r); if (r.createFootnote) fnOrder.push({ fn: o.fn, tab: o.tab }); }); });
  var res = Docs.Documents.batchUpdate({ requests: reqs }, docId);
  var fnFill = [], i2 = 0;
  res.replies.forEach(function (r) {
    if (r.createFootnote) {
      var f = fnOrder[i2++];
      fnFill.push({ insertText: { text: footnotes[f.fn], endOfSegmentLocation: { segmentId: r.createFootnote.footnoteId, tabId: f.tab } } });
    }
  });
  if (fnFill.length) Docs.Documents.batchUpdate({ requests: fnFill }, docId);
  log.push("api ops: " + reqs.length + ", footnotes: " + fnFill.length);

  // Merge the roster title row; make the section between the two column breaks two columns wide.
  d = Docs.Documents.get(docId, { includeTabsContent: true });
  var post = [];
  var novel = tabBody(d, spec.tabs.novel);
  novel.forEach(function (e) {
    if (e.table && JSON.stringify(e.table.tableRows[0]).indexOf("Roster of The Gull") >= 0) {
      post.push({ mergeTableCells: { tableRange: { tableCellLocation: { tableStartLocation: { index: e.startIndex, tabId: spec.tabs.novel }, rowIndex: 0, columnIndex: 0 }, rowSpan: 1, columnSpan: 4 } } });
    }
  });
  var breaks = novel.filter(function (e) { return e.sectionBreak && e.startIndex > 1; });
  if (breaks.length >= 2) {
    post.push({ updateSectionStyle: { range: { startIndex: breaks[0].endIndex, endIndex: breaks[1].startIndex, tabId: spec.tabs.novel },
      sectionStyle: { columnProperties: [{ paddingEnd: { magnitude: 18, unit: "PT" } }, {}], columnSeparatorStyle: "BETWEEN_EACH_COLUMN" },
      fields: "columnProperties,columnSeparatorStyle" } });
  }
  if (post.length) Docs.Documents.batchUpdate({ requests: post }, docId);
  log.push("merges/columns: " + post.length);
  return log.join("; ");
}
