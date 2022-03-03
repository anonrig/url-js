const Benchmarkify = require('benchmarkify')
const bench = new Benchmarkify('URL').printHeader()

const suite = bench.createSuite('url')

suite.add('URL', () => new URL('https://www.google.com/path/to/something'))

bench.run([suite])
