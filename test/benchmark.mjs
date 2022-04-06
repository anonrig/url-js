import URLStateMachine from "../lib/index.js";
import WHATWG from "whatwg-url";
import benchmark from "cronometro";

await benchmark(
  {
    "URL"() {
      return new URL("https://www.google.com/path/to/something");
    },
    "url-state-machine"() {
      return new URLStateMachine("https://www.google.com/path/to/something");
    },
    "whatwg-url"() {
      return new WHATWG.URL("https://www.google.com/path/to/something");
    },
  },
  { warmup: true },
);
