/* jshint esversion: 8 */
/* jshint node: true */

"use strict";
import URLStateMachine from "../lib/index.js";
import WHATWG from "whatwg-url";
import benchmark from "cronometro";

await benchmark(
  {
    URL() {
      return new URL(
        "/path/to/something?hello=world",
        "https://www.google.com",
      );
    },
    "url-state-machine"() {
      return new URLStateMachine(
        "/path/to/something?hello=world",
        new URLStateMachine("https://www.google.com").url,
      );
    },
    "whatwg-url"() {
      return new WHATWG.URL(
        "/path/to/something?hello=world",
        "https://www.google.com",
      );
    },
  },
  { warmup: true, print: { compare: true, compareMode: "previous" } },
);
