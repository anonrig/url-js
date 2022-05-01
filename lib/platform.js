/* jshint esversion: 8 */
/* jshint node: true */

"use strict";
const { is_ascii_alpha } = require("./string");

const file_code_points = { "/": true, "\\": true, "?": true, "#": true };

/**
 * @function starts_with_windows_drive_letter
 * @description A string starts with a Windows drive letter if all the following are true:
 * - its length is greater than or equal to 2
 * - its first two code points are a Windows drive letter
 * - its length is 2 or its third code point is U+002F (/), U+005C (\), U+003F (?), or U+0023 (#).
 *
 * @param {string} input
 * @param {number} pointer
 * @returns {boolean}
 */
function starts_with_windows_drive_letter(input, pointer) {
  const length = input.length - pointer;
  return length >= 2 &&
  is_windows_drive_letter(input[pointer] + input[pointer + 1]) &&
  (length === 2 || file_code_points[input[pointer + 2]] !== undefined);
}

/**
 * @function is_normalized_windows_drive_letter
 * @description A normalized Windows drive letter is a Windows drive letter of which the second code point is U+003A (:).
 * @param {string} input
 * @returns {boolean}
 */
function is_normalized_windows_drive_letter(input) {
  return input[1] === ":" && is_windows_drive_letter(input);
}

/**
 * @function is_windows_drive_letter
 * @description A Windows drive letter is two code points, of which the first is an ASCII alpha and
 * the second is either U+003A (:) or U+007C (|).
 * @param {string} input
 * @returns {boolean}
 */
function is_windows_drive_letter(input) {
  return input.length === 2 &&
  is_ascii_alpha(input.codePointAt(0)) &&
  (input[1] === ":" || input[1] === "|");
}

module.exports =
  {
    starts_with_windows_drive_letter,
    is_windows_drive_letter,
    is_normalized_windows_drive_letter,
  };
