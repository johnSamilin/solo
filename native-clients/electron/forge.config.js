export default {
  packagerConfig: {
    name: 'Solo',
    executableName: 'solo',
    icon: './build/icon',
    asar: true,
    extraResource: [
      './electron/dist'
    ],
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
};
