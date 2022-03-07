const assert = require('node:assert')
const { FAILURE } = require('./constants')
const Errors = require('./errors')

const special_schemes = ['ftp', 'file', 'http', 'https', 'ws', 'wss']

/**
 * @typedef {'scheme-start'|'no-scheme'|'scheme'|'fragment'|'relative'|'relative-slash'|'file'|'file-slash'|'query'|'path'} State
 *
 * @class
 * @public
 */
class URLStateMachine {

  hasValidationError = false
  buffer = ''
  atSignSeen = false
  insideBrackets = false
  passwordTokenSeen = false
  pointer = 0
  failure = false

  /** @type {State} */
  state = 'scheme-start'

  /**
   * @constructor
   * @param {string} input
   * @param {string=} base
   * @param {State=} stateOverride
   */
  constructor(input, base, stateOverride) {
    if (!input || typeof input !== 'string') {
      throw Errors.INVALID_ARGUMENT
    }

    this.setInput(input)

    if (stateOverride) {
      this.state = stateOverride
    }

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
    this.stateOverride = stateOverride

    this.iterateInput()
  }

  /**
   * @private
   * @function setInput
   * @description Sanitize the input and set it internally
   * @param {string} input
   */
  setInput(input) {
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
  iterateInput() {
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
  processState(code, character) {
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
      case 'file-slash':
        return this.fileSlashState(code, character)
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
  schemeStartState(code, character) {
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
  schemeState(code, character) {}

  /**
   * @private
   * @function noSchemeState
   * @param {number} code
   * @param {string} character
   */
  noSchemeState(code, character) {
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
  fragmentState(code, character) {}

  /**
   * @private
   * @function relativeState
   * @param {number} code
   * @param {string} character
   */
  relativeState(code, character) {
    // Assert: base’s scheme is not "file".
    assert(this.base.scheme !== 'file')
    this.url.scheme = this.base.scheme

    // If c is U+002F (/), then set state to relative slash state.
    if (character === '/') {
      this.state = 'relative-slash'
    } else if (character === '\\' && special_schemes.includes(this.url.scheme)) {
      // Otherwise, if url is special and c is U+005C (\), validation error, set state to relative slash state.
      this.hasValidationError = true
      this.state = 'relative-slash'
    } else {
      this.url.username = this.base.username
      this.url.password = this.base.password
      this.url.host = this.base.host
      this.url.port = this.base.port
      this.url.path = this.base.path // TODO: make this a clone
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
   * @function relativeSlashState
   * @param {number} code
   * @param {string} character
   */
  relativeSlashState(code, character) {}

  /**
   * @private
   * @function fileState
   * @param {number} code
   * @param {string} character
   */
  fileState(code, character) {}

  /**
   * @private
   * @function fileSlashState
   * @param {number} code
   * @param {string} character
   */
  fileSlashState(code, character) {}

  /**
   * @private
   * @function queryState
   * @param {number} code
   * @param {string} character
   */
  queryState(code, character) {}

  /**
   * @private
   * @function pathState
   * @param {number} code
   * @param {string} character
   */
  pathState(code, character) {}
}

module.exports = URLStateMachine
