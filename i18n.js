const zh = {
  menu: {
    openInBrowser: '在浏览器中打开',
    addInstance: '添加其他实例...',
    autoSwitching: '自动切换实例',
    notConnected: '未连接...',
    showHideWindow: '显示/隐藏窗口',
    hoverToShow: '悬停显示',
    stayOnTop: '置顶显示',
    startAtLogin: '开机自启动',
    enableShortcut: '启用快捷键 (Ctrl+Alt+X)',
    detachedWindow: '使用独立窗口',
    fullscreen: '全屏模式 (Ctrl+Alt+回车)',
    version: '版本',
    viewOnGithub: '在 GitHub 上查看',
    restart: '重启应用',
    reset: '⚠️ 重置应用',
    quit: '退出',
    language: '语言',
    chinese: '中文',
    english: 'English'
  },
  dialog: {
    resetTitle: '确定要重置 Home Assistant 桌面版吗？',
    resetAll: '全部重置',
    resetWindows: '仅重置窗口',
    cancel: '取消'
  },
  tray: {
    tooltip: 'Home Assistant 桌面版 - 点击显示/隐藏'
  },
  index: {
    title: 'Home Assistant 桌面版',
    availableInstances: '发现的实例：',
    urlChecked: 'URL 验证成功，正在自动跳转到 Home Assistant...',
    urlPlaceholder: '例如：http://homeassistant.local:8123',
    urlLabel: 'Home Assistant 地址',
    urlInvalid: '请输入有效的 URL 地址',
    submit: '连接'
  },
  error: {
    message: '无法连接到 Home Assistant 实例，请检查您的网络连接。',
    reconnect: '重新连接',
    restart: '重启应用'
  }
};

const en = {
  menu: {
    openInBrowser: 'Open in Browser',
    addInstance: 'Add another Instance...',
    autoSwitching: 'Automatic Switching',
    notConnected: 'Not Connected...',
    showHideWindow: 'Show/Hide Window',
    hoverToShow: 'Hover to Show',
    stayOnTop: 'Stay on Top',
    startAtLogin: 'Start at Login',
    enableShortcut: 'Enable Shortcut (Ctrl+Alt+X)',
    detachedWindow: 'Use detached Window',
    fullscreen: 'Fullscreen Mode (Ctrl+Alt+Enter)',
    version: 'Version',
    viewOnGithub: 'View on GitHub',
    restart: 'Restart Application',
    reset: '⚠️ Reset Application',
    quit: 'Quit',
    language: 'Language',
    chinese: '中文',
    english: 'English'
  },
  dialog: {
    resetTitle: 'Are you sure you want to reset Home Assistant Desktop?',
    resetAll: 'Reset Everything!',
    resetWindows: 'Reset Windows',
    cancel: 'Cancel'
  },
  tray: {
    tooltip: 'Home Assistant Desktop - Click to show/hide'
  },
  index: {
    title: 'Home Assistant Desktop',
    availableInstances: 'Available Instances:',
    urlChecked: 'Your URL is checked, and you will be forwarded to Home Assistant automatically.',
    urlPlaceholder: 'e.g. http://homeassistant.local:8123',
    urlLabel: 'Home Assistant URL',
    urlInvalid: 'Please provide a valid url.',
    submit: 'Submit'
  },
  error: {
    message: 'Home Assistant instance is not available, please check your connection.',
    reconnect: 'Reconnect',
    restart: 'Restart'
  }
};

function getLang(lang) {
  return lang === 'zh' ? zh : en;
}

module.exports = { getLang, zh, en };
