/* jshint esversion: 8 */
/* jshint node: true */

"use strict";
/**
 * @function is_control_percent_encoded
 * @description
 * The C0 control percent-encode set are the C0 controls and all code points greater than U+007E (~).
 * A C0 control is a code point in the range U+0000 NULL to U+001F INFORMATION SEPARATOR ONE, inclusive.
 *
 * [Specification]{@link https://url.spec.whatwg.org/#c0-control-percent-encode-set}
 *
 * @param {number} code_point
 * @returns {boolean}
 */
function is_control_percent_encoded(code_point) {
  return code_point <= 0x1F || code_point > 0x7E;
}

const query_percent_encodes = {
  " ": true,
  '"': true,
  "#": true,
  "<": true,
  ">": true,
};

/**
 * @function is_query_percent_encoded
 * [Specification]{@link https://url.spec.whatwg.org/#query-percent-encode-set}
 * @param {number} code
 * @param {string} character
 * @returns {boolean}
 */
function is_query_percent_encoded(code, character) {
  return query_percent_encodes[character] !== undefined || is_control_percent_encoded(
    code,
  );
}

const path_percent_encodes = { "?": true, "`": true, "{": true, "}": true };

/**
 * @function is_path_percent_encoded
 * @description The path percent-encode set is the query percent-encode set and U+003F (?), U+0060 (`), U+007B ({), and U+007D (}).
 * [Specification]{@link https://url.spec.whatwg.org/#path-percent-encode-set}
 * @param {number} code
 * @param {string} character
 * @returns {boolean}
 */
function is_path_percent_encoded(code, character) {
  return path_percent_encodes[character] !== undefined || is_query_percent_encoded(
    code,
    character,
  );
}

const user_info_percent_encodes = {
  "/": true,
  ":": true,
  ";": true,
  "=": true,
  "@": true,
  "[": true,
  "^": true,
  "\\": true,
  "]": true,
  "|": true,
};

/**
 * @function is_userinfo_percent_encoded
 * @description The userinfo percent-encode set is the path percent-encode set and U+002F (/), U+003A (:), U+003B (;),
 * U+003D (=), U+0040 (@), U+005B ([) to U+005E (^), inclusive, and U+007C (|).
 * @param {number} code
 * @param {string} character
 * @returns {boolean}
 */
function is_userinfo_percent_encoded(code, character) {
  return user_info_percent_encodes[character] !== undefined || is_path_percent_encoded(
    code,
    character,
  );
}

const extra_fragment_percent_encodes = {
  " ": true,
  '"': true,
  "<": true,
  ">": true,
  "`": true,
};

/**
 * @function is_fragment_percent_encoded
 * [Specification]{@link https://url.spec.whatwg.org/#fragment-percent-encode-set}
 *
 * @param {number} code
 * @param {string} character
 * @returns {boolean}
 */
function is_fragment_percent_encoded(code, character) {
  return extra_fragment_percent_encodes[character] !== undefined || is_control_percent_encoded(
    code,
  );
}

/**
 * @function is_special_query_percent_encoded
 * [Specification]{@link https://url.spec.whatwg.org/#special-query-percent-encode-set}
 * @param {number} code
 * @param {string} character
 * @returns {boolean}
 */
function is_special_query_percent_encoded(code, character) {
  return character === `'` || is_query_percent_encoded(code, character);
}

module.exports =
  {
    is_control_percent_encoded,
    is_userinfo_percent_encoded,
    is_fragment_percent_encoded,
    is_special_query_percent_encoded,
    is_query_percent_encoded,
    is_path_percent_encoded,
  };
