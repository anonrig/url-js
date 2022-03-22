import { test, assert } from 'vitest'
import suites from './coverage.json'
import StateMachine from '../lib'

type Suite = {
  input: string
  base?: string
  protocol?: string
}

for (let suite of suites) {
  if (typeof suite === 'string') {
    continue
  }

  if (suite.input) {
    const t = suite as Suite

    test(t.input, () => {
      const state = new StateMachine(t.input, t.base)

      if (t.protocol) {
        assert.equal(state.url.scheme, t.protocol.replaceAll(':', ''))
      }
    })
  }
}
