/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// eslint-disable-next-line no-unused-vars
const EXPORTED_SYMBOLS = ["FakeEventFactory"];

/**
 * Responsible for expanding a "sketch" of desired events into a sufficiently
 * populated event or recurring series of events so that they can be served up
 * as an iCal file or via a fake-server and synchronize correctly and look
 * reasonable in a UI.
 *
 * Parts of this class are derived from Thunderbird's `messageGenerator.js`,
 * specifically the name and subject generation logic.  Note that
 * messageGenerator was concerned about producing fully deterministic generated
 * values to ensure test stability.  This class may eventually go that way, but
 * for now things will just be random.  (Ideally we could use a PRNG that allows
 * us to control the seed and derive the seed from the input data, but it's not
 * yet worth taking a dependency for that and a sequential ordering turns out
 * too boring right now.)
 */
// eslint-disable-next-line no-unused-vars
class FakeEventFactory {
  #nextNameNumber;
  #nextSummaryNumber;
  #nextEventTS;
  #defaultEventDurationMillis;
  #defaultEventSpacingMillis;

  constructor({
    firstEventTS,
    eventDurationMillis = 55 * 60 * 1000,
    eventSpacingMillis = 60 * 60 * 1000,
  }) {
    this.#nextEventTS = firstEventTS;
    this.#defaultEventDurationMillis = eventDurationMillis;
    this.#defaultEventSpacingMillis = eventSpacingMillis;

    /**
     * Maps sketch objects to the full event we generated for them.  Exists to
     * allow using an event sketch as a lighter weight handle to the full event
     * when doing set comparisons.  Lighter weight in this case means that if
     * logging it for debug purposes, it doesn't have to be full of the extra
     * details we filled in.
     */
    this.sketchToFullMap = new Map();
    this.fullToSketchMap = new Map();
    this.summaryToSketchMap = new Map();

    this.#nextNameNumber = 0;
    this.#nextSummaryNumber = 0;
  }

  deriveFullEvents({ eventSketches, creator, organizer }) {
    const fullEvents = [];
    for (const sketch of eventSketches) {
      let startDate, endDate;
      // NB: Right now the legacy model uses "start" and "end" without prefix,
      // but this does seem appropriate for sketch purposes where we wouldn't
      // want this to be an explicit absolute time anyways.
      if (sketch.start && sketch.end) {
        startDate = new Date(sketch.start);
        endDate = new Date(sketch.end);
        this.#nextEventTS =
          startDate.valueOf() + this.#defaultEventSpacingMillis;
        if (endDate.valueOf() > this.#nextEventTS) {
          this.#nextEventTS = endDate.valueOf();
        }
      } else {
        startDate = new Date(this.#nextEventTS);
        endDate = new Date(
          startDate.valueOf() + this.#defaultEventDurationMillis
        );
        this.#nextEventTS += this.#defaultEventSpacingMillis;
      }

      const summary = sketch.summary || this.#makeSummary();

      const description =
        sketch.description ||
        this.#generateDescription({ links: sketch.links });

      let attendees;
      if (sketch.attendees) {
        if (typeof sketch.attendees === "number") {
          attendees = this.#makeNamesAndAddresses(sketch.attendees);
        } else if (Array.isArray(sketch.attendees)) {
          // copy the contents of the array
          attendees = sketch.attendees.concat();
        } else {
          throw new Error(
            `Unknown "attendees" value, expected Number of Array: ${sketch.attendees}`
          );
        }
      } else {
        attendees = [];
      }

      const location = sketch.location || undefined;
      const fullEvent = {
        startDate,
        endDate,
        summary,
        description,
        // TODO: improve fidelity of the creator and organizer semantics
        creator,
        organizer,
        attendees,
        location,
      };

      this.sketchToFullMap.set(sketch, fullEvent);
      this.fullToSketchMap.set(fullEvent, sketch);
      this.summaryToSketchMap.set(summary, sketch);

      fullEvents.push(fullEvent);
    }

    return fullEvents;
  }

  /**
   * Given an array of events which may either be full events or sketches,
   * transform any full events to sketches.
   */
  mapEventsToSketches(events) {
    return events.map(someEvent => {
      // Return the event if it's already a sketch.
      if (this.sketchToFullMap.has(someEvent)) {
        return someEvent;
      }
      // Otherwise it's either a full event or a WorkshopAPI CalEvent, in which
      // case we can just index by the summary.
      let fromSummary = this.summaryToSketchMap.get(someEvent.summary);
      if (fromSummary) {
        return fromSummary;
      }

      throw new Error(`Provided event is not known: ${someEvent}`);
    });
  }

  /**
   * Generate a consistently determined (and reversible) name from a unique
   *  value.  Currently up to 26*26 unique names can be generated, which
   *  should be sufficient for testing purposes, but if your code cares, check
   *  against MAX_VALID_NAMES.
   *
   * @param aNameNumber The 'number' of the name you want which must be less
   *     than MAX_VALID_NAMES.
   * @returns The unique name corresponding to the name number.
   */
  #makeName(aNameNumber) {
    const iFirst = aNameNumber % FIRST_NAMES.length;
    const iLast =
      (iFirst + Math.floor(aNameNumber / FIRST_NAMES.length)) %
      LAST_NAMES.length;

    return FIRST_NAMES[iFirst] + " " + LAST_NAMES[iLast];
  }

  /**
   * Generate a consistently determined (and reversible) e-mail address from
   *  a unique value; intended to work in parallel with makeName.  Currently
   *  up to 26*26 unique addresses can be generated, but if your code cares,
   *  check against MAX_VALID_MAIL_ADDRESSES.
   *
   * @param aNameNumber The 'number' of the mail address you want which must be
   *     less than MAX_VALID_MAIL_ADDRESSES.
   * @returns The unique name corresponding to the name mail address.
   */
  #makeMailAddress(aNameNumber) {
    const iFirst = aNameNumber % FIRST_NAMES.length;
    const iLast =
      (iFirst + Math.floor(aNameNumber / FIRST_NAMES.length)) %
      LAST_NAMES.length;

    return (
      FIRST_NAMES[iFirst].toLowerCase() +
      "@" +
      LAST_NAMES[iLast].toLowerCase() +
      ".nul"
    );
  }

  /**
   * Generate a pair of name and e-mail address.
   *
   * @return An object containing two members: "name" is a name produced by
   *     a call to makeName, and "address" an e-mail address produced by a
   *     call to makeMailAddress.  This representation is used by the
   *     SyntheticMessage class when dealing with names and addresses.
   */
  #makeNameAndAddress() {
    const useNameNumber = this.#nextNameNumber++;
    return {
      email: this.#makeMailAddress(useNameNumber),
      displayName: this.#makeName(useNameNumber),
    };
  }

  /**
   * Generate and return multiple pairs of names and e-mail addresses.  The
   *  names are allocated using the automatic mechanism as documented on
   *  makeNameAndAddress.  You should accordingly not allocate / hard code name
   *  numbers on your own.
   *
   * @param aCount The number of people you want name and address tuples for.
   * @returns a list of aCount name-and-address objects.
   */
  #makeNamesAndAddresses(aCount) {
    const namesAndAddresses = [];
    for (let i = 0; i < aCount; i++) {
      namesAndAddresses.push(this.#makeNameAndAddress());
    }
    return namesAndAddresses;
  }

  /**
   * Generate a consistently determined (and reversible) subject from a unique
   *  value.  Up to MAX_VALID_SUBJECTS can be produced.
   *
   * @returns The subject corresponding to the given subject number.
   */
  #makeSummary() {
    const useSummaryNumber = this.#nextSummaryNumber++;
    const iAdjective = useSummaryNumber % SUMMARY_ADJECTIVES.length;
    const iNoun =
      (iAdjective + Math.floor(useSummaryNumber / SUMMARY_ADJECTIVES.length)) %
      SUMMARY_NOUNS.length;
    const iSuffix =
      (iNoun +
        Math.floor(
          useSummaryNumber / (SUMMARY_ADJECTIVES.length * SUMMARY_NOUNS.length)
        )) %
      SUMMARY_SUFFIXES.length;
    return (
      SUMMARY_ADJECTIVES[iAdjective] +
      " " +
      SUMMARY_NOUNS[iNoun] +
      " " +
      SUMMARY_SUFFIXES[iSuffix] +
      " #" +
      useSummaryNumber
    );
  }

  #weightedRandomChoice(choiceList) {
    if (typeof choiceList === "string") {
      return choiceList;
    }
    // If the first element is an empty string, then we do an initial 50% check
    // to bias towards not including anything.
    if (choiceList[0].length === 0) {
      if (Math.random() < 0.5) {
        return choiceList[0];
      }
    }
    // 1 is exclusive so we should never subscript length.
    return choiceList[Math.floor(Math.random() * choiceList.length)];
  }

  #compileRandomProse(prosePermutationArray) {
    let str = "";
    for (const pieceChoices of prosePermutationArray) {
      const nextPiece = this.#weightedRandomChoice(pieceChoices);
      // Append with whitespace if both strings are non-empty.
      if (str && nextPiece) {
        str += " " + nextPiece;
      } else {
        // nextPiece could still be empty here, but then this is a no-op.
        str += nextPiece;
      }
    }

    return str;
  }

  #generateDescription({ prose = true, links }) {
    if (prose === true) {
      prose = this.#compileRandomProse(MEETING_DESCRIPTION_PROSE);
    }

    if (!links) {
      return prose;
    }

    if (prose) {
      prose += "\n\n";
    }
    for (const link of links) {
      if (link.text) {
        prose += `<a href="${link.url}>${link.text}</a>\n`;
      } else {
        prose += `${link.url}\n`;
      }
    }

    return prose;
  }
}

/**
 * Permutation components for stringing together a random meeting description
 * introduction sentence.
 *
 * This is intended for the eventual benefit of automated screenshots that look
 * normal-ish or interactive demonstrations where it's preferable to not reveal
 * people's actual calendars.
 */
const MEETING_DESCRIPTION_PROSE = [
  [
    "Let's have a",
    "I propose a",
    "With all due haste we must have a",
    "Yo, we need a",
  ],
  [
    "",
    "visionary",
    "frank",
    "friendly",
    "timely",
    "not ill-advised",
    "very legal",
  ],
  [
    "meeting",
    "planning session",
    "meeting of the minds",
    "discussion",
    "conversation",
  ],
  "to",
  [
    "debate",
    "discuss",
    "envision",
    "hash out",
    "just look up on wikipedia",
    "plan",
    "ponder",
    "pontificate on",
  ],
  "our",
  [
    "",
    "award nominated",
    "award winning",
    "entirely legal",
    "expensive",
    "long overdue",
    "overdue",
    "visionary",
    "well conceived",
  ],
  [
    "approach",
    "best laid plans",
    "best laid schemes",
    "plan",
    "solution",
    "vision",
  ],
  ["to", "for"],
  "the",
  [
    "",
    "fancy",
    "not ill-advised",
    "legally necessary",
    "long planned",
    "much beloved",
    "vexing",
  ],
  [
    "business lunch",
    "fax machine",
    "vending machine",
    "danceathon",
    "poodle",
    "potato clock",
  ],
  [
    "",
    "advisory council",
    "planning committee",
    "selection process",
    "situation",
  ],
  ".",
];

/**
 * A list of first names for use by MessageGenerator to create deterministic,
 *  reversible names.  To keep things easily reversible, if you add names, make
 *  sure they have no spaces in them!
 */
const FIRST_NAMES = [
  "Andy",
  "Bob",
  "Chris",
  "David",
  "Emily",
  "Felix",
  "Gillian",
  "Helen",
  "Idina",
  "Johnny",
  "Kate",
  "Lilia",
  "Martin",
  "Neil",
  "Olof",
  "Pete",
  "Quinn",
  "Rasmus",
  "Sarah",
  "Troels",
  "Ulf",
  "Vince",
  "Will",
  "Xavier",
  "Yoko",
  "Zig",
];

/**
 * A list of last names for use by MessageGenerator to create deterministic,
 *  reversible names.  To keep things easily reversible, if you add names, make
 *  sure they have no spaces in them!
 */
const LAST_NAMES = [
  "Anway",
  "Bell",
  "Clarke",
  "Davol",
  "Ekberg",
  "Flowers",
  "Gilbert",
  "Hook",
  "Ivarsson",
  "Jones",
  "Kurtz",
  "Lowe",
  "Morris",
  "Nagel",
  "Orzabal",
  "Price",
  "Quinn",
  "Rolinski",
  "Stanley",
  "Tennant",
  "Ulvaeus",
  "Vannucci",
  "Wiggs",
  "Xavier",
  "Young",
  "Zig",
];

/**
 * A list of adjectives used to construct a deterministic, reversible subject
 *  by MessageGenerator.  To keep things easily reversible, if you add more,
 *  make sure they have no spaces in them!  Also, make sure your additions
 *  don't break the secret Monty Python reference!
 */
const SUMMARY_ADJECTIVES = [
  "Big",
  "Small",
  "Huge",
  "Tiny",
  "Red",
  "Green",
  "Blue",
  "My",
  "Happy",
  "Sad",
  "Grumpy",
  "Angry",
  "Awesome",
  "Fun",
  "Lame",
  "Funky",
];

/**
 * A list of nouns used to construct a deterministic, reversible subject
 *  by MessageGenerator.  To keep things easily reversible, if you add more,
 *  make sure they have no spaces in them!  Also, make sure your additions
 *  don't break the secret Monty Python reference!
 */
const SUMMARY_NOUNS = [
  "Meeting",
  "Party",
  "Shindig",
  "Wedding",
  "Document",
  "Report",
  "Spreadsheet",
  "Hovercraft",
  "Aardvark",
  "Giraffe",
  "Llama",
  "Velociraptor",
  "Laser",
  "Ray-Gun",
  "Pen",
  "Sword",
];

/**
 * A list of suffixes used to construct a deterministic, reversible subject
 *  by MessageGenerator.  These can (clearly) have spaces in them.  Make sure
 *  your additions don't break the secret Monty Python reference!
 */
const SUMMARY_SUFFIXES = [
  "Today",
  "Tomorrow",
  "Yesterday",
  "In a Fortnight",
  "Needs Attention",
  "Very Important",
  "Highest Priority",
  "Full Of Eels",
  "In The Lobby",
  "On Your Desk",
  "In Your Car",
  "Hiding Behind The Door",
];
