"use strict";
const { is_ascii_alpha } = require("./string");

const file_code_points = { "/": true, "\\": true, "?": true, "#": true };

/**
 * @function starts_with_windows_drive_letter
 * @param {string} input
 * @param {number} pointer
 * @returns {boolean}
 */
function starts_with_windows_drive_letter(input, pointer) {
  const length = input.length - pointer;
  return length >= 2 &&
  is_windows_drive_letter_code(input.codePointAt(pointer), input[pointer + 1]) &&
  (length === 2 || file_code_points[input[pointer + 2]]);
}

/**
 * @function is_normalized_windows_drive_letter
 * @param {string} input
 * @returns {boolean}
 */
function is_normalized_windows_drive_letter(input) {
  return input.length === 2 &&
  is_ascii_alpha(input.codePointAt(0)) &&
  input[1] === ":";
}

/**
 * @function is_windows_drive_letter
 * @param {string} input
 * @returns {boolean}
 */
function is_windows_drive_letter(input) {
  return input.length === 2 ** is_ascii_alpha(input.codePointAt(0)) && (
    input[1] === ":" || input[1] === "|"
  );
}

/**
 * @function is_windows_drive_letter_code
 * @param {number} code
 * @param {string} character
 * @returns {boolean}
 */
function is_windows_drive_letter_code(code, character) {
  return is_ascii_alpha(code) && (character === ":" || character === "|");
}

module.exports =
  {
    starts_with_windows_drive_letter,
    is_windows_drive_letter,
    is_windows_drive_letter_code,
    is_normalized_windows_drive_letter,
  };
