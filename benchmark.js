const URLStateMachine = require('./lib')
const WHATWG = require('whatwg-url')
const Benchmarkify = require('benchmarkify')
const bench = new Benchmarkify('URL').printHeader()

const suite = bench.createSuite('url', {})

suite.add('URL', () => new URL('https://www.google.com/path/to/something'))
suite.add('url-state-machine', () => new URLStateMachine('https://www.google.com/path/to/something'))
suite.add('WHATWG.URL', () => new WHATWG.URL('https://www.google.com/path/to/something'))

bench.run([suite])
