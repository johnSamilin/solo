import fs from 'node:fs';
import path from 'node:path';

// The build orchestrator packages each variant into its own out/ subdirectory.
const BUILD_VARIANT = process.env.SOLO_BUILD_VARIANT;
const EXCLUDE_INSTRUMENTS = BUILD_VARIANT === 'light' || process.env.SOLO_EXCLUDE_INSTRUMENTS === 'true';

// `extraResource` copies electron/dist wholesale (ignore does not apply), so
// strip only semantic search from the lightweight package's resources.
function removeInstrumentsFrom(outputPath) {
  const resourceDirs = [
    path.join(outputPath, 'resources'),
    path.join(outputPath, 'Solo.app', 'Contents', 'Resources'),
    path.join(outputPath, 'Contents', 'Resources'),
  ];

  for (const resourcesDir of resourceDirs) {
    fs.rmSync(path.join(resourcesDir, 'dist', 'instruments', 'semantic-search'), { recursive: true, force: true });
  }
}

export default {
  ...(BUILD_VARIANT ? { buildIdentifier: BUILD_VARIANT } : {}),
  packagerConfig: {
    name: 'Solo',
    executableName: 'solo',
    icon: '../../assets/icons/png/512x512.png',
    asar: true,
    extraResource: [
      './electron/dist',
      './models',
      './libvosk'
    ],
    // `libvosk` and `models` are copied via `extraResource` (outside the asar).
    // They must NOT also be packed into the asar, otherwise `findLibvoskPath`
    // resolves to `app.asar/libvosk/...` and `dlopen` can't load a dylib from
    // inside the asar.
    ignore: [
      // Never bundle previous Forge outputs back into the next package.
      /^\/out(\/|$)/,
      /^\/libvosk(\/|$)/,
      /^\/models(\/|$)/,
      // Only resources/dist contains the instrument; never duplicate it in app.asar.
      /^\/electron\/dist\/instruments\/semantic-search(\/|$)/,
    ],
    osxSign: {},
    osxNotarize: undefined,
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
