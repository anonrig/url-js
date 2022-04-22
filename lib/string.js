/* jshint esversion: 8 */
/* jshint node: true */

"use strict";
// TODO: https://github.com/denoland/deno/pull/3596/files#diff-5cf956277018e46ffe39bc9cf4780f0e5c0e73e40aca8f3f6f7b7eb899446db7
const text_encoder = new TextEncoder();

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
 * @param {number} code_point
 * @returns {boolean}
 */
function is_ascii_alpha(code_point) {
  return (code_point >= 0x41 && code_point <= 0x5A) || (
    code_point >= 0x61 && code_point <= 0x7A
  );
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
 * @param {string} input
 * @param {(code: number, character: string) => string} predicate
 * @returns {string}
 */
function utf8_percent_encode(input, predicate) {
  const bytes = text_encoder.encode(input);
  let encoded_output = "";

  for (const byte of bytes) {
    let character = String.fromCodePoint(byte);
    let code_point = character.codePointAt(0);
    if (!predicate(code_point, character)) {
      encoded_output += character;
    } else {
      encoded_output += percent_encode(code_point);
    }
  }

  return encoded_output;
}

/**
 * @function utf8_percent_encode_string
 * @param {string} input
 * @param {(code: number, character: string) => string} predicate
 * @param {boolean} [space_as_plus=false] space_as_plus
 * @returns {string}
 */
function utf8_percent_encode_string(input, predicate, space_as_plus = false) {
  let output = "";
  for (const character of input) {
    if (space_as_plus && character === " ") {
      output += "+";
    } else {
      output += utf8_percent_encode(character, predicate);
    }
  }
  return output;
}

/**
 * @function percent_encode
 * @param {number} code
 * @returns {string}
 */
function percent_encode(code) {
  const hex = code.toString(16).toUpperCase();

  if (hex.length === 1) {
    return `0${hex}`;
  }

  return `%${hex}`;
}

/**
 * @function percent_decode_bytes
 * @param {Uint8Array} input
 * @returns {Uint8Array}
 */
function percent_decode_bytes(input) {
  const output = new Uint8Array(input.byteLength);
  let outputIndex = 0;
  for (let i = 0; i < input.byteLength; ++i) {
    if (input[i] !== 0x25) {
      output[outputIndex++] = input[i];
    } else if (
      input[i] === 0x25 && (
        !is_ascii_hex(input[i + 1]) || !is_ascii_hex(input[i + 2])
      )
    ) {
      output[outputIndex++] = input[i];
    } else {
      output[outputIndex++] =
        parseInt(String.fromCodePoint(input[i + 1], input[i + 2]), 16);
      i += 2;
    }
  }

  return output.slice(0, outputIndex);
}

/**
 * @function percent_decode
 * @param {string} input
 * @returns {Uint8Array}
 */
function percent_decode(input) {
  const bytes = text_encoder.encode(input);
  return percent_decode_bytes(bytes);
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
    percent_decode,
  };
