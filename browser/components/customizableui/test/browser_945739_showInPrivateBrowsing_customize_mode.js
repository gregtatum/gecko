/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const kWidgetId = "test-private-browsing-customize-mode-widget";

let gTests = [
  {
    desc: "Add a widget via the API with showInPrivateBrowsing set to false " +
          "and ensure it does not appear in the list of unused widgets in private windows",
    run: function() {
      CustomizableUI.createWidget({
        id: kWidgetId,
        showInPrivateBrowsing: false
      });

      let normalWidgetArray = CustomizableUI.getUnusedWidgets(gNavToolbox.palette);
      normalWidgetArray = normalWidgetArray.map((w) => w.id);
      ok(normalWidgetArray.indexOf(kWidgetId) > -1,
         "Widget should appear as unused in non-private window");

      let privateWindow = yield openAndLoadWindow({private: true});
      let privateWidgetArray = CustomizableUI.getUnusedWidgets(privateWindow.gNavToolbox.palette);
      privateWidgetArray = privateWidgetArray.map((w) => w.id);
      is(privateWidgetArray.indexOf(kWidgetId), -1,
         "Widget should not appear as unused in private window");
      privateWindow.close();

      CustomizableUI.destroyWidget(kWidgetId);
    },
  },
];

function asyncCleanup() {
  yield resetCustomization();
}

function test() {
  waitForExplicitFinish();
  runTests(gTests, asyncCleanup);
}

