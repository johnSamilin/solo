import fs from 'node:fs';
import path from 'node:path';

// When set, the bundled ONNX instruments are excluded from the packaged app
// (primarily intended for the .deb build to keep it lightweight).
const EXCLUDE_INSTRUMENTS = process.env.SOLO_EXCLUDE_INSTRUMENTS === 'true';

const INSTRUMENT_FILES = [
  'onnx-runtime',
  'model.json',
  'model.onnx',
  'tokenizer.json',
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Electron-packager `ignore` patterns are matched against the path relative to
// the app directory, so the instruments bundled inside `electron/dist` are
// matched as `/electron/dist/instruments/<name>`.
function instrumentIgnorePatterns() {
  return INSTRUMENT_FILES.map(
    (name) => new RegExp(`^/electron/dist/instruments/${escapeRegExp(name)}($|/)`),
  );
}

// `extraResource` is copied wholesale and does not honor `ignore`, so the
// instruments copied into `resources/dist/instruments` are removed here.
function removeInstrumentsFrom(outputPath) {
  const resourceDirs = [
    path.join(outputPath, 'resources'),
    path.join(outputPath, 'Contents', 'Resources'),
  ];

  for (const resourcesDir of resourceDirs) {
    const instrumentsPath = path.join(resourcesDir, 'dist', 'instruments');
    if (!fs.existsSync(instrumentsPath)) continue;

    for (const name of INSTRUMENT_FILES) {
      fs.rmSync(path.join(instrumentsPath, name), { recursive: true, force: true });
    }
  }
}

export default {
  packagerConfig: {
    name: 'Solo',
    executableName: 'solo',
    icon: '../../assets/icons/png/512x512.png',
    asar: true,
    extraResource: [
      './electron/dist'
    ],
    osxSign: {},
    osxNotarize: undefined,
    ...(EXCLUDE_INSTRUMENTS ? { ignore: instrumentIgnorePatterns() } : {}),
  },
  hooks: {
    ...(EXCLUDE_INSTRUMENTS
      ? {
          postPackage: async (_forgeConfig, { outputPaths }) => {
            for (const outputPath of outputPaths) {
              removeInstrumentsFrom(outputPath);
            }
          },
        }
      : {}),
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'solo',
        icon: '../../assets/icons/win/icon.ico'
      },
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        icon: '../../assets/icons/png/512x512.png',
        options: {
          maintainer: 'Alexander Saltykov',
          homepage: 'https://github.com/johnSamilin/solo',
        },
      },
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO',
        icon: '../../assets/icons/mac/icon.icns'
      },
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'johnSamilin',
          name: 'solo'
        },
        prerelease: false,
        draft: true
      }
    }
  ]
};
