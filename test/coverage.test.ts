import { test, assert } from 'vitest'
import tests from './coverage.json'
import StateMachine from '../lib'

for (let automated_test of tests) {
  if (typeof automated_test === 'string') {
    continue
  }

  if (automated_test.input && automated_test.base) {
    test(automated_test.input, () => {
      const instance = new StateMachine(automated_test.input, automated_test.base)

      if (automated_test.protocol) {
        assert.equal(instance.url.scheme, automated_test.protocol.replaceAll(':', ''))
      }
    })
  }
}
