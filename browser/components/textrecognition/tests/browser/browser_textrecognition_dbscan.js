/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */
"use strict";

requestLongerTimeout(1000);

add_task(async function() {
  const URL_IMG =
    "http://mochi.test:8888/browser/browser/components/textrecognition/tests/browser/dbscan.html";

  await SpecialPowers.pushPrefEnv({
    set: [["dom.text-recognition.enabled", true]],
  });

  clearTelemetry();

  await BrowserTestUtils.withNewTab(URL_IMG, async function(browser) {
    setClipboardText("");
    is(getTextFromClipboard(), "", "The copied text is empty.");

    await new Promise(resolve => setTimeout(resolve, 1000000000));
    
    info("Right click image to show context menu.");
    let popupShownPromise = BrowserTestUtils.waitForEvent(
      document,
      "popupshown"
    );
    await BrowserTestUtils.synthesizeMouseAtCenter(
      "img",
      { type: "contextmenu", button: 2 },
      browser
    );
    await popupShownPromise;


    info("Click context menu to copy the image text.");
    document.getElementById("context-imagetext").doCommand();

    info("Close the context menu.");
    let contextMenu = document.getElementById("contentAreaContextMenu");
    let popupHiddenPromise = BrowserTestUtils.waitForEvent(
      contextMenu,
      "popuphidden"
    );
    contextMenu.hidePopup();
    await popupHiddenPromise;

    info("Waiting for the dialog browser to be shown.");
    const { contentDocument } = await BrowserTestUtils.waitForCondition(() =>
      document.querySelector(".textRecognitionDialogFrame")
    );

    info("Waiting for text results.");
    const resultsHeader = contentDocument.querySelector(
      "#text-recognition-header-results"
    );
    await BrowserTestUtils.waitForCondition(() => {
      return resultsHeader.style.display !== "none";
    });

    const expectedResultText = "Mozilla\n\nFirefox";

    {
      info("Check the text results.");
      const text = contentDocument.querySelector(".textRecognitionText");
      is(text.children.length, 2, "Two piece of text were found");
      const [p1, p2] = text.children;
      is(p1.tagName, "P", "The children are paragraph tags.");
      is(p2.tagName, "P", "The children are paragraph tags.");
      is(p1.innerText, "Mozilla", "The first piece of text matches.");
      is(p2.innerText, "Firefox", "The second piece of text matches.");

      const clipboardText = getTextFromClipboard();
      is(clipboardText, expectedResultText, "The copied text matches.");

      is(
        clipboardText,
        text.innerText,
        "The copied text and the text elements innerText match."
      );
    }

    info("Close the dialog box.");
    const close = contentDocument.querySelector("#text-recognition-close");
    close.click();

    info("Waiting for the dialog frame to close.");
    await BrowserTestUtils.waitForCondition(
      () => !document.querySelector(".textRecognitionDialogFrame")
    );

    info("Check for interaction telemetry.");
    const timing = await BrowserTestUtils.waitForCondition(() => {
      const { sum } = Services.telemetry
        .getHistogramById("TEXT_RECOGNITION_INTERACTION_TIMING")
        .snapshot();
      if (sum > 0) {
        return sum;
      }
      return false;
    });
    ok(timing > 0, "Interaction timing was measured.");

    setClipboardText("");
    clearTelemetry();
  });
});
