#!/usr/bin/env node
/** Build light and extended desktop installers for the current host platform. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electron = path.join(root, 'native-clients', 'electron');
const search = path.join(root, 'instruments', 'semantic-search');
const staged = path.join(electron, 'electron', 'dist', 'instruments', 'semantic-search');
const assetsDir = path.resolve(process.env.SOLO_EXTENDED_SEARCH_ASSETS || path.join(root, 'extended-search-assets'));
const runtimeVersion = '1.26.0';
const modelBaseUrl = 'https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2/resolve/main';

export function runtimeTarget(platform = process.platform, arch = process.arch) {
  const variants = {
    'darwin-arm64': ['osx-arm64', 'libonnxruntime.dylib'],
    'darwin-x64': ['osx-x64', 'libonnxruntime.dylib'],
    'linux-x64': ['linux-x64', 'libonnxruntime.so'],
    'linux-arm64': ['linux-aarch64', 'libonnxruntime.so'],
  };
  const variant = variants[`${platform}-${arch}`];
  if (!variant) throw new Error(`ONNX Runtime packaging is not configured for ${platform}/${arch}`);
  return { archive: `onnxruntime-${variant[0]}-${runtimeVersion}.tgz`, library: variant[1] };
}

function run(command, args, cwd, env = process.env) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${result.status})`);
}

function present(file) {
  try { return fs.statSync(file).size > 0; } catch { return false; }
}

/** Resolve local inputs without changing them. */
export function resolveSearchAssets(directory, target) {
  const model = [path.join(directory, 'models'), directory]
    .find(candidate => present(path.join(candidate, 'model.onnx')) && present(path.join(candidate, 'tokenizer.json')));
  const runtime = [
    path.join(directory, 'onnx-runtime', 'lib'),
    path.join(directory, 'lib'),
  ].find(candidate => present(path.join(candidate, target.library)));

  if (!model || !runtime) {
    throw new Error(`Missing search assets in ${directory}. Expected models/model.onnx, models/tokenizer.json and onnx-runtime/lib/${target.library} (or model files at root and runtime in lib/).`);
  }
  const profile = path.join(search, 'models', 'model.json');
  if (!present(profile)) throw new Error(`Missing search model profile: ${profile}`);
  return { model, runtime, profile };
}

function downloadFile(url, destination) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'solo-download-'));
  try {
    const file = path.join(temporary, path.basename(destination));
    run('curl', ['--fail', '--location', '--retry', '3', '--output', file, url], root);
    if (!present(file)) throw new Error(`Downloaded file is empty: ${url}`);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.renameSync(file, destination);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function extractArchive(archive, destination) {
  run('tar', ['-xzf', archive, '-C', destination], root);
}

/** Download only missing search inputs, then validate the complete set. */
export function ensureSearchAssets(directory, target, download = downloadFile, extract = extractArchive) {
  const candidates = [path.join(directory, 'models'), directory];
  const model = candidates.find(candidate => present(path.join(candidate, 'model.onnx')) && present(path.join(candidate, 'tokenizer.json')))
    ?? candidates.find(candidate => present(path.join(candidate, 'model.onnx')) || present(path.join(candidate, 'tokenizer.json')))
    ?? candidates[0];

  for (const [file, url] of [
    ['model.onnx', `${modelBaseUrl}/onnx/model.onnx`],
    ['tokenizer.json', `${modelBaseUrl}/tokenizer.json`],
  ]) {
    if (!present(path.join(model, file))) download(url, path.join(model, file));
  }

  const runtime = [path.join(directory, 'onnx-runtime', 'lib'), path.join(directory, 'lib')]
    .find(candidate => present(path.join(candidate, target.library)));
  if (!runtime) {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'solo-onnx-'));
    try {
      const archive = path.join(temporary, target.archive);
      download(`https://github.com/microsoft/onnxruntime/releases/download/v${runtimeVersion}/${target.archive}`, archive);
      extract(archive, temporary);
      const extracted = path.join(temporary, target.archive.slice(0, -4), 'lib');
      if (!present(path.join(extracted, target.library))) {
        throw new Error(`ONNX Runtime archive does not contain ${target.library}`);
      }
      fs.cpSync(extracted, path.join(directory, 'onnx-runtime', 'lib'), { recursive: true, dereference: true });
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }

  return resolveSearchAssets(directory, target);
}

function prepareVosk() {
  const model = path.join(electron, 'models', 'vosk-model-small-ru-0.22', 'am');
  const lib = path.join(electron, 'libvosk', process.platform === 'darwin' ? 'libvosk.dylib' : 'libvosk.so');
  if (!fs.existsSync(model) || !present(lib)) {
    throw new Error('Missing Vosk resources for Electron; run bash scripts/fetch-vosk-models.sh first.');
  }
}

export function copySearchAssets(assets, destination) {
  const stagedModels = path.join(destination, 'models');
  fs.mkdirSync(stagedModels, { recursive: true });
  fs.copyFileSync(assets.profile, path.join(stagedModels, 'model.json'));
  for (const file of ['model.onnx', 'tokenizer.json']) {
    fs.copyFileSync(path.join(assets.model, file), path.join(stagedModels, file));
  }
  fs.cpSync(assets.runtime, path.join(destination, 'onnx-runtime', 'lib'), { recursive: true, dereference: true });
}

export function verifyStagedSearch(destination, target) {
  for (const file of ['solo-search', 'models/model.json', 'models/model.onnx', 'models/tokenizer.json', `onnx-runtime/lib/${target.library}`]) {
    if (!present(path.join(destination, file))) throw new Error(`Incomplete extended-search package: ${file}`);
  }
}

function stageSearch(target, assets) {
  // This is generated output, not the source models or a user data directory.
  fs.rmSync(staged, { recursive: true, force: true });
  fs.mkdirSync(staged, { recursive: true });
  const binary = path.join(staged, 'solo-search');
  run('go', ['build', '-o', binary, './cmd/solo-search'], search, { ...process.env, CGO_ENABLED: '1' });
  copySearchAssets(assets, staged);
  verifyStagedSearch(staged, target);
}

function buildWeb(extended) {
  // copy-assets:desktop merges into this directory. Remove the previous web
  // bundle so light cannot carry a stale extended-search JS chunk (and vice versa).
  fs.rmSync(path.join(electron, 'electron', 'dist', 'assets'), { recursive: true, force: true });
  run('npm', ['run', 'build:desktop:web'], root, {
    ...process.env,
    SOLO_EXTENDED_SEARCH: extended ? 'true' : 'false',
  });
}

function packageVariant(variant) {
  // Forge output is generated; an interrupted earlier run must not leave a
  // seemingly successful but incomplete package behind.
  fs.rmSync(path.join(electron, 'out', variant), { recursive: true, force: true });
  run('npm', ['exec', '--', 'electron-forge', 'package'], electron, {
    ...process.env,
    SOLO_BUILD_VARIANT: variant,
    SOLO_EXCLUDE_INSTRUMENTS: variant === 'light' ? 'true' : 'false',
  });
  verifyPackage(path.join(electron, 'out', variant), variant, runtimeTarget());
}

export function verifyPackage(outputDir, variant, target, platform = process.platform, arch = process.arch) {
  const packageDir = path.join(outputDir, `Solo-${platform}-${arch}`);
  const resources = platform === 'darwin'
    ? path.join(packageDir, 'Solo.app', 'Contents', 'Resources')
    : path.join(packageDir, 'resources');
  if (!present(path.join(resources, 'dist', 'index.html'))) {
    throw new Error(`Incomplete ${variant} Electron package: missing resources/dist/index.html in ${packageDir}`);
  }
  const instrument = path.join(resources, 'dist', 'instruments', 'semantic-search');
  if (variant === 'light') {
    if (fs.existsSync(instrument)) throw new Error(`Light package contains semantic search: ${instrument}`);
  } else {
    verifyStagedSearch(instrument, target);
  }
}

export function makerForHost(platform = process.platform) {
  if (platform === 'darwin') return { target: '@electron-forge/maker-dmg', extension: '.dmg' };
  if (platform === 'linux') return { target: '@electron-forge/maker-deb', extension: '.deb' };
  throw new Error(`Unsupported desktop installer platform: ${platform}`);
}

export function verifyMakeArtifact(directory, extension) {
  const artifacts = [];
  const visit = current => {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && entry.name.endsWith(extension) && present(file)) artifacts.push(file);
    }
  };
  visit(directory);
  if (artifacts.length === 0) throw new Error(`No ${extension} installer found in ${directory}`);
  return artifacts;
}

function makeVariant(variant, maker) {
  const outputDir = path.join(electron, 'out', variant);
  fs.rmSync(path.join(outputDir, 'make'), { recursive: true, force: true });
  run('npm', ['exec', '--', 'electron-forge', 'make', '--skip-package', '--targets', maker.target], electron, {
    ...process.env,
    SOLO_BUILD_VARIANT: variant,
    SOLO_EXCLUDE_INSTRUMENTS: variant === 'light' ? 'true' : 'false',
  });
  return verifyMakeArtifact(path.join(outputDir, 'make'), maker.extension);
}

export function buildDesktop() {
  const maker = makerForHost();
  const target = runtimeTarget();
  const assets = ensureSearchAssets(assetsDir, target);
  prepareVosk();
  run('npm', ['run', 'build:electron'], electron);

  // Package light first: even an old staged instrument cannot leak into the
  // lightweight package (forge excludes it from asar and extraResource).
  buildWeb(false);
  packageVariant('light');
  const lightArtifacts = makeVariant('light', maker);

  buildWeb(true);
  stageSearch(target, assets);
  packageVariant('extended');
  const extendedArtifacts = makeVariant('extended', maker);
  console.log(`\nInstallers:\n${[...lightArtifacts, ...extendedArtifacts].join('\n')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { buildDesktop(); } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
