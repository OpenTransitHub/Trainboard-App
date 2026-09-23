(async function () {
  const selectedLang = localStorage.getItem("app_lang") || "de";

  function updateLanguageLabel(name) {
    const displayElement = document.getElementById("selected-languages");
    if (displayElement) {
      displayElement.textContent = name;
    }
  }

  let ignorePhrases = [];
  try {
    const ignoreResponse = await fetch("./languages/ignore.json");
    if (ignoreResponse.ok) {
      ignorePhrases = await ignoreResponse.json();
    }
  } catch (err) {}

  if (selectedLang === "de") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => updateLanguageLabel("Deutsch"));
    } else {
      updateLanguageLabel("Deutsch");
    }
    return;
  }

  let dictionary = {};

  try {
    const response = await fetch(`./languages/${selectedLang}.json`);
    if (!response.ok) throw new Error("Sprachdatei nicht gefunden");
    dictionary = await response.json();
  } catch (err) {
    console.error("i18n Fehler beim Laden:", err);
    return;
  }

  const langName = dictionary["_language_name"] || selectedLang.toUpperCase();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => updateLanguageLabel(langName));
  } else {
    updateLanguageLabel(langName);
  }

  const keys = Object.keys(dictionary).filter((key) => key !== "_language_name");
  
  const allPhrases = [...ignorePhrases, ...keys].sort((a, b) => b.length - a.length);
  if (allPhrases.length === 0) return;

  const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const searchPattern = new RegExp(
    allPhrases.map((k) => escapeRegExp(k)).join("|"),
    "g"
  );

  function processText(text) {
    return text.replace(searchPattern, (matched) => {
      if (ignorePhrases.includes(matched)) {
        return matched;
      }
      return dictionary[matched] || matched;
    });
  }

  function translateTextNode(node) {
    if (node.nodeType === 3 && node.nodeValue.trim() !== "") {
      const original = node.nodeValue;
      const updated = processText(original);
      if (original !== updated) {
        node.nodeValue = updated;
      }
    }
  }

  function translateAttributes(element) {
    if (element.nodeType !== 1) return;
    const targetAttrs = ["placeholder", "title", "alt"];

    targetAttrs.forEach((attr) => {
      if (element.hasAttribute(attr)) {
        const original = element.getAttribute(attr);
        const updated = processText(original);
        if (original !== updated) {
          element.setAttribute(attr, updated);
        }
      }
    });
  }

  function translateTree(root) {
    if (root.nodeType === 1) translateAttributes(root);

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (node.nodeType === 1) {
            const tag = node.tagName;
            if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA") {
              return NodeFilter.FILTER_REJECT;
            }
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    let currentNode = walker.nextNode();
    while (currentNode) {
      if (currentNode.nodeType === 3) {
        translateTextNode(currentNode);
      } else if (currentNode.nodeType === 1) {
        translateAttributes(currentNode);
      }
      currentNode = walker.nextNode();
    }
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => translateTree(node));

      if (
        mutation.type === "attributes" &&
        ["placeholder", "title", "alt"].includes(mutation.attributeName)
      ) {
        translateAttributes(mutation.target);
      }
    }
  });

  function init() {
    translateTree(document.body);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "alt"],
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();