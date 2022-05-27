/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * @ts-check
 */

/**
 * @template P
 * @typedef {import("react-redux").ResolveThunks<P>} ResolveThunks<P>
 */

/**
 * @typedef {Object} StateProps
 * @property {XPCOM.nsINavHistoryContainerResultNode[]} history
 */

/**
 * @typedef {StateProps} Props
 */

import { React, ReactDOMFactories, ReactRedux } from "./vendor.js";
import * as selectors from "./selectors.js";
const { div, h1 } = ReactDOMFactories;

/**
 * @extends {React.PureComponent<Props>}
 */
class HistoryPlusImpl extends React.PureComponent {
  render() {
    const { history } = this.props;

    return div(
      { className: `history` },
      h1(null, "Highest Frecency"),
      div(
        { className: "history-latest" },
        history.map(domain => div(null, "URL: ", domain))
      )
    );
  }
}

/**
 * @param {HistoryPlus.State} state
 * @returns {StateProps}
 */
function mapStateToProps(state) {
  return {
    history: selectors.topFrecencyDomains(state),
  };
}

export const HistoryPlus = ReactRedux.connect(mapStateToProps)(HistoryPlusImpl);
