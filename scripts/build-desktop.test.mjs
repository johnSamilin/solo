import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runtimeTarget, resolveSearchAssets, ensureSearchAssets, copySearchAssets, verifyStagedSearch, verifyPackage } from './build-desktop.mjs';

test('the ONNX bundle matches the target architecture and library name', () => {
  assert.deepEqual(runtimeTarget('darwin', 'arm64'), {
    archive: 'onnxruntime-osx-arm64-1.26.0.tgz', library: 'libonnxruntime.dylib',
  });
  assert.deepEqual(runtimeTarget('linux', 'x64'), {
    archive: 'onnxruntime-linux-x64-1.26.0.tgz', library: 'libonnxruntime.so',
  });
  assert.throws(() => runtimeTarget('win32', 'x64'), /not configured/);
});

test('missing inputs are fetched once and cached; existing inputs stay untouched', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'solo-search-download-test-'));
  const target = runtimeTarget('darwin', 'arm64');
  const downloads = [];
  const download = (url, destination) => {
    downloads.push(url);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, 'fixture');
  };
  const extract = (_archive, destination) => {
    const lib = path.join(destination, target.archive.slice(0, -4), 'lib');
    fs.mkdirSync(lib, { recursive: true });
    fs.writeFileSync(path.join(lib, target.library), 'runtime');
  };
  try {
    fs.mkdirSync(path.join(directory, 'models'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'models', 'tokenizer.json'), 'existing-tokenizer');
    const assets = ensureSearchAssets(directory, target, download, extract);
    assert.equal(downloads.length, 2); // model + runtime, not tokenizer
    assert.match(downloads[0], /onnx\/model\.onnx$/);
    assert.match(downloads[1], /onnxruntime-osx-arm64-1\.26\.0\.tgz$/);
    assert.equal(fs.readFileSync(path.join(assets.model, 'tokenizer.json'), 'utf8'), 'existing-tokenizer');
    assert.equal(fs.readFileSync(path.join(assets.runtime, target.library), 'utf8'), 'runtime');
    ensureSearchAssets(directory, target, () => { throw new Error('Unexpected download'); });
    assert.equal(downloads.length, 2);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('local model and runtime are validated before packaging', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'solo-search-assets-'));
  const target = runtimeTarget('darwin', 'arm64');
  try {
    assert.throws(() => resolveSearchAssets(directory, target), /Missing search assets/);
    const models = path.join(directory, 'models');
    const runtime = path.join(directory, 'onnx-runtime', 'lib');
    fs.mkdirSync(models, { recursive: true });
    fs.mkdirSync(runtime, { recursive: true });
    for (const file of ['model.onnx', 'tokenizer.json']) fs.writeFileSync(path.join(models, file), 'fixture');
    fs.writeFileSync(path.join(runtime, target.library), 'fixture');
    const assets = resolveSearchAssets(directory, target);
    assert.equal(assets.model, models);
    assert.equal(assets.runtime, runtime);
    assert.ok(assets.profile.endsWith('instruments/semantic-search/models/model.json'));
    const destination = path.join(directory, 'package');
    copySearchAssets(assets, destination);
    fs.writeFileSync(path.join(destination, 'solo-search'), 'binary');
    assert.doesNotThrow(() => verifyStagedSearch(destination, target));
    for (const file of ['model.onnx', 'tokenizer.json', 'model.json']) {
      assert.ok(fs.statSync(path.join(destination, 'models', file)).size > 0);
    }
    assert.equal(fs.readFileSync(path.join(destination, 'onnx-runtime', 'lib', target.library), 'utf8'), 'fixture');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('light package strips semantic search without removing other resources', async () => {
  const previous = process.env.SOLO_BUILD_VARIANT;
  process.env.SOLO_BUILD_VARIANT = 'light';
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'solo-light-test-'));
  try {
    const { default: config } = await import(`../native-clients/electron/forge.config.js?light=${Date.now()}`);
    assert.equal(config.buildIdentifier, 'light');
    assert.ok(config.packagerConfig.ignore.some(pattern => pattern.test('/electron/dist/instruments/semantic-search/models/model.onnx')));
    assert.ok(config.packagerConfig.ignore.some(pattern => pattern.test('/out/extended/Solo-darwin-arm64/Solo.app')));
    const instrument = path.join(output, 'Solo.app/Contents/Resources/dist/instruments/semantic-search/models/model.onnx');
    const other = path.join(output, 'Solo.app/Contents/Resources/dist/assets/app.css');
    fs.mkdirSync(path.dirname(instrument), { recursive: true });
    fs.mkdirSync(path.dirname(other), { recursive: true });
    fs.writeFileSync(instrument, 'model');
    fs.writeFileSync(other, 'css');
    await config.hooks.postPackage(null, { outputPaths: [output] });
    assert.equal(fs.existsSync(instrument), false);
    assert.equal(fs.existsSync(other), true);
  } finally {
    if (previous === undefined) delete process.env.SOLO_BUILD_VARIANT;
    else process.env.SOLO_BUILD_VARIANT = previous;
    fs.rmSync(output, { recursive: true, force: true });
  }
});

test('extended package retains the instrument outside app.asar', async () => {
  const previous = process.env.SOLO_BUILD_VARIANT;
  process.env.SOLO_BUILD_VARIANT = 'extended';
  try {
    const { default: config } = await import(`../native-clients/electron/forge.config.js?extended=${Date.now()}`);
    assert.equal(config.buildIdentifier, 'extended');
    assert.ok(config.packagerConfig.extraResource.includes('./electron/dist'));
    assert.ok(config.packagerConfig.ignore.some(pattern => pattern.test('/electron/dist/instruments/semantic-search/solo-search')));
    assert.ok(config.packagerConfig.ignore.some(pattern => pattern.test('/out/light/Solo-darwin-arm64/Solo.app')));
    assert.equal(config.hooks.postPackage, undefined);
  } finally {
    if (previous === undefined) delete process.env.SOLO_BUILD_VARIANT;
    else process.env.SOLO_BUILD_VARIANT = previous;
  }
});

test('package verification rejects incomplete and contaminated outputs', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'solo-package-verify-'));
  const target = runtimeTarget('darwin', 'arm64');
  const resources = path.join(output, 'Solo-darwin-arm64', 'Solo.app', 'Contents', 'Resources');
  try {
    assert.throws(() => verifyPackage(output, 'light', target, 'darwin', 'arm64'), /missing resources/);
    fs.mkdirSync(path.join(resources, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(resources, 'dist', 'index.html'), '<html/>');
    verifyPackage(output, 'light', target, 'darwin', 'arm64');
    const instrument = path.join(resources, 'dist', 'instruments', 'semantic-search');
    fs.mkdirSync(instrument, { recursive: true });
    assert.throws(() => verifyPackage(output, 'light', target, 'darwin', 'arm64'), /contains semantic search/);
    assert.throws(() => verifyPackage(output, 'extended', target, 'darwin', 'arm64'), /Incomplete extended-search package/);
  } finally {
    fs.rmSync(output, { recursive: true, force: true });
  }
});
