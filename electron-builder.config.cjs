/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
module.exports = {
  appId: "net.johnsamilin.solo",
  productName: "Solo",
  directories: {
    output: "release/${version}",
    buildResources: "electron/resources"
  },
  files: [
    "dist/**/*",
    "electron/**/*"
  ],
  mac: {
    target: ["dmg", "zip"],
    category: "public.app-category.productivity",
    icon: "assets/icons/mac/icon.icns"
  },
  win: {
    target: ["nsis", "portable"],
    icon: "assets/icons/win/icon.ico"
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true
  },
  linux: {
    target: ["AppImage", "deb"],
    icon: "assets/icons/png"
  }
};