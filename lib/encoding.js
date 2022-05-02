/* jshint esversion: 8 */
/* jshint node: true */

"use strict";
/**
 * @function is_c0_control_percent_encoded
 * @description
 * The C0 control percent-encode set are the C0 controls and all code points greater than U+007E (~).
 * A C0 control is a code point in the range U+0000 NULL to U+001F INFORMATION SEPARATOR ONE, inclusive.
 *
 * [Specification]{@link https://url.spec.whatwg.org/#c0-control-percent-encode-set}
 *
 * @param {number} code_point
 * @returns {boolean}
 */
function is_c0_control_percent_encoded(code_point) {
  return code_point <= 0x1F || code_point > 0x7E;
}

const query_percent_encodes = {
  0x20: true,
  0x22: true,
  0x23: true,
  0x3C: true,
  0x3E: true,
};

/**
 * @function is_query_percent_encoded
 * @description The query percent-encode set is the C0 control percent-encode set and U+0020 SPACE, U+0022 ("),
 * U+0023 (#), U+003C (<), and U+003E (>).
 * [Specification]{@link https://url.spec.whatwg.org/#query-percent-encode-set}
 * @param {number} code
 * @returns {boolean}
 */
function is_query_percent_encoded(code) {
  return typeof query_percent_encodes[code] !== "undefined" || is_c0_control_percent_encoded(
    code,
  );
}

const path_percent_encodes = { 0x3F: true, 0x60: true, 0x7B: true, 0x7D: true };

/**
 * @function is_path_percent_encoded
 * @description The path percent-encode set is the query percent-encode set and U+003F (?), U+0060 (`), U+007B ({), and U+007D (}).
 * [Specification]{@link https://url.spec.whatwg.org/#path-percent-encode-set}
 * @param {number} code
 * @returns {boolean}
 */
function is_path_percent_encoded(code) {
  return typeof path_percent_encodes[code] !== "undefined" || is_query_percent_encoded(
    code,
  );
}

const user_info_percent_encodes = {
  0x2F: true,
  0x3A: true,
  0x3B: true,
  0x3D: true,
  0x40: true,
  0x5B: true,
  0x5E: true,
  0x5C: true,
  0x5D: true,
  0x7C: true,
};

/**
 * @function is_userinfo_percent_encoded
 * @description The userinfo percent-encode set is the path percent-encode set and U+002F (/), U+003A (:), U+003B (;),
 * U+003D (=), U+0040 (@), U+005B ([) to U+005E (^), inclusive, and U+007C (|).
 * [Specification]{@link https://url.spec.whatwg.org/#userinfo-percent-encode-set}
 *
 * @param {number} code
 * @returns {boolean}
 */
function is_userinfo_percent_encoded(code) {
  return typeof user_info_percent_encodes[code] !== "undefined" || is_path_percent_encoded(
    code,
  );
}

const extra_fragment_percent_encodes = {
  0x20: true,
  0x22: true,
  0x3C: true,
  0x3E: true,
  0x60: true,
};

/**
 * @function is_fragment_percent_encoded
 * @description The fragment percent-encode set is the C0 control percent-encode set and U+0020 SPACE,
 * U+0022 ("), U+003C (<), U+003E (>), and U+0060 (`).
 * [Specification]{@link https://url.spec.whatwg.org/#fragment-percent-encode-set}
 *
 * @param {number} code
 * @returns {boolean}
 */
function is_fragment_percent_encoded(code) {
  return typeof extra_fragment_percent_encodes[code] !== "undefined" || is_c0_control_percent_encoded(
    code,
  );
}

/**
 * @function is_special_query_percent_encoded
 * [Specification]{@link https://url.spec.whatwg.org/#special-query-percent-encode-set}
 * @param {number} code
 * @returns {boolean}
 */
function is_special_query_percent_encoded(code) {
  return code === 39 || is_query_percent_encoded(code);
}

module.exports =
  {
    is_c0_control_percent_encoded,
    is_userinfo_percent_encoded,
    is_fragment_percent_encoded,
    is_special_query_percent_encoded,
    is_query_percent_encoded,
    is_path_percent_encoded,
  };
