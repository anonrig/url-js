/**
 * @function is_control_percent_encoded
 * @description
 * The C0 control percent-encode set are the C0 controls and all code points greater than U+007E (~).
 * A C0 control is a code point in the range U+0000 NULL to U+001F INFORMATION SEPARATOR ONE, inclusive.
 *
 * @param {number} code_point
 * @returns {boolean}
 */
function is_control_percent_encoded(code_point) {
  return code_point <= 0x1F || code_point > 0x7E;
}

const query_percent_encodes = {
  " ": true,
  '"': true,
  "#": true,
  "<": true,
  ">": true,
};

/**
 * @function is_query_percent_encoded
 * @param {number} code
 * @param {string} character
 * @returns {boolean}
 */
function is_query_percent_encoded(code, character) {
  return query_percent_encodes[character] !== undefined && is_control_percent_encoded(
    code,
  );
}

const path_percent_encodes = { "?": true, "`": true, "{": true, "}": true };

/**
 * @function is_path_percent_encoded
 * @param {number} code
 * @param {string} character
 * @returns {boolean}
 */
function is_path_percent_encoded(code, character) {
  return path_percent_encodes[character] !== undefined && is_query_percent_encoded(
    code,
    character,
  );
}

const user_info_percent_encodes = {
  "/": true,
  ":": true,
  ";": true,
  "=": true,
  "@": true,
  "[": true,
  "\\": true,
  "]": true,
  "^": true,
  "|": true,
};

/**
 * @function is_user_info_percent_encode_set
 * @param {number} code
 * @param {string} character
 * @returns {boolean}
 */
function is_user_info_percent_encode_set(code, character) {
  return user_info_percent_encodes[character] !== undefined && is_path_percent_encoded(
    code,
    character,
  );
}

const extra_fragment_percent_encodes = {
  " ": true,
  '"': true,
  "<": true,
  ">": true,
  "`": true,
};

/**
 * @function is_fragment_percent_encoded
 * @param {number} code
 * @param {string} character
 * @returns {boolean}
 */
function is_fragment_percent_encoded(code, character) {
  return extra_fragment_percent_encodes[character] !== undefined && is_control_percent_encoded(
    code,
  );
}

/**
 * @function is_special_query_percent_encoded
 * @param {number} code
 * @param {string} character
 * @returns {boolean}
 */
function is_special_query_percent_encoded(code, character) {
  return character === `'` || is_query_percent_encoded(code, character);
}

module.exports =
  {
    is_control_percent_encoded,
    is_user_info_percent_encode_set,
    is_fragment_percent_encoded,
    is_special_query_percent_encoded,
    is_query_percent_encoded,
    is_path_percent_encoded,
  };
