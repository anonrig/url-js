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

<details>
  <summary>Full domain with input and base</summary>

- `new URL("/path/to/something?hello=world", "https://www.google.com")`

```
╔═══════════════════╤═════════╤══════════════════╤═══════════╗
║ Slower tests      │ Samples │           Result │ Tolerance ║
╟───────────────────┼─────────┼──────────────────┼───────────╢
║ whatwg-url        │    1000 │  39201.88 op/sec │  ± 0.78 % ║
║ url-state-machine │    4500 │ 240972.89 op/sec │  ± 0.96 % ║
╟───────────────────┼─────────┼──────────────────┼───────────╢
║ Fastest test      │ Samples │           Result │ Tolerance ║
╟───────────────────┼─────────┼──────────────────┼───────────╢
║ URL               │    1500 │ 474534.13 op/sec │  ± 0.74 % ║
╚═══════════════════╧═════════╧══════════════════╧═══════════╝
```
</details>

<details>
  <summary>ipv4 address</summary>

- `new URL("http://127.0.0.1")`

```
╔═══════════════════╤═════════╤═══════════════════╤═══════════╗
║ Slower tests      │ Samples │            Result │ Tolerance ║
╟───────────────────┼─────────┼───────────────────┼───────────╢
║ whatwg-url        │    3000 │   97649.84 op/sec │  ± 0.92 % ║
║ url-state-machine │   10000 │  552853.27 op/sec │  ± 1.72 % ║
╟───────────────────┼─────────┼───────────────────┼───────────╢
║ Fastest test      │ Samples │            Result │ Tolerance ║
╟───────────────────┼─────────┼───────────────────┼───────────╢
║ URL               │   10000 │ 1116647.32 op/sec │  ± 2.25 % ║
╚═══════════════════╧═════════╧═══════════════════╧═══════════╝
```

</details>

<details>
  <summary>ipv6 address</summary>

- `new URL("http://[1:0::]")`

```
╔═══════════════════╤═════════╤═══════════════════╤═══════════╗
║ Slower tests      │ Samples │            Result │ Tolerance ║
╟───────────────────┼─────────┼───────────────────┼───────────╢
║ whatwg-url        │    8500 │  199717.03 op/sec │  ± 0.98 % ║
║ url-state-machine │    4000 │ 1409688.65 op/sec │  ± 0.96 % ║
╟───────────────────┼─────────┼───────────────────┼───────────╢
║ Fastest test      │ Samples │            Result │ Tolerance ║
╟───────────────────┼─────────┼───────────────────┼───────────╢
║ URL               │   10000 │ 1472345.31 op/sec │  ± 1.52 % ║
╚═══════════════════╧═════════╧═══════════════════╧═══════════╝
```
</details>

### Testing

All tests are referenced and borrowed from [web-platform-tests](https://github.com/web-platform-tests/wpt/blob/master/url/resources/urltestdata.json).

```
Test Files  1 failed (1)
     Tests  17 failed | 716 passed (733)
      Time  504ms (in thread 33ms, 1526.78%)
```

#### Conformance to specification

We're currently testing only the following attributes for URL

- pathname
  - 13 failed | 720 passed (733)
- host
  - 5 failed | 728 passed (733)
- password
  - 1 failed | 732 passed (733)
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
