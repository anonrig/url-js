// load tests from https://github.com/web-platform-tests/wpt/blob/master/url/resources/urltestdata.json
import { test, assert } from "vitest";
import path from "node:path";
import url_test_data from "./urltestdata.json";
import StateMachine from "../lib";
import net from "node:net";

type Suite = {
  input: string,
  base?: string,
  protocol?: string,
  failure?: boolean,
  username?: string,
  password?: string,
  host?: string,
  hostname?: string,
  fragment?: string,
  pathname?: string,
  query?: string,
  port?: number,
};

for (let suite of url_test_data) {
  if (typeof suite === "string") {
    continue;
  }

  const t = suite as Suite;

  if (suite.input) {
    test(
      path.join(t.base ?? "", t.input),
      () => {
        const base = t.base ? new StateMachine(t.base).url : null;
        const state = new StateMachine(t.input, base);

        if (typeof t.failure !== "undefined") {
          assert.equal(state.failure, t.failure);
        }

        if (t.protocol) {
          assert.equal(
            state.url.scheme,
            t.protocol.replaceAll(":", ""),
            JSON.stringify(state, null, 2),
          );
        }

        if (t.password) {
          assert.equal(state.url.password, t.password);
        }

        if (t.pathname) {
          let path = state.url.path.map((p) => `/${p}`).join("");
          assert.equal(path, t.pathname, JSON.stringify({ state, t }, null, 2));
        }

        if (t.host) {
          let port = state.url.port ? `:${state.url.port}` : "";
          let is_ipv6 = net.isIPv6(state.url.host);
          assert.equal(
            is_ipv6 ? `[${state.url.host}]${port}` : state.url.host + port,
            t.host,
            JSON.stringify({ state, t }, null, 2),
          );
        }

        if (t.username) {
          assert.equal(
            state.url.username,
            t.username,
            JSON.stringify(state, null, 2),
          );
        }

        if (t.port) {
          assert.equal(state.url.port, t.port, JSON.stringify(state, null, 2));
        }

        if (t.fragment) {
          assert.equal(
            state.url.fragment,
            t.fragment,
            JSON.stringify(state, null, 2),
          );
        }

        if (t.query) {
          assert.equal(state.url.query, t.query);
        }
      },
    );
  }
}
