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
║ whatwg-url        │    3500 │   99878.13 op/sec │  ± 0.90 % │                          ║
║ url-state-machine │   10000 │  565186.84 op/sec │  ± 1.47 % │ + 465.88 %               ║
╟───────────────────┼─────────┼───────────────────┼───────────┼──────────────────────────╢
║ Fastest test      │ Samples │            Result │ Tolerance │ Difference with previous ║
╟───────────────────┼─────────┼───────────────────┼───────────┼──────────────────────────╢
║ URL               │    5000 │ 1135921.14 op/sec │  ± 0.92 % │ + 100.98 %               ║
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
║ whatwg-url        │    5000 │  220603.37 op/sec │  ± 0.93 % │                          ║
║ url-state-machine │   10000 │ 1311682.35 op/sec │  ± 3.81 % │ + 494.59 %               ║
╟───────────────────┼─────────┼───────────────────┼───────────┼──────────────────────────╢
║ Fastest test      │ Samples │            Result │ Tolerance │ Difference with previous ║
╟───────────────────┼─────────┼───────────────────┼───────────┼──────────────────────────╢
║ URL               │   10000 │ 1329438.79 op/sec │  ± 4.49 % │ + 1.35 %                 ║
╚═══════════════════╧═════════╧═══════════════════╧═══════════╧══════════════════════════╝
```
</details>

### Testing

All tests are referenced and borrowed from [web-platform-tests](https://github.com/web-platform-tests/wpt/blob/master/url/resources/urltestdata.json).

```
Test Files  1 failed (1)
     Tests  16 failed | 717 passed (733)
      Time  48ms
```

#### Conformance to specification

We're currently testing only the following attributes for URL

- pathname
  - 13 failed | 720 passed (733)
- host
  - 5 failed | 728 passed (733)
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
