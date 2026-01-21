export default {
  packagerConfig: {
    name: 'Solo',
    executableName: 'solo',
    icon: './build/icon',
    asar: true,
    extraResource: [
      './electron/dist'
    ],
    osxSign: {},
    osxNotarize: undefined,
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'solo',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
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
