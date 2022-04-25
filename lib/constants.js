/* jshint esversion: 8 */
/* jshint node: true */

"use strict";
module.exports =
  {
    FAILURE: 999,
    State: {
      AUTHORITY: 100,
      SCHEME_START: 101,
      SCHEME: 102,
      HOST: 103,
      NO_SCHEME: 104,
      FRAGMENT: 105,
      RELATIVE: 106,
      RELATIVE_SLASH: 107,
      FILE: 108,
      FILE_HOST: 109,
      FILE_SLASH: 110,
      PATH_OR_AUTHORITY: 111,
      SPECIAL_AUTHORITY_IGNORE_SLASHES: 112,
      SPECIAL_AUTHORITY_SLASHES: 113,
      SPECIAL_RELATIVE_OR_AUTHORITY: 114,
      QUERY: 115,
      PATH: 116,
      PATH_START: 117,
      OPAQUE_PATH: 118,
      PORT: 119,
    },
  };
