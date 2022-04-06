const tr46 = require("tr46");
const net = require("net");
const { FAILURE } = require("./constants");
const { percent_decode, utf8_percent_encode } = require("./string");
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
 * @param {string} input
 */
function parse_ipv6(input) {
  // TODO: Implement this
  if (!net.isIPv6(input)) {
    return FAILURE;
  }

  return input;
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

  return utf8_percent_encode(buffer, is_control_percent_encoded);
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
