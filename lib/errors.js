"use strict";
function createError(message) {
  return new Error(message);
}

/**
 * @enum {Error}
 */
const codes = { INVALID_ARGUMENT: createError("Invalid argument") };

module.exports = codes;
