/**
 * Copyright 2021 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import logic from "logic";
import { LogicEvent } from "logic";

/**
 * Circular buffer to store the log entries.
 * The implementation is pretty basic:
 *  - the buffer is a fixed-size one;
 *  - we track the position of the next element to insert modulo the buffer
 *    length;
 *  - the elements between indices 0 and the current position are the last ones.
 *
 * Entries are censored in order to remove some private information.
 */
export class LogicBuffer {
  #buffer;
  #currentPosition;
  #lastPosition;
  #onEventBound;
  #onCensorEventBound;

  constructor({ maxSize = 65536, censor = true }) {
    this.#buffer = new Array(maxSize);
    this.#currentPosition = 0;
    this.#lastPosition = maxSize;

    this.#onEventBound = this.#onEvent.bind(this);
    logic.on("event", this.#onEventBound);

    if (censor) {
      this.#onCensorEventBound = this.#onCensorEvent.bind(this);
      logic.on("censorEvent", this.#onCensorEventBound);
    }
  }

  destroy() {
    logic.removeListener("event", this.#onEventBound);
    if (this.#onCensorEventBound) {
      logic.removeListener("censorEvent", this.#onCensorEventBound);
    }
    this.#buffer = null;
  }

  #onEvent(event) {
    if (!event) {
      return;
    }
    this.#buffer[this.#currentPosition] = event.jsonRepresentation;
    this.#currentPosition = (this.#currentPosition + 1) % this.#buffer.length;
  }

  #censorValue(obj) {
    if (!obj || !logic.isPlainObject(obj)) {
      return obj;
    }

    for (const [key, value] of Object.entries(obj)) {
      if (key.charAt(0) === "_") {
        obj[key] = "Censored";
      } else if (Array.isArray(value)) {
        obj[key] = value.map(this.#censorValue.bind(this)).filter(x => !!x);
      } else {
        obj[key] = this.#censorValue(value);
      }
    }

    return obj;
  }

  #onCensorEvent(event) {
    const { details } = event;
    if (!logic.isPlainObject(details)) {
      return;
    }
    this.#censorValue(details);
  }

  add(entry) {
    const event = LogicEvent.fromJSON(entry);
    this.#censorValue(event);
    this.#onEvent(event);
  }

  getBuffer() {
    this.#lastPosition = this.#currentPosition;
    const firstPart = this.#buffer.slice(this.#currentPosition);
    const secondPart = this.#buffer.slice(0, this.#currentPosition);
    return firstPart.concat(secondPart).filter(line => !!line);
  }

  getLastEntries() {
    if (this.#lastPosition === this.#currentPosition) {
      return null;
    }

    let entries;
    if (this.#lastPosition <= this.#currentPosition) {
      entries = this.#buffer.slice(this.#lastPosition, this.#currentPosition);
    } else {
      const firstPart = this.#buffer.slice(this.#lastPosition);
      const secondPart = this.#buffer.slice(0, this.#currentPosition);
      entries = firstPart.concat(secondPart);
    }

    this.#lastPosition = this.#currentPosition;

    return entries.filter(line => !!line);
  }
}
