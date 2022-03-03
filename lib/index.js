const { FAILURE } = require('./constants')
const Errors = require('./errors')

/**
 * @typedef {'scheme-start-state'|'no-scheme-state'|'scheme-state'} State
 */

/**
 * @property {string} input
 * @property {State} state
 * @property {string=} base
 */
class URLStateMachine {

  // A validation error does not mean that the parser terminates.
  // Termination of a parser is always stated explicitly, e.g., through a return statement.
  hasValidationError = false

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
    this.setState(stateOverride || 'scheme-start-state')
    this.buffer = ''
    this.base = base || null
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
    this.atSignSeen = false
    this.insideBrackets = false
    this.passwordTokenSeen = false
    this.pointer = 0
    this.failure = false

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
   * @function setState
   * @description Changes the current state of the state machine
   * @param {State} state
   */
  setState(state) {
    this.state = state
  }

  /**
   * @private
   * @function iterateInput
   * @description Iterate through the input and update state
   */
  iterateInput() {
    const codes = Array.from(this.input, c => [c, c.codePointAt(0)])

    while (this.pointer < codes.length) {
      const [character, code] = codes[this.pointer]
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
   * @function
   * @param {number} code
   * @param {String} character
   * @returns {boolean|Symbol}
   */
  processState(code, character) {
    switch (this.state) {
      case 'scheme-start-state':
        return this.schemeStartState(code, character)
      case 'no-scheme-state':
        return this.noSchemeState(code, character)
    }
  }

  /**
   * @private
   * @function schemeStartState
   * @param {number} code
   * @param {string} character
   * @returns {boolean|Symbol}
   */
  schemeStartState(code, character) {
    // If c is an ASCII alpha, append c, lowercased, to buffer, and set state to scheme state.
    if ((code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)) {
      this.buffer += character.toLowerCase()
      this.setState('scheme-state')
    } else if (!this.stateOverride) {
      // Otherwise, if state override is not given, set state to no scheme state and decrease pointer by 1.
      this.setState('no-scheme-state')
      this.pointer = this.pointer - 1
    } else {
      // Otherwise, validation error, return failure.
      this.hasValidationError = true
      return FAILURE
    }

    return true
  }

  /**
   * @private
   * @function noSchemeState
   * @param {number} code
   * @param {string} character
   */
  noSchemeState(code, character) {

  }
}
