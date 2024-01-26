/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const lazy = {};
import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

XPCOMUtils.defineLazyPreferenceGetter(lazy, "enabled", "genai.enabled");
XPCOMUtils.defineLazyPreferenceGetter(lazy, "endpoint", "genai.http.endpoint");
XPCOMUtils.defineLazyPreferenceGetter(lazy, "bearer", "genai.http.bearer");
XPCOMUtils.defineLazyPreferenceGetter(lazy, "model", "genai.http.model");

const allowContext = {};
XPCOMUtils.defineLazyPreferenceGetter(
  allowContext,
  "currentTabTitle",
  "genai.context.currentTabTitle"
);
XPCOMUtils.defineLazyPreferenceGetter(
  allowContext,
  "openTabs",
  "genai.context.openTabs"
);
XPCOMUtils.defineLazyPreferenceGetter(
  allowContext,
  "pageText",
  "genai.context.pageText"
);
XPCOMUtils.defineLazyPreferenceGetter(
  allowContext,
  "selection",
  "genai.context.selection"
);

export const GenAI = {
  async completion(prompt, context = {}) {
    if (!lazy.enabled) {
      throw Error("GenAI disabled");
    }

    let ret = "",
      request,
      response;

    // Try to get JSON response if prompt includes "json"
    const expectJSON = prompt.search(/\bjson\b/i) >= 0;

    // Conditionally add prompt context if needed and allowed
    Object.entries(context).forEach(([key, val]) => {
      const placeholder = `%${key}%`;
      if (prompt.includes(placeholder) && allowContext[key]) {
        prompt = prompt.replace(
          placeholder,
          `"${key}": ${JSON.stringify(val)}`
        );
      }
    });

    // TODO: Pick a body format in a smarter way
    const body = {};
    if (lazy.endpoint.endsWith("/v1/chat/completions")) {
      body.messages = [{ content: prompt, role: "user" }];
      body.max_tokens = 1024;
      body.model = lazy.model;
      if (expectJSON) {
        body.response_format = { type: "json_object" };
      }
    } else if (lazy.endpoint.endsWith(":predict")) {
      body.instances = [{ content: prompt }];
      body.parameters = { maxOutputTokens: 1024 };
    } else if (lazy.endpoint.endsWith(":streamGenerateContent")) {
      body.contents = [{ parts: [{ text: prompt }], role: "user" }];
      body.generation_config = { maxOutputTokens: 1024 };
    } else {
      body.prompt = prompt;
      if (expectJSON) {
        body.grammar = `root ::= "{" [^\\n]* "}"\n`;
      }
    }

    const headers = {
      "Content-Type": "application/json",
    };
    if (lazy.bearer) {
      headers.Authorization = `Bearer ${lazy.bearer}`;
    }

    try {
      request = await fetch(lazy.endpoint, {
        body: JSON.stringify(body),
        headers,
        method: "POST",
      });

      response = await request.json();
      ret =
        response.response ??
        response.content ??
        response.choices?.[0].message.content ??
        response.predictions?.[0].content ??
        response.map(r => r.candidates[0].content.parts[0].text).join("");

      // Some wrap JSON responses in code block
      if (expectJSON) {
        ret = ret.replace(/^\s*```(json)?/, "").replace(/```$/, "");
      }
    } catch (ex) {
      ret = [lazy.endpoint, request?.status, ex, JSON.stringify(response)].join(
        "\n\n"
      );
    }
    return ret;
  },
};
