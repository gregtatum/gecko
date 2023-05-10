/* -*- indent-tabs-mode: nil; js-indent-level: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const kTranslationsPermission = "translate";
const kLanguagesPref = "browser.translation.neverForLanguages";
const kAlwaysTranslateLangsPref =
  "browser.translations.alwaysTranslateLanguages";
const kNeverTranslateLangsPref = "browser.translations.neverTranslateLanguages";

function Tree(aId, aData) {
  this._data = aData;
  this._tree = document.getElementById(aId);
  this._tree.view = this;
}

Tree.prototype = {
  get tree() {
    return this._tree;
  },
  get isEmpty() {
    return !this._data.length;
  },
  get hasSelection() {
    return this.selection.count > 0;
  },
  getSelectedItems() {
    let result = [];

    let rc = this.selection.getRangeCount();
    for (let i = 0; i < rc; ++i) {
      let min = {},
        max = {};
      this.selection.getRangeAt(i, min, max);
      for (let j = min.value; j <= max.value; ++j) {
        result.push(this._data[j]);
      }
    }

    return result;
  },

  // nsITreeView implementation
  get rowCount() {
    return this._data.length;
  },
  getCellText(aRow, aColumn) {
    return this._data[aRow];
  },
  isSeparator(aIndex) {
    return false;
  },
  isSorted() {
    return false;
  },
  isContainer(aIndex) {
    return false;
  },
  setTree(aTree) {},
  getImageSrc(aRow, aColumn) {},
  getCellValue(aRow, aColumn) {},
  cycleHeader(column) {},
  getRowProperties(row) {
    return "";
  },
  getColumnProperties(column) {
    return "";
  },
  getCellProperties(row, column) {
    return "";
  },
  QueryInterface: ChromeUtils.generateQI(["nsITreeView"]),
};

function Lang(aCode, label) {
  this.langCode = aCode;
  this._label = label;
}

Lang.prototype = {
  toString() {
    return this._label;
  },
};

var gTranslationsPreferences = {
  onLoad() {
    if (this._neverTranslateSiteTree) {
      // Re-using an open dialog, clear the old observers.
      this.uninit();
    }

    // Load site permissions into an array.
    this._neverTranslateSites = [];
    for (let perm of Services.perms.all) {
      if (
        perm.type == kTranslationsPermission &&
        perm.capability == Services.perms.DENY_ACTION
      ) {
        this._neverTranslateSites.push(perm.principal.origin);
      }
    }
    this._neverTranslateSites.sort();

    Services.obs.addObserver(this, "perm-changed");
    Services.prefs.addObserver(kAlwaysTranslateLangsPref, this);
    Services.prefs.addObserver(kNeverTranslateLangsPref, this);

    this._alwaysTranslateLangs = this.getAlwaysTranslateLanguages();
    this._neverTranslateLangs = this.getNeverTranslateLanguages();

    this._alwaysTranslateLangsTree = new Tree(
      "alwaysTranslateLanguagesTree",
      this._alwaysTranslateLangs
    );
    this._neverTranslateLangsTree = new Tree(
      "neverTranslateLanguagesTree",
      this._neverTranslateLangs
    );
    this._neverTranslateSiteTree = new Tree(
      "neverTranslateSitesTree",
      this._neverTranslateSites
    );

    this.onSelectAlwaysTranslateLanguage();
    this.onSelectNeverTranslateSite();
    this.onSelectNeverTranslateLanguage();
  },

  getLangsFromPref(pref) {
    let rawLangs = Services.prefs.getCharPref(pref);
    if (!rawLangs) {
      return [];
    }

    let langArr = rawLangs.split(",");
    let displayNames = Services.intl.getLanguageDisplayNames(
      undefined,
      langArr
    );
    let langs = langArr.map((lang, i) => new Lang(lang, displayNames[i]));
    langs.sort();

    return langs;
  },

  getAlwaysTranslateLanguages() {
    return this.getLangsFromPref(kAlwaysTranslateLangsPref);
  },

  getNeverTranslateLanguages() {
    return this.getLangsFromPref(kNeverTranslateLangsPref);
  },

  observe(aSubject, aTopic, aData) {
    if (aTopic == "perm-changed") {
      if (aData == "cleared") {
        if (!this._neverTranslateSites.length) {
          return;
        }
        let removed = this._neverTranslateSites.splice(
          0,
          this._neverTranslateSites.length
        );
        this._neverTranslateSiteTree.tree.rowCountChanged(0, -removed.length);
      } else {
        let perm = aSubject.QueryInterface(Ci.nsIPermission);
        if (perm.type != kTranslationsPermission) {
          return;
        }
        if (aData == "added") {
          if (perm.capability != Services.perms.DENY_ACTION) {
            return;
          }
          this._neverTranslateSites.push(perm.principal.origin);
          this._neverTranslateSites.sort();
          let tree = this._neverTranslateSiteTree.tree;
          tree.rowCountChanged(0, 1);
          tree.invalidate();
        } else if (aData == "deleted") {
          let index = this._neverTranslateSites.indexOf(perm.principal.origin);
          if (index == -1) {
            return;
          }
          this._neverTranslateSites.splice(index, 1);
          this._neverTranslateSiteTree.tree.rowCountChanged(index, -1);
          this.onSelectNeverTranslateSite();
          return;
        }
      }
      this.onSelectNeverTranslateSite();
    } else if (aTopic == "nsPref:changed") {
      this._alwaysTranslateLangs = this.getAlwaysTranslateLanguages();
      this._neverTranslateLangs = this.getNeverTranslateLanguages();

      let alwaysTranslateLangsChange =
        this._alwaysTranslateLangs.length -
        this._alwaysTranslateLangsTree.rowCount;
      let neverTranslateLangsChange =
        this._neverTranslateLangs.length -
        this._neverTranslateLangsTree.rowCount;

      this._alwaysTranslateLangsTree._data = this._alwaysTranslateLangs;
      this._neverTranslateLangsTree._data = this._neverTranslateLangs;

      let alwaysTranslateLangsTree = this._alwaysTranslateLangsTree.tree;
      let neverTranslateLangsTree = this._neverTranslateLangsTree.tree;

      if (alwaysTranslateLangsChange) {
        alwaysTranslateLangsTree.rowCountChanged(0, alwaysTranslateLangsChange);
      }
      if (neverTranslateLangsChange) {
        neverTranslateLangsTree.rowCountChanged(0, neverTranslateLangsChange);
      }

      alwaysTranslateLangsTree.invalidate();
      neverTranslateLangsTree.invalidate();

      this.onSelectAlwaysTranslateLanguage();
      this.onSelectNeverTranslateLanguage();
    }
  },

  _handleButtonDisabling(aTree, aIdPart) {
    let empty = aTree.isEmpty;
    document.getElementById("removeAll" + aIdPart + "s").disabled = empty;
    document.getElementById("remove" + aIdPart).disabled =
      empty || !aTree.hasSelection;
  },

  onSelectAlwaysTranslateLanguage() {
    this._handleButtonDisabling(
      this._alwaysTranslateLangsTree,
      "AlwaysTranslateLanguage"
    );
  },

  onSelectNeverTranslateLanguage() {
    this._handleButtonDisabling(
      this._neverTranslateLangsTree,
      "NeverTranslateLanguage"
    );
  },

  onSelectNeverTranslateSite() {
    this._handleButtonDisabling(
      this._neverTranslateSiteTree,
      "NeverTranslateSite"
    );
  },

  _onRemoveLanguage(pref, tree) {
    let langs = Services.prefs.getCharPref(pref);
    if (!langs) {
      return;
    }

    let removed = tree.getSelectedItems().map(l => l.langCode);

    langs = langs.split(",").filter(l => !removed.includes(l));
    Services.prefs.setCharPref(pref, langs.join(","));
  },

  onRemoveAlwaysTranslateLanguage() {
    this._onRemoveLanguage(
      kAlwaysTranslateLangsPref,
      this._alwaysTranslateLangsTree
    );
  },

  onRemoveNeverTranslateLanguage() {
    this._onRemoveLanguage(
      kNeverTranslateLangsPref,
      this._neverTranslateLangsTree
    );
  },

  onRemoveNeverTranslateSite() {
    let removedNeverTranslateSites = this._neverTranslateSiteTree.getSelectedItems();
    for (let origin of removedNeverTranslateSites) {
      let principal = Services.scriptSecurityManager.createContentPrincipalFromOrigin(
        origin
      );
      Services.perms.removeFromPrincipal(principal, kTranslationsPermission);
    }
  },

  onRemoveAllAlwaysTranslateLanguages() {
    Services.prefs.setCharPref(kAlwaysTranslateLangsPref, "");
  },

  onRemoveAllNeverTranslateLanguages() {
    Services.prefs.setCharPref(kNeverTranslateLangsPref, "");
  },

  onRemoveAllNeverTranslateSites() {
    if (this._neverTranslateSiteTree.isEmpty) {
      return;
    }

    let removedNeverTranslateSites = this._neverTranslateSites.splice(
      0,
      this._neverTranslateSites.length
    );
    this._neverTranslateSiteTree.tree.rowCountChanged(
      0,
      -removedNeverTranslateSites.length
    );

    for (let origin of removedNeverTranslateSites) {
      let principal = Services.scriptSecurityManager.createContentPrincipalFromOrigin(
        origin
      );
      Services.perms.removeFromPrincipal(principal, kTranslationsPermission);
    }

    this.onSelectNeverTranslateSite();
  },

  onAlwaysTranslateLanguageKeyPress(aEvent) {
    if (aEvent.keyCode == KeyEvent.DOM_VK_DELETE) {
      this.onRemoveAlwaysTranslateLanguage();
    }
  },

  onNeverTranslateLanguageKeyPress(aEvent) {
    if (aEvent.keyCode == KeyEvent.DOM_VK_DELETE) {
      this.onRemoveNeverTranslateLanguage();
    }
  },

  onNeverTranslateSiteKeyPress(aEvent) {
    if (aEvent.keyCode == KeyEvent.DOM_VK_DELETE) {
      this.onRemoveNeverTranslateSite();
    }
  },

  uninit() {
    Services.obs.removeObserver(this, "perm-changed");
    Services.prefs.removeObserver(kAlwaysTranslateLangsPref, this);
    Services.prefs.removeObserver(kNeverTranslateLangsPref, this);
  },
};
