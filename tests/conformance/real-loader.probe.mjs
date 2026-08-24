import assert from "node:assert/strict";

const rawInput = process.argv[2];
assert.ok(rawInput, "real-loader probe input is required");
const { loaderUrl, installedPackageDir } = JSON.parse(rawInput);
assert.ok(loaderUrl, "real loader URL is required");
assert.ok(installedPackageDir, "installed plugin directory is required");

const { pluginLoader } = await import(loaderUrl);
const accesses = [];
const rejectAccess = (path) => {
  accesses.push(path);
  throw new Error(`unexpected DB access: ${String(path)}`);
};
const strictDbProxy = new Proxy(
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

const loader = pluginLoader(strictDbProxy);
await assert.rejects(
  loader.installPlugin({ localPath: installedPackageDir }),
  /does not appear to be a Paperclip plugin \(no manifest found\)/,
);
assert.deepEqual(accesses, []);
