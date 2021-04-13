/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var EXPORTED_SYMBOLS = ["EngagementChild"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.jsm",
});

ChromeUtils.defineModuleGetter(
  this,
  "fathom",
  "resource://gre/modules/third_party/fathom/fathom.jsm"
);

// Compile each ruleset only once:
XPCOMUtils.defineLazyGetter(this, "articleRules", makeArticleRuleset);
XPCOMUtils.defineLazyGetter(this, "shoppingRules", makeShoppingRuleset);

class EngagementChild extends JSWindowActorChild {
  actorCreated() {
    this.contentWindow.addEventListener("keyup", this);
  }

  /*
   * Events
   */
  didDestroy() {
    this.destroyed = true;
  }

  initWebProgressListener() {
    if (this.inited) {
      return;
    }
    this.inited = true;

    const webProgress = this.docShell
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIWebProgress);

    const listener = {
      QueryInterface: ChromeUtils.generateQI([
        "nsIWebProgressListener",
        "nsISupportsWeakReference",
      ]),
    };

    listener.onLocationChange = (aWebProgress, aRequest, aLocation, aFlags) => {
      if (this.destroyed) {
        return;
      }

      if (PrivateBrowsingUtils.isContentWindowPrivate(this.contentWindow)) {
        return;
      }

      if (!aWebProgress.isTopLevel) {
        return;
      }
      let docInfo = {};
      docInfo.url = aLocation.specIgnoringRef;
      let context = this.manager.browsingContext;
      if (docInfo) {
        docInfo.isActive = context.isActive;
        docInfo.contextId = this.browsingContext.id;
        this.sendAsyncMessage("Engagement:Engage", docInfo);
      }
    };

    webProgress.addProgressListener(
      listener,
      Ci.nsIWebProgress.NOTIFY_LOCATION
    );
  }

  async getDocumentInfo() {
    let doc = this.document;
    if (
      doc.documentURIObject.scheme != "http" &&
      doc.documentURIObject.scheme != "https"
    ) {
      return null;
    }
    let docInfo = {};
    docInfo.url = doc.documentURIObject.specIgnoringRef;
    return docInfo;
  }

  /**
   * Handles events received from the actor child notifications.
   *
   * @param {object} event The event details.
   */
  async handleEvent(event) {
    if (PrivateBrowsingUtils.isContentWindowPrivate(this.contentWindow)) {
      return;
    }
    switch (event.type) {
      case "pageshow": {
        // BFCACHE - not sure what to do here yet.
        //        check();
        //        this.sendAsyncMessage("Engagement:Log", "PAGESHOW");
        break;
      }
      case "load": {
        //        this.sendAsyncMessage("Engagement:Log", "LOAD");
        break;
      }
      case "DOMContentLoaded": {
        this.initWebProgressListener();
        if (
          !this.docShell.currentDocumentChannel ||
          !(this.docShell.currentDocumentChannel instanceof Ci.nsIHttpChannel)
        ) {
          return;
        }

        if (this.docShell.currentDocumentChannel.responseStatus == 404) {
          return;
        }

        let docInfo = await this.getDocumentInfo();
        let context = this.manager.browsingContext;
        if (docInfo) {
          docInfo.isActive = context.isActive;
          docInfo.contextId = this.browsingContext.id;
          this.sendAsyncMessage("Engagement:Engage", docInfo);
        }
        break;
      }
      case "pagehide": {
        if (
          !this.docShell.currentDocumentChannel ||
          !(this.docShell.currentDocumentChannel instanceof Ci.nsIHttpChannel)
        ) {
          return;
        }

        if (this.docShell.currentDocumentChannel.responseStatus == 404) {
          return;
        }

        let docInfo = await this.getDocumentInfo();
        if (docInfo) {
          docInfo.contextId = this.browsingContext.id;
          this.sendAsyncMessage("Engagement:Disengage", docInfo);
        }
        break;
      }
    }
  }

  async receiveMessage(msg) {
    if (msg.name == "Engagement:Categorize") {
      // Return "shopping", "article", or (meaning "neither") "", reflecting
      // the category of the page.
      // Should be able to return a Promise here if the parent uses sendQuery.
      return category(this.document);
    }

    return undefined;
  }
}

/**
 * Return the most likely category of the given document, "" if none is over
 * 50% confidence.
 */
function category(document) {
  const shoppingFnodes = shoppingRules.against(document).get("shopping");
  const articleFnodes = articleRules.against(document).get("article");
  const scores = {
    shopping:
      shoppingFnodes.length === 0 ? 0 : shoppingFnodes[0].scoreFor("shopping"),
    article:
      articleFnodes.length === 0 ? 0 : articleFnodes[0].scoreFor("article"),
  };
  console.debug("shopping category confidence: ", scores.shopping);
  console.debug("article category confidence: ", scores.article);
  const predictedCategory = Object.keys(scores).reduce((a, b) =>
    scores[a] > scores[b] ? a : b
  );
  if (scores[predictedCategory] >= 0.5) {
    return predictedCategory;
  }
  return "";
}

// Adapted from mozilla-services/fathom-smoot commit 9612fcddc64096418e95b347f3bf26ca02a600f4
function makeShoppingRuleset() {
  const { dom, rule, ruleset, score, type } = fathom;

  function caselessIncludes(haystack, needle) {
    if (haystack === undefined) {
      haystack = "";
    }
    return haystack.toLowerCase().includes(needle.toLowerCase());
  }

  function numberOfOccurrencesOf(fnode, text) {
    const regex = new RegExp(text, "gi");
    return (fnode.element.innerText.match(regex) || []).length;
  }

  function numberOfCartOccurrences(fnode) {
    return numberOfOccurrencesOf(fnode, "cart") > 1;
  }

  function numberOfBuyOccurrences(fnode) {
    return numberOfOccurrencesOf(fnode, "buy") > 1;
  }

  function numberOfCheckoutOccurrences(fnode) {
    return numberOfOccurrencesOf(fnode, "checkout") > 1;
  }

  function numberOfBuyButtons(fnode) {
    const buttons = Array.from(
      fnode.element.querySelectorAll("button,input,a")
    );
    return (
      buttons.filter(button => caselessIncludes(button.innerText, "buy"))
        .length > 2
    );
  }

  function numberOfShopButtons(fnode) {
    const buttons = Array.from(
      fnode.element.querySelectorAll("button,input,a")
    );
    return (
      buttons.filter(button => caselessIncludes(button.innerText, "shop"))
        .length > 2
    );
  }

  function hasAddToCartButton(fnode) {
    const buttons = Array.from(
      fnode.element.querySelectorAll('button, a[class*="btn"]')
    );
    if (
      buttons.some(button => {
        return (
          caselessIncludes(button.innerText, "add to cart") ||
          caselessIncludes(button.innerText, "add to bag") ||
          caselessIncludes(button.innerText, "add to basket") ||
          caselessIncludes(button.innerText, "add to trolley") ||
          caselessIncludes(button.className, "add-to-cart") ||
          caselessIncludes(button.title, "add to cart")
        );
      })
    ) {
      return true;
    }
    const images = Array.from(fnode.element.querySelectorAll("img"));
    if (images.some(image => caselessIncludes(image.title, "add to cart"))) {
      return true;
    }
    const inputs = Array.from(fnode.element.querySelectorAll("input"));
    if (
      inputs.some(input => caselessIncludes(input.className, "add-to-cart"))
    ) {
      return true;
    }
    const spans = Array.from(fnode.element.querySelectorAll("span"));
    if (
      spans.some(span => {
        return (
          caselessIncludes(span.className, "addtocart") ||
          caselessIncludes(span.innerText, "add to bag") ||
          caselessIncludes(span.innerText, "add to cart")
        );
      })
    ) {
      return true;
    }
    const links = Array.from(fnode.element.querySelectorAll("a"));
    return links.some(link => caselessIncludes(link.innerText, "加入购物车"));
  }

  function hasCheckoutButton(fnode) {
    const divs = Array.from(fnode.element.querySelectorAll("div"));
    if (divs.some(div => caselessIncludes(div.className, "checkout"))) {
      return true;
    }
    const buttons = Array.from(fnode.element.querySelectorAll("button"));
    if (
      buttons.some(button => {
        return (
          caselessIncludes(button.innerText, "checkout") ||
          caselessIncludes(button.innerText, "check out") ||
          caselessIncludes(button.className, "checkout")
        );
      })
    ) {
      return true;
    }
    const spans = Array.from(fnode.element.querySelectorAll("span"));
    if (spans.some(span => caselessIncludes(span.className, "checkout"))) {
      return true;
    }
    const links = Array.from(fnode.element.querySelectorAll("a"));
    if (
      links.some(link => {
        return (
          caselessIncludes(link.innerText, "checkout") ||
          caselessIncludes(link.href, "checkout")
        );
      })
    ) {
      return true;
    }
    const inputs = Array.from(fnode.element.querySelectorAll("input"));
    return inputs.some(input => caselessIncludes(input.value, "checkout"));
  }

  function hasLinkToCart(fnode) {
    const links = Array.from(fnode.element.getElementsByTagName("a"));
    if (
      links.some(link => {
        return (
          caselessIncludes(link.className, "cart") ||
          link.href.endsWith("/cart/") ||
          link.href.endsWith("/cart") ||
          caselessIncludes(getAriaLabel(link), "cart") ||
          link.href.endsWith("/main_view_cart.php") ||
          caselessIncludes(link.className, "/cart/") ||
          link.href.endsWith("/cart.php") ||
          link.href.endsWith("/shoppingCart") ||
          link.href.endsWith("/ShoppingCart") ||
          link.href.endsWith("/shopping_cart.php") ||
          caselessIncludes(link.id, "cart") ||
          caselessIncludes(link.id, "basket") ||
          caselessIncludes(link.id, "bag") ||
          caselessIncludes(link.id, "trolley") ||
          caselessIncludes(link.className, "basket") ||
          caselessIncludes(link.className, "trolley") ||
          caselessIncludes(link.className, "shoppingbag") ||
          caselessIncludes(link.title, "cart") ||
          link.href.endsWith("/trolley") ||
          link.href.endsWith("/basket") ||
          link.href.endsWith("/bag") ||
          link.href.endsWith("/viewcart") ||
          link.href.endsWith("/basket.html") ||
          link.href.endsWith("/ShoppingBag.aspx") ||
          link.href.startsWith("https://cart.")
        );
      })
    ) {
      return true;
    }
    const buttons = Array.from(fnode.element.querySelectorAll("button"));
    if (
      buttons.some(button => {
        return (
          caselessIncludes(button.className, "cart") ||
          caselessIncludes(getAriaLabel(button), "cart")
        );
      })
    ) {
      return true;
    }
    const spans = Array.from(fnode.element.getElementsByTagName("span"));
    return spans.some(span => {
      return caselessIncludes(span.className, "cart");
    });
  }

  function getAriaLabel(element) {
    if (element.hasAttribute("aria-label")) {
      return element.getAttribute("aria-label");
    }
    return "";
  }

  function numberOfLinksToStore(fnode) {
    const links = Array.from(
      fnode.element.querySelectorAll('a[href]:not([href=""])')
    );
    return (
      links.filter(link => {
        return (
          link.href.startsWith("https://shop.") ||
          link.href.startsWith("https://store.") ||
          link.href.startsWith("https://products.") ||
          link.href.endsWith("/shop/") ||
          link.href.endsWith("/products") ||
          caselessIncludes(link.href, "/marketplace/") ||
          caselessIncludes(link.href, "/store/") ||
          caselessIncludes(link.href, "/shop/") ||
          link.href.endsWith("/store")
        );
      }).length > 2
    );
  }

  function numberOfLinksToCatalog(fnode) {
    const links = Array.from(
      fnode.element.querySelectorAll('a[href]:not([href=""])')
    );
    return (
      links.filter(link => caselessIncludes(link.href, "catalog")).length > 1
    );
  }

  function hasShoppingCartIcon(fnode) {
    const icons = Array.from(fnode.element.getElementsByTagName("i"));
    if (icons.some(icon => caselessIncludes(icon.className, "cart"))) {
      return true;
    }
    const imgs = Array.from(fnode.element.getElementsByTagName("img"));
    if (imgs.some(img => caselessIncludes(img.src, "cart"))) {
      return true;
    }
    const spans = Array.from(fnode.element.getElementsByTagName("span"));
    return spans.some(span => {
      return (
        caselessIncludes(span.className, "cart") ||
        caselessIncludes(span.className, "trolley")
      );
    });
  }

  function hasStarRatings(fnode) {
    const divs = Array.from(
      fnode.element.querySelectorAll(
        'div[class*="rating" i], div[class*="review" i]'
      )
    );
    return divs.some(div => {
      const stars = div.querySelectorAll(
        'span[class*="star" i], i[class*="star" i], div[type*="star" i], div[class*="star" i], svg[class*="star" i]'
      );
      return stars.length >= 5;
    });
  }

  function numberOfCurrencySymbols(fnode) {
    const currencies = /[$£€¥]/g;
    return (fnode.element.innerText.match(currencies) || []).length >= 4;
  }

  function numberOfShippingAddressOccurrences(fnode) {
    return numberOfOccurrencesOf(fnode, "shipping address") >= 1;
  }

  function numberOfBillingAddressOccurrences(fnode) {
    return numberOfOccurrencesOf(fnode, "billing address") >= 2;
  }

  function numberOfPaymentMethodOccurrences(fnode) {
    return numberOfOccurrencesOf(fnode, "payment method") >= 1;
  }

  function numberOfShippingMethodOccurrences(fnode) {
    return numberOfOccurrencesOf(fnode, "shipping method") >= 1;
  }

  function numberOfStockPhraseOccurrences(fnode) {
    return (
      numberOfOccurrencesOf(fnode, "in stock") +
        numberOfOccurrencesOf(fnode, "out of stock") >=
      1
    );
  }

  function numberOfContinueShoppingOccurrences(fnode) {
    return numberOfOccurrencesOf(fnode, "continue shopping") >= 1;
  }

  function numberOfPolicyOccurrences(fnode) {
    return numberOfOccurrencesOf(fnode, "policy") >= 1;
  }

  function numberOfTermsOccurrences(fnode) {
    return numberOfOccurrencesOf(fnode, "terms") >= 1;
  }

  function numberOfLinksToSale(fnode) {
    const links = Array.from(
      fnode.element.querySelectorAll('a[href]:not([href=""])')
    );
    return (
      links.filter(link => {
        return (
          caselessIncludes(link.href, "sale") ||
          caselessIncludes(link.href, "deals") ||
          caselessIncludes(link.href, "clearance")
        );
      }).length >= 1
    );
  }

  function numberOfProductLinks(fnode) {
    const links = Array.from(
      fnode.element.querySelectorAll('a[href]:not([href=""])')
    );
    return (
      links.filter(link => caselessIncludes(link.href, "product")).length >= 5
    );
  }

  function numberOfElementsWithProductClass(fnode) {
    return (
      Array.from(fnode.element.querySelectorAll('*[class*="product" i]'))
        .length >= 4
    );
  }

  function numberOfElementsWithProductId(fnode) {
    return (
      Array.from(fnode.element.querySelectorAll('*[id*="product" i]')).length >=
      1
    );
  }

  function hasOrderForm(fnode) {
    const forms = Array.from(fnode.element.getElementsByTagName("form"));
    return forms.some(form => {
      return (
        caselessIncludes(form.name, "order") ||
        caselessIncludes(form.name, "shipping") ||
        caselessIncludes(form.name, "payment") ||
        caselessIncludes(form.name, "checkout") ||
        caselessIncludes(form.name, "address") ||
        caselessIncludes(form.name, "product")
      );
    });
  }

  function hasContactForm(fnode) {
    const forms = Array.from(fnode.element.getElementsByTagName("form"));
    return forms.some(form => {
      return (
        caselessIncludes(form.name, "contact") ||
        caselessIncludes(form.name, "question")
      );
    });
  }

  function numberOfHelpOrSupportLinks(fnode) {
    const links = Array.from(
      fnode.element.querySelectorAll('a[href]:not([href=""])')
    );
    return (
      links.filter(link => {
        try {
          const url = new URL(link.href);
          return urlIsHelpOrSupport(url);
        } catch (e) {
          // None empty strings that are not valid URLs
          return false;
        }
      }).length >= 1
    );
  }

  function numberOfPromoLinkOccurrences(fnode) {
    const links = Array.from(
      fnode.element.querySelectorAll('a[href]:not([href=""])')
    );
    return (
      links.filter(link => caselessIncludes(link.href, "promo")).length >= 2
    );
  }

  function numberOfPercentOff(fnode) {
    return numberOfOccurrencesOf(fnode, "% off") >= 1;
  }

  function isAHelpOrSupportURL(fnode) {
    const pageURL = new URL(fnode.element.ownerDocument.URL);
    return urlIsHelpOrSupport(pageURL);
  }

  function urlIsHelpOrSupport(url) {
    const domainPieces = url.hostname.split(".");
    const subdomain = domainPieces[0];
    if (
      caselessIncludes(subdomain, "help") ||
      caselessIncludes(subdomain, "support")
    ) {
      return true;
    }
    const topLevelDomain = domainPieces[domainPieces.length - 1];
    if (
      caselessIncludes(topLevelDomain, "help") ||
      caselessIncludes(topLevelDomain, "support")
    ) {
      return true;
    }
    const pathname = url.pathname;
    return (
      caselessIncludes(pathname, "help") ||
      caselessIncludes(pathname, "support") ||
      caselessIncludes(pathname, "contact") ||
      caselessIncludes(pathname, "policy") ||
      caselessIncludes(pathname, "terms") ||
      caselessIncludes(pathname, "troubleshooting")
    );
  }

  function isAJobsURL(fnode) {
    const pageURL = new URL(fnode.element.ownerDocument.URL);
    const domainPieces = pageURL.hostname.split(".");
    const subdomain = domainPieces[0];
    if (
      caselessIncludes(subdomain, "jobs") ||
      caselessIncludes(subdomain, "careers")
    ) {
      return true;
    }
    const topLevelDomain = domainPieces[domainPieces.length - 1];
    if (
      caselessIncludes(topLevelDomain, "jobs") ||
      caselessIncludes(topLevelDomain, "careers")
    ) {
      return true;
    }
    const pathname = pageURL.pathname;
    return (
      caselessIncludes(pathname, "jobs") ||
      caselessIncludes(pathname, "careers")
    );
  }

  function isAShopishURL(fnode) {
    const pageURL = new URL(fnode.element.ownerDocument.URL);
    const domainPieces = pageURL.hostname.split(".");
    const subdomain = domainPieces[0];
    if (
      caselessIncludes(subdomain, "shop") ||
      caselessIncludes(subdomain, "store")
    ) {
      return true;
    }
    const topLevelDomain = domainPieces[domainPieces.length - 1];
    if (
      caselessIncludes(topLevelDomain, "shop") ||
      caselessIncludes(topLevelDomain, "store")
    ) {
      return true;
    }
    const pathname = pageURL.pathname;
    return (
      caselessIncludes(pathname, "product") ||
      caselessIncludes(pathname, "store") ||
      caselessIncludes(pathname, "marketplace") ||
      caselessIncludes(pathname, "catalog") ||
      caselessIncludes(pathname, "shop")
    );
  }

  // TODO: Should this just be part of `isAShopishURL`?
  function isAShoppingActionURL(fnode) {
    const pageURL = new URL(fnode.element.ownerDocument.URL);
    const pathname = pageURL.pathname;
    return (
      caselessIncludes(pathname, "cart") ||
      caselessIncludes(pathname, "checkout") ||
      caselessIncludes(pathname, "wishlist") ||
      caselessIncludes(pathname, "deals") ||
      caselessIncludes(pathname, "sales") ||
      caselessIncludes(pathname, "pricing") ||
      caselessIncludes(pathname, "basket") ||
      caselessIncludes(pathname, "wish-list")
    );
  }

  function isArticleishURL(fnode) {
    const pageURL = new URL(fnode.element.ownerDocument.URL);
    return isArticleish(pageURL);
  }

  function isArticleish(url) {
    const domainPieces = url.hostname.split(".");
    const subdomain = domainPieces[0];
    if (
      caselessIncludes(subdomain, "blog") ||
      caselessIncludes(subdomain, "news")
    ) {
      return true;
    }
    const topLevelDomain = domainPieces[domainPieces.length - 1];
    if (
      caselessIncludes(topLevelDomain, "blog") ||
      caselessIncludes(topLevelDomain, "news")
    ) {
      return true;
    }
    const pathname = url.pathname;
    return (
      caselessIncludes(pathname, "blog") || caselessIncludes(pathname, "news")
    );
  }

  function numberOfArticleishLinks(fnode) {
    const links = Array.from(
      fnode.element.querySelectorAll('a[href]:not([href=""])')
    );
    return (
      links.filter(link => {
        try {
          const pageURL = new URL(link.href);
          return isArticleish(pageURL);
        } catch (e) {
          // None empty strings that are not valid URLs
          return false;
        }
      }).length >= 1
    );
  }

  function hasLinkToStoreFinder(fnode) {
    const links = Array.from(
      fnode.element.querySelectorAll('a[href]:not([href=""])')
    );
    return links.some(link => {
      return (
        caselessIncludes(link.href, "storelocator") ||
        caselessIncludes(link.href, "storefinder") ||
        caselessIncludes(link.innerText, "store locator") ||
        caselessIncludes(link.innerText, "store finder") ||
        caselessIncludes(link.innerText, "locate a store") ||
        caselessIncludes(link.innerText, "find a store")
      );
    });
  }

  function numberOfPrices(fnode) {
    const price = /\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})/g;
    return (fnode.element.innerText.match(price) || []).length >= 5;
  }

  function numberOfElementsWithCheckoutClass(fnode) {
    return (
      Array.from(fnode.element.querySelectorAll('*[class*="checkout" i]'))
        .length >= 1
    );
  }

  function numberOfElementsWithCheckoutId(fnode) {
    return (
      Array.from(fnode.element.querySelectorAll('*[id*="checkout" i]'))
        .length >= 1
    );
  }

  function numberOfElementsWithCartClass(fnode) {
    return (
      Array.from(fnode.element.querySelectorAll('*[class*="cart" i]')).length >=
      1
    );
  }

  function numberOfElementsWithCartId(fnode) {
    return (
      Array.from(fnode.element.querySelectorAll('*[id*="cart" i]')).length >= 1
    );
  }

  function numberOfElementsWithShippingClass(fnode) {
    return (
      Array.from(fnode.element.querySelectorAll('*[class*="shipping" i]'))
        .length >= 1
    );
  }

  function numberOfElementsWithShippingId(fnode) {
    return (
      Array.from(fnode.element.querySelectorAll('*[id*="shipping" i]'))
        .length >= 1
    );
  }

  function numberOfElementsWithPaymentClass(fnode) {
    return (
      Array.from(fnode.element.querySelectorAll('*[class*="payment" i]'))
        .length >= 1
    );
  }

  function numberOfElementsWithPaymentId(fnode) {
    return (
      Array.from(fnode.element.querySelectorAll('*[id*="payment" i]')).length >=
      1
    );
  }

  return ruleset(
    [
      rule(dom("html"), type("shopping")),
      rule(type("shopping"), score(numberOfCartOccurrences), {
        name: "numberOfCartOccurrences",
      }),
      rule(type("shopping"), score(numberOfBuyOccurrences), {
        name: "numberOfBuyOccurrences",
      }),
      rule(type("shopping"), score(numberOfCheckoutOccurrences), {
        name: "numberOfCheckoutOccurrences",
      }),
      rule(type("shopping"), score(numberOfBuyButtons), {
        name: "numberOfBuyButtons",
      }),
      rule(type("shopping"), score(numberOfShopButtons), {
        name: "numberOfShopButtons",
      }),
      rule(type("shopping"), score(hasAddToCartButton), {
        name: "hasAddToCartButton",
      }),
      rule(type("shopping"), score(hasCheckoutButton), {
        name: "hasCheckoutButton",
      }),
      rule(type("shopping"), score(hasLinkToCart), { name: "hasLinkToCart" }),
      rule(type("shopping"), score(numberOfLinksToStore), {
        name: "numberOfLinksToStore",
      }),
      rule(type("shopping"), score(numberOfLinksToCatalog), {
        name: "numberOfLinksToCatalog",
      }),
      rule(type("shopping"), score(hasShoppingCartIcon), {
        name: "hasShoppingCartIcon",
      }),
      rule(type("shopping"), score(hasStarRatings), { name: "hasStarRatings" }),
      rule(type("shopping"), score(numberOfCurrencySymbols), {
        name: "numberOfCurrencySymbols",
      }),
      rule(type("shopping"), score(numberOfShippingAddressOccurrences), {
        name: "numberOfShippingAddressOccurrences",
      }),
      rule(type("shopping"), score(numberOfBillingAddressOccurrences), {
        name: "numberOfBillingAddressOccurrences",
      }),
      rule(type("shopping"), score(numberOfPaymentMethodOccurrences), {
        name: "numberOfPaymentMethodOccurrences",
      }),
      rule(type("shopping"), score(numberOfShippingMethodOccurrences), {
        name: "numberOfShippingMethodOccurrences",
      }),
      rule(type("shopping"), score(numberOfStockPhraseOccurrences), {
        name: "numberOfStockPhraseOccurrences",
      }),
      rule(type("shopping"), score(numberOfContinueShoppingOccurrences), {
        name: "numberOfContinueShoppingOccurrences",
      }),
      rule(type("shopping"), score(numberOfPolicyOccurrences), {
        name: "numberOfPolicyOccurrences",
      }),
      rule(type("shopping"), score(numberOfTermsOccurrences), {
        name: "numberOfTermsOccurrences",
      }),
      rule(type("shopping"), score(numberOfLinksToSale), {
        name: "numberOfLinksToSale",
      }),
      rule(type("shopping"), score(numberOfProductLinks), {
        name: "numberOfProductLinks",
      }),
      rule(type("shopping"), score(numberOfElementsWithProductClass), {
        name: "numberOfElementsWithProductClass",
      }),
      rule(type("shopping"), score(numberOfElementsWithProductId), {
        name: "numberOfElementsWithProductId",
      }),
      rule(type("shopping"), score(hasOrderForm), { name: "hasOrderForm" }),
      rule(type("shopping"), score(hasContactForm), { name: "hasContactForm" }),
      rule(type("shopping"), score(numberOfHelpOrSupportLinks), {
        name: "numberOfHelpOrSupportLinks",
      }),
      rule(type("shopping"), score(numberOfPromoLinkOccurrences), {
        name: "numberOfPromoLinkOccurrences",
      }),
      rule(type("shopping"), score(numberOfPercentOff), {
        name: "numberOfPercentOff",
      }),
      rule(type("shopping"), score(isAHelpOrSupportURL), {
        name: "isAHelpOrSupportURL",
      }),
      rule(type("shopping"), score(isAJobsURL), { name: "isAJobsURL" }),
      rule(type("shopping"), score(isAShopishURL), { name: "isAShopishURL" }),
      rule(type("shopping"), score(isAShoppingActionURL), {
        name: "isAShoppingActionURL",
      }),
      rule(type("shopping"), score(isArticleishURL), {
        name: "isArticleishURL",
      }),
      rule(type("shopping"), score(numberOfArticleishLinks), {
        name: "numberOfArticleishLinks",
      }),
      rule(type("shopping"), score(hasLinkToStoreFinder), {
        name: "hasLinkToStoreFinder",
      }),
      rule(type("shopping"), score(numberOfPrices), { name: "numberOfPrices" }),
      rule(type("shopping"), score(numberOfElementsWithCheckoutClass), {
        name: "numberOfElementsWithCheckoutClass",
      }),
      rule(type("shopping"), score(numberOfElementsWithCheckoutId), {
        name: "numberOfElementsWithCheckoutId",
      }),
      rule(type("shopping"), score(numberOfElementsWithCartClass), {
        name: "numberOfElementsWithCartClass",
      }),
      rule(type("shopping"), score(numberOfElementsWithCartId), {
        name: "numberOfElementsWithCartId",
      }),
      rule(type("shopping"), score(numberOfElementsWithShippingClass), {
        name: "numberOfElementsWithShippingClass",
      }),
      rule(type("shopping"), score(numberOfElementsWithShippingId), {
        name: "numberOfElementsWithShippingId",
      }),
      rule(type("shopping"), score(numberOfElementsWithPaymentClass), {
        name: "numberOfElementsWithPaymentClass",
      }),
      rule(type("shopping"), score(numberOfElementsWithPaymentId), {
        name: "numberOfElementsWithPaymentId",
      }),
      rule(type("shopping"), "shopping"),
    ],
    [
      ["numberOfCartOccurrences", 0.004431677050888538],
      ["numberOfBuyOccurrences", 0.37095534801483154],
      ["numberOfCheckoutOccurrences", 0.003904791548848152],
      ["numberOfBuyButtons", 0.5181145071983337],
      ["numberOfShopButtons", 0.09862659871578217],
      ["hasAddToCartButton", 0.5496213436126709],
      ["hasCheckoutButton", 0.41033145785331726],
      ["hasLinkToCart", 0.37247663736343384],
      ["numberOfLinksToStore", 0.6745859980583191],
      ["numberOfLinksToCatalog", 0.39251187443733215],
      ["hasShoppingCartIcon", 0.34280550479888916],
      ["hasStarRatings", 0.5168086886405945],
      ["numberOfCurrencySymbols", 0.7948866486549377],
      ["numberOfShippingAddressOccurrences", 0.8619705438613892],
      ["numberOfBillingAddressOccurrences", 0.3214116096496582],
      ["numberOfPaymentMethodOccurrences", -0.26714643836021423],
      ["numberOfShippingMethodOccurrences", 0.3138491213321686],
      ["numberOfStockPhraseOccurrences", 0.5305109620094299],
      ["numberOfContinueShoppingOccurrences", 0.8661705255508423],
      ["numberOfPolicyOccurrences", -0.014949105679988861],
      ["numberOfTermsOccurrences", -0.5102343559265137],
      ["numberOfLinksToSale", 0.6466160416603088],
      ["numberOfProductLinks", 0.5545489192008972],
      ["numberOfElementsWithProductClass", 0.5344703197479248],
      ["numberOfElementsWithProductId", 0.3443285822868347],
      ["hasOrderForm", 0.7178601026535034],
      ["hasContactForm", -1.2140718698501587],
      ["numberOfHelpOrSupportLinks", -0.9627346992492676],
      ["numberOfPromoLinkOccurrences", 0.892467200756073],
      ["numberOfPercentOff", 0.6170496940612793],
      ["isAHelpOrSupportURL", -0.8478246927261353],
      ["isAJobsURL", -0.6292590498924255],
      ["isAShopishURL", 0.6362354755401611],
      ["isAShoppingActionURL", 0.8201884031295776],
      ["isArticleishURL", -0.3249336779117584],
      ["numberOfArticleishLinks", -0.5694810152053833],
      ["hasLinkToStoreFinder", 0.5195519328117371],
      ["numberOfPrices", 0.5592770576477051],
      ["numberOfElementsWithCheckoutClass", 0.10612574964761734],
      ["numberOfElementsWithCheckoutId", 0.2279045581817627],
      ["numberOfElementsWithCartClass", 0.21071551740169525],
      ["numberOfElementsWithCartId", 0.3967038094997406],
      ["numberOfElementsWithShippingClass", 0.6411164402961731],
      ["numberOfElementsWithShippingId", -0.3398124575614929],
      ["numberOfElementsWithPaymentClass", 0.4274355173110962],
      ["numberOfElementsWithPaymentId", 0.7997353672981262],
    ],
    [["shopping", -0.7523059248924255]]
  );
}

// Adapted from mozilla-services/fathom-smoot commit d1f0ca55cf472754fef611656d97681fa6cd049f
function makeArticleRuleset() {
  const {
    dom,
    rule,
    ruleset,
    score,
    type,
    utils: { linearScale },
  } = fathom;

  // Memoize expensive results, so they are only computed once.
  let highestScoringParagraphs;
  let numParagraphsInAllDivs;

  const MIN_PARAGRAPH_LENGTH = 234; // Optimized with 10 sample pages
  const UNLIKELY_WORDS_IN_PARAGRAPH_CLASSNAMES = /comment|caption/i;

  // Text nodes are not targetable via document.querySelectorAll (i.e. Fathom's `dom` method), so we instead use
  // different heuristics based on the child elements contained inside the <div>.
  function numParagraphTextNodesInDiv({ element }) {
    if (divHasBrChildElement({ element })) {
      // Estimate the number of paragraph-like text nodes based on the number of descendant <br> elements and
      // list elements in the <div>
      const listDescendants = Array.from(element.querySelectorAll("ol")).concat(
        Array.from(element.querySelectorAll("ul"))
      );
      const brDescendants = Array.from(element.querySelectorAll("br"));
      const pDescendants = Array.from(element.querySelectorAll("p"));
      // We assume a <br> divides two text nodes/"chunks" (a paragraph or a list)
      // But let's make sure each <br> is actually immediately adjacent to at least one textNode of sufficient length, as
      // sometimes there are lots of extra <br>s just for styling purposes.
      const brsNextToSufficientlyLongTextNodes = brDescendants.filter(
        descendant => {
          const { previousSibling, nextSibling } = descendant;
          if (
            previousSibling &&
            previousSibling.nodeType === Node.TEXT_NODE &&
            previousSibling.length >= MIN_PARAGRAPH_LENGTH
          ) {
            return true;
          }
          if (
            nextSibling &&
            nextSibling.nodeType === Node.TEXT_NODE &&
            nextSibling.length >= MIN_PARAGRAPH_LENGTH
          ) {
            return true;
          }
          return false;
        }
      );
      return (
        brsNextToSufficientlyLongTextNodes.length -
        listDescendants.length -
        pDescendants.length +
        1
      );
    }
    // The only other divs this function would receive are if divHasOnlyTextNodesAnchorElementsOrSpanElements,
    // so we'll just say the div contains one paragraph if its text nodes, when summed together, have sufficient length.
    const textNodeLengths = Array.from(element.childNodes).map(node =>
      node.nodeType === Node.TEXT_NODE ? node.nodeValue.length : 0
    );
    const totalLength = textNodeLengths.reduce(
      (prev, current) => current + prev,
      0
    );
    return totalLength >= MIN_PARAGRAPH_LENGTH ? 1 : 0;
  }

  function getNumParagraphsInAllDivs() {
    const divFnodes = highestScoringParagraphs.filter(
      ({ element }) => element.tagName === "DIV"
    );
    return divFnodes.reduce((accumulator, currentValue) => {
      return accumulator + currentValue.noteFor("paragraph");
    }, 0);
  }

  // Returns true if an element's center coordinates are somewhere likely to be the main content area of the page.
  function elementIsInTheMainContentArea(element) {
    const { left, top, width, height } = element.getBoundingClientRect();
    const [xCenter, yCenter] = [left + width / 2, top + height / 2];
    // Get the middle 50% area of the page in the x-direction (TODO: Optimize %).
    const win = element.ownerGlobal;
    const docLeftCutoff = win.innerWidth / 4;
    const docRightCutoff = (3 * win.innerWidth) / 4;
    const MAIN_CONTENT_VERTICAL_CUTOFF = 200; // TODO Optimize
    return (
      xCenter >= docLeftCutoff &&
      xCenter <= docRightCutoff &&
      yCenter >= MAIN_CONTENT_VERTICAL_CUTOFF
    );
  }

  /**
   * Positive ``when`` callbacks
   */
  function isElementVisible({ element }) {
    // Have to null-check element.style to deal with SVG and MathML nodes.
    return (
      (!element.style || element.style.display != "none") &&
      !element.hasAttribute("hidden")
    );
  }

  function divHasOnlyTextNodesAnchorElementsOrSpanElements({ element }) {
    return Array.from(element.childNodes).every(
      node =>
        node.nodeType === Node.TEXT_NODE ||
        node.tagName === "A" ||
        node.tagName === "SPAN"
    );
  }

  function divHasBrChildElement({ element }) {
    return Array.from(element.children).some(
      childEle => childEle.tagName === "BR"
    );
  }

  /**
   * Negative "paragraph" rules
   */
  function pElementHasListItemAncestor({ element }) {
    return element.matches("li p");
  }

  // This probably means this is just a preview of a complete paragraph
  function containsElipsisAtEndOfText({ element }) {
    return element.innerText.endsWith("...");
  }

  // Modeled after toolkit/components/reader/Readability-readerable.js in Firefox
  function classNameOfSelfOrParentContainsUnlikelyWord({ element }) {
    const matchString = `${element.className} ${element.parentNode.className}`;
    return UNLIKELY_WORDS_IN_PARAGRAPH_CLASSNAMES.test(matchString);
  }

  /**
   * Positive "paragraph" rules
   */
  function hasLongTextContent({ element }) {
    const textContentLength = element.textContent.trim().length;
    return linearScale(textContentLength, 0, MIN_PARAGRAPH_LENGTH);
  }

  function getHighestScoringParagraphs(fnode) {
    return fnode._ruleset.get("paragraph");
  }

  /**
   * Negative "article rules"
   */
  // Often homepages of news websites have article previews (i.e. not a single, encapsulated article).
  function hasMultipleArticleElements({ element }) {
    const doc = element.ownerDocument;
    const articleElements = doc.querySelectorAll("article");
    return articleElements.length > 1;
  }

  function hasMultipleParagraphsWhoseClassNameIncludesArticle(fnode) {
    highestScoringParagraphs =
      highestScoringParagraphs || getHighestScoringParagraphs(fnode);
    const paragraphsWithArticleInClassName = highestScoringParagraphs.filter(
      ({ element }) => element.className.toLowerCase().includes("article")
    );
    return paragraphsWithArticleInClassName.length > 1;
  }

  /**
   * Positive "article" rules
   */
  function hasEnoughParagraphs(fnode) {
    highestScoringParagraphs =
      highestScoringParagraphs || getHighestScoringParagraphs(fnode);
    numParagraphsInAllDivs =
      numParagraphsInAllDivs ||
      getNumParagraphsInAllDivs(highestScoringParagraphs);
    return highestScoringParagraphs.length + numParagraphsInAllDivs >= 9; // Optimized with 40 training samples
  }

  function hasExactlyOneArticleElement({ element }) {
    const doc = element.ownerDocument;
    const articleElements = doc.querySelectorAll("article");
    // TODO: May want to award less points the more article elements a page has. Revisit.
    return articleElements.length === 1;
  }

  function paragraphElementsHaveSiblingsWithSameTagName(fnode) {
    highestScoringParagraphs =
      highestScoringParagraphs || getHighestScoringParagraphs(fnode);
    const numSiblingsPerParagraphNode = [];
    for (const paragraphNode of highestScoringParagraphs) {
      const { element } = paragraphNode;
      let siblingsWithSameTagName = 0;
      if (element.tagName === "DIV") {
        const numParagraphs = paragraphNode.noteFor("paragraph");
        siblingsWithSameTagName = numParagraphs - 1;
      } else {
        siblingsWithSameTagName = Array.from(
          element.parentNode.children
        ).filter(node => node.tagName === element.tagName && node !== element)
          .length;
      }
      numSiblingsPerParagraphNode.push(siblingsWithSameTagName);
    }
    const sum = numSiblingsPerParagraphNode.reduce(
      (prev, current) => current + prev,
      0
    );
    // average sibling count per highest scoring paragraph node; divide by 0 returns NaN which makes the feature return false
    return Math.round(sum / numSiblingsPerParagraphNode.length) >= 3; // Optimized with 40 training samples
  }

  function mostParagraphElementsAreHorizontallyAligned(fnode) {
    // TODO: Include paragraphs inside divs with brs, see 'getNumParagraphsInAllDivs'
    highestScoringParagraphs =
      highestScoringParagraphs || getHighestScoringParagraphs(fnode);
    const leftPositionVsFrequency = new Map();
    for (const { element } of highestScoringParagraphs) {
      const left = element.getBoundingClientRect().left;
      if (leftPositionVsFrequency.get(left) === undefined) {
        leftPositionVsFrequency.set(left, 1);
      } else {
        leftPositionVsFrequency.set(
          left,
          leftPositionVsFrequency.get(left) + 1
        );
      }
    }

    const totals = []; // Each element (int) corresponds to the number of paragraphs with the same left position
    for (const total of leftPositionVsFrequency.values()) {
      totals.push(total);
    }

    const maxNumParagraphsWithSameLeftPosition = Math.max(...totals);
    if (highestScoringParagraphs.length < 2) {
      // Avoid divide by 0 errors, and we don't want to give a page that only has one paragraph the max score;
      // this rule is intended to compare a paragraph's left position relative to other paragraphs.
      return 0;
    }

    return (
      maxNumParagraphsWithSameLeftPosition / highestScoringParagraphs.length
    );
  }

  function moreParagraphElementsThanListItemsOrTableRows(fnode) {
    highestScoringParagraphs =
      highestScoringParagraphs || getHighestScoringParagraphs(fnode);
    const numParagraphElements = highestScoringParagraphs.length;
    const doc = fnode.element.ownerDocument;
    const tableRowElements = Array.from(
      doc.querySelectorAll("tr")
    ).filter(node => elementIsInTheMainContentArea(node));
    const listItemElements = Array.from(
      doc.getElementsByTagName("li")
    ).filter(node => elementIsInTheMainContentArea(node));
    // TODO: Include paragraphs inside divs with brs, see 'getNumParagraphsInAllDivs'
    // TODO: the greater the difference, the higher the score
    return (
      numParagraphElements > tableRowElements.length &&
      numParagraphElements > listItemElements.length
    );
  }

  function headerElementIsSiblingToParagraphElements(fnode) {
    const headerTagNames = ["H1", "H2"];
    let counter = 0;
    highestScoringParagraphs =
      highestScoringParagraphs || getHighestScoringParagraphs(fnode);
    for (const { element } of highestScoringParagraphs) {
      const siblings = Array.from(element.parentNode.children).filter(
        node => node !== element
      );
      if (siblings.some(sibling => headerTagNames.includes(sibling.tagName))) {
        counter++;
      }
    }
    // TODO: Include paragraphs inside divs with brs, see 'getNumParagraphsInAllDivs'
    return linearScale(counter, 4, 11); // oneAt cut-off optimized with 40 samples
  }

  return ruleset(
    [
      /**
       * Paragraph rules
       */
      // Consider all visible paragraph-ish elements
      rule(dom("p, pre").when(isElementVisible), type("paragraph")),
      rule(
        dom("div")
          .when(isElementVisible)
          .when(divHasBrChildElement),
        type("paragraph").note(numParagraphTextNodesInDiv)
      ),
      rule(
        dom("div")
          .when(isElementVisible)
          .when(divHasOnlyTextNodesAnchorElementsOrSpanElements),
        type("paragraph").note(numParagraphTextNodesInDiv)
      ),
      rule(type("paragraph"), score(pElementHasListItemAncestor), {
        name: "pElementHasListItemAncestor",
      }),
      rule(type("paragraph"), score(hasLongTextContent), {
        name: "hasLongTextContent",
      }),
      rule(type("paragraph"), score(containsElipsisAtEndOfText), {
        name: "containsElipsisAtEndOfText",
      }),
      rule(
        type("paragraph"),
        score(classNameOfSelfOrParentContainsUnlikelyWord),
        { name: "classNameOfSelfOrParentContainsUnlikelyWord" }
      ),
      // return paragraph-ish element(s) with max score
      rule(type("paragraph").max(), "paragraph"),

      /**
       * Article rules
       */
      rule(dom("html"), type("article")),
      rule(type("article"), score(hasEnoughParagraphs), {
        name: "hasEnoughParagraphs",
      }),
      rule(type("article"), score(hasExactlyOneArticleElement), {
        name: "hasExactlyOneArticleElement",
      }),
      rule(
        type("article"),
        score(paragraphElementsHaveSiblingsWithSameTagName),
        { name: "paragraphElementsHaveSiblingsWithSameTagName" }
      ),
      rule(
        type("article"),
        score(mostParagraphElementsAreHorizontallyAligned),
        { name: "mostParagraphElementsAreHorizontallyAligned" }
      ),
      rule(
        type("article"),
        score(moreParagraphElementsThanListItemsOrTableRows),
        { name: "moreParagraphElementsThanListItemsOrTableRows" }
      ),
      rule(type("article"), score(headerElementIsSiblingToParagraphElements), {
        name: "headerElementIsSiblingToParagraphElements",
      }),
      rule(type("article"), score(hasMultipleArticleElements), {
        name: "hasMultipleArticleElements",
      }),
      rule(
        type("article"),
        score(hasMultipleParagraphsWhoseClassNameIncludesArticle),
        { name: "hasMultipleParagraphsWhoseClassNameIncludesArticle" }
      ),
      rule(type("article"), "article"),
    ],
    [
      ["pElementHasListItemAncestor", -2.86763596534729],
      ["hasLongTextContent", 5.575725555419922],
      ["containsElipsisAtEndOfText", -0.13708636164665222],
      ["classNameOfSelfOrParentContainsUnlikelyWord", -2.073239326477051],
      ["hasEnoughParagraphs", -1.0311405658721924],
      ["hasExactlyOneArticleElement", -1.2359271049499512],
      ["paragraphElementsHaveSiblingsWithSameTagName", 12.159211158752441],
      ["mostParagraphElementsAreHorizontallyAligned", 0.5681423544883728],
      ["moreParagraphElementsThanListItemsOrTableRows", -2.6533799171447754],
      ["headerElementIsSiblingToParagraphElements", 12.294110298156738],
      ["hasMultipleArticleElements", -3.300487756729126],
      [
        "hasMultipleParagraphsWhoseClassNameIncludesArticle",
        0.26676997542381287,
      ],
    ],
    [
      ["paragraph", -4.550228595733643],
      ["article", -2.676619291305542],
    ]
  );
}
