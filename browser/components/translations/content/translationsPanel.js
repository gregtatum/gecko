/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint-env mozilla/browser-window */

/**
 * This singleton class controls the Translations popup panel.
 *
 * This component is a `/browser` component, and the actor is a `/toolkit` actor, so care
 * must be taken to keep the presentation (this component) from the state management
 * (the Translations actor). This class reacts to state changes coming from the
 * Translations actor.
 */
var TranslationsPanel = new (class {
  /** @type {Console?} */
  #console;

  /**
   * The automatically determined document lang tag.
   *
   * @type {null | string}
   */
  #docLangTag = null;

  /**
   * The language tags that are used for translating. This is looked up by the default
   * view and used again for the dual view.
   *
   * @type {null | { appLangTag: string, docLangTag: string }}
   */
  #langTagsForTranslation = null;

  /**
   * Lazily get a console instance.
   *
   * @returns {Console}
   */
  get console() {
    if (!this.#console) {
      this.#console = console.createInstance({
        maxLogLevelPref: "browser.translations.logLevel",
        prefix: "Translations",
      });
    }
    return this.#console;
  }

  /**
   * Where the lazy elements are stored.
   *
   * @type {Record<string, Element>?}
   */
  #lazyElements;

  /**
   * Lazily creates the dom elements, and lazily selects them.
   *
   * @returns {Record<string, Element>}
   */
  get elements() {
    if (!this.#lazyElements) {
      // Lazily turn the template into a DOM element.
      /** @type {HTMLTemplateElement} */
      const wrapper = document.getElementById("template-translations-panel");
      const panel = wrapper.content.firstElementChild;
      wrapper.replaceWith(wrapper.content);

      const settingsButton = document.getElementById(
        "translations-panel-settings"
      );
      // Clone the settings toolbarbutton across all the views.
      for (const header of panel.querySelectorAll(".panel-header")) {
        if (header.contains(settingsButton)) {
          continue;
        }
        header.appendChild(settingsButton.cloneNode(true));
      }

      // Lazily select the elements.
      this.#lazyElements = {
        panel,
        settingsButton,

        get button() {
          delete this.button;
          return (this.button = document.getElementById("translations-button"));
        },
        get dualFromMenuPopup() {
          delete this.dualFromMenuPopup;
          return (this.dualFromMenuPopup = document.getElementById(
            "translations-panel-dual-from-menupopup"
          ));
        },
        get dualToMenuPopup() {
          delete this.dualToMenuPopup;
          return (this.dualToMenuPopup = document.getElementById(
            "translations-panel-dual-to-menupopup"
          ));
        },
        get defaultToMenuPopup() {
          delete this.defaultToMenuPopup;
          return (this.defaultToMenuPopup = document.getElementById(
            "translations-panel-default-to-menupopup"
          ));
        },
        get multiview() {
          delete this.multiview;
          return (this.multiview = document.getElementById(
            "translations-panel-multiview"
          ));
        },
        get dualView() {
          delete this.dualView;
          return (this.dualView = document.getElementById(
            "translations-panel-view-dual"
          ));
        },
        get defaultView() {
          delete this.defaultView;
          return (this.defaultView = document.getElementById(
            "translations-panel-view-default"
          ));
        },
        get restoreView() {
          delete this.restoreView;
          return (this.restoreView = document.getElementById(
            "translations-panel-view-restore"
          ));
        },
        get dualFromMenuList() {
          delete this.dualFromMenuList;
          return (this.dualFromMenuList = document.getElementById(
            "translations-panel-dual-from"
          ));
        },
        get dualToMenuList() {
          delete this.dualToMenuList;
          return (this.dualToMenuList = document.getElementById(
            "translations-panel-dual-to"
          ));
        },
        get defaultToMenuList() {
          delete this.defaultToMenuList;
          return (this.defaultToMenuList = document.getElementById(
            "translations-panel-default-to"
          ));
        },
        get defaultDescription() {
          delete this.defaultDescription;
          return (this.defaultDescription = document.getElementById(
            "translations-panel-default-description"
          ));
        },
        get restoreLabel() {
          delete this.restoreLabel;
          return (this.restoreLabel = document.getElementById(
            "translations-panel-restore-label"
          ));
        },
        get settingsPopup() {
          delete this.settingsPopup;
          return (this.settingsPopup = document.getElementById(
            "translations-panel-settings-popup"
          ));
        },
      };
    }

    return this.#lazyElements;
  }

  /**
   * @returns {TranslationsParent}
   */
  #getTranslationsActor() {
    const actor = gBrowser.selectedBrowser.browsingContext.currentWindowGlobal.getActor(
      "Translations"
    );

    if (!actor) {
      throw new Error("Unable to get the TranslationsParent");
    }
    return actor;
  }

  /**
   * @type {"initialized" | "error" | "uninitialized"}
   */
  #langListsPhase = "uninitialized";

  /**
   * Builds the <menulist> of languages for both the "from" and "to". This can be
   * called every time the popup is shown, as it will retry when there is an error
   * (such as a network error) or be a noop if it's already initialized.
   *
   * TODO(Bug 1813796) This needs to be updated when the supported languages change
   * via RemoteSettings.
   */
  async #ensureLangListsBuilt() {
    switch (this.#langListsPhase) {
      case "initialized":
        // This has already been initialized.
        return;
      case "error":
        // Attempt to re-initialize.
        this.#langListsPhase = "uninitialized";
        break;
      case "uninitialized":
        // Ready to initialize.
        break;
      default:
        this.console.error("Unknown langList phase", this.#langListsPhase);
    }
    try {
      /** @type {SupportedLanguages} */
      const {
        languagePairs,
        fromLanguages,
        toLanguages,
      } = await this.#getTranslationsActor().getSupportedLanguages();

      // Verify that we are in a proper state.
      if (languagePairs.length === 0) {
        throw new Error("No translation languages were retrieved.");
      }

      for (const { langTag, isBeta, displayName } of fromLanguages) {
        const fromMenuItem = document.createXULElement("menuitem");
        fromMenuItem.setAttribute("value", langTag);
        if (isBeta) {
          document.l10n.setAttributes(
            fromMenuItem,
            "translations-panel-displayname-beta",
            { language: displayName }
          );
        } else {
          fromMenuItem.setAttribute("label", displayName);
        }
        this.elements.dualFromMenuPopup.appendChild(fromMenuItem);
      }
      for (const { langTag, isBeta, displayName } of toLanguages) {
        const toMenuItem = document.createXULElement("menuitem");
        toMenuItem.setAttribute("value", langTag);
        if (isBeta) {
          document.l10n.setAttributes(
            toMenuItem,
            "translations-panel-displayname-beta",
            { language: displayName }
          );
        } else {
          toMenuItem.setAttribute("label", displayName);
        }
        this.elements.defaultToMenuPopup.appendChild(
          toMenuItem.cloneNode(true)
        );
        this.elements.dualToMenuPopup.appendChild(toMenuItem);
      }
      this.#langListsPhase = "initialized";
    } catch (error) {
      this.console.error(error);
      this.#langListsPhase = "error";
    }
  }

  /**
   * Switch to the dual language view of choosing a source and target language.
   */
  setDualView() {
    const { dualFromMenuList, dualToMenuList, multiview } = this.elements;

    multiview.showSubView("translations-panel-view-dual");

    // Remove any old selected values synchronously before asking for new ones.
    dualFromMenuList.value = "";
    dualToMenuList.value = "";

    if (this.#langTagsForTranslation) {
      const { docLangTag, appLangTag } = this.#langTagsForTranslation;
      dualFromMenuList.value = docLangTag;
      dualToMenuList.value = appLangTag;
    } else {
      this.console.error("No language tags for translation were found.");
    }
  }

  /**
   * Builds the <menulist> of languages for both the "from" and "to". This can be
   * called every time the popup is shown, as it will retry when there is an error
   * (such as a network error) or be a noop if it's already initialized.
   *
   * @param {Promise<void>} langListBuilt
   */
  async #showDefaultView() {
    await this.#ensureLangListsBuilt();
    const actor = this.#getTranslationsActor();

    const { defaultToMenuList, defaultDescription, multiview } = this.elements;

    multiview.setAttribute("mainViewId", "translations-panel-view-default");
    this.#hideChangeSource(false);

    // Remove any old selected values synchronously before asking for new ones.
    defaultToMenuList.value = "";

    // TODO(Bug 1825801) - There is a race condition, we may download the languages, and
    // later trigger the subview to be shown after opening the popup again. We need to
    // properly handle this.

    // TODO(Bug 1825801) - This could potentially be a bad pause, as we aren't showing
    // the panel until the language list is ready. It's probably fine for a prototype,
    // but should be handled for the MVP. We might want design direction here, as we need
    // a subview for when the language list is still being retrieved.

    /** @type {null | { appLangTag: string, docLangTag: string }} */
    const langTags = await actor.getLangTagsForTranslation();
    this.#langTagsForTranslation = langTags;

    if (langTags) {
      const displayNames = new Services.intl.DisplayNames(undefined, {
        type: "language",
      });

      const { docLangTag, appLangTag } = langTags;
      defaultToMenuList.value = appLangTag;
      this.#docLangTag = docLangTag;

      document.l10n.setAttributes(
        defaultDescription,
        defaultDescription.getAttribute("data-l10n-id"),
        { pageLanguage: displayNames.of(docLangTag) }
      );
    } else {
      this.#docLangTag = null;
      this.console.error("No language tags for translation were found.");
    }
  }

  /**
   * The change source menuitem should only be shown when the page isn't translated.
   */
  #hideChangeSource(hidden) {
    const elements = this.elements.multiview.querySelectorAll(
      ".translations-panel-change-source"
    );
    if (!elements.length) {
      throw new Error("Unable to find the change source menuitems.");
    }
    for (const changeSource of elements) {
      changeSource.hidden = hidden;
    }
  }

  /**
   * Configures the panel for the user to reset the page after it has been translated.
   *
   * @param {TranslationPair} translationPair
   */
  #showRestoreView({ fromLanguage, toLanguage }) {
    const { multiview, restoreLabel } = this.elements;

    multiview.setAttribute("mainViewId", "translations-panel-view-restore");
    this.#hideChangeSource(true);

    const displayNames = new Services.intl.DisplayNames(undefined, {
      type: "language",
    });

    restoreLabel.setAttribute(
      "data-l10n-args",
      JSON.stringify({
        fromLanguage: displayNames.of(fromLanguage),
        toLanguage: displayNames.of(toLanguage),
      })
    );
  }

  /**
   * Opens the TranslationsPanel.
   *
   * @param {Event} event
   */
  async open(event) {
    const { panel, button } = this.elements;

    const {
      requestedTranslationPair,
    } = this.#getTranslationsActor().languageState;

    if (requestedTranslationPair) {
      this.#showRestoreView(requestedTranslationPair);
    } else {
      this.#showDefaultView().catch(error => {
        this.console.error(error);
      });
    }

    PanelMultiView.openPopup(panel, button, {
      position: "bottomright topright",
      triggerEvent: event,
    }).catch(error => this.console.error(error));
  }

  /**
   * Handle the translation button being clicked on the default view.
   */
  async onDefaultTranslate() {
    PanelMultiView.hidePopup(this.elements.panel);

    const actor = this.#getTranslationsActor();
    actor.translate(this.#docLangTag, this.elements.defaultToMenuList.value);
  }

  /**
   * Handle the translation button being clicked when there are two language options.
   */
  async onDualTranslate() {
    PanelMultiView.hidePopup(this.elements.panel);

    const actor = this.#getTranslationsActor();
    actor.translate(
      this.elements.dualFromMenuList.value,
      this.elements.dualToMenuList.value
    );
  }

  onCancel() {
    PanelMultiView.hidePopup(this.elements.panel);
  }

  /**
   * A handler for opening the settings context menu.
   */
  openSettingsPopup(button) {
    const popup = button.querySelector("menupopup");
    popup.openPopup(button);
  }

  /**
   * Redirect the user to about:preferences
   */
  openManageLanguages() {
    const window =
      gBrowser.selectedBrowser.browsingContext.top.embedderElement.ownerGlobal;
    window.openTrustedLinkIn("about:preferences#general-translations", "tab");
  }

  /**
   * Handle the restore button being clicked.
   */
  onRestore() {
    const { panel } = this.elements;
    PanelMultiView.hidePopup(panel);

    this.#getTranslationsActor().restorePage();
  }

  /**
   * Set the state of the translations button in the URL bar.
   *
   * @param {CustomEvent} event
   */
  handleEvent = event => {
    switch (event.type) {
      case "TranslationsParent:LanguageState":
        const { detectedLanguages, requestedTranslationPair } = event.detail;
        const { button } = this.elements;

        if (detectedLanguages) {
          button.hidden = false;
          if (requestedTranslationPair) {
            button.setAttribute("translationsactive", true);
          } else {
            button.removeAttribute("translationsactive");
          }
        } else {
          button.removeAttribute("translationsactive");
          button.hidden = true;
        }
        break;
    }
  };
})();
