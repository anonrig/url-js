"use strict";
const {
  is_ascii_alphanumeric,
  utf8_percent_encode,
  is_ascii_hex,
  is_ascii_alpha,
  is_ascii_digit,
  is_double_dot_path_segment,
  is_single_dot_path_segment,
} = require("./string");
const { FAILURE } = require("./constants");
const Errors = require("./errors");
const {
  starts_with_windows_drive_letter,
  is_normalized_windows_drive_letter,
  is_windows_drive_letter,
  is_windows_drive_letter_code,
} = require("./platform");
const {
  is_userinfo_percent_encoded,
  is_fragment_percent_encoded,
  is_control_percent_encoded,
  is_special_query_percent_encoded,
  is_path_percent_encoded,
  is_query_percent_encoded,
} = require("./encoding");
const { parse_host } = require("./parser");

const special_schemes = {
  ftp: 21,
  file: null,
  http: 80,
  https: 443,
  ws: 80,
  wss: 443,
};

/**
 * @typedef {Object} URLStateMachineBase
 * @property {string} scheme
 * @property {string} username
 * @property {string} password
 * @property {string=} [host=null] host
 * @property {number=} [port=null] port
 * @property {(string[]|string)=} [path=null] path
 * @property {string=} [query=null] query
 * @property {string=} [fragment=null] fragment
 */

/**
 * @typedef {'authority'|'scheme-start'|'no-scheme'|'scheme'|'fragment'|'relative'|'relative-slash'|'file'|'file-slash'|'query'|'path'|'file-host'|'path-or-authority'|'special-relative-or-authority'|'special-authority-slashes'|'special-authority-ignore-slashes'|'path-start'|'opaque-path'|'port'} State
 *
 * @class
 * @public
 * @constructor
 * @param {string} input
 * @param {URLStateMachineBase=} [base=null] base
 * @param {State=} stateOverride
 */
function URLStateMachine(input, base = null, stateOverride) {
  if (!input || typeof input !== "string") {
    throw Errors.INVALID_ARGUMENT;
  }

  this.hasValidationError = false;
  this.buffer = "";
  this.atSignSeen = false;
  this.insideBrackets = false;
  this.passwordTokenSeen = false;
  this.pointer = 0;
  this.failure = false;

  // Always update this value when this.url.scheme is updated.
  this.isSpecialUrl = false;

  /** @type {State} */
  this.state = stateOverride || "scheme-start";
  this.stateOverride = stateOverride;
  this.input = "";
  this.setInput(input);

  this.base = base;
  this.url =
    {
      // A URL’s scheme is an ASCII string that identifies the type of URL and can be used to dispatch a URL for
      // further processing after parsing. It is initially the empty string.
      scheme: "",
      // A URL’s username is an ASCII string identifying a username. It is initially the empty string.
      username: "",
      // A URL’s password is an ASCII string identifying a password. It is initially the empty string.
      password: "",
      // A URL’s host is null or a host. It is initially null.
      host: null,
      // A URL’s port is either null or a 16-bit unsigned integer that identifies a networking port. It is initially null.
      port: null,
      // A URL’s path is either an ASCII string or a list of zero or more ASCII strings, usually identifying a location.
      path: [],
      // A URL’s query is either null or an ASCII string. It is initially null.
      query: null,
      // A URL’s fragment is either null or an ASCII string that can be used for further processing on the resource
      // the URL’s other components identify. It is initially null.
      fragment: null,
    };

  for (; this.pointer <= this.input.length; this.pointer++) {
    const character = this.input[this.pointer];
    const code = character === undefined ? undefined : character.codePointAt(0);
    const result = this.processState(code, character);

    if (result === FAILURE) {
      this.failure = true;
      break;
    } else if (result === false) {
      break;
    }
  }
}

/**
 * @private
 * @function setInput
 * @description Sanitize the input and set it internally
 * @param {string} input
 */
URLStateMachine.prototype.setInput =
  function setInput(input) {
    // If input contains any leading or trailing C0 control or space, validation error.
    // If input contains any ASCII tab or newline, validation error.
    const extra_characters_removed = input.replace(
      /[\u0000-\u001F\u007F-\u009F]/g,
      "",
    ).replace(/[\u0009\u000A\u000D]/ug, "");

    if (extra_characters_removed !== input) {
      this.hasValidationError = true;
    }

    this.input = extra_characters_removed;
  };

/**
 * @private
 * @function processState
 * @param {number} code
 * @param {String} character
 * @returns {boolean|Symbol|undefined}
 */
URLStateMachine.prototype.processState =
  function processState(code, character) {
    switch (this.state) {
      case "authority":
        return this.authorityState(code, character);
      case "scheme-start":
        return this.schemeStartState(code, character);
      case "scheme":
        return this.schemeState(code, character);
      case "host":
      case "hostname":
        return this.hostState(code, character);
      case "no-scheme":
        return this.noSchemeState(code, character);
      case "fragment":
        return this.fragmentState(code, character);
      case "relative":
        return this.relativeState(code, character);
      case "relative-slash":
        return this.relativeSlashState(code, character);
      case "file":
        return this.fileState(code, character);
      case "file-host":
        return this.fileHostState(code, character);
      case "file-slash":
        return this.fileSlashState(code, character);
      case "path-or-authority":
        return this.pathOrAuthorityState(code, character);
      case "special-authority-ignore-slashes":
        return this.specialAuthorityIgnoreSlashesState(code, character);
      case "special-authority-slashes":
        return this.specialAuthoritySlashesState(code, character);
      case "special-relative-or-authority":
        return this.specialRelativeOrAuthorityState(code, character);
      case "query":
        return this.queryState(code, character);
      case "path":
        return this.pathState(code, character);
      case "path-start":
        return this.pathStartState(code, character);
      case "opaque-path":
        return this.opaquePathState(code, character);
      case "port":
        return this.portState(code, character);
    }
  };

/**
 * @function shortenUrl
 * @returns {void}
 */
URLStateMachine.prototype.shortenUrl =
  function shortenUrl() {
    // If url’s scheme is "file", path’s size is 1, and path[0] is a normalized Windows drive letter, then return.
    if (
      this.url.scheme === "file" &&
      this.url.path.length === 1 &&
      is_normalized_windows_drive_letter(this.url.path[0])
    ) {
      return;
    }
    // Remove path’s last item, if any.
    this.url.path.pop();
  };

/**
 * @private
 * @function authorityState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.authorityState =
  function authorityState(code, character) {
    // If c is U+0040 (@), then:
    if (character === "@") {
      this.hasValidationError = true;

      // If atSignSeen is true, then prepend '%40' to buffer.
      if (this.atSignSeen) {
        this.buffer = "%40" + this.buffer;
      }

      this.atSignSeen = true;

      // For each codePoint in buffer:
      for (let i = 0; i < this.buffer.length; i++) {
        // If codePoint is U+003A (:) and passwordTokenSeen is false, then set passwordTokenSeen to true and continue.
        if (this.buffer[i] === ":" && !this.passwordTokenSeen) {
          this.passwordTokenSeen = true;
          continue;
        }

        // Let encodedCodePoints be the result of running UTF-8 percent-encode codePoint using the userinfo percent-encode set.
        const encoded_code_points = utf8_percent_encode(
          this.buffer[i],
          is_userinfo_percent_encoded,
        );

        if (this.passwordTokenSeen) {
          // If passwordTokenSeen is true, then append encodedCodePoints to url’s password.
          this.url.password += encoded_code_points;
        } else {
          // Otherwise, append encodedCodePoints to url’s username.
          this.url.username += encoded_code_points;
        }
      }

      // Set buffer to the empty string.
      this.buffer = "";
    }
    // Otherwise, if one of the following is true:
    // - c is the EOF code point, U+002F (/), U+003F (?), or U+0023 (#)
    // - url is special and c is U+005C (\)
    else if (
      isNaN(code) ||
      character === "/" ||
      character === "?" ||
      character === "#" ||
      (this.isSpecialUrl && character === "\\")
    ) {
      // If atSignSeen is true and buffer is the empty string, validation error, return failure.
      if (this.atSignSeen && this.buffer === "") {
        this.hasValidationError = true;
        return FAILURE;
      }

      // Decrease pointer by the number of code points in buffer plus one, set buffer to the empty string, and set state to host state.
      this.pointer -= this.buffer.length + 1;
      this.buffer = "";
      this.state = "host";
    }
    // Otherwise, append c to buffer.
    else {
      this.buffer += character;
    }
  };

/**
 * @private
 * @function hostState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.hostState =
  function hostState(code, character) {
    // If state override is given and url’s scheme is "file", then decrease pointer by 1 and set state to file host state.
    if (this.stateOverride && this.url.scheme === "file") {
      this.pointer--;
      this.state = "file-host";
    }
    // Otherwise, if c is U+003A (:) and insideBrackets is false, then:
    else if (character === ":" && !this.insideBrackets) {
      if (this.buffer === "") {
        // If buffer is the empty string, validation error, return failure.
        this.hasValidationError = true;
        return FAILURE;
      }

      // If state override is given and state override is hostname state, then return.
      if (this.stateOverride === "hostname") {
        return false;
      }

      // Let host be the result of host parsing buffer with url is not special.
      const host = parse_host(this.buffer, !this.isSpecialUrl);

      // If host is failure, then return failure.
      if (host === FAILURE) {
        return FAILURE;
      }

      // Set url’s host to host, buffer to the empty string, and state to port state.
      this.url.host = host;
      this.buffer = "";
      this.state = "port";
    }
    // Otherwise, if one of the following is true:
    // - c is the EOF code point, U+002F (/), U+003F (?), or U+0023 (#)
    // - url is special and c is U+005C (\)
    else if (
      (
        isNaN(code) ||
          character === "/" ||
          character === "?" ||
          character === "#"
      ) || (this.isSpecialUrl && character === "\\")
    ) {
      // then decrease pointer by 1, and then:
      this.pointer--;

      // If url is special and buffer is the empty string, validation error, return failure.
      if (this.isSpecialUrl && this.buffer === "") {
        this.hasValidationError = true;
        return FAILURE;
      }
      // Otherwise, if state override is given, buffer is the empty string, and either url includes credentials or url’s port is non-null, return.
      else if (
        this.stateOverride &&
        this.buffer === "" &&
        (this.url.port || this.url.username !== "" || this.url.password !== "")
      ) {
        return false;
      }

      const host = parse_host(this.buffer, !this.isSpecialUrl);

      if (host === FAILURE) {
        return FAILURE;
      }

      // Set url’s host to host, buffer to the empty string, and state to path start state.
      this.url.host = host;
      this.buffer = "";
      this.state = "path-start";

      // If state override is given, then return.
      if (this.stateOverride) {
        return false;
      }
    } else {
      // If c is U+005B ([), then set insideBrackets to true.
      if (character === "[") {
        this.insideBrackets = true;
      } else if (character === "]") {
        // If c is U+005D (]), then set insideBrackets to false.
        this.insideBrackets = false;
      }

      this.buffer += character;
    }
  };

/**
 * @private
 * @function schemeStartState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.schemeStartState =
  function schemeStartState(code, character) {
    // If c is an ASCII alpha, append c, lowercased, to buffer, and set state to scheme state.
    if (is_ascii_alpha(code)) {
      this.buffer += character.toLowerCase();
      this.state = "scheme";
    }
    // Otherwise, if state override is not given, set state to no scheme state and decrease pointer by 1.
    else if (!this.stateOverride) {
      this.state = "no-scheme";
      this.pointer--;
    }
    // Otherwise, validation error, return failure.
    else {
      this.hasValidationError = true;
      return FAILURE;
    }
  };

/**
 * @private
 * @function schemeState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.schemeState =
  function schemeState(code, character) {
    // If c is an ASCII alphanumeric, U+002B (+), U+002D (-), or U+002E (.), append c, lowercased, to buffer.
    if (
      is_ascii_alphanumeric(code) ||
      character === "+" ||
      character === "-" ||
      character === "."
    ) {
      this.buffer += character.toLowerCase();
    }
    // Otherwise, if c is U+003A (:), then:
    else if (character === ":") {
      // If state override is given, then:
      if (this.stateOverride) {
        const buffer_special = special_schemes[this.buffer] !== undefined;

        // If url’s scheme is a special scheme and buffer is not a special scheme, then return.
        if (this.isSpecialUrl && !buffer_special) {
          return false;
        }
        // If url’s scheme is not a special scheme and buffer is a special scheme, then return.
        else if (!this.isSpecialUrl && buffer_special) {
          return false;
        }
        // If url includes credentials or has a non-null port, and buffer is 'file', then return.
        // A URL includes credentials if its username or password is not the empty string.
        else if (
          (
            (this.url.username !== "" || this.url.password !== "") || this.url.port !== null
          ) && this.buffer === "file"
        ) {
          return false;
        }
        // If url’s scheme is 'file' and its host is an empty host, then return.
        // An empty host is the empty string.
        else if (this.url.scheme === "file" && this.url.host === "") {
          return false;
        }
      }

      // Set url’s scheme to buffer.
      this.isSpecialUrl = special_schemes[this.buffer] !== undefined;
      this.url.scheme = this.buffer;

      // If state override is given, then:
      if (this.stateOverride) {
        // If url’s port is url’s scheme’s default port, then set url’s port to null.
        if (this.url.port === special_schemes[this.url.scheme]) {
          this.url.port = null;
          return false;
        }
      }

      // Set buffer to the empty string.
      this.buffer = "";

      // If url’s scheme is "file", then:
      if (this.url.scheme === "file") {
        // If remaining does not start with '//', validation error.
        if (this.input.substring(this.pointer + 1, 2) !== "//") {
          this.hasValidationError = true;
        }

        // Set state to file state.
        this.state = "file";
      }
      // Otherwise, if url is special, base is non-null, and base’s scheme is url’s scheme:
      else if (
        this.isSpecialUrl &&
        this.base !== null &&
        this.base.scheme === this.url.scheme
      ) {
        // TODO: Assert: base is is_special (and therefore does not have an opaque path).
        // Set state to special relative or authority state.
        this.state = "special-relative-or-authority";
      } else if (this.isSpecialUrl) {
        // Otherwise, if url is special, set state to special authority slashes state.
        this.state = "special-authority-slashes";
      }
      // Otherwise, if remaining starts with an U+002F (/), set state to path or authority state and increase pointer by 1.
      else if (this.input[this.pointer + 1] === "/") {
        this.state = "path-or-authority";
        this.pointer++;
      }
      // Otherwise, set url’s path to the empty string and set state to opaque path state.
      else {
        this.url.path = "";
        this.state = "opaque-path";
      }
    }
    // Otherwise, if state override is not given, set buffer to the empty string, state to no scheme state,
    // and start over (from the first code point in input).
    else if (!this.stateOverride) {
      this.buffer = "";
      this.state = "no-scheme";
      this.pointer = -1;
    }
    // Otherwise, validation error, return failure.
    else {
      this.hasValidationError = true;
      return FAILURE;
    }
  };

/**
 * @private
 * @function noSchemeState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.noSchemeState =
  function noSchemeState(code, character) {
    // If base is null, or base has an opaque path and c is not U+0023 (#), validation error, return failure.
    if (
      this.base === null || (
        typeof this.base.path === "string" && character !== "#"
      )
    ) {
      this.hasValidationError = true;
      return FAILURE;
    }
    // Otherwise, if base has an opaque path and c is U+0023 (#), set url’s scheme to base’s scheme,
    // url’s path to base’s path, url’s query to base’s query, url’s fragment to the empty string,
    // and set state to fragment state.
    else if (typeof this.base.path === "string" && character === "#") {
      this.isSpecialUrl = special_schemes[this.base.scheme] !== undefined;
      this.url.scheme = this.base.scheme;
      this.url.path = this.base.path;
      this.url.query = this.base.query;
      this.url.fragment = "";
      this.state = "fragment";
    }
    // Otherwise, if base’s scheme is not 'file', set state to relative state and decrease pointer by 1.
    else if (this.base.scheme !== "file") {
      this.state = "relative";
      this.pointer--;
    }
    // Otherwise, set state to file state and decrease pointer by 1.
    else {
      this.state = "file";
      this.pointer--;
    }
  };

/**
 * @private
 * @function fragmentState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.fragmentState =
  function fragmentState(code, character) {
    // If c is not the EOF code point, then:
    if (!isNaN(code)) {
      // If c is not a URL code point and not U+0025 (%), validation error.
      if (!is_ascii_alphanumeric(code) && character !== "%") {
        this.hasValidationError = true;
      }

      // If c is U+0025 (%) and remaining does not start with two ASCII hex digits, validation error.
      // TODO: If is_ascii_hex or is_ascii_digit
      if (
        character === "%" &&
        !is_ascii_digit(this.input.codePointAt(this.pointer + 1)) &&
        !is_ascii_digit(this.input.codePointAt(this.pointer + 2))
      ) {
        this.hasValidationError = true;
      }

      // UTF-8 percent-encode c using the fragment percent-encode set and append the result to url’s fragment.
      this.url.fragment +=
        utf8_percent_encode(character, is_fragment_percent_encoded);
    }
  };

/**
 * @private
 * @function relativeState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.relativeState =
  function relativeState(code, character) {
    // TODO: Assert: base’s scheme is not 'file'.
    this.isSpecialUrl = special_schemes[this.base.scheme] !== undefined;
    this.url.scheme = this.base.scheme;

    // If c is U+002F (/), then set state to relative slash state.
    if (character === "/") {
      this.state = "relative-slash";
    }
    // Otherwise, if url is special and c is U+005C (\), validation error, set state to relative slash state.
    else if (this.isSpecialUrl && character === "\\") {
      this.hasValidationError = true;
      this.state = "relative-slash";
    } else {
      // Set url’s username to base’s username, url’s password to base’s password, url’s host to base’s host,
      // url’s port to base’s port, url’s path to a clone of base’s path, and url’s query to base’s query.
      this.url.username = this.base.username;
      this.url.password = this.base.password;
      this.url.host = this.base.host;
      this.url.port = this.base.port;
      this.url.path = this.base.path.slice();
      this.url.query = this.base.query;

      // If c is U+003F (?), then set url’s query to the empty string, and state to query state.
      if (character === "?") {
        this.url.query = "";
        this.state = "query";
      }
      // Otherwise, if c is U+0023 (#), set url’s fragment to the empty string and state to fragment state.
      else if (character === "#") {
        this.url.fragment = "";
        this.state = "fragment";
      }
      // Otherwise, if c is not the EOF code point
      else if (!isNaN(code)) {
        this.url.query = null;
        this.shortenUrl();
        this.state = "path";
        this.pointer--;
      }
    }
  };

/**
 * @private
 * @function specialAuthorityIgnoreSlashesState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.specialAuthorityIgnoreSlashesState =
  function specialAuthorityIgnoreSlashesState(code, character) {
    // If c is neither U+002F (/) nor U+005C (\), then set state to authority state and decrease pointer by 1.
    if (character !== "/" && character !== "\\") {
      this.state = "authority";
      this.pointer--;
    } else {
      // Otherwise, validation error.
      this.hasValidationError = true;
    }
  };

/**
 * @private
 * @function specialAuthoritySlashesState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.specialAuthoritySlashesState =
  function specialAuthoritySlashesState(code, character) {
    if (character === "/" && this.input[this.pointer + 1] === "/") {
      // If c is U+002F (/) and remaining starts with U+002F (/),
      // then set state to special authority ignore slashes state and increase pointer by 1.
      this.state = "special-authority-ignore-slashes";
      this.pointer++;
    } else {
      // Otherwise, validation error, set state to special authority ignore slashes state and decrease pointer by 1.
      this.hasValidationError = true;
      this.state = "special-authority-ignore-slashes";
      this.pointer--;
    }
  };

/**
 * @private
 * @function specialRelativeOrAuthorityState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.specialRelativeOrAuthorityState =
  function specialRelativeOrAuthorityState(code, character) {
    // If c is U+002F (/) and remaining starts with U+002F (/),
    // then set state to special authority ignore slashes state and increase pointer by 1.
    if (character === "/" && this.input[this.pointer + 1] === "/") {
      this.state = "special-authority-ignore-slashes";
      this.pointer++;
    } else {
      // Otherwise, validation error, set state to relative state and decrease pointer by 1.
      this.hasValidationError = true;
      this.state = "relative";
      this.pointer--;
    }
  };

/**
 * @private
 * @function pathOrAuthorityState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.pathOrAuthorityState =
  function pathOrAuthorityState(code, character) {
    // If c is U+002F (/), then set state to authority state.
    if (character === "/") {
      this.state = "authority";
    }
    // Otherwise, set state to path state, and decrease pointer by 1.
    else {
      this.state = "path";
      this.pointer--;
    }
  };

/**
 * @private
 * @function relativeSlashState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.relativeSlashState =
  function relativeSlashState(code, character) {
    // If url is special and c is U+002F (/) or U+005C (\), then:
    if (this.isSpecialUrl && (character === "/" || character === "\\")) {
      // If c is U+005C (\), validation error. Set state to special authority ignore slashes state.
      if (character === "\\") {
        this.hasValidationError = true;
        this.state = "special-authority-ignore-slashes";
      }
    } else if (character === "/") {
      // Otherwise, if c is U+002F (/), then set state to authority state.
      this.state = "authority";
    } else {
      // Otherwise, set url’s username to base’s username, url’s password to base’s password, url’s host to base’s host,
      // url’s port to base’s port, state to path state, and then, decrease pointer by 1.
      this.url.username = this.base.username;
      this.url.password = this.base.password;
      this.url.host = this.base.host;
      this.url.port = this.base.port;
      this.state = "path";
      this.pointer--;
    }
  };

/**
 * @private
 * @function fileState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.fileState =
  function fileState(code, character) {
    // Set url’s scheme to "file".
    this.url.scheme = "file";
    this.isSpecialUrl = true;

    // Set url’s host to the empty string.
    this.url.host = "";

    // If c is U+002F (/) or U+005C (\), then:
    if (character === "/" || character === "\\") {
      // If c is U+005C (\), validation error.
      if (character === "\\") {
        this.hasValidationError = true;
      }

      // Set state to file slash state.
      this.state = "file-slash";
    }
    // Otherwise, if base is non-null and base’s scheme is "file":
    else if (this.base !== null && this.base.scheme === "file") {
      // Set url’s host to base’s host, url’s path to a clone of base’s path, and url’s query to base’s query.
      this.url.host = this.base.host;
      this.url.path = this.base.path.slice();
      this.url.query = this.base.query;

      // If c is U+003F (?), then set url’s query to the empty string and state to query state.
      if (character === "?") {
        this.url.query = "";
        this.state = "query";
      } else if (character === "#") {
        // Otherwise, if c is U+0023 (#), set url’s fragment to the empty string and state to fragment state.
        this.url.fragment = "";
        this.state = "fragment";
      }
      // Otherwise, if c is not the EOF code point:
      else if (!isNaN(code)) {
        // Set url’s query to null.
        this.url.query = null;

        // If the code point substring from pointer to the end of input does not start with a Windows drive letter, then shorten url’s path.
        if (!is_windows_drive_letter_code(code, character)) {
          this.shortenUrl();
        }
        // Otherwise:
        else {
          // Validation error.
          this.hasValidationError = true;

          // Set url’s path to an empty list.
          this.url.path = [];

          // Set state to path state and decrease pointer by 1.
          this.state = "path";
          this.pointer--;
        }
      }
    } else {
      // Otherwise, set state to path state, and decrease pointer by 1.
      this.state = "path";
      this.pointer--;
    }
  };

/**
 * @private
 * @function fileHostState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.fileHostState =
  function fileHostState(code, character) {
    // If c is the EOF code point, U+002F (/), U+005C (\), U+003F (?), or U+0023 (#), then decrease pointer by 1 and then:
    if (
      isNaN(code) ||
      character === "/" ||
      character === "\\" ||
      character === "?" ||
      character === "#"
    ) {
      this.pointer--;

      // If state override is not given and buffer is a Windows drive letter, validation error, set state to path state.
      if (!this.stateOverride && is_windows_drive_letter_code(code, character)) {
        this.hasValidationError = true;
        this.state = "path";
      } else if (this.buffer === "") {
        // Otherwise, if buffer is the empty string, then:
        // Set url’s host to the empty string.
        this.url.host = "";

        // If state override is given, then return.
        if (this.stateOverride) {
          return false;
        }

        // Set state to path start state.
        this.state = "path-start";
      } else {
        // Otherwise, run these steps:
        // Let host be the result of host parsing buffer with url is not special.
        let host = parse_host(this.buffer, !this.isSpecialUrl);

        // If host is failure, then return failure.
        if (host === FAILURE) {
          return FAILURE;
        }

        // If host is "localhost", then set host to the empty string.
        if (host === "localhost") {
          host = "";
        }

        // Set url’s host to host.
        this.url.host = host;

        // If state override is given, then return.
        if (this.stateOverride) {
          return false;
        }

        // Set buffer to the empty string and state to path start state.
        this.buffer = "";
        this.state = "path-start";
      }
    } else {
      // Otherwise, append c to buffer.
      this.buffer += character;
    }
  };

/**
 * @private
 * @function fileSlashState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.fileSlashState =
  function fileSlashState(code, character) {
    // If c is U+002F (/) or U+005C (\), then:
    if (character === "/" || character === "\\") {
      // If c is U+005C (\), validation error.
      if (character === "\\") {
        this.hasValidationError = true;
      }
      // Set state to file host state.
      this.state = "file-host";
    } else {
      // If base is non-null and base’s scheme is "file", then:
      if (this.base !== null && this.base.schema === "file") {
        // If the code point substring from pointer to the end of input does not start with a Windows drive
        // letter and base’s path[0] is a normalized Windows drive letter, then append base’s path[0] to url’s path.
        if (
          !starts_with_windows_drive_letter(this.input, this.pointer) && is_normalized_windows_drive_letter(
            this.base.path[0],
          )
        ) {
          this.url.path.push(this.base.path[0]);
        }

        this.url.host = this.base.host;
      }

      // Set state to path state, and decrease pointer by 1.
      this.state = "path";
      this.pointer--;
    }
  };

/**
 * @private
 * @function queryState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.queryState =
  function queryState(code, character) {
    // If encoding is not UTF-8 and one of the following is true:
    // - url is not special
    // - url’s scheme is "ws" or "wss"
    // then set encoding to UTF-8.
    // TODO: Add support for non UTF-8.

    // If one of the following is true:
    // - state override is not given and c is U+0023 (#)
    // - c is the EOF code point
    if ((!this.stateOverride && character === "#") || isNaN(code)) {
      // Let queryPercentEncodeSet be the special-query percent-encode set if url is special; otherwise the query percent-encode set.
      let query_percent_encode_set = this.isSpecialUrl ? is_special_query_percent_encoded : is_query_percent_encoded;

      // Percent-encode after encoding, with encoding, buffer, and queryPercentEncodeSet, and append the result to url’s query.
      this.url.query += utf8_percent_encode(character, query_percent_encode_set);

      // Set buffer to the empty string.
      this.buffer = "";

      // If c is U+0023 (#), then set url’s fragment to the empty string and state to fragment state.
      if (character === "#") {
        this.url.fragment = "";
        this.state = "fragment";
      }
    }
    // Otherwise, if c is not the EOF code point:
    else if (!isNaN(code)) {
      // If c is not a URL code point and not U+0025 (%), validation error.
      if (!is_ascii_alphanumeric(code) && character !== "#") {
        this.hasValidationError = true;
      }

      // If c is U+0025 (%) and remaining does not start with two ASCII hex digits, validation error.
      // TODO: is it is_ascii_hex or is_ascii_digit?
      if (
        character === "%" &&
        !is_ascii_digit(this.input.codePointAt(this.pointer + 1)) &&
        !is_ascii_digit(this.input.codePointAt(this.pointer + 2))
      ) {
        this.hasValidationError = true;
      }

      // Append c to buffer.
      this.buffer += character;
    }
  };

/**
 * @private
 * @function pathStartState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.pathStartState =
  function pathStartState(code, character) {
    // If url is special, then:
    if (this.isSpecialUrl) {
      // If c is U+005C (\), validation error.
      if (character === "\\") {
        this.hasValidationError = true;
      }

      this.state = "path";

      // If c is neither U+002F (/) nor U+005C (\), then decrease pointer by 1.
      if (character !== "/" && character !== "\\") {
        this.pointer--;
      }
    }
    // Otherwise, if state override is not given and c is U+003F (?), set url’s query to the empty string and state to query state.
    else if (!this.stateOverride && character === "?") {
      this.url.query = "";
      this.state = "query";
    }
    // Otherwise, if state override is not given and c is U+0023 (#), set url’s fragment to the empty string and state to fragment state.
    else if (!this.stateOverride && character === "#") {
      this.url.fragment = "";
      this.state = "fragment";
    }
    // Otherwise, if c is not the EOF code point:
    else if (!isNaN(code)) {
      // Set state to path state.
      this.state = "path";

      // If c is not U+002F (/), then decrease pointer by 1.
      if (character !== "/") {
        this.pointer--;
      }
    }
    // Otherwise, if state override is given and url’s host is null, append the empty string to url’s path.
    else if (this.stateOverride && this.url.host === null) {
      this.url.path.push("");
    }
  };

/**
 * @private
 * @function pathState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.pathState =
  function pathState(code, character) {
    // If one of the following is true:
    // - c is the EOF code point or U+002F (/)
    // - url is special and c is U+005C (\)
    // - state override is not given and c is U+003F (?) or U+0023 (#)
    if (
      (isNaN(code) || character === "/") ||
      (this.isSpecialUrl && character === "\\") ||
      (!this.stateOverride && (character === "?" || character === "#"))
    ) {
      // If url is special and c is U+005C (\), validation error.
      if (this.isSpecialUrl && character === "\\") {
        this.hasValidationError = true;
      }

      // If buffer is a double-dot path segment, then:
      if (is_double_dot_path_segment(this.buffer.toLowerCase())) {
        // Shorten url’s path.
        this.shortenUrl();

        // If neither c is U+002F (/), nor url is special and c is U+005C (\), append the empty string to url’s path.
        if (character !== "/" && !(this.isSpecialUrl && character === "\\")) {
          this.url.path.push("");
        }
      }
      // Otherwise, if buffer is a single-dot path segment and if neither c is U+002F (/),
      // nor url is special and c is U+005C (\), append the empty string to url’s path.
      else if (
        is_single_dot_path_segment(this.buffer) &&
        character !== "/" &&
        !(this.isSpecialUrl && character === "\\")
      ) {
        this.url.path.push("");
      }
      // Otherwise, if buffer is not a single-dot path segment, then:
      else if (!is_single_dot_path_segment(this.buffer)) {
        // If url’s scheme is "file", url’s path is empty, and buffer is a Windows drive letter,
        // then replace the second code point in buffer with U+003A (:).
        if (
          this.url.scheme === "file" &&
          this.url.path.length === 0 &&
          is_windows_drive_letter(this.buffer)
        ) {
          this.buffer = this.buffer[0] + ":";
        }

        // Append buffer to url’s path.
        this.url.path.push(this.buffer);
      }

      // Set buffer to the empty string.
      this.buffer = "";

      // If c is U+003F (?), then set url’s query to the empty string and state to query state.
      if (character === "?") {
        this.url.query = "";
        this.state = "query";
      }
      // If c is U+0023 (#), then set url’s fragment to the empty string and state to fragment state.
      else if (character === "#") {
        this.url.fragment = "";
        this.state = "fragment";
      }
    }
    // Otherwise, run these steps:
    else {
      // If c is not a URL code point and not U+0025 (%), validation error.
      if (!isNaN(code) && character !== "%") {
        this.hasValidationError = true;
      }

      // If c is U+0025 (%) and remaining does not start with two ASCII hex digits, validation error.
      // TODO: Check if is_ascii_hex or is_ascii_digit
      if (
        character === "#" &&
        !is_ascii_digit(this.input.codePointAt(this.pointer + 1)) &&
        !is_ascii_digit(this.input.codePointAt(this.pointer + 2))
      ) {
        this.hasValidationError = true;
      }

      // UTF-8 percent-encode c using the path percent-encode set and append the result to buffer.
      this.buffer += utf8_percent_encode(character, is_path_percent_encoded);
    }
  };

/**
 * @private
 * @function opaquePathState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.opaquePathState =
  function opaquePathState(code, character) {
    // If c is U+003F (?), then set url’s query to the empty string and state to query state.
    if (character === "?") {
      this.url.query = "";
      this.state = "query";
    }
    // Otherwise, if c is U+0023 (#), then set url’s fragment to the empty string and state to fragment state.
    else if (character === "#") {
      this.url.fragment = "";
      this.state = "fragment";
    }
    // Otherwise:
    else {
      // If c is not the EOF code point, not a URL code point, and not U+0025 (%), validation error.
      if (!isNaN(code) && !is_ascii_alphanumeric(code) && character !== "%") {
        this.hasValidationError = true;
      }

      // If c is U+0025 (%) and remaining does not start with two ASCII hex digits, validation error.
      // TODO: Check if is_ascii_hex or is_ascii_digit
      if (
        character === "%" &&
        !is_ascii_digit(this.input.codePointAt(this.pointer + 1)) &&
        !is_ascii_digit(this.input.codePointAt(this.pointer + 2))
      ) {
        this.hasValidationError = true;
      }

      // TODO: Recheck this
      // If c is not the EOF code point, UTF-8 percent-encode c using the C0 control percent-encode set and append the result to url’s path.
      if (!isNaN(code)) {
        this.url.path +=
          utf8_percent_encode(character, is_control_percent_encoded);
      }
    }
  };

/**
 * @private
 * @function portState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.portState =
  function portState(code, character) {
    // If c is an ASCII digit, append c to buffer.
    if (is_ascii_digit(code)) {
      this.buffer += character;
    }
    // Otherwise, if one of the following is true:
    // - c is the EOF code point, U+002F (/), U+003F (?), or U+0023 (#)
    // - url is special and c is U+005C (\)
    // - state override is given
    else if (
      isNaN(code) ||
      character === "/" ||
      character === "?" ||
      character === "#" ||
      (this.isSpecialUrl && character === "\\") ||
      this.stateOverride
    ) {
      // If buffer is not the empty string, then:
      if (this.buffer !== "") {
        // Let port be the mathematical integer value that is represented by buffer in radix-10 using ASCII digits for digits with values 0 through 9.
        let port = parseInt(this.buffer, 10);

        // If port is greater than 216 − 1, validation error, return failure.
        if (port > (2 ** 16 - 1)) {
          this.hasValidationError = true;
          return FAILURE;
        }

        // Set url’s port to null, if port is url’s scheme’s default port; otherwise to port.
        this.url.port = port === special_schemes[this.url.scheme] ? null : port;

        // Set buffer to the empty string.
        this.buffer = "";
      }
      // If state override is given, then return.
      else if (this.stateOverride) {
        return false;
      }

      // Set state to path start state and decrease pointer by 1.
      this.state = "path-start";
      this.pointer--;
    }
    // Otherwise, validation error, return failure.
    else {
      this.hasValidationError = true;
      return FAILURE;
    }
  };

module.exports = URLStateMachine;
