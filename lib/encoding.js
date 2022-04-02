/**
 * @function is_control_percent_encoded
 * @param {number} code
 * @returns {boolean}
 */
function is_control_percent_encoded(code) {
  return code <= 0x1F || code > 0x7E
}

const query_percent_encodes = { ' ': true, '"': true, '#': true, '<': true, '>': true }

/**
 * @function is_query_percent_encoded
 * @param {number} code
 * @param {string} character
 * @returns {boolean}
 */
function is_query_percent_encoded(code, character) {
  return query_percent_encodes[character] && is_control_percent_encoded(code)
}

const path_percent_encodes = { '?': true, '`': true, '{': true, '}': true }

/**
 * @function is_path_percent_encoded
 * @param {number} code
 * @param {string} character
 * @returns {boolean}
 */
function is_path_percent_encoded(code, character) {
  return is_query_percent_encoded(code, character) && path_percent_encodes[character]
}

const user_info_percent_encodes = {
  '/': true,
  ':': true,
  ';': true,
  '=': true,
  '@': true,
  '[': true,
  '\\': true,
  ']': true,
  '^': true,
  '|': true,
}

/**
 * @function is_user_info_percent_encode_set
 * @param {number} code
 * @param {string} character
 * @returns {boolean}
 */
function is_user_info_percent_encode_set(code, character) {
  return user_info_percent_encodes[character] && is_path_percent_encoded(code, character)
}

module.exports = {
  is_control_percent_encoded,
  is_query_percent_encoded,
  is_path_percent_encoded,
  is_user_info_percent_encode_set,
}
