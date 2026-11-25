/**
 * Google Docs Add-on: StickyMagic
 * The script interacts with document tabs to fetch a document tab containing structured metadata
 * and provides context-aware suggestions based on the user's cursor position.
 * The metadata is organized using headings, which define the hierarchy. Each entry can have descriptions (text and one image) or properties (key/value)
 * The add-on includes a sidebar UI for user interaction. Users can change how much context to include when looking up values.
 */

function onOpen() {
  DocumentApp.getUi().createMenu('Sticky Magic')
    .addItem('Open Sticky Magic', 'showSidebar')
    .addToUi();
}

function showSidebar() {
  // clasp deploys the file as "script/Sidebar"; copy-paste installs name it "Sidebar"
  var html;
  try {
    html = HtmlService.createHtmlOutputFromFile('script/Sidebar');
  } catch (e) {
    html = HtmlService.createHtmlOutputFromFile('Sidebar');
  }
  html = html.setTitle('Sticky Magic')
    .setWidth(300);
  DocumentApp.getUi().showSidebar(html);
}

function getMetadataContent(tabName) {
  // Default to "Metadata" if no tab name provided
  var targetTabName = tabName || "Metadata";
  var docId = DocumentApp.getActiveDocument().getId();
  
  try {
    var doc = Docs.Documents.get(docId, {
      'includeTabsContent': true,
      // Read pending suggestions as if rejected; inline, a suggested "Age: 53" over "Age: 52" reads "Age: 53Age: 52"
      'suggestionsViewMode': 'PREVIEW_WITHOUT_SUGGESTIONS'
    });

    // Root level objects (mostly for single-tab or legacy docs)
    var rootInlineObjects = doc.inlineObjects || {};
    var rootPositionedObjects = doc.positionedObjects || {};

    if (!doc.tabs) {
      // Fallback for single-tab docs
      return { items: parseBodyContent(doc.body.content, rootInlineObjects, rootPositionedObjects) };
    }

    var metadataTab = findTab(doc.tabs, targetTabName);

    if (!metadataTab) {
      return { error: "Tab named '" + targetTabName + "' not found." };
    }

    // IMPORTANT: Access objects specific to the tab if they exist, fallback to root
    // Note: The API structure for tabs usually nests these under documentTab
    var tabInlineObjects = metadataTab.documentTab.inlineObjects || rootInlineObjects;
    var tabPositionedObjects = metadataTab.documentTab.positionedObjects || rootPositionedObjects;

    var items = parseBodyContent(metadataTab.documentTab.body.content, tabInlineObjects, tabPositionedObjects);
    return { items: items };

  } catch (e) {
    return { error: "Error accessing tab: " + e.message };
  }
}

// Depth-first, so subtabs follow their parent tab.
function findTab(tabs, title) {
  for (var i = 0; i < (tabs || []).length; i++) {
    if (tabs[i].tabProperties.title === title) return tabs[i];
    var child = findTab(tabs[i].childTabs, title);
    if (child) return child;
  }
  return null;
}

// All tab titles, subtabs included, in document order.
function getTabList() {
  var titles = [];
  try {
    (function walk(tabs) {
      tabs.forEach(function(tab) {
        titles.push({ title: tab.getTitle() });
        walk(tab.getChildTabs());
      });
    })(DocumentApp.getActiveDocument().getTabs());
  } catch (e) {
    // Leave whatever was collected
  }
  return titles;
}

/**
 * Parses content into structured metadata blocks with hierarchy.
 * Supports H1-H6 as categories/path.
 * Automatically populates descriptions for parent items if they are empty.
 */
function parseBodyContent(contentArray, inlineObjects, positionedObjects) {
  var metadata = {};
  var buffer = []; 
  var headingStack = []; 
  var currentPath = "";

  // Ensure objects are defined
  inlineObjects = inlineObjects || {};
  positionedObjects = positionedObjects || {};

  if (!contentArray) return metadata;

  // 1. Extract lines with style info
  var lines = [];
  contentArray.forEach(function(element) {
    if (element.paragraph) {
      var text = "";
      var imageUrl = null;
      var imageId = null;

      // Check for Inline Objects (inside text elements)
      element.paragraph.elements.forEach(function(el) {
        if (el.textRun && el.textRun.content) {
          text += el.textRun.content;
        } else if (el.person) {
          text += el.person.personProperties.name || el.person.personProperties.email || "";
        } else if (el.dateElement) {
          text += el.dateElement.dateElementProperties.displayText || "";
        } else if (el.dropdown) {
          text += el.dropdown.dropdownProperties.displayValue || "";
        } else if (el.richLink) {
          text += el.richLink.richLinkProperties.title || el.richLink.richLinkProperties.uri || "";
        } else if (el.inlineObjectElement && inlineObjects) {
          var objectId = el.inlineObjectElement.inlineObjectId;
          if (inlineObjects[objectId] &&
              inlineObjects[objectId].inlineObjectProperties &&
              inlineObjects[objectId].inlineObjectProperties.embeddedObject &&
              inlineObjects[objectId].inlineObjectProperties.embeddedObject.imageProperties) {

             if (!imageUrl) {
               imageUrl = inlineObjects[objectId].inlineObjectProperties.embeddedObject.imageProperties.contentUri;
               imageId = objectId;
             }
          }
        }
      });
      
      // Check for Positioned Objects (anchored to paragraph)
      if (!imageUrl && element.paragraph.positionedObjectIds && positionedObjects) {
        element.paragraph.positionedObjectIds.forEach(function(objectId) {
          if (!imageUrl && positionedObjects[objectId] &&
              positionedObjects[objectId].positionedObjectProperties &&
              positionedObjects[objectId].positionedObjectProperties.embeddedObject &&
              positionedObjects[objectId].positionedObjectProperties.embeddedObject.imageProperties) {

            imageUrl = positionedObjects[objectId].positionedObjectProperties.embeddedObject.imageProperties.contentUri;
            imageId = objectId;
          }
        });
      }

      var style = "NORMAL_TEXT";
      if (element.paragraph.paragraphStyle && element.paragraph.paragraphStyle.namedStyleType) {
        style = element.paragraph.paragraphStyle.namedStyleType;
      }

      // Shift+Enter puts a vertical tab inside one paragraph; each such line counts as its own line,
      // except in headings, which stay one heading.
      var parts = /^HEADING_/.test(style) ? [text.replace(/\u000b/g, " ")] : text.split("\u000b");
      parts.forEach(function(part, i) {
        lines.push({
          text: part.trim(),
          style: style,
          imageUrl: i === 0 ? imageUrl : null,
          imageId: i === 0 ? imageId : null
        });
      });
    }
  });

  // 2. Helper to process buffer into a metadata item
  function processBuffer(buf, pathStr) {
    // IMPORTANT: Only shift if text is empty AND NO IMAGE.
    while(buf.length > 0 && buf[0].text === "" && !buf[0].imageUrl) {
      buf.shift();
    }
    
    if (buf.length === 0) return;

    var name = buf[0].text;
    var description = "";
    if (buf.length > 1 && !buf[1].text.includes(":") && !buf[1].text.startsWith("_")) {
       description = buf[1].text;
    }

    var properties = {};
    var imageLine = null;

    // Check first line for image if present
    if (buf[0].imageUrl) imageLine = buf[0];
    // Check second line
    if (!imageLine && buf.length > 1 && buf[1].imageUrl) imageLine = buf[1];

    var startIndex = (description !== "") ? 2 : 1;

    for (var i = startIndex; i < buf.length; i++) {
      var line = buf[i].text;

      // Also check for image in subsequent lines
      if (!imageLine && buf[i].imageUrl) {
        imageLine = buf[i];
      }

      if (line.startsWith("_")) break; 

      if (line.includes(":")) {
        var parts = line.split(":");
        var key = parts[0].trim();
        var val = parts.slice(1).join(":").trim();
        if (key && val) {
          properties[key] = val;
        }
      }
    }

    if (name) {
      metadata[name] = {
        description: description,
        properties: properties,
        category: pathStr,
        imageUrl: imageLine ? imageLine.imageUrl : null,
        imageId: imageLine ? imageLine.imageId : null
      };
    }
  }

  // 3. Iterate lines
  lines.forEach(function(lineObj) {
    var headingMatch = lineObj.style.match(/^HEADING_(\d)$/);
    
    if (headingMatch) {
      var level = parseInt(headingMatch[1], 10); 
      
      if (buffer.length > 0) {
        processBuffer(buffer, currentPath);
        buffer = [];
      }
      
      var parentPath = headingStack.slice(0, level - 1).join(" > ");
      currentPath = parentPath;
      
      // Treat heading as an item itself
      buffer.push(lineObj); 
      
      headingStack[level - 1] = lineObj.text;
      headingStack.length = level;
      
    } else if (lineObj.text === "" && !lineObj.imageUrl) {
      // Empty line with no image acts as separator
      if (buffer.length > 0) {
        processBuffer(buffer, currentPath);
        buffer = [];
      }
      currentPath = headingStack.join(" > ");
      
    } else {
      if (buffer.length === 0) {
        currentPath = headingStack.join(" > ");
      }
      buffer.push(lineObj);
    }
  });

  if (buffer.length > 0) {
    processBuffer(buffer, currentPath);
  }

  // 4. Post-processing: Fill empty descriptions with child entries
  Object.keys(metadata).forEach(function(parentName) {
    var item = metadata[parentName];
    // Only if description is effectively empty
    if (!item.description || item.description.trim() === "") {
      var children = [];
      
      // Calculate the expected category string for immediate children
      var expectedChildCategory = item.category ? (item.category + " > " + parentName) : parentName;

      Object.keys(metadata).forEach(function(childName) {
        if (metadata[childName].category === expectedChildCategory) {
          children.push(childName);
        }
      });
      
      if (children.length > 0) {
        item.description = "Entries: " + children.join(", ");
      }
    }
  });
  
  return metadata;
}

/**
 * Docs API image URIs are served with Cross-Origin-Resource-Policy: same-site,
 * so the sidebar (hosted on googleusercontent.com) can't load them directly.
 * The sidebar calls this per image, only when a card needs it, and caches the result.
 * Returns null if the URI isn't a Docs image or has expired (they last ~30 minutes).
 */
function getImageDataUri(contentUri) {
  if (!/^https:\/\/(docs\.google\.com|[\w-]+\.googleusercontent\.com)\//.test(contentUri)) return null;
  try {
    var blob = UrlFetchApp.fetch(contentUri.replace(/=s\d+(?=\?|$)/, "=s400")).getBlob();
    return "data:" + blob.getContentType() + ";base64," + Utilities.base64Encode(blob.getBytes());
  } catch (e) {
    return null;
  }
}

/**
 * Gets the text context from the user's cursor.
 * Accepts an optional 'lookaround' parameter to include preceding/following paragraphs.
 */
function getCurrentContext(lookaround) {
  var limit = lookaround || 0;
  var doc = DocumentApp.getActiveDocument();
  var selection = doc.getSelection();
  var cursor = doc.getCursor();
  
  var coreText = "";
  var startBlock = null;
  var endBlock = null;

  // Helper to find the Paragraph or ListItem container
  function getBlockParent(element) {
    while (element) {
      var type = element.getType();
      if (type === DocumentApp.ElementType.PARAGRAPH || type === DocumentApp.ElementType.LIST_ITEM) {
        return element;
      }
      element = element.getParent();
    }
    return null;
  }

  // Element wrappers aren't reused between calls, so identify a block by its path of child indexes
  function blockKey(element) {
    var path = [];
    for (var parent = element.getParent(); parent; element = parent, parent = parent.getParent()) {
      path.push(parent.getChildIndex(element));
    }
    return path.join("/");
  }

  // Helper to extract text safely from blocks
  function getTextSafe(el) {
     if (!el) return "";
     var t = el.getType();
     if (t === DocumentApp.ElementType.PARAGRAPH) return el.asParagraph().getText();
     if (t === DocumentApp.ElementType.LIST_ITEM) return el.asListItem().getText();
     return "";
  }

  // 1. Capture the Core Text and identify boundaries (Start/End Block)
  if (selection) {
    var elements = selection.getRangeElements();
    if (elements.length > 0) {
      startBlock = getBlockParent(elements[0].getElement());
      endBlock = getBlockParent(elements[elements.length - 1].getElement());
    }

    // Whole paragraphs the selection touches, each once. A smart chip splits a paragraph into several
    // Text elements, so reading only the selected Text element would miss the words before the chip.
    var seen = {};
    for (var i = 0; i < elements.length; i++) {
      var block = getBlockParent(elements[i].getElement());
      if (!block) continue;
      var key = blockKey(block);
      if (seen[key]) continue;
      seen[key] = true;
      coreText += getTextSafe(block) + " ";
    }
  } 
  else if (cursor) {
    startBlock = getBlockParent(cursor.getElement());
    endBlock = startBlock; // Cursor is a single point, so start == end
    if (startBlock) {
      coreText = getTextSafe(startBlock);
    }
  }

  if (!startBlock) return buildContextResponse(doc, "");

  // 2. Look Backwards (Prepend text)
  var prefix = "";
  var curr = startBlock;
  var count = 0;
  var safety = 0;

  while (count < limit && safety < 100) {
    curr = curr.getPreviousSibling();
    if (!curr) break;
    
    var txt = getTextSafe(curr);
    // Only count/add if the paragraph has content
    if (txt.trim().length > 0) {
      prefix = txt + " " + prefix;
      count++;
    }
    safety++;
  }

  // 3. Look Forwards (Append text)
  var suffix = "";
  curr = endBlock || startBlock; 
  count = 0;
  safety = 0;

  while (count < limit && safety < 100) {
    curr = curr.getNextSibling();
    if (!curr) break;
    
    var txt = getTextSafe(curr);
    // Only count/add if the paragraph has content
    if (txt.trim().length > 0) {
      suffix += " " + txt;
      count++;
    }
    safety++;
  }

  var resultText = prefix + " " + coreText + " " + suffix;
  return buildContextResponse(doc, resultText);
}

/**
 * Wraps the context text with the active tab title and document revision,
 * which the sidebar uses to detect edits to the metadata tab.
 */
function buildContextResponse(doc, contextText) {
  var activeTabTitle = "";
  var revisionId = "";

  try {
    var activeTab = doc.getActiveTab();
    if (activeTab) {
      activeTabTitle = activeTab.getTitle();
    }
  } catch (e) {
    // Tabs not supported
  }

  try {
    revisionId = Docs.Documents.get(doc.getId(), {fields: "revisionId"}).revisionId;
  } catch (e) {
    // Leave revisionId empty; auto-reload just skips this poll
  }

  return {
    contextText: contextText,
    activeTabTitle: activeTabTitle,
    revisionId: revisionId
  };
}
