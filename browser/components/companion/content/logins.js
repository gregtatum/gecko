/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Adapted from aboutLogins.js

// Rather than make gElements a const, just assign it on window.
// The real elements will be inserted on page load.
window.gElements = {
  loginList: null,
  loginItem: null,
};

const gElements = window.gElements; // TODO find a better way to bind things together. le sigh

function handleAllLogins(logins) {
  gElements.loginList.setLogins(logins);
}

// Begin code that executes on page load.
// TODO: maybe instead of waiting for page load, we export a module that the main companion file calls into on page load.
// or just, as a hack, assign a global on window. and call it from companion.
window.gLogins = {};

window.gLogins.initLogins = () => {
  gElements.loginList = document.querySelector("login-list");
  gElements.loginItem = document.querySelector("login-item");
};
// Let's also expose the function that renders a login object, so that we can mock out logins temporarily:
window.gLogins.handleAllLogins = handleAllLogins;
// Stub out some logins, so we can work on styling in parallel with working
// on getting parent/child communication working. TODO remove once we have
// the Actors working.
// Note: you can regenerate this list locally by running the following command in a browser toolbox console:
// `JSON.stringify(LoginHelper.loginsToVanillaObjects(Services.logins.getAllLogins()))`
window.gLogins.mockLogins =
  '[{"guid":"{b038a1af-b0fe-ba44-a460-22aa97455511}","timeCreated":1628013392124,"timeLastUsed":1628013392124,"timePasswordChanged":1628013392124,"timesUsed":1,"username":"foo_barman","password":"password","displayOrigin":"foo.com","origin":"https://foo.com","hostname":"https://foo.com"},{"guid":"{87e68aee-23c7-8c43-81d4-8e8dc5e5fc85}","timeCreated":1628039820535,"timeLastUsed":1628039820535,"timePasswordChanged":1628039820535,"timesUsed":1,"username":"wutwut","password":"wutwut","displayOrigin":"www.example.com","origin":"https://www.example.com","hostname":"https://www.example.com"},{"guid":"{82479228-f6fb-e14c-9e2f-269e3a035487}","timeCreated":1628039831766,"timeLastUsed":1628039831766,"timePasswordChanged":1628039831766,"timesUsed":1,"username":"foo@mozilla.com","password":"asdfasdfasdf","displayOrigin":"accounts.firefox.com","origin":"https://accounts.firefox.com","hostname":"https://accounts.firefox.com"}]';
