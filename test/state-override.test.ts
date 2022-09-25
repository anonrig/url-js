import { test, assert } from "vitest";
import URLStateMachine from "../lib";

const { State } = URLStateMachine.Constants;

test("parse HOST", () => {
  const result = new URLStateMachine(
    "www.google.com",
    null,
    undefined,
    State.HOST,
  );

  assert.equal(result.stateOverride, State.HOST);
  assert.deepEqual(result.url.host, "www.google.com");
});

test("parse QUERY", () => {
  const result = new URLStateMachine(
    "?hello=world",
    null,
    undefined,
    State.QUERY,
  );

  assert.equal(result.stateOverride, State.QUERY);
  assert.deepEqual(result.url.query, "?hello=world");
});

test("parse FRAGMENT", () => {
  const result = new URLStateMachine(
    "my-super-long-fragment",
    null,
    undefined,
    State.FRAGMENT,
  );

  assert.equal(result.stateOverride, State.FRAGMENT);
  assert.deepEqual(result.url.fragment, "my-super-long-fragment");
});
