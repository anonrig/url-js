/* jshint esversion: 8 */
/* jshint node: true */

"use strict";
const { encode_utf8 } = require("./utf8");

/**
 * @function is_double_dot_path_segment
 * @description A double-dot path segment must be ".." or an ASCII case-insensitive match for ".%2e", "%2e.", or "%2e%2e".
 * @param {string} input
 * @returns {boolean}
 */
function is_double_dot_path_segment(input) {
  return input === ".." ||
  input === "%2e." ||
  input === ".%2e" ||
  input === "%2e%2e";
}

/**
 * @function is_single_dot_path_segment
 * @description A single-dot path segment must be "." or an ASCII case-insensitive match for "%2e".
 * @param {string} input
 * @returns {boolean}
 */
function is_single_dot_path_segment(input) {
  return input === "." || input.toLowerCase() === "%2e";
}

/**
 * @function
 * @description An ASCII alpha is an ASCII upper alpha or ASCII lower alpha.
 * @param {number} code
 * @returns {boolean}
 */
function is_ascii_alpha(code) {
  return (code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A);
}

/**
 * @function is_ascii_digit
 * @description An ASCII digit is a code point in the range U+0030 (0) to U+0039 (9), inclusive.
 * @param {number} code_point
 * @returns {boolean}
 */
function is_ascii_digit(code_point) {
  return code_point >= 0x30 && code_point <= 0x39;
}

/**
 * @function is_ascii_alphanumeric
 * @description An ASCII alphanumeric is an ASCII digit or ASCII alpha.
 * @param {number} code_point
 * @returns {boolean}
 */
function is_ascii_alphanumeric(code_point) {
  return is_ascii_digit(code_point) || is_ascii_alpha(code_point);
}

/**
 * @function is_ascii_hex
 * @description
 * An ASCII upper hex digit is an ASCII digit or a code point in the range U+0041 (A) to U+0046 (F), inclusive.
 * An ASCII lower hex digit is an ASCII digit or a code point in the range U+0061 (a) to U+0066 (f), inclusive.
 *
 * @param {number} code
 * @returns {boolean}
 */
function is_ascii_hex(code) {
  return is_ascii_digit(code) ||
  (code >= 0x41 && code <= 0x46) ||
  (code >= 0x61 && code <= 0x66);
}

/**
 * @function utf8_percent_encode
 * @param {number} input
 * @param {(code: number) => string} predicate
 * @returns {string}
 */
function utf8_percent_encode(input, predicate) {
  const bytes = encode_utf8(input ? String.fromCodePoint(input) : "");
  let encoded_output = "";

  for (const byte of bytes) {
    if (!predicate(byte)) {
      encoded_output += String.fromCodePoint(byte);
    } else {
      encoded_output += percent_encode(byte);
    }
  }

  return encoded_output;
}

/**
 * @function utf8_percent_encode_string
 * @param {string} input
 * @param {(code: number) => string} predicate
 * @returns {string}
 */
function utf8_percent_encode_string(input, predicate) {
  let output = "";
  for (let i = 0; i < input.length; i++) {
    output += utf8_percent_encode(input.codePointAt(i), predicate);
  }
  return output;
}

/**
 * @function percent_encode
 * @description To percent-encode a byte byte, return a string consisting of U+0025 (%), followed by two ASCII upper hex digits representing byte.
 * [Specification]{@link https://url.spec.whatwg.org/#percent-encode}
 * @param {number} code
 * @returns {string}
 */
function percent_encode(code) {
  const hex = code.toString(16).toUpperCase();

  if (hex.length === 1) {
    return `%0${hex}`;
  }

  return `%${hex}`;
}

module.exports =
  {
    is_double_dot_path_segment,
    is_single_dot_path_segment,
    is_ascii_alpha,
    is_ascii_digit,
    is_ascii_hex,
    is_ascii_alphanumeric,
    utf8_percent_encode,
    utf8_percent_encode_string,
  };
