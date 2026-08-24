import assert from "node:assert/strict";
import test from "node:test";

import { parseCompanyConfig } from "../dist/company-config.js";

test("missing configuration resolves to a frozen disabled config", () => {
  const parsed = parseCompanyConfig(undefined);

  assert.deepEqual(parsed, { ok: true, config: { enabled: false } });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(Object.isFrozen(parsed.config), true);
  }
});

test("only literal boolean enabled values are accepted", () => {
  assert.deepEqual(parseCompanyConfig({ enabled: true }), {
    ok: true,
    config: { enabled: true },
  });
  assert.deepEqual(parseCompanyConfig({ enabled: false }), {
    ok: true,
    config: { enabled: false },
  });

  for (const value of [
    { enabled: "true" },
    { enabled: 1 },
    { enabled: null },
    { enabled: new Boolean(true) },
    {},
  ]) {
    const parsed = parseCompanyConfig(value);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.equal(parsed.code, "enabled_not_boolean");
    }
  }
});

test("non-objects and unknown keys fail closed with stable error codes", () => {
  for (const value of [null, "enabled", 1, [], new Date()]) {
    const parsed = parseCompanyConfig(value);
    assert.deepEqual(parsed, { ok: false, code: "not_plain_object" });
  }

  const parsed = parseCompanyConfig({ enabled: true, extra: "denied" });
  assert.deepEqual(parsed, { ok: false, code: "unknown_keys" });
  assert.deepEqual(parseCompanyConfig({ extra: "denied", enabled: true }), parsed);
});

test("config parsing does not retain or mutate caller-owned objects", () => {
  const input = { enabled: true };
  const parsed = parseCompanyConfig(input);

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.notEqual(parsed.config, input);
    assert.equal(Object.isFrozen(parsed.config), true);
  }
  assert.deepEqual(input, { enabled: true });
});
