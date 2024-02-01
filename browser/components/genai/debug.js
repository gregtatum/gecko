/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  EngineProcess: "chrome://global/content/ml/EngineProcess.sys.mjs",
  GenAI: "resource:///modules/GenAI.sys.mjs",
});

const { XPCOMUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/XPCOMUtils.sys.mjs"
);

const win = window.browsingContext.topChromeWindow;
const { gBrowser } = win;

function renderPrompts() {
  const prompts = document.getElementById("prompts");
  const prefs = Services.prefs.getChildList("genai.debug.prompts.").sort();
  for (const pref of prefs) {
    if (Services.prefs.getPrefType(pref) == Services.prefs.PREF_STRING) {
      const button = prompts.appendChild(document.createElement("button"));
      const prefVal = Services.prefs.getStringPref(pref);
      try {
        button.config = JSON.parse(prefVal);
      } catch (ex) {
        button.config = { prompt: prefVal };
      }
      button.title = prefVal;
      button.textContent = button.config?.label ?? prefVal;
    }
  }
}

async function renderResult({ engine, args, prompt }) {
  const startTime = new Date();
  const result = document.createElement("div");
  result.setAttribute("running", true);
  result.textContent = `Started ${startTime}`;
  document.getElementById("results").prepend(result);

  let actor;
  try {
    actor =
      gBrowser.selectedBrowser.browsingContext.currentWindowGlobal.getActor(
        "GenAI"
      );
  } catch (ex) {}

  const tabMap = {};
  const context = {
    currentTabTitle: gBrowser.selectedTab.label,
    openTabs: gBrowser.tabs
      .slice(-300)
      .reverse()
      .reduce((o, t, i) => {
        try {
          if (t.label != "New Tab") {
            const key =
              t.linkedBrowser.currentURI.host.replace(/^www\./, "") + i;
            o[key] = t.label.slice(0, 100);
            tabMap[key] = t;
          }
        } catch (ex) {}
        return o;
      }, {}),
    pageText: await actor?.getPageText(),
    selection: await actor?.getSelection(),
  };

  let text = "";
  try {
    if (engine) {
      text = await (await lazy.EngineProcess.getMLEngineParent())
        .getEngine(engine)
        .run(JSON.stringify({ queries: [context[args]] }));
    } else {
      text = await lazy.GenAI.completion(prompt, context);
    }
  } catch (ex) {
    text = ex;
  }

  const parts = { debug: "" };
  try {
    Object.assign(parts, JSON.parse(text));
  } catch (ex) {
    parts.debug = ex + "\n\n" + text;
  }
  parts.debug += `\n\n${
    (prompt + JSON.stringify(context) + text).length
  } chars, ${((Date.now() - startTime) / 1000).toFixed(1)} sec`;

  result.removeAttribute("running");
  result.textContent = "";

  if (parts.label) {
    const node = result.appendChild(document.createElement("h4"));
    node.textContent = parts.label;
  }

  if (parts.description) {
    const node = result.appendChild(document.createElement("p"));
    node.textContent = parts.description;
  }

  if (parts.tabs) {
    const node = result.appendChild(document.createElement("ul"));
    parts.tabs.forEach(key => {
      const tab = tabMap[key];
      if (tab) {
        const button = node
          .appendChild(document.createElement("li"))
          .appendChild(document.createElement("button"));
        button.textContent = button.title = tab.label;
        button.tab = tab;
      }
    });
  }

  if (parts.queries) {
    const node = result.appendChild(document.createElement("ul"));
    parts.queries.forEach(query => {
      const link = node
        .appendChild(document.createElement("li"))
        .appendChild(document.createElement("a"));
      link.textContent = query;
      link.href = Services.search.defaultEngine.getSubmission(query).uri.spec;
    });
  }

  if (parts.scores) {
    const node = result.appendChild(document.createElement("ul"));
    parts.scores.forEach(score => {
      node.appendChild(document.createElement("li")).textContent = score;
    });
  }

  const debug = result.appendChild(document.createElement("p"));
  debug.classList.add("debug");
  debug.textContent = parts.debug;
}

addEventListener("click", ({ target }) => {
  if (target.parentNode.id == "prompts") {
    renderResult(target.config);
  } else if (target.tab) {
    gBrowser.selectedTab = target.tab;
  } else if (target.href) {
    win.openLinkIn(target.href, "tabshifted", {
      triggeringPrincipal: win._createNullPrincipalFromTabUserContextId(),
    });
  }
});

addEventListener("load", renderPrompts);
