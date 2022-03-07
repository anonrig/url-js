/**
 * @function is_ascii_alpha
 * @param {number} code
 * @returns {boolean}
 */
function is_ascii_alpha(code) {
  return (code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)
}

/**
 * @function is_ascii_digit
 * @param {number} code
 * @returns {boolean}
 */
function is_ascii_digit(code) {
  return code >= 0x30 && code <= 0x39;
}

/**
 * @function is_ascii_alphanumeric
 * @param {number} code
 * @returns {boolean}
 */
function is_ascii_alphanumeric(code) {
  return is_ascii_alpha(code) || is_ascii_digit(code)
}

module.exports = {
  is_ascii_alpha,
  is_ascii_digit,
  is_ascii_alphanumeric,
}
