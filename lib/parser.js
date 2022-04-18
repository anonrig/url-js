"use strict";
const tr46 = require("tr46");
const net = require("net");
const { FAILURE } = require("./constants");
const {
  percent_decode,
  utf8_percent_encode_string,
  is_ascii_hex,
  is_ascii_digit,
} = require("./string");
const { is_control_percent_encoded } = require("./encoding");
const utf8_decoder = new TextDecoder("utf-8", { ignoreBOM: true });

/**
 * @function ends_with_a_number
 * @param {string} input
 * @returns {boolean}
 */
function ends_with_a_number(input) {
  // Let parts be the result of strictly splitting input on U+002E (.).
  const parts = input.split(".");

  // If the last item in parts is the empty string, then:
  if (parts[parts.length - 1] === "") {
    // If parts’s size is 1, then return false.
    if (parts.length === 1) {
      return false;
    }

    // Remove the last item from parts.
    parts.pop();
  }

  // Let last be the last item in parts.
  const last = parts[parts.length - 1];

  // If parsing last as an IPv4 number does not return failure, then return true.
  if (last !== "" && parse_ipv4_number(last) !== FAILURE) {
    return true;
  }

  // If last is non-empty and contains only ASCII digits, then return true.
  return /^[0-9]+$/u.test(last);
}

/**
 * @function parse_ipv6
 * @description [Specification]{@link https://url.spec.whatwg.org/#concept-ipv6-parser}
 * @param {string} input
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
        /** @typedef {number=} */
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
 * @param {string} input
 */
function parse_ipv4(input) {
  // TODO: Implement this
  if (!net.isIPv4(input)) {
    return FAILURE;
  }

  return input;
}

/**
 * @function parse_ipv4_number
 * @param {string} input Non-empty (length > 0) input string
 * @returns {number|FAILURE}
 */
function parse_ipv4_number(input) {
  let R = 10;

  if (input.toLowerCase().startsWith("0x")) {
    input = input.substring(2);
    R = 16;
  } else if (input[0] === "0") {
    input = input.substring(1);
    R = 8;
  }

  if (input === "") {
    return 0;
  }

  let regex = /[^0-7]/u;
  if (R === 10) {
    regex = /[^0-9]/u;
  }
  if (R === 16) {
    regex = /[^0-9A-Fa-f]/u;
  }

  if (regex.test(input)) {
    return FAILURE;
  }

  return parseInt(input, R);
}

/**
 * @function parse_opaque_host
 * @param {string} buffer
 */
function parse_opaque_host(buffer) {
  if (
    buffer.search(
      /\u0000|\u0009|\u000A|\u000D|\u0020|#|\/|:|<|>|\?|@|\[|\\|\]|\^|\|/u,
    ) !== -1
  ) {
    return FAILURE;
  }

  return utf8_percent_encode_string(buffer, is_control_percent_encoded);
}

/**
 * @function domain_to_ascii
 * @param {string} domain
 * @param {boolean=} [be_strict=false] be_strict
 * @returns {string|FAILURE}
 */
function domain_to_ascii(domain, be_strict = false) {
  const result = tr46.toASCII(
    domain,
    {
      checkBidi: true,
      checkHyphens: false,
      checkJoiners: true,
      useSTD3ASCIIRules: be_strict,
      verifyDNSLength: be_strict,
    },
  );
  if (result === null || result === "") {
    return FAILURE;
  }

  return result;
}

/**
 * @function parse_host
 * @description [Official Specification]{@link https://url.spec.whatwg.org/#host-parsing}
 * @param {string} buffer
 * @param {boolean=} [is_not_url_special=false] is_not_url_special
 * @returns {string|symbol}
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

  // TODO: Assert: input is not the empty string.
  // Let domain be the result of running UTF-8 decode without BOM on the percent-decoding of input.
  const domain = utf8_decoder.decode(percent_decode(buffer));
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
