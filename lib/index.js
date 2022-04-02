const assert = require('node:assert')

const { is_ascii_alphanumeric, utf8_percent_encode, is_ascii_hex, is_ascii_alpha} = require('./string')
const { FAILURE } = require('./constants')
const Errors = require('./errors')
const { starts_with_windows_drive_letter, is_normalized_windows_drive_letter } = require('./platform')
const { is_user_info_percent_encode_set } = require("./encoding")
const { parse_host } = require("./parser")

const special_schemes = {
  ftp: 21,
  file: null,
  http: 80,
  https: 443,
  ws: 80,
  wss: 443
}

/**
 * @typedef {'authority'|'scheme-start'|'no-scheme'|'scheme'|'fragment'|'relative'|'relative-slash'|'file'|'file-slash'|'query'|'path'|'file-host'|'path-or-authority'|'special-relative-or-authority'|'special-authority-slashes'|'special-authority-ignore-slashes'} State
 *
 * @class
 * @public
 * @constructor
 * @param {string} input
 * @param {string=} base
 * @param {State=} stateOverride
 */
function URLStateMachine(input, base, stateOverride) {
  if (!input || typeof input !== 'string') {
    throw Errors.INVALID_ARGUMENT
  }

  this.hasValidationError = false
  this.buffer = ''
  this.atSignSeen = false
  this.insideBrackets = false
  this.passwordTokenSeen = false
  this.pointer = 0
  this.failure = false

  // Always update this value when this.url.scheme is updated.
  this.isSpecialUrl = false

  /** @type {State} */
  this.state = stateOverride || 'scheme-start'
  this.stateOverride = stateOverride
  this.input = ''
  this.setInput(input)

  this.base = base ?? null
  this.url = {
    scheme: '',
    username: '',
    password: '',
    host: null,
    port: null,
    path: [],
    query: null,
    fragment: null,
  }

  while (this.pointer < this.input.length) {
    const character = this.input[this.pointer]
    const code = this.input[this.pointer].codePointAt(0)
    const result = this.processState(code, character)

    if (result === FAILURE) {
      this.failure = true
      break
    } else if (result === false) {
      break
    }

    this.pointer++
  }
}

/**
 * @private
 * @function setInput
 * @description Sanitize the input and set it internally
 * @param {string} input
 */
URLStateMachine.prototype.setInput = function setInput(input) {
  // If input contains any leading or trailing C0 control or space, validation error.
  const control_space_removed = input.replace(/[\u0000-\u001F\u007F-\u009F]/g, '')

  if (control_space_removed !== input) {
    this.hasValidationError = true
  }

  // If input contains any ASCII tab or newline, validation error.
  const tab_newline_removed = control_space_removed.replace(/[\u0009\u000A\u000D]/ug, '')

  if (control_space_removed !== tab_newline_removed) {
    this.hasValidationError = true
  }

  this.input = tab_newline_removed
}

/**
 * @private
 * @function processState
 * @param {number} code
 * @param {String} character
 * @returns {boolean|Symbol|undefined}
 */
URLStateMachine.prototype.processState = function processState(code, character) {
  switch (this.state) {
    case 'authority':
      return this.authorityState(code, character)
    case 'scheme-start':
      return this.schemeStartState(code, character)
    case 'scheme':
      return this.schemeState(code, character)
    case 'host':
    case 'hostname':
      return this.hostState(code, character)
    case 'no-scheme':
      return this.noSchemeState(code, character)
    case 'fragment':
      return this.fragmentState(code, character)
    case 'relative':
      return this.relativeState(code, character)
    case 'relative-slash':
      return this.relativeSlashState(code, character)
    case 'file':
      return this.fileState(code, character)
    case 'file-host':
      return this.fileHostState(code, character)
    case 'file-slash':
      return this.fileSlashState(code, character)
    case 'path-or-authority':
      return this.pathOrAuthorityState(code, character)
    case 'special-authority-ignore-slashes':
      return this.specialAuthorityIgnoreSlashesState(code, character)
    case 'special-authority-slashes':
      return this.specialAuthoritySlashesState(code, character)
    case 'special-relative-or-authority':
      return this.specialRelativeOrAuthorityState(code, character)
    case 'query':
      return this.queryState(code, character)
    case 'path':
      return this.pathState(code, character)
  }
}

/**
 * @private
 * @function authorityState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.authorityState = function authorityState(code, character) {
  // If c is U+0040 (@), then:
  if (character === '@') {
    this.hasValidationError = true

    // If atSignSeen is true, then prepend '%40' to buffer.
    if (this.atSignSeen) {
      this.buffer = '%40' + this.buffer
    }

    this.atSignSeen = true

    // For each codePoint in buffer:
    for (let i = 0; i < this.buffer.length; i++) {
      // If codePoint is U+003A (:) and passwordTokenSeen is false, then set passwordTokenSeen to true and continue.
      if (this.buffer[i] === ':' && !this.passwordTokenSeen) {
        this.passwordTokenSeen = true
        continue
      }

      // Let encodedCodePoints be the result of running UTF-8 percent-encode codePoint using the userinfo percent-encode set.
      const encoded_code_points = utf8_percent_encode(character, is_user_info_percent_encode_set)

      if (this.passwordTokenSeen) {
        // If passwordTokenSeen is true, then append encodedCodePoints to url’s password.
        this.url.password += encoded_code_points
      } else {
        // Otherwise, append encodedCodePoints to url’s username.
        this.url.username += encoded_code_points
      }
    }

    // Set buffer to the empty string.
    this.buffer = ''
  } else if (character === '/' || character === '?' || character === '#' || isNaN(code) || (this.isSpecialUrl && character === '\\')) {
    // Otherwise, if one of the following is true:
    // - c is the EOF code point, U+002F (/), U+003F (?), or U+0023 (#)
    // - url is special and c is U+005C (\)
    if (this.atSignSeen && this.buffer === '') {
      this.hasValidationError = true
      return FAILURE
    }
    this.pointer = this.pointer - this.buffer.length - 1
    this.buffer = ''
    this.state = 'host'
  } else {
    // Otherwise, append c to buffer.
    this.buffer += character
  }
}

/**
 * @private
 * @function hostState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.hostState = function hostState(code, character) {
  // If state override is given and url’s scheme is "file", then decrease pointer by 1 and set state to file host state.
  if (this.stateOverride && this.url.scheme === 'file') {
    this.pointer--
    this.state = 'file-host'
  } else if (character === ':' && !this.insideBrackets) {
    // Otherwise, if c is U+003A (:) and insideBrackets is false, then:
    if (this.buffer === '') {
      // If buffer is the empty string, validation error, return failure.
      this.hasValidationError = true
      return FAILURE
    }

    // If state override is given and state override is hostname state, then return.
    if (this.stateOverride === 'hostname') {
      return false
    }

    // Let host be the result of host parsing buffer with url is not special.
    const host = parse_host(this.buffer, !this.isSpecialUrl)

    // If host is failure, then return failure.
    if (host === FAILURE) {
      return FAILURE
    }

    // Set url’s host to host, buffer to the empty string, and state to port state.
    this.url.host = host
    this.buffer = ''
    this.state = 'port'
  } else if ((character === '/' || character === '?' || character === '#') || this.isSpecialUrl && character === '\\') {
    // Otherwise, if one of the following is true:
    // - c is the EOF code point, U+002F (/), U+003F (?), or U+0023 (#)
    // - url is special and c is U+005C (\)
    this.pointer--

    // If url is special and buffer is the empty string, validation error, return failure.
    if (this.isSpecialUrl && this.buffer === '') {
      this.hasValidationError = true
      return FAILURE
    } else if (this.stateOverride && this.buffer === '' && (this.url.port || this.url.username !== '' || this.url.password !== '')) {
      // Otherwise, if state override is given, buffer is the empty string, and either url includes credentials or url’s port is non-null, return.
      return false
    }

    const host = parse_host(this.buffer, !this.isSpecialUrl)

    if (host === FAILURE) {
      return FAILURE
    }

    // Set url’s host to host, buffer to the empty string, and state to path start state.
    this.url.host = host
    this.buffer = ''
    this.state = 'path-start'

    // If state override is given, then return.
    if (this.stateOverride) {
      return false
    }
  } else {
    // If c is U+005B ([), then set insideBrackets to true.
    if (character === '[') {
      this.insideBrackets = true
    } else if (character === ']') {
      // If c is U+005D (]), then set insideBrackets to false.
      this.insideBrackets = false
    }

    this.buffer += character
  }
}

/**
 * @private
 * @function schemeStartState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.schemeStartState = function schemeStartState(code, character) {
  // If c is an ASCII alpha, append c, lowercased, to buffer, and set state to scheme state.
  if (is_ascii_alpha(code)) {
    this.buffer += character.toLowerCase()
    this.state = 'scheme'
  } else if (!this.stateOverride) {
    // Otherwise, if state override is not given, set state to no scheme state and decrease pointer by 1.
    this.state = 'no-scheme'
    this.pointer--
  } else {
    // Otherwise, validation error, return failure.
    this.hasValidationError = true
    return FAILURE
  }
}

/**
 * @private
 * @function schemeState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.schemeState = function schemeState(code, character) {
  // If c is an ASCII alphanumeric, U+002B (+), U+002D (-), or U+002E (.), append c, lowercased, to buffer.
  if (is_ascii_alphanumeric(code) || (character === '+' || character === '-' || character === '.')) {
    this.buffer += character.toLowerCase()
  } else if (character === ':') {
    if (this.stateOverride) {
      const buffer_special = special_schemes[this.buffer] !== undefined

      if (this.isSpecialUrl && !buffer_special) {
        // If url’s scheme is a special scheme and buffer is not a special scheme, then return.
        return false
      } else if (!this.isSpecialUrl && buffer_special) {
        // If url’s scheme is not a special scheme and buffer is a special scheme, then return.
        return false
      } else if ((this.url.username.length > 0 && this.url.password.length > 0 || this.url.port !== null) && this.buffer === 'file') {
        // If url includes credentials or has a non-null port, and buffer is 'file', then return.
        return false
      } else if (this.url.scheme === 'file' && this.url.host === '') {
        // If url’s scheme is 'file' and its host is an empty host, then return.
        return false
      }
    }

    this.isSpecialUrl = special_schemes[this.buffer] !== undefined
    this.url.scheme = this.buffer

    if (this.stateOverride) {
      if (this.url.port === special_schemes[this.url.scheme]) {
        // If url’s port is url’s scheme’s default port, then set url’s port to null.
        this.url.port = null
        return false
      }
    }

    this.buffer = ''

    if (this.url.scheme === 'file') {
      // If remaining does not start with '//', validation error.
      if (this.input[this.pointer + 1] !== '/' || this.input[this.pointer + 2] !== '/') {
        this.hasValidationError = true
        this.state = 'file'
      }
    } else if (this.isSpecialUrl && this.base !== null && this.base.scheme === this.url.scheme) {
      // Assert: base is is_special (and therefore does not have an opaque path).
      assert(this.isSpecialUrl)
      this.state = 'special-relative-or-authority'
    } else if (this.isSpecialUrl) {
      // Otherwise, if url is special, set state to special authority slashes state.
      this.state = 'special-authority-slashes'
    } else if (this.input[this.pointer + 1] === '/') {
      // Otherwise, if remaining starts with an U+002F (/), set state to path or authority state and increase pointer by 1.
      this.state  = 'path-or-authority-state'
      this.pointer++
    }
  } else if (!this.stateOverride) {
    // Otherwise, if state override is not given, set buffer to the empty string, state to no scheme state, and start over (from the first code point in input).
    this.buffer = ''
    this.state = 'no-scheme'
    this.pointer = -1
  } else {
    this.hasValidationError = true
    return FAILURE
  }
}

/**
 * @private
 * @function noSchemeState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.noSchemeState = function noSchemeState(code, character) {
  const base_has_opaque_path = typeof this.base.path === 'string'

  // If base is null, or base has an opaque path and c is not U+0023 (#), validation error, return failure.
  if (this.base === null || (base_has_opaque_path && character !== '#')) {
    this.hasValidationError = true
    return FAILURE
  } else if (base_has_opaque_path && character === '#') {
    // Otherwise, if base has an opaque path and c is U+0023 (#), set url’s scheme to base’s scheme,
    // url’s path to base’s path, url’s query to base’s query, url’s fragment to the empty string,
    // and set state to fragment state.
    this.isSpecialUrl = special_schemes[this.base.scheme] !== undefined
    this.url.scheme = this.base.scheme
    this.url.path = this.base.path
    this.url.query = this.base.query
    this.url.fragment = ''
    this.state = 'fragment'
  } else if (this.base.scheme !== 'file') {
    // Otherwise, if base’s scheme is not 'file', set state to relative state and decrease pointer by 1.
    this.state = 'relative'
    this.pointer--
  } else {
    // Otherwise, set state to file state and decrease pointer by 1.
    this.state = 'file'
    this.pointer--
  }
}

/**
 * @private
 * @function fragmentState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.fragmentState = function fragmentState(code, character) {
  if (code && !Number.isNaN(code)) {
    // If c is not a URL code point and not U+0025 (%), validation error.
    if (character !== '%') {
      this.hasValidationError = true
    } else if (character === '%' && is_ascii_hex(this.input[this.pointer + 1].codePointAt(0)) && is_ascii_hex(this.input[this.pointer + 2].codePointAt(0))) {
      // If c is U+0025 (%) and remaining does not start with two ASCII hex digits, validation error.
      this.hasValidationError = true
    }

    // UTF-8 percent-encode c using the fragment percent-encode set and append the result to url’s fragment.
    this.url.fragment += utf8_percent_encode(character, isFragmentPercentEncode) // TODO
  }
}

/**
 * @private
 * @function relativeState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.relativeState = function relativeState(code, character) {
  // Assert: base’s scheme is not 'file'.
  assert(this.base.scheme !== 'file')

  this.isSpecialUrl = special_schemes[this.base.scheme] !== undefined
  this.url.scheme = this.base.scheme

  // If c is U+002F (/), then set state to relative slash state.
  if (character === '/') {
    this.state = 'relative-slash'
  } else if ( this.isSpecialUrl && character === '\\') {
    // Otherwise, if url is special and c is U+005C (\), validation error, set state to relative slash state.
    this.hasValidationError = true
    this.state = 'relative-slash'
  } else {
    // Set url’s username to base’s username, url’s password to base’s password, url’s host to base’s host,
    // url’s port to base’s port, url’s path to a clone of base’s path, and url’s query to base’s query.
    this.url.username = this.base.username
    this.url.password = this.base.password
    this.url.host = this.base.host
    this.url.port = this.base.port
    this.url.path = this.base.path.repeat(1)
    this.url.query = this.base.query

    // If c is U+003F (?), then set url’s query to the empty string, and state to query state.
    if (character === '?') {
      this.url.query = ''
      this.state = 'query'
    } else if (character === '#') {
      // Otherwise, if c is U+0023 (#), set url’s fragment to the empty string and state to fragment state.
      this.url.fragment = ''
      this.state = 'fragment'
    } else if (code && !Number.isNaN(code)) {
      // Otherwise, if c is not the EOF code point
      this.url.query = null
      this.url.path.pop()
      this.state = 'path'
      this.pointer--
    }
  }
}

/**
 * @private
 * @function specialAuthorityIgnoreSlashesState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.specialAuthorityIgnoreSlashesState = function specialAuthorityIgnoreSlashesState(code, character) {
  if (character !== '/' && character !== '\\') {
    // If c is neither U+002F (/) nor U+005C (\), then set state to authority state and decrease pointer by 1.
    this.state = 'authority'
    this.pointer--
  } else {
    // Otherwise, validation error.
    this.hasValidationError = true
  }
}

/**
 * @private
 * @function specialAuthoritySlashesState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.specialAuthoritySlashesState = function specialAuthoritySlashesState(code, character) {
  if (character === '/' && this.input[this.pointer + 1] === '/') {
    // If c is U+002F (/) and remaining starts with U+002F (/),
    // then set state to special authority ignore slashes state and increase pointer by 1.
    this.state = 'special-authority-ignore-slashes'
    this.pointer++
  } else {
    // Otherwise, validation error, set state to special authority ignore slashes state and decrease pointer by 1.
    this.hasValidationError = true
    this.state = 'special-authority-ignore-slashes'
    this.pointer--
  }
}

/**
 * @private
 * @function specialRelativeOrAuthorityState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.specialRelativeOrAuthorityState = function specialRelativeOrAuthorityState(code, character) {
  // If c is U+002F (/) and remaining starts with U+002F (/), then set state to special authority ignore slashes state and increase pointer by 1.
  if (character === '/' && this.input[this.pointer + 1] === '/') {
    this.state = 'special-authority-ignore-slashes'
    this.pointer++
  } else {
    // Otherwise, validation error, set state to relative state and decrease pointer by 1.
    this.hasValidationError = true
    this.state = 'relative'
    this.pointer--
  }
}

/**
 * @private
 * @function pathOrAuthorityState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.pathOrAuthorityState = function pathOrAuthorityState(code, character) {
  if (character === '/') {
    // If c is U+002F (/), then set state to authority state.
    this.state = 'authority'
  } else {
    // Otherwise, set state to path state, and decrease pointer by 1.
    this.state = 'path'
    this.pointer--
  }
}

/**
 * @private
 * @function relativeSlashState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.relativeSlashState = function relativeSlashState(code, character) {
  // If url is special and c is U+002F (/) or U+005C (\), then:
  if (this.isSpecialUrl && (character === '/' || character === '\\')) {
    // If c is U+005C (\), validation error. Set state to special authority ignore slashes state.
    if (character === '\\') {
      this.hasValidationError = true
      this.state = 'special-authority-ignore-slashes'
    }
  } else if (character === '/') {
    // Otherwise, if c is U+002F (/), then set state to authority state.
    this.state = 'authority'
  } else {
    // Otherwise, set url’s username to base’s username, url’s password to base’s password, url’s host to base’s host,
    // url’s port to base’s port, state to path state, and then, decrease pointer by 1.
    this.url.username = this.base.username
    this.url.password = this.base.password
    this.url.host = this.base.host
    this.url.port = this.base.port
    this.state = 'path'
    this.pointer--
  }
}

/**
 * @private
 * @function fileState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.fileState = function fileState(code, character) {}

/**
 * @private
 * @function fileHostState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.fileHostState = function fileHostState(code, character) {}

/**
 * @private
 * @function fileSlashState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.fileSlashState = function fileSlashState(code, character) {
  if (character === '/' || character === '\\') {
    if (character === '\\') {
      this.hasValidationError = true
    }
    // Set state to file host state.
    this.state = 'file-host'
  } else {
    if (this.base !== null && this.base.schema === 'file') {
      // If the code point substring from pointer to the end of input does not start with a Windows drive
      // letter and base’s path[0] is a normalized Windows drive letter, then append base’s path[0] to url’s path.
      if (!starts_with_windows_drive_letter(this.input, this.pointer) && is_normalized_windows_drive_letter(this.base.path[0])) {
        this.url.path.push(this.base.path[0])
      }

      this.url.host = this.base.host
    }

    // Set state to path state, and decrease pointer by 1.
    this.state = 'path'
    this.pointer--
  }
}

/**
 * @private
 * @function queryState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.queryState = function queryState(code, character) {}

/**
 * @private
 * @function pathState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.pathState = function pathState(code, character) {}

module.exports = URLStateMachine
