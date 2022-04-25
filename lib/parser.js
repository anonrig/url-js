/* jshint esversion: 8 */
/* jshint node: true */

"use strict";
const { domainToASCII } = require("node:url");
const { FAILURE } = require("./constants");
const {
  percent_decode,
  utf8_percent_encode_string,
  is_ascii_hex,
  is_ascii_digit,
} = require("./string");
const { is_control_percent_encoded } = require("./encoding");
const { decode_utf8 } = require("./utf8");

/**
 * @function ends_with_a_number
 * @param {string} input
 * @returns {boolean}
 */
function ends_with_a_number(input) {
  // Let parts be the result of strictly splitting input on U+002E (.).
  const last_point = input.lastIndexOf(".");

  // Let last be the last item in parts.
  let last = input.substring(last_point + 1, input.length);

  // If the last item in parts is the empty string, then:
  if (last_point === (input.length - 1)) {
    let previous_point = input.lastIndexOf(".", last_point - 1);

    // If part's size is 1, then return false.
    if (previous_point === last_point) {
      return false;
    }

    // Remove the last item from parts.
    last = input.substring(previous_point + 1, last_point - 1);
  }

  // If parsing last as an IPv4 number does not return failure, then return true.
  if (parse_ipv4_number(last) !== FAILURE) {
    return true;
  }

  // If last is non-empty and contains only ASCII digits, then return true.
  return /^[0-9]+$/u.test(last);
}

/**
 * @function parse_ipv6
 * @description [Specification]{@link https://url.spec.whatwg.org/#concept-ipv6-parser}
 * @param {string} input
 * @returns {number[]|Symbol}
 */
function parse_ipv6(input) {
  let address = [0, 0, 0, 0, 0, 0, 0, 0];
  let piece_index = 0;
  let compress = null;
  let pointer = 0;

  // If c is U+003A (:), then:
  if (input[pointer] === ":") {
    // If remaining does not start with U+003A (:), validation error, return failure.
    if (input[pointer + 1] !== ":") {
      return FAILURE;
    }

    // Increase pointer by 2.
    pointer += 2;

    // Increase pieceIndex by 1 and then set compress to pieceIndex.
    piece_index += 1;
    compress = piece_index;
  }

  // While c is not the EOF code point:
  while (pointer < input.length) {
    // If pieceIndex is 8, validation error, return failure.
    if (piece_index === 8) {
      return FAILURE;
    }

    // If c is U+003A (:), then:
    if (input[pointer] === ":") {
      // If compress is non-null, validation error, return failure.
      if (compress !== null) {
        return FAILURE;
      }

      // Increase pointer and pieceIndex by 1, set compress to pieceIndex, and then continue.
      pointer += 1;
      piece_index += 1;
      compress = piece_index;
      continue;
    }

    // Let value and length be 0.
    let value = 0;
    let length = 0;

    // While length is less than 4 and c is an ASCII hex digit,
    // set value to value × 0x10 + c interpreted as hexadecimal number, and increase pointer and length by 1.
    while (length < 4 && is_ascii_hex(input.codePointAt(pointer))) {
      value = (value * 0x10) + parseInt(input[pointer], 16);
      pointer++;
      length++;
    }

    // If c is U+002E (.), then:
    if (input[pointer] === ".") {
      // If length is 0, validation error, return failure.
      if (length === 0) {
        return FAILURE;
      }

      // Decrease pointer by length.
      pointer -= length;

      // If pieceIndex is greater than 6, validation error, return failure.
      if (piece_index > 6) {
        return FAILURE;
      }

      // Let numbersSeen be 0.
      let numbers_seen = 0;

      // While c is not the EOF code point:
      while (input[pointer] !== undefined) {
        // Let ipv4Piece be null.
        /** @type {number|null} */
        let ipv4_piece = null;

        // If numbersSeen is greater than 0, then:
        if (numbers_seen > 0) {
          // If c is a U+002E (.) and numbersSeen is less than 4, then increase pointer by 1.
          if (input[pointer] === "." && numbers_seen < 4) {
            pointer++;
          }
          // Otherwise, validation error, return failure.
          else {
            return FAILURE;
          }
        }

        // If c is not an ASCII digit, validation error, return failure.
        if (!is_ascii_digit(input.codePointAt(pointer))) {
          return FAILURE;
        }

        // While c is an ASCII digit:
        while (is_ascii_digit(input.codePointAt(pointer))) {
          // Let number be c interpreted as decimal number.
          let number = parseInt(input[pointer]);

          // If ipv4Piece is null, then set ipv4Piece to number.
          if (ipv4_piece === null) {
            ipv4_piece = number;
          }
          // Otherwise, if ipv4Piece is 0, validation error, return failure.
          else if (ipv4_piece === 0) {
            return FAILURE;
          }
          // Otherwise, set ipv4Piece to ipv4Piece × 10 + number.
          else {
            ipv4_piece = (ipv4_piece * 10) + number;
          }

          // If ipv4Piece is greater than 255, validation error, return failure.
          if (ipv4_piece > 255) {
            return FAILURE;
          }

          pointer++;
        }

        // Set address[pieceIndex] to address[pieceIndex] × 0x100 + ipv4Piece.
        address[piece_index] = (address[piece_index] * 0x100) + ipv4_piece;

        // Increase numbersSeen by 1.
        numbers_seen++;

        // If numbersSeen is 2 or 4, then increase pieceIndex by 1.
        if (numbers_seen === 2 || numbers_seen === 4) {
          piece_index++;
        }
      }

      // If numbersSeen is not 4, validation error, return failure.
      if (numbers_seen !== 4) {
        return FAILURE;
      }

      break;
    }
    // Otherwise, if c is U+003A (:):
    else if (input[pointer] === ":") {
      // Increase pointer by 1.
      pointer++;

      // If c is the EOF code point, validation error, return failure.
      if (input[pointer] === undefined) {
        return FAILURE;
      }
    }
    // Otherwise, if c is not the EOF code point, validation error, return failure.
    else if (input[pointer] !== undefined) {
      return FAILURE;
    }

    // Set address[pieceIndex] to value.
    address[piece_index] = value;

    // Increase pieceIndex by 1.
    piece_index++;
  }

  // If compress is non-null, then:
  if (compress !== null) {
    // Let swaps be pieceIndex − compress.
    let swaps = piece_index - compress;

    // Set pieceIndex to 7.
    piece_index = 7;

    // While pieceIndex is not 0 and swaps is greater than 0, swap address[pieceIndex] with address[compress + swaps − 1],
    // and then decrease both pieceIndex and swaps by 1.
    while (piece_index !== 0 && swaps > 0) {
      const temp = address[compress + swaps - 1];
      address[compress + swaps - 1] = address[piece_index];
      address[piece_index] = temp;
      piece_index--;
      swaps--;
    }
  }
  // Otherwise, if compress is null and pieceIndex is not 8, validation error, return failure.
  else if (piece_index !== 8) {
    return FAILURE;
  }

  // Return address
  return address;
}

/**
 * @function parse_ipv4
 * @description [Specification]{@link https://url.spec.whatwg.org/#concept-ipv4-parser}
 * @param {string} input
 * @returns {string|Symbol}
 */
function parse_ipv4(input) {
  // Let parts be the result of strictly splitting input on U+002E (.).
  let parts = input.split(".");

  // If the last item in parts is the empty string, then:
  if (parts[parts.length - 1] === "") {
    // If parts’s size is greater than 1, then remove the last item from parts.
    if (parts.length > 1) {
      parts.pop();
    }
  }

  // If parts’s size is greater than 4, validation error, return failure.
  if (parts.length > 4) {
    return FAILURE;
  }

  // Let numbers be an empty list.
  let numbers = [];

  // For each part of parts:
  for (let i = 0; i < parts.length; i++) {
    // Let result be the result of parsing part.
    let result = parse_ipv4_number(parts[i]);

    // If result is failure, validation error, return failure.
    if (result === FAILURE) {
      return FAILURE;
    }

    // If any item in numbers is greater than 255, validation error.
    // If any but the last item in numbers is greater than 255, then return failure.
    if (result > 255) {
      return FAILURE;
    }

    // Append result[0] to numbers.
    numbers.push(result);
  }

  // If the last item in numbers is greater than or equal to 256(5 − numbers’s size), validation error, return failure.
  if (numbers[numbers.length - 1] >= 256 ** (5 - numbers.length)) {
    return FAILURE;
  }

  // Let ipv4 be the last item in numbers.
  // Remove the last item from numbers.
  let ipv4 = numbers.pop();

  // Let counter be 0.
  for (let i = 0; i < numbers.length; i++) {
    // Increment ipv4 by n × 256(3 − counter).
    ipv4 += numbers[i] * 256 ** (3 - i);
  }

  return ipv4;
}

/**
 * @function parse_ipv4_number
 * @description [Specification]{@link https://url.spec.whatwg.org/#ipv4-number-parser}
 * @param {string} input Non-empty (length > 0) input string
 * @returns {number|Symbol}
 */
function parse_ipv4_number(input) {
  // Let R be 10.
  let R = 10;

  // If input contains at least two code points and the first two code points are either "0X" or "0x", then:
  if (input.length >= 2 && (input.startsWith("0X") || input.startsWith("0x"))) {
    // Remove the first two code points from input.
    input = input.substring(2);

    // Set R to 16.
    R = 16;
  }
  // Otherwise, if input contains at least two code points and the first code point is U+0030 (0), then:
  else if (input.length >= 2 && input[0] === "0") {
    // Remove the first code point from input.
    input = input.substring(1);

    // Set R to 8.
    R = 8;
  }

  // If input is the empty string, then return (0, true).
  if (input === "") {
    return 0;
  }

  let regex = /[^0-7]/u;

  if (R === 10) {
    regex = /[^0-9]/u;
  } else if (R === 16) {
    regex = /[^0-9A-Fa-f]/u;
  }

  // If input contains a code point that is not a radix-R digit, then return failure.
  if (regex.test(input)) {
    return FAILURE;
  }

  // Let output be the mathematical integer value that is represented by input in radix-R notation, using ASCII
  // hex digits for digits with values 0 through 15.
  return parseInt(input, R);
}

/**
 * @function parse_opaque_host
 * @description [Specification]{@link https://url.spec.whatwg.org/#concept-opaque-host-parser}
 *
 * A forbidden host code point is U+0000 NULL, U+0009 TAB, U+000A LF, U+000D CR, U+0020 SPACE, U+0023 (#), U+002F (/),
 * U+003A (:), U+003C (<), U+003E (>), U+003F (?), U+0040 (@), U+005B ([), U+005C (\), U+005D (]), U+005E (^), or U+007C (|).
 *
 * @param {string} buffer
 * @returns {string|Symbol}
 */
function parse_opaque_host(buffer) {
  // If input contains a forbidden host code point, validation error, return failure.
  if (
    buffer.search(
      /\u0000|\u0009|\u000A|\u000D|\u0020|#|\/|:|<|>|\?|@|\[|\\|\]|\^|\|/u,
    ) !== -1
  ) {
    return FAILURE;
  }

  // Return the result of running UTF-8 percent-encode on input using the C0 control percent-encode set.
  return utf8_percent_encode_string(buffer, is_control_percent_encoded);
}

/**
 * @function domain_to_ascii
 * @param {string} domain
 * @returns {string|Symbol}
 */
function domain_to_ascii(domain) {
  let result = domainToASCII(domain);

  if (result === "") {
    return FAILURE;
  }

  return result;
}

/**
 * @function parse_host
 * @description [Official Specification]{@link https://url.spec.whatwg.org/#host-parsing}
 * @param {string} buffer
 * @param {boolean=} [is_not_url_special=false] is_not_url_special
 * @returns {string|symbol|number[]}
 */
function parse_host(buffer, is_not_url_special = false) {
  // If input starts with U+005B ([), then:
  if (buffer[0] === "[") {
    // If input does not end with U+005D (]), validation error, return failure.
    if (buffer[buffer.length - 1] !== "]") {
      return FAILURE;
    }

    // Return the result of IPv6 parsing input with its leading U+005B ([) and trailing U+005D (]) removed.
    return parse_ipv6(buffer.substring(1, buffer.length - 1));
  }

  // If isNotSpecial is true, then return the result of opaque-host parsing input.
  if (is_not_url_special) {
    return parse_opaque_host(buffer);
  }

  // Let domain be the result of running UTF-8 decode without BOM on the percent-decoding of input.
  const domain = decode_utf8(percent_decode(buffer));
  const ascii_domain = domain_to_ascii(domain);

  // If asciiDomain is failure, validation error, return failure.
  if (ascii_domain === FAILURE) {
    return FAILURE;
  }

  // If asciiDomain contains a forbidden domain code point, validation error, return failure.
  if (
    ascii_domain.search(
      /\u0000|\u0009|\u000A|\u000D|\u0020|#|\/|:|<|>|\?|@|\[|\\|\]|\^|\|/u,
    ) !== -1 || ascii_domain.search(/[\u0000-\u001F]|%|\u007F/u) !== -1
  ) {
    return FAILURE;
  }

  // If asciiDomain ends in a number, then return the result of IPv4 parsing asciiDomain.
  if (ends_with_a_number(ascii_domain)) {
    return parse_ipv4(ascii_domain);
  }

  return ascii_domain;
}

module.exports = { parse_host };
