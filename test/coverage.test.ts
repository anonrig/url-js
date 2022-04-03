// load tests from https://github.com/web-platform-tests/wpt/blob/master/url/resources/urltestdata.json
import { test, assert } from 'vitest'
import url_test_data from './urltestdata.json'
import StateMachine from '../lib'

type Suite = {
  input: string
  base?: string
  protocol?: string
  failure?: boolean
}

for (let suite of url_test_data) {
  if (typeof suite === 'string') {
    continue
  }

  if (suite.input) {
    const t = suite as Suite

    test(t.input, () => {
      try {
        const state = new StateMachine(t.input, t.base)

        if (t.protocol) {
          assert.equal(state.url.scheme, t.protocol.replaceAll(':', ''))
        }
      } catch (error) {
        if (t.failure) {
          assert(error.message)
        } else {
          throw error
        }
      }

    })
  }
}
