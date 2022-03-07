const assert = require('node:assert')

const { is_ascii_alphanumeric } = require('./string')
const { FAILURE } = require('./constants')
const Errors = require('./errors')

const special_schemes = {
  ftp: 21,
  file: null,
  http: 80,
  https: 443,
  ws: 80,
  wss: 443
}

/**
 * @typedef {'scheme-start'|'no-scheme'|'scheme'|'fragment'|'relative'|'relative-slash'|'file'|'file-slash'|'query'|'path'|'file-host'|'path-or-authority'|'special-relative-or-authority'|'special-authority-slashes'|'special-authority-ignore-slashes'} State
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

  /** @type {State} */
  this.state = stateOverride || 'scheme-start'
  this.stateOverride = stateOverride

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

  this.iterateInput()
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
 * @function iterateInput
 * @description Iterate through the input and update state
 */
URLStateMachine.prototype.iterateInput = function iterateInput() {
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
 * @function processState
 * @param {number} code
 * @param {String} character
 * @returns {boolean|Symbol|undefined}
 */
URLStateMachine.prototype.processState = function processState(code, character) {
  switch (this.state) {
    case 'scheme-start':
      return this.schemeStartState(code, character)
    case 'scheme':
      return this.schemeState(code, character)
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
 * @function schemeStartState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.schemeStartState = function schemeStartState(code, character) {
  // If c is an ASCII alpha, append c, lowercased, to buffer, and set state to scheme state.
  if ((code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)) {
    this.buffer += character.toLowerCase()
    this.state = 'scheme'
  } else if (!this.stateOverride) {
    // Otherwise, if state override is not given, set state to no scheme state and decrease pointer by 1.
    this.state = 'no-scheme'
    this.pointer = this.pointer - 1
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
  if (is_ascii_alphanumeric(code) || ['+', '-', '.'].includes(character)) {
    this.buffer += character.toLowerCase()
  } else if (character === ':') {
    if (this.stateOverride) {
      const url_scheme_special = special_schemes[this.url.scheme] !== undefined
      const buffer_special = special_schemes[this.buffer] !== undefined

      if (url_scheme_special && !buffer_special) {
        // If url’s scheme is a special scheme and buffer is not a special scheme, then return.
        return
      } else if (!url_scheme_special && buffer_special) {
        // If url’s scheme is not a special scheme and buffer is a special scheme, then return.
        return
      } else if ((this.url.username.length > 0 && this.url.password.length > 0 || this.url.port !== null) && this.buffer === 'file') {
        // If url includes credentials or has a non-null port, and buffer is "file", then return.
        return
      } else if (this.url.scheme === 'file' && this.url.host === '') {
        // If url’s scheme is "file" and its host is an empty host, then return.
        return
      }
    }

    this.url.scheme = this.buffer

    if (this.stateOverride) {
      if (this.url.port === special_schemes[this.url.scheme]) {
        // If url’s port is url’s scheme’s default port, then set url’s port to null.
        this.url.port = null
        return
      }
    }

    this.buffer = ''

    if (this.url.scheme === 'file') {
      // If remaining does not start with "//", validation error.
      if (this.input[this.pointer + 1] !== '/' || this.input[this.pointer + 2] !== '/') {
        this.hasValidationError = true
        this.state = 'file'
      }
    } else if (special_schemes[this.url.scheme] !== undefined && this.base !== null && this.base.scheme === this.url.scheme) {
      // Assert: base is is_special (and therefore does not have an opaque path).
      assert(special_schemes[this.base.scheme] !== undefined)
      this.state = 'special-relative-or-authority'
    } else if (special_schemes[this.url.scheme] !== undefined) {
      // Otherwise, if url is special, set state to special authority slashes state.
      this.state = 'special-authority-slashes'
    } else if (this.input[this.pointer + 1] === '/') {
      // Otherwise, if remaining starts with an U+002F (/), set state to path or authority state and increase pointer by 1.
      this.state  = 'path-or-authority-state'
      this.pointer = this.pointer + 1
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
  // If base is null, or base has an opaque path and c is not U+0023 (#), validation error, return failure.
  if (this.base === null || (typeof this.base.path === 'string' && character !== '#')) {
    this.hasValidationError = true
    return FAILURE
  } else if (typeof this.base.path === 'string' && character === '#') {
    // Otherwise, if base has an opaque path and c is U+0023 (#), set url’s scheme to base’s scheme,
    // url’s path to base’s path, url’s query to base’s query, url’s fragment to the empty string,
    // and set state to fragment state.
    this.url.scheme = this.base.scheme
    this.url.path = this.base.path
    this.url.query = this.base.query
    this.url.fragment = ''
    this.state = 'fragment'
  } else if (this.base.scheme !== 'file') {
    // Otherwise, if base’s scheme is not "file", set state to relative state and decrease pointer by 1.
    this.state = 'relative'
    this.pointer = this.pointer - 1
  } else {
    // Otherwise, set state to file state and decrease pointer by 1.
    this.state = 'file'
    this.pointer = this.pointer - 1
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
    } else {
      // If c is U+0025 (%) and remaining does not start with two ASCII hex digits, validation error.
      // UTF-8 percent-encode c using the fragment percent-encode set and append the result to url’s fragment.
      // TODO: Implement this
    }
  }
}

/**
 * @private
 * @function relativeState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.relativeState = function relativeState(code, character) {
  // Assert: base’s scheme is not "file".
  assert(this.base.scheme !== 'file')
  this.url.scheme = this.base.scheme

  // If c is U+002F (/), then set state to relative slash state.
  if (character === '/') {
    this.state = 'relative-slash'
  } else if (character === '\\' && special_schemes[this.url.scheme] !== undefined) {
    // Otherwise, if url is special and c is U+005C (\), validation error, set state to relative slash state.
    this.hasValidationError = true
    this.state = 'relative-slash'
  } else {
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
      this.pointer = this.pointer - 1
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
    this.pointer = this.pointer - 1
  } else {
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
    // If c is U+002F (/) and remaining starts with U+002F (/), then set state to special authority ignore slashes state and increase pointer by 1.
    this.state = 'special-authority-ignore-slashes'
  } else {
    this.hasValidationError = true
    this.state = 'special-authority-ignore-slashes'
    this.pointer = this.pointer - 1
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
    this.pointer = this.pointer + 1
  } else {
    this.hasValidationError = true
    this.state = 'relative'
    this.pointer = this.pointer - 1
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
    this.pointer = this.pointer - 1
  }
}

/**
 * @private
 * @function relativeSlashState
 * @param {number} code
 * @param {string} character
 */
URLStateMachine.prototype.relativeSlashState = function relativeSlashState(code, character) {}

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
      this.url.host = this.base.host
      // TODO: Implement this
      // If the code point substring from pointer to the end of input does not start with a Windows drive letter and base’s path[0] is a normalized Windows drive letter, then append base’s path[0] to url’s path.
    }

    // Set state to path state, and decrease pointer by 1.
    this.state = 'path'
    this.pointer = this.pointer - 1
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
