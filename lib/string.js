const text_encoder = new TextEncoder()

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
  return code >= 0x30 && code <= 0x39
}

/**
 * @function is_ascii_alphanumeric
 * @param {number} code
 * @returns {boolean}
 */
function is_ascii_alphanumeric(code) {
  return is_ascii_alpha(code) || is_ascii_digit(code)
}

/**
 * @function is_ascii_hex
 * @param {number} code
 * @returns {boolean}
 */
function is_ascii_hex(code) {
  return is_ascii_digit(code) || (code >= 0x41 && code <= 0x46) || (code >= 0x61 && code <= 0x66)
}

/**
 * @function utf8_percent_encode
 * @param {string} character
 * @param {(code: number, character: string) => string} predicate
 * @returns {string}
 */
function utf8_percent_encode(character, predicate) {
  const bytes = text_encoder.encode(character)
  let encoded_output = ''

  for (let i = 0; i < bytes.length; i++) {
    if (!predicate(bytes[i], String.fromCharCode(bytes[i]))) {
      encoded_output += String.fromCharCode(bytes[i])
    } else {
      encoded_output += percent_encode(bytes[i])
    }
  }

  return encoded_output
}

/**
 * @function percent_encode
 * @param {number} code
 * @returns {string}
 */
function percent_encode(code) {
  const hex = code.toString(16).toUpperCase()

  if (hex.length === 1) {
    return `0${hex}`
  }

  return `%${hex}`
}

function percent_decode_bytes(input) {
  const output = new Uint8Array(input.byteLength)
  let outputIndex = 0
  for (let i = 0; i < input.byteLength; ++i) {
    if (input[i] !== 0x25) {
      output[outputIndex++] = input[i]
    } else if (input[i] === 0x25 && (!is_ascii_hex(input[i + 1]) || !is_ascii_hex(input[i + 2]))) {
      output[outputIndex++] = input[i]
    } else {
      output[outputIndex++] = parseInt(String.fromCodePoint(input[i + 1], input[i + 2]), 16)
      i += 2
    }
  }

  return output.slice(0, outputIndex)
}

function percent_decode(input) {
  const bytes = text_encoder.encode(input)
  return percent_decode_bytes(bytes)
}

module.exports = {
  is_ascii_alpha,
  is_ascii_digit,
  is_ascii_hex,
  is_ascii_alphanumeric,
  utf8_percent_encode,
  percent_encode,
  percent_decode,
}
