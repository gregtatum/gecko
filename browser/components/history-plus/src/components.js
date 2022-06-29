/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// @ts-check

/**
 * @template P
 * @typedef {import("react-redux").ResolveThunks<P>} ResolveThunks<P>
 */

import { React, ReactDOMFactories, ReactRedux } from "./vendor.js";
const { a, div, h1, input, img, b, span, button } = ReactDOMFactories;
import * as Actions from "./actions/index.js";
import * as Selectors from "./selectors.js";

export function HistoryPlus() {
  const dispatch = ReactRedux.useDispatch();
  const search = ReactRedux.useSelector(Selectors.getSearchString);
  const historyRows = ReactRedux.useSelector(Selectors.getHistoryRows);

  React.useEffect(() => {
    dispatch(Actions.searchHistory(""));
  }, []);

  return div(
    { className: `history` },
    h1(
      { className: "historyTitle" },
      span({ className: "historyTitleSpan" }, "History"),
      button({ className: "historyTitleClear" }, "Clear History")
    ),
    div(
      {
        className: "historyInputWrapper",
      },
      img({
        src: "chrome://global/skin/icons/search-textbox.svg",
        className: "historyInputIcon",
      }),
      input({
        type: "text",
        className: "historyInput",
        placeholder: "Seach all history",
        value: search,
        onChange: event => {
          // TODO - Debounce.
          dispatch(Actions.searchHistory(event.target.value));
        },
      }),
      HistoryResults({ historyRows })
    )
  );
}

/**
 * @param {{ historyRows: HistoryPlus.HistoryRow[] }} props
 */
function HistoryResults(props) {
  const { historyRows } = props;
  return div(
    { className: "historyResults" },
    historyRows.map(({ url, title, description }) =>
      div(
        { className: "historyResultsRow" },
        div(
          { className: "historyResultsUrl" },
          img({ src: "page-icon:" + url, className: "historyResultsFavicon" }),
          React.createElement(DisplayURL, { url }),
          React.createElement(MoreOptions)
        ),
        a(
          { className: "historyResultsTitle", href: url, target: "_blank" },
          title || url
        ),
        div(
          { className: "historyResultsDescription" },
          ApplyBoldTags({ text: description })
        )
      )
    )
  );
}

function useOpenCloseBehavior() {
  const [isOpen, setIsOpen] = React.useState(false);
  const isOpenRef = React.useRef(isOpen);
  const keypressHandler = React.useMemo(() => {
    /**
     * @param {KeyboardEvent} event
     */
    return function handler(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
  }, []);
  const clickHandler = React.useMemo(() => {
    return () => setIsOpen(false);
  }, []);

  // Sync the state to a ref.
  React.useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  React.useEffect(() => {
    if (isOpen) {
      window.addEventListener("keypress", keypressHandler);
      window.addEventListener("click", clickHandler);
    } else {
      window.removeEventListener("keypress", keypressHandler);
      window.removeEventListener("click", clickHandler);
    }
    return () => {
      window.removeEventListener("keypress", keypressHandler);
      window.removeEventListener("click", clickHandler);
    };
  }, [isOpen]);

  return { isOpen, setIsOpen };
}

/**
 * @param {Object} props
 * @param {string} props.url
 * @returns {any}
 */
function DisplayURL(props) {
  const rawURL = props.url;
  const dispatch = ReactRedux.useDispatch();
  const { isOpen, setIsOpen } = useOpenCloseBehavior();

  let url;
  try {
    url = new URL(rawURL);
  } catch (error) {
    return rawURL;
  }
  const { host } = url;
  const index = rawURL.indexOf(host) + 1 + host.length;
  //                                   ^ skip the first "/"
  if (index === -1) {
    return rawURL;
  }
  const urlRest = rawURL.slice(index);
  let rest = [];
  if (urlRest.length) {
    rest.push(
      span({ className: "historyResultsUrlSlash" }, "/"),
      span({ className: "historyResultsUrlRest" }, urlRest)
    );
  }

  let menu = null;
  if (isOpen) {
    menu = div(
      { className: "historyHostMenu" },
      button(
        {
          className: "historyHostMenuItem",
          onClick: () => {
            dispatch(Actions.addSiteToSearchString(host));

            // TODO - Is there a more react-y way to do this?
            const input = /** @type {HTMLInputElement | undefined} */ (document.querySelector(
              ".historyInput"
            ));
            input?.focus();
          },
        },
        "Search only this site"
      ),
      button({ className: "historyHostMenuItem" }, "Forget about site")
    );
  }

  return span(
    { className: "historyResultsUrlRow" },
    menu,
    button(
      { className: "historyResultsUrlHost", onClick: () => setIsOpen(true) },
      url.host
    ),
    ...rest
  );
}

/**
 * @param {Object} props
 * @param {string} [props.text]
 */
function ApplyBoldTags({ text }) {
  if (!text) {
    return null;
  }
  const parts = [];
  const chunks = text.split("<b>");
  parts.push(chunks[0]);
  for (const chunk of chunks.slice(1)) {
    const [innerText, ...rest] = chunk.split("</b>");
    parts.push(b(null, innerText), ...rest);
  }
  return parts;
}

function MoreOptions() {
  const { isOpen, setIsOpen } = useOpenCloseBehavior();

  let menu = null;
  if (isOpen) {
    menu = div(
      { className: "historyMoreOptionsMenu" },
      button({ className: "historyHostMenuItem" }, "Forget this page"),
      button({ className: "historyHostMenuItem" }, "Forget this site"),
      button({ className: "historyHostMenuItem" }, "Add as bookmark")
    );
  }

  return button(
    { className: "historyMoreOptions", onClick: () => setIsOpen(true) },
    span(
      // TODO - Do not use a random unicode glyph here.
      {
        style: {
          fontSize: "20px",
          position: "relative",
          display: "inline-block",
          left: "-2px",
        },
      },
      "⠸"
    ),
    menu
  );
}
