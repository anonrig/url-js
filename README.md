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
✔ URL                       1,209,360 rps
✔ url-state-machine         3,167,353 rps
✔ WHATWG.URL                   59,296 rps

   URL                     -61.82%      (1,209,360 rps)   (avg: 826ns)
   url-state-machine            0%      (3,167,353 rps)   (avg: 315ns)
   WHATWG.URL              -98.13%         (59,296 rps)   (avg: 16μs)
-----------------------------------------------------------------------
```
