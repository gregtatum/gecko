# -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is mozilla.org code.
#
# The Initial Developer of the Original Code is
# Netscape Communications Corporation.
# Portions created by the Initial Developer are Copyright (C) 1999
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Stephen Lamm            <slamm@netscape.com>
#   Robert John Churchill   <rjc@netscape.com>
#   David Hyatt             <hyatt@mozilla.org>
#   Christopher A. Aillon   <christopher@aillon.com>
#   Myk Melez               <myk@mozilla.org>
#   Pamela Greene           <pamg.bugs@gmail.com>
#   Gavin Sharp             <gavin@gavinsharp.com>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const JAVASCRIPT_GLOBAL_PROPERTY_CATEGORY = "JavaScript global property";

var gStrBundleService = null;
function srGetStrBundle(path) {
  if (!gStrBundleService) {
    gStrBundleService = Cc["@mozilla.org/intl/stringbundle;1"].
                        getService(Ci.nsIStringBundleService);
  }

  return gStrBundleService.createBundle(path);
}

function Sidebar() {
  this.searchService = Cc["@mozilla.org/browser/search-service;1"].
                       getService(Ci.nsIBrowserSearchService);
}

Sidebar.prototype = {
  // =========================== utility code ===========================
  _validateSearchEngine: function validateSearchEngine(engineURL, iconURL) {
    try {
      // Make sure we're using HTTP, HTTPS, or FTP.
      if (! /^(https?|ftp):\/\//i.test(engineURL))
        throw "Unsupported search engine URL";
    
      // Make sure we're using HTTP, HTTPS, or FTP and refering to a
      // .gif/.jpg/.jpeg/.png/.ico file for the icon.
      if (iconURL &&
          ! /^(https?|ftp):\/\/.+\.(gif|jpg|jpeg|png|ico)$/i.test(iconURL))
        throw "Unsupported search icon URL.";
    } catch(ex) {
      Cu.reportError("Invalid argument passed to window.sidebar.addSearchEngine: " + ex);
      
      var searchBundle = srGetStrBundle("chrome://global/locale/search/search.properties");
      var brandBundle = srGetStrBundle("chrome://branding/locale/brand.properties");
      var brandName = brandBundle.GetStringFromName("brandShortName");
      var title = searchBundle.GetStringFromName("error_invalid_engine_title");
      var msg = searchBundle.formatStringFromName("error_invalid_engine_msg",
                                                  [brandName], 1);
      var promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"].
                          getService(Ci.nsIPromptService);
      promptService.alert(null, title, msg);
      return false;
    }
    
    return true;
  },

  // =========================== nsISidebar ===========================
  addPanel: function addPanel(aTitle, aContentURL, aCustomizeURL) {
    // not supported
  },

  addPersistentPanel: function addPersistentPanel(aTitle, aContentURL, aCustomizeURL) {
    // not supported
  },

  addMicrosummaryGenerator: function addMicrosummaryGenerator(generatorURL) {
    // not supported
  },

  // The suggestedTitle and suggestedCategory parameters are ignored, but remain
  // for backward compatibility.
  addSearchEngine: function addSearchEngine(engineURL, iconURL, suggestedTitle,
                                            suggestedCategory) {
    if (!this._validateSearchEngine(engineURL, iconURL))
      return;

    // File extension for Sherlock search plugin description files
    const SHERLOCK_FILE_EXT_REGEXP = /\.src$/i;

    // OpenSearch files will likely be far more common than Sherlock files, and
    // have less consistent suffixes, so we assume that ".src" is a Sherlock
    // (text) file, and anything else is OpenSearch (XML).
    var dataType;
    if (SHERLOCK_FILE_EXT_REGEXP.test(engineURL))
      dataType = Ci.nsISearchEngine.DATA_TEXT;
    else
      dataType = Ci.nsISearchEngine.DATA_XML;

    this.searchService.addEngine(engineURL, dataType, iconURL, true);
  },

  // =========================== nsISidebarExternal ===========================
  // This function exists to implement window.external.AddSearchProvider(),
  // to match other browsers' APIs.  The capitalization, although nonstandard here,
  // is therefore important.
  AddSearchProvider: function AddSearchProvider(aDescriptionURL) {
    if (!this._validateSearchEngine(aDescriptionURL, ""))
      return;
  
    const typeXML = Ci.nsISearchEngine.DATA_XML;
    this.searchService.addEngine(aDescriptionURL, typeXML, "", true);
  },

  // This function exists to implement window.external.IsSearchProviderInstalled(),
  // for compatibility with other browsers.  It will return an integer value
  // indicating whether the given engine is installed for the current user.
  // However, it is currently stubbed out due to security/privacy concerns
  // stemming from difficulties in determining what domain issued the request.
  // See bug 340604 and
  // http://msdn.microsoft.com/en-us/library/aa342526%28VS.85%29.aspx .
  // XXX Implement this!
  IsSearchProviderInstalled: function IsSearchProviderInstalled(aSearchURL) {
    return 0;
  },

  // =========================== nsIClassInfo ===========================
  flags: Ci.nsIClassInfo.DOM_OBJECT,
  classDescription: "Sidebar",
  getInterfaces: function getInterfaces(count) {
    var interfaceList = [Ci.nsISidebar, Ci.nsISidebarExternal, Ci.nsIClassInfo];
    count.value = interfaceList.length;
    return interfaceList;
  },
  getHelperForLanguage: function getHelperForLanguage(count) {
    return null;
  },

  // =========================== nsISupports ===========================
  QueryInterface: XPCOMUtils.generateQI([Ci.nsISidebar,
                                         Ci.nsISidebarExternal,
                                         Ci.nsIClassInfo]),

  // XPCOMUtils stuff
  classID: Components.ID("{22117140-9c6e-11d3-aaf1-00805f8a4905}"),
  className: "Sidebar JS Component",
  contractID: "@mozilla.org/sidebar;1",
  _xpcom_categories: [{ category: JAVASCRIPT_GLOBAL_PROPERTY_CATEGORY,
                        entry: "sidebar"},
                      { category: JAVASCRIPT_GLOBAL_PROPERTY_CATEGORY,
                        entry: "external"}]
}

function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule([Sidebar]);
}
