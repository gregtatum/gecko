/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const GOOGLE_SERVICE = {
  icon: "chrome://browser/content/companion/googleAccount.png",
  name: "Google Services",
  services: "Gmail, Calendar, Meet",
  domains: [
    "mail.google.com",
    "calendar.google.com",
    "meet.google.com",
    "accounts.google.com",
    "apps.google.com",
  ],
  type: "google",
  api: "gapi",
};

const MICROSOFT_SERVICE = {
  icon: "chrome://browser/content/companion/microsoft365.ico",
  name: "Microsoft 365",
  services: "Outlook, Teams, OneDrive",
  domains: [
    "outlook.live.com",
    "login.live.com",
    "login.microsoftonline.com",
    "www.office.com",
  ],
  type: "microsoft",
  api: "mapi",
};

const TEST_SERVICES_PREF = "browser.pinebuild.companion.test-services";

class ServiceUtilsClass {
  constructor() {
    this.serviceByDomain = new Map();
    this.serviceByType = new Map();
    this.serviceByAPI = new Map();

    if (!Cu.isInAutomation) {
      this.registerService(GOOGLE_SERVICE);
      this.registerService(MICROSOFT_SERVICE);
    } else {
      let boundSetTestServices = this.setTestServices.bind(this);
      window.addEventListener(
        "Companion:Setup",
        () => {
          window.CompanionUtils.addPrefObserver(
            TEST_SERVICES_PREF,
            boundSetTestServices
          );
          this.setTestServices();
        },
        { once: true }
      );
      window.addEventListener("unload", () => {
        window.CompanionUtils.removePrefObserver(
          TEST_SERVICES_PREF,
          boundSetTestServices
        );
      });
    }
  }

  registerService(service) {
    this.serviceByType.set(service.type, service);
    this.serviceByAPI.set(service.api, service);
    for (let domain of service.domains) {
      this.serviceByDomain.set(domain, service.type);
    }
  }

  getServiceByType(type) {
    return this.serviceByType.get(type);
  }

  getServiceForDomain(domain) {
    return this.serviceByDomain.get(domain);
  }

  getServiceByApi(api) {
    return this.serviceByAPI.get(api);
  }

  setTestServices() {
    // Ensure we clear service data between tests
    this.serviceByDomain = new Map();
    this.serviceByType = new Map();
    this.serviceByAPI = new Map();

    const testServices = JSON.parse(
      window.CompanionUtils.getCharPref(TEST_SERVICES_PREF, "[]")
    );
    for (let service of testServices) {
      this.registerService(service);
    }
  }
}

export const ServiceUtils = new ServiceUtilsClass();
