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
const state = new URLStateMachine('https://www.yagiz.co/implementing-node-js-url-parser-in-webassembly-with-rust/')

console.log(state.url)
```

### Benchmarks

Here's the current benchmarks comparing `url-state-machine` with the native URL implementation and `whatwg-url`. 

Even though these benchmarks provide a good reference for `url-state-machine`, should not be taken in any consideration since the implementation of `url-state-machine` is not finished, and does not reflect the final performance of it.

```
╔═══════════════════╤═════════╤══════════════════╤═══════════╗
║ Slower tests      │ Samples │           Result │ Tolerance ║
╟───────────────────┼─────────┼──────────────────┼───────────╢
║ whatwg-url        │    1500 │  38398.83 op/sec │  ± 0.80 % ║
║ URL               │    3500 │ 722911.82 op/sec │  ± 0.87 % ║
╟───────────────────┼─────────┼──────────────────┼───────────╢
║ Fastest test      │ Samples │           Result │ Tolerance ║
╟───────────────────┼─────────┼──────────────────┼───────────╢
║ url-state-machine │   10000 │ 774222.60 op/sec │  ± 1.35 % ║
╚═══════════════════╧═════════╧══════════════════╧═══════════╝
```

### Testing

All tests are referenced and borrowed from [web-platform-tests](https://github.com/web-platform-tests/wpt/blob/master/url/resources/urltestdata.json).

```
Test Files  1 failed (1)
     Tests  220 failed | 513 passed (733)
      Time  543ms (in thread 55ms, 987.09%)
```

#### Conformance to specification

We're currently testing only the following attributes for URL

- pathname
  - 105 failed | 628 passed (733)
- host
  - 72 failed | 661 passed (733)
- username
  - 28 failed | 705 passed (733)
- password
  - 20 failed | 713 passed (733)
- protocol
  - 1 failed | 732 passed (733)
- port
  - 733 passed (733)
- fragment
  - 733 passed (733)
- query
  - 733 passed (733)
