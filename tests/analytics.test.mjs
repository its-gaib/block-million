import test from "node:test";
import assert from "node:assert/strict";
import { validEvent, EVENTS } from "../lib/analytics.ts";
const event = {
  event: "page_view",
  session: "8895c3b2-91ce-4bf0-8f67-2f9fb298ceda",
  source: "direct",
  device: "desktop",
};
test("accepts only the documented analytics vocabulary", () => {
  for (const name of EVENTS)
    assert.equal(validEvent({ ...event, event: name }), true);
  assert.equal(
    validEvent({ ...event, event: "arbitrary-private-data" }),
    false,
  );
});
test("rejects arbitrary identifiers and URLs", () => {
  assert.equal(validEvent({ ...event, session: "email@example.com" }), false);
  assert.equal(
    validEvent({
      ...event,
      source: "https://example.com/private?token=secret",
    }),
    false,
  );
  assert.equal(validEvent({ ...event, device: "private-data" }), false);
  assert.equal(validEvent(null), false);
  assert.equal(validEvent({}), false);
});
