const Store = require('electron-store');

module.exports = new Store({
  defaults: {
    language: 'zh',
    automaticSwitching: true,
    detachedMode: false,
    disableHover: false,
    stayOnTop: false,
    fullScreen: false,
    shortcutEnabled: false,
    allInstances: []
  }
});
