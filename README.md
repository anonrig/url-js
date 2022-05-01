## URL Parser

This repository contains a work in progress state machine 100% compliant to the URL parser specification. The goal is to create a performant URL parser.

For more information about the URL parsing state machine visit [here](https://url.spec.whatwg.org/#url-parsing).

### Installation

```bash
npm i --save url-state-machine
```

### Usage

```javascript
const URLStateMachine = require('url-state-machine')
const state = new URL('https://www.yagiz.co/implementing-node-js-url-parser-in-webassembly-with-rust')

console.log(state.url)
// {
//   scheme: 'https',
//   username: '',
//   password: '',
//   host: 'www.yagiz.co',
//   port: null,
//   path: [ 'implementing-node-js-url-parser-in-webassembly-with-rust' ],
//   query: null,
//   fragment: null
// }
```

### Benchmarks

<details>
  <summary>Full domain with input and base</summary>

- `new URL("/path/to/something?hello=world", "https://www.google.com")`

```
╔═══════════════════╤═════════╤══════════════════╤═══════════╤══════════════════════════╗
║ Slower tests      │ Samples │           Result │ Tolerance │ Difference with previous ║
╟───────────────────┼─────────┼──────────────────┼───────────┼──────────────────────────╢
║ whatwg-url        │    1000 │  37994.48 op/sec │  ± 0.97 % │                          ║
║ url-state-machine │    9500 │ 257195.34 op/sec │  ± 0.99 % │ + 576.93 %               ║
╟───────────────────┼─────────┼──────────────────┼───────────┼──────────────────────────╢
║ Fastest test      │ Samples │           Result │ Tolerance │ Difference with previous ║
╟───────────────────┼─────────┼──────────────────┼───────────┼──────────────────────────╢
║ URL               │   10000 │ 477303.34 op/sec │  ± 1.27 % │ + 85.58 %                ║
╚═══════════════════╧═════════╧══════════════════╧═══════════╧══════════════════════════╝
```
</details>

<details>
  <summary>ipv4 address</summary>

- `new URL("http://127.0.0.1")`

```
╔═══════════════════╤═════════╤═══════════════════╤═══════════╤══════════════════════════╗
║ Slower tests      │ Samples │            Result │ Tolerance │ Difference with previous ║
╟───────────────────┼─────────┼───────────────────┼───────────┼──────────────────────────╢
║ whatwg-url        │    5000 │   91747.56 op/sec │  ± 0.97 % │                          ║
║ url-state-machine │   10000 │  626208.74 op/sec │  ± 1.65 % │ + 582.53 %               ║
╟───────────────────┼─────────┼───────────────────┼───────────┼──────────────────────────╢
║ Fastest test      │ Samples │            Result │ Tolerance │ Difference with previous ║
╟───────────────────┼─────────┼───────────────────┼───────────┼──────────────────────────╢
║ URL               │    2500 │ 1037903.40 op/sec │  ± 0.87 % │ + 65.74 %                ║
╚═══════════════════╧═════════╧═══════════════════╧═══════════╧══════════════════════════╝
```

</details>

<details>
  <summary>ipv6 address</summary>

- `new URL("http://[1:0::]")`

```
╔═══════════════════╤═════════╤═══════════════════╤═══════════╤══════════════════════════╗
║ Slower tests      │ Samples │            Result │ Tolerance │ Difference with previous ║
╟───────────────────┼─────────┼───────────────────┼───────────┼──────────────────────────╢
║ whatwg-url        │    5500 │  196896.91 op/sec │  ± 0.97 % │                          ║
║ url-state-machine │   10000 │ 1321601.39 op/sec │  ± 2.76 % │ + 571.21 %               ║
╟───────────────────┼─────────┼───────────────────┼───────────┼──────────────────────────╢
║ Fastest test      │ Samples │            Result │ Tolerance │ Difference with previous ║
╟───────────────────┼─────────┼───────────────────┼───────────┼──────────────────────────╢
║ URL               │    8000 │ 1356561.74 op/sec │  ± 0.97 % │ + 2.65 %                 ║
╚═══════════════════╧═════════╧═══════════════════╧═══════════╧══════════════════════════╝
```
</details>

### Testing

#### Running

All tests are referenced and borrowed from [web-platform-tests](https://github.com/web-platform-tests/wpt/blob/master/url/resources/urltestdata.json).

```bash
npm test
```

#### Code Coverage

```
Test Files  1 failed (1)
     Tests  10 failed | 723 passed (733)
      Time  737ms (in thread 70ms, 1052.63%)
```

File          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------|---------|----------|---------|---------|--------------------------------------------
All files     |   95.88 |    95.18 |      98 |   95.88 |
 constants.js |     100 |      100 |     100 |     100 |
 encoding.js  |     100 |      100 |     100 |     100 |
 index.js     |   93.99 |    93.02 |     100 |   93.99 | ...4-775,800-801,921-922,926-927,1070-1071
 parser.js    |   99.53 |    99.05 |     100 |   99.53 | 283-284
 platform.js  |     100 |      100 |     100 |     100 |
 string.js    |     100 |      100 |     100 |     100 |
 utf8.js      |   84.33 |    88.23 |      50 |   84.33 | 39-44,63-64,77-81

#### Conformance to specification

- pathname
  - 10 failed | 723 passed (733)
- host
  - 733 passed (733)
- password
  - 733 passed (733)
- protocol
  - 733 passed (733)
- username
  - 733 passed (733)
- port
  - 733 passed (733)
- fragment
  - 733 passed (733)
- query
  - 733 passed (733)
