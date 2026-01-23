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
