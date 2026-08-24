// Real-loader probe — runs in a child process against the real built Paperclip
// server. Two modes:
//
// default: the packed Mission Control package must be rejected as "no
//   manifest found" before the loader touches any persistence property.
// positive-control ("mode": "positive-control"): a minimal valid plugin must
//   pass fetch/manifest validation and reach installPlugin persistence, where
//   installPlugin reads `db.transaction` and fails. The proxy records exactly
//   which properties were touched.

import assert from "node:assert/strict";

const rawInput = process.argv[2];
assert.ok(rawInput, "real-loader probe input is required");
const { loaderUrl, installedPackageDir, mode } = JSON.parse(rawInput);
assert.ok(loaderUrl, "real loader URL is required");
assert.ok(installedPackageDir, "installed plugin directory is required");

const { pluginLoader } = await import(loaderUrl);
function createStrictDbProxy() {
  const accesses = [];
  const rejectAccess = (path) => {
    accesses.push(path);
    throw new Error(`unexpected DB access: ${String(path)}`);
  };
  const db = new Proxy(
    {},
    {
      get(_target, property) {
        rejectAccess(property);
      },
      set(_target, property) {
        rejectAccess(property);
      },
    },
  );
  return { accesses, db };
}

const { accesses, db } = createStrictDbProxy();
const loader = pluginLoader(db);

if (mode === "positive-control") {
  await assert.rejects(
    loader.installPlugin({ localPath: installedPackageDir }),
    /unexpected DB access: transaction/u,
  );
  assert.deepEqual(
    accesses,
    ["transaction"],
    "installPlugin must touch exactly the transaction property before rejecting",
  );
} else {
  await assert.rejects(
    loader.installPlugin({ localPath: installedPackageDir }),
    /does not appear to be a Paperclip plugin \(no manifest found\)/,
  );
  assert.deepEqual(accesses, []);
}
