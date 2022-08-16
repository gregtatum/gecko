// This file is loaded into a windowless browser.
/* eslint-env browser */
import { MailAPIFactory } from "chrome://browser/content/companion/workshop-api-built.js";
const OnlineServicesHelper = ChromeUtils.import(
  "resource:///modules/OnlineServicesHelper.jsm"
);
window.WORKSHOP_API = MailAPIFactory({
  mainThreadServices: OnlineServicesHelper.MainThreadServices(window),
  isHiddenWindow: false,
  isLoggingEnabled: true,
});
window.dispatchEvent(new CustomEvent("apiLoaded"));
