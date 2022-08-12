/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * @param {string} text
 */
function setClipboardText(text) {
  const ClipboardHelper = Cc[
    "@mozilla.org/widget/clipboardhelper;1"
  ].getService(Ci.nsIClipboardHelper);
  ClipboardHelper.copyString(text);
}

/**
 * @returns {string}
 */
function getTextFromClipboard() {
  const transferable = Cc["@mozilla.org/widget/transferable;1"].createInstance(
    Ci.nsITransferable
  );
  transferable.init(window.docShell.QueryInterface(Ci.nsILoadContext));
  transferable.addDataFlavor("text/unicode");
  Services.clipboard.getData(transferable, Services.clipboard.kGlobalClipboard);

  const results = {};
  transferable.getTransferData("text/unicode", results);
  return results.value.QueryInterface(Ci.nsISupportsString)?.data ?? "";
}

/**
 * Returns events specifically for text recognition.
 */
function getTelemetryEvents() {
  const events = Services.telemetry.snapshotEvents(
    Ci.nsITelemetry.DATASET_PRERELEASE_CHANNELS,
    true /* clear events */
  );

  if (!events.parent) {
    return [];
  }

  return (
    events.parent
      .map(
        ([timestamp, category, method, object, stringValue, extraValues]) => ({
          timestamp,
          category,
          method,
          object,
          stringValue,
          extraValues,
        })
      )
      .filter(event => event.category === "textrecognition") ?? []
  );
}

function clearTelemetry() {
  Services.telemetry.clearEvents();
  Services.telemetry
    .getHistogramById("TEXT_RECOGNITION_API_PERFORMANCE")
    .clear();
  Services.telemetry
    .getHistogramById("TEXT_RECOGNITION_INTERACTION_TIMING")
    .clear();
  Services.telemetry.getHistogramById("TEXT_RECOGNITION_TEXT_LENGTH").clear();
}
