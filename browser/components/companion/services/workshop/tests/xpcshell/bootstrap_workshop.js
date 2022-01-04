import { MailAPIFactory } from "chrome://browser/content/companion/workshop-api-built.js";
const OnlineServicesHelper = ChromeUtils.import(
  "resource:///modules/OnlineServicesHelper.jsm"
);
window.WORKSHOP_API = MailAPIFactory(
  OnlineServicesHelper.MainThreadServices(window)
);
window.dispatchEvent(new CustomEvent("apiLoaded"));
