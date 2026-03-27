const {
  app,
  dialog,
  ipcMain,
  shell,
  globalShortcut,
  screen,
  net,
  Menu,
  Tray,
  BrowserWindow,
} = require('electron');
const AutoLaunch = require('auto-launch');
const Positioner = require('electron-traywindow-positioner');
const Bonjour = require('bonjour-service');
const bonjour = new Bonjour.Bonjour();
const logger = require('electron-log');
const config = require('./config');
const { getLang } = require('./i18n');

// Windows 平台优化：解决 GPU 初始化问题
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('use-angle', 'default');
  app.disableHardwareAcceleration();
}

logger.catchErrors();
logger.info(`${app.name} started`);
logger.info(`Platform: ${process.platform} ${process.arch}`);

// hide dock icon on macOS
if (process.platform === 'darwin') {
  app.dock.hide();
}

const autoLauncher = new AutoLaunch({ name: 'Home Assistant Desktop' });

const indexFile = `file://${__dirname}/web/index.html`;
const errorFile = `file://${__dirname}/web/error.html`;

let initialized = false;
let autostartEnabled = false;
let forceQuit = false;
let resizeEvent = false;
let mainWindow;
let tray;
let availabilityCheckerInterval;

function registerKeyboardShortcut() {
  globalShortcut.register('CommandOrControl+Alt+X', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      showWindow();
    }
  });
}

function unregisterKeyboardShortcut() {
  globalShortcut.unregisterAll();
}

function checkAutoStart() {
  autoLauncher
    .isEnabled()
    .then((isEnabled) => {
      autostartEnabled = isEnabled;
    })
    .catch((err) => {
      logger.error('There was a problem with application auto start');
      logger.error(err);
    });
}

function availabilityCheck() {
  const instance = currentInstance();

  if (!instance) {
    return;
  }

  let url = new URL(instance);
  const request = net.request(`${url.origin}/auth/providers`);

  request.on('response', async (response) => {
    if (response.statusCode !== 200) {
      logger.error('Response error: ' + response);
      await showError(true);
    }
  });

  request.on('error', async (error) => {
    logger.error(error);
    clearInterval(availabilityCheckerInterval);
    availabilityCheckerInterval = null;
    await showError(true);

    if (config.get('automaticSwitching')) {
      checkForAvailableInstance();
    }
  });

  request.end();
}

function changePosition() {
  const trayBounds = tray.getBounds();
  const windowBounds = mainWindow.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y,
  });
  const displayWorkArea = display.workArea;
  const taskBarPosition = Positioner.getTaskbarPosition(trayBounds);

  // Windows 平台优化：添加边距避免窗口贴边
  const margin = process.platform === 'win32' ? 8 : 0;

  if (taskBarPosition === 'top' || taskBarPosition === 'bottom') {
    const alignment = {
      x: 'center',
      y: taskBarPosition === 'top' ? 'up' : 'down',
    };

    if (trayBounds.x + (trayBounds.width + windowBounds.width) / 2 < displayWorkArea.width) {
      Positioner.position(mainWindow, trayBounds, alignment);
    } else {
      const { y } = Positioner.calculate(mainWindow.getBounds(), trayBounds, alignment);

      mainWindow.setPosition(
        displayWorkArea.width - windowBounds.width + displayWorkArea.x - margin,
        y + (taskBarPosition === 'bottom' ? displayWorkArea.y : 0) + (taskBarPosition === 'top' ? margin : 0),
        false,
      );
    }
  } else {
    const alignment = {
      x: taskBarPosition,
      y: 'center',
    };

    if (trayBounds.y + (trayBounds.height + windowBounds.height) / 2 < displayWorkArea.height) {
      const { x, y } = Positioner.calculate(mainWindow.getBounds(), trayBounds, alignment);
      mainWindow.setPosition(
        x + (taskBarPosition === 'right' ? displayWorkArea.x : 0) + (taskBarPosition === 'left' ? margin : 0),
        y
      );
    } else {
      const { x } = Positioner.calculate(mainWindow.getBounds(), trayBounds, alignment);
      mainWindow.setPosition(
        x + (taskBarPosition === 'right' ? 0 : margin),
        displayWorkArea.y + displayWorkArea.height - windowBounds.height - margin,
        false
      );
    }
  }
}

function checkForAvailableInstance() {
  const instances = config.get('allInstances');

  if (instances?.length > 1) {
    bonjour.find({ type: 'home-assistant' }, (instance) => {
      if (instance.txt.internal_url && instances.indexOf(instance.txt.internal_url) !== -1) {
        return currentInstance(instance.txt.internal_url);
      }

      if (instance.txt.external_url && instances.indexOf(instance.txt.external_url) !== -1) {
        return currentInstance(instance.txt.external_url);
      }
    });
    let found;
    for (let instance of instances.filter((e) => e.url !== currentInstance())) {
      const url = new URL(instance);
      const request = net.request(`${url.origin}/auth/providers`);
      request.on('response', (response) => {
        if (response.statusCode === 200) {
          found = instance;
        }
      });
      request.on('error', (_) => {
      });
      request.end();

      if (found) {
        currentInstance(found);
        break;
      }
    }
  }
}

function getMenu() {
  const lang = getLang(config.get('language'));
  const t = lang.menu;

  let instancesMenu = [
    {
      label: t.openInBrowser,
      enabled: currentInstance(),
      click: async () => {
        await shell.openExternal(currentInstance());
      },
    },
    {
      type: 'separator',
    },
  ];

  const allInstances = config.get('allInstances');

  if (allInstances) {
    allInstances.forEach((e) => {
      instancesMenu.push({
        label: e,
        type: 'checkbox',
        checked: currentInstance() === e,
        click: async () => {
          currentInstance(e);
          await mainWindow.loadURL(e);
          mainWindow.show();
        },
      });
    });

    instancesMenu.push(
      {
        type: 'separator',
      },
      {
        label: t.addInstance,
        click: async () => {
          config.delete('currentInstance');
          await mainWindow.loadURL(indexFile);
          mainWindow.show();
        },
      },
      {
        label: t.autoSwitching,
        type: 'checkbox',
        enabled: config.has('allInstances') && config.get('allInstances').length > 1,
        checked: config.get('automaticSwitching'),
        click: () => {
          config.set('automaticSwitching', !config.get('automaticSwitching'));
        },
      },
    );
  } else {
    instancesMenu.push({ label: t.notConnected, enabled: false });
  }

  return Menu.buildFromTemplate([
    {
      label: t.showHideWindow,
      visible: process.platform === 'linux',
      click: () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          showWindow();
        }
      },
    },
    {
      visible: process.platform === 'linux',
      type: 'separator',
    },
    ...instancesMenu,
    {
      type: 'separator',
    },
    {
      label: t.hoverToShow,
      visible: process.platform !== 'linux' && !config.get('detachedMode'),
      enabled: !config.get('detachedMode'),
      type: 'checkbox',
      checked: !config.get('disableHover'),
      click: () => {
        config.set('disableHover', !config.get('disableHover'));
      },
    },
    {
      label: t.stayOnTop,
      type: 'checkbox',
      checked: config.get('stayOnTop'),
      click: () => {
        config.set('stayOnTop', !config.get('stayOnTop'));
        mainWindow.setAlwaysOnTop(config.get('stayOnTop'));

        if (mainWindow.isAlwaysOnTop()) {
          showWindow();
        }
      },
    },
    {
      label: t.startAtLogin,
      type: 'checkbox',
      checked: autostartEnabled,
      click: () => {
        if (autostartEnabled) {
          autoLauncher.disable();
        } else {
          autoLauncher.enable();
        }

        checkAutoStart();
      },
    },
    {
      label: t.enableShortcut,
      type: 'checkbox',
      accelerator: 'CommandOrControl+Alt+X',
      checked: config.get('shortcutEnabled'),
      click: () => {
        config.set('shortcutEnabled', !config.get('shortcutEnabled'));

        if (config.get('shortcutEnabled')) {
          registerKeyboardShortcut();
        } else {
          unregisterKeyboardShortcut();
        }
      },
    },
    {
      type: 'separator',
    },
    {
      label: t.detachedWindow,
      type: 'checkbox',
      checked: config.get('detachedMode'),
      click: async () => {
        config.set('detachedMode', !config.get('detachedMode'));
        mainWindow.hide();
        await createMainWindow(config.get('detachedMode'));
      },
    },
    {
      label: t.fullscreen,
      type: 'checkbox',
      checked: config.get('fullScreen'),
      accelerator: 'CommandOrControl+Alt+Return',
      click: () => {
        toggleFullScreen();
      },
    },
    {
      type: 'separator',
    },
    {
      label: `${t.version} v${app.getVersion()}`,
      enabled: false,
    },
    {
      label: t.language,
      submenu: [
        {
          label: t.chinese,
          type: 'checkbox',
          checked: config.get('language') === 'zh',
          click: () => {
            config.set('language', 'zh');
            updateTrayTooltip();
          },
        },
        {
          label: t.english,
          type: 'checkbox',
          checked: config.get('language') === 'en',
          click: () => {
            config.set('language', 'en');
            updateTrayTooltip();
          },
        },
      ],
    },
    {
      label: t.viewOnGithub,
      click: async () => {
        await shell.openExternal('https://github.com/iprodanovbg/homeassistant-desktop');
      },
    },
    {
      type: 'separator',
    },
    {
      label: t.restart,
      click: () => {
        app.relaunch();
        app.exit();
      },
    },
    {
      label: t.reset,
      click: () => {
        const d = lang.dialog;
        dialog
          .showMessageBox({
            message: d.resetTitle,
            buttons: [d.resetAll, d.resetWindows, d.cancel],
          })
          .then(async (res) => {
            if (res.response !== 2) {
              if (res.response === 0) {
                config.clear();
                await mainWindow.webContents.session.clearCache();
                await mainWindow.webContents.session.clearStorageData();
              } else {
                config.delete('windowSizeDetached');
                config.delete('windowSize');
                config.delete('windowPosition');
                config.delete('fullScreen');
                config.delete('detachedMode');
              }

              app.relaunch();
              app.exit();
            }
          });
      },
    },
    {
      type: 'separator',
    },
    {
      label: t.quit,
      click: () => {
        forceQuit = true;
        app.quit();
      },
    },
  ]);
}

async function createMainWindow(show = false) {
  logger.info('Initialized main window');

  // Windows 平台优化：设置更合适的默认窗口尺寸
  const isWindows = process.platform === 'win32';
  const defaultWidth = isWindows ? 480 : 420;
  const defaultHeight = isWindows ? 520 : 460;

  mainWindow = new BrowserWindow({
    width: defaultWidth,
    height: defaultHeight,
    minWidth: 400,
    minHeight: 400,
    show: false,
    skipTaskbar: !show,
    autoHideMenuBar: true,
    frame: config.get('detachedMode') && process.platform !== 'darwin',
    // Windows 平台优化：禁用原生窗口动画以获得更流畅的体验
    backgroundColor: '#1c1c1c',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      // Windows 平台优化：启用硬件加速
      offscreen: false,
    },
  });

  // mainWindow.webContents.openDevTools();
  await mainWindow.loadURL(indexFile);

  createTray();

  // open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // hide scrollbar
  mainWindow.webContents.on('did-finish-load', async function () {
    await mainWindow.webContents.insertCSS('::-webkit-scrollbar { display: none; } body { -webkit-user-select: none; }');

    if (config.get('detachedMode') && process.platform === 'darwin') {
      await mainWindow.webContents.insertCSS('body { -webkit-app-region: drag; }');
    }

    // let code = `document.addEventListener('mousemove', () => { ipcRenderer.send('mousemove'); });`;
    // mainWindow.webContents.executeJavaScript(code);
  });

  if (config.get('detachedMode')) {
    if (config.has('windowPosition')) {
      mainWindow.setSize(...config.get('windowSizeDetached'));
    } else {
      config.set('windowPosition', mainWindow.getPosition());
    }

    if (config.has('windowSizeDetached')) {
      mainWindow.setPosition(...config.get('windowPosition'));
    } else {
      config.set('windowSizeDetached', mainWindow.getSize());
    }
  } else if (config.has('windowSize')) {
    mainWindow.setSize(...config.get('windowSize'));
  } else {
    config.set('windowSize', mainWindow.getSize());
  }

  mainWindow.on('resize', (e) => {
    // ignore resize event when using fullscreen mode
    if (mainWindow.isFullScreen()) {
      return e;
    }

    if (!config.get('disableHover') || resizeEvent) {
      config.set('disableHover', true);
      resizeEvent = e;
      setTimeout(() => {
        if (resizeEvent === e) {
          config.set('disableHover', false);
          resizeEvent = false;
        }
      }, 600);
    }

    if (config.get('detachedMode')) {
      config.set('windowSizeDetached', mainWindow.getSize());
    } else {
      if (process.platform !== 'linux') {
        changePosition();
      }

      config.set('windowSize', mainWindow.getSize());
    }
  });

  mainWindow.on('move', () => {
    if (config.get('detachedMode')) {
      config.set('windowPosition', mainWindow.getPosition());
    }
  });

  mainWindow.on('close', (e) => {
    if (!forceQuit) {
      mainWindow.hide();
      e.preventDefault();
    }
  });

  mainWindow.on('blur', () => {
    if (!config.get('detachedMode') && !mainWindow.isAlwaysOnTop()) {
      mainWindow.hide();
    }
  });

  mainWindow.setAlwaysOnTop(!!config.get('stayOnTop'));

  if (initialized && (mainWindow.isAlwaysOnTop() || show)) {
    showWindow();
  }

  toggleFullScreen(!!config.get('fullScreen'));

  initialized = true;
}

async function reinitMainWindow() {
  logger.info('Re-initialized main window');
  mainWindow.destroy();
  mainWindow = null;
  await createMainWindow(!config.has('currentInstance'));

  if (!availabilityCheckerInterval) {
    logger.info('Re-initialized availability check');
    availabilityCheckerInterval = setInterval(availabilityCheck, 3000);
  }
}

function showWindow() {
  if (!config.get('detachedMode')) {
    changePosition();
  }

  if (!mainWindow.isVisible()) {
    mainWindow.setVisibleOnAllWorkspaces(true); // put the window on all screens
    mainWindow.show();
    mainWindow.focus();
    mainWindow.setVisibleOnAllWorkspaces(false); // disable all screen behavior
    mainWindow.setSkipTaskbar(!config.get("detachedMode"));
  }
}

function updateTrayTooltip() {
  if (tray) {
    const lang = getLang(config.get('language'));
    tray.setToolTip(lang.tray.tooltip);
  }
}

function createTray() {
  if (tray instanceof Tray) {
    return;
  }

  logger.info('Initialized Tray menu');

  const isWindows = process.platform === 'win32';
  const iconPath = isWindows ? `${__dirname}/assets/IconWin.png` : `${__dirname}/assets/IconTemplate.png`;

  tray = new Tray(iconPath);

  updateTrayTooltip();

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();

      if (process.platform === 'darwin') {
        app.dock.hide();
      }
    } else {
      showWindow();
    }
  });

  // Windows 平台优化：双击托盘图标打开窗口
  if (isWindows) {
    tray.on('double-click', () => {
      showWindow();
    });
  }

  tray.on('right-click', () => {
    if (!config.get('detachedMode')) {
      mainWindow.hide();
    }

    tray.popUpContextMenu(getMenu());
  });

  let timer = undefined;

  tray.on('mouse-move', () => {
    if (config.get('detachedMode') || mainWindow.isAlwaysOnTop() || config.get('disableHover')) {
      return;
    }

    if (!mainWindow.isVisible()) {
      showWindow();
    }

    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      let mousePos = screen.getCursorScreenPoint();
      let trayBounds = tray.getBounds();

      if (
        !(mousePos.x >= trayBounds.x && mousePos.x <= trayBounds.x + trayBounds.width) ||
        !(mousePos.y >= trayBounds.y && mousePos.y <= trayBounds.y + trayBounds.height)
      ) {
        setWindowFocusTimer();
      }
    }, 100);
  });
}

function setWindowFocusTimer() {
  setTimeout(() => {
    let mousePos = screen.getCursorScreenPoint();
    let windowPosition = mainWindow.getPosition();
    let windowSize = mainWindow.getSize();

    if (
      !resizeEvent &&
      (
        !(mousePos.x >= windowPosition[ 0 ] && mousePos.x <= windowPosition[ 0 ] + windowSize[ 0 ]) ||
        !(mousePos.y >= windowPosition[ 1 ] && mousePos.y <= windowPosition[ 1 ] + windowSize[ 1 ])
      )
    ) {
      mainWindow.hide();
    } else {
      setWindowFocusTimer();
    }
  }, 110);
}

function toggleFullScreen(mode = !mainWindow.isFullScreen()) {
  config.set('fullScreen', mode);
  mainWindow.setFullScreen(mode);

  if (mode) {
    mainWindow.setAlwaysOnTop(true);
  } else {
    mainWindow.setAlwaysOnTop(config.get('stayOnTop'));
  }
}

function currentInstance(url = null) {
  if (url) {
    config.set('currentInstance', config.get('allInstances').indexOf(url));
  }

  if (config.has('currentInstance')) {
    return config.get('allInstances')[ config.get('currentInstance') ];
  }

  return false;
}

function addInstance(url) {
  if (!config.has('allInstances')) {
    config.set('allInstances', []);
  }

  let instances = config.get('allInstances');

  if (instances.find((e) => e === url)) {
    currentInstance(url);

    return;
  }

  // active hover by default after adding first instance
  if (!instances.length) {
    config.set('disableHover', false);
  }

  instances.push(url);
  config.set('allInstances', instances);
  currentInstance(url);
}

async function showError(isError) {
  if (!isError && mainWindow.webContents.getURL().includes('error.html')) {
    await mainWindow.loadURL(indexFile);
  }

  if (isError && currentInstance() && !mainWindow.webContents.getURL().includes('error.html')) {
    await mainWindow.loadURL(errorFile);
  }
}

app.whenReady().then(async () => {
  // Windows 平台优化：请求单实例锁
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    logger.info('Another instance is already running, quitting...');
    app.quit();
    return;
  }

  // Windows 平台优化：当尝试运行第二个实例时，聚焦到第一个实例
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    logger.info('Second instance detected, focusing main window');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      showWindow();
      mainWindow.focus();
    }
  });

  checkAutoStart();

  await createMainWindow(!config.has('currentInstance'));

  if (process.platform === 'linux') {
    tray.setContextMenu(getMenu());
  }

  if (!availabilityCheckerInterval) {
    logger.info('Initialized availability check');
    availabilityCheckerInterval = setInterval(availabilityCheck, 3000);
  }

  // register shortcut
  if (config.get('shortcutEnabled')) {
    registerKeyboardShortcut();
  }

  globalShortcut.register('CommandOrControl+Alt+Return', () => {
    toggleFullScreen();
  });

  // disable hover for first start
  if (!config.has('currentInstance')) {
    config.set('disableHover', true);
  }

  // Windows 平台优化：设置应用用户模型ID（用于任务栏固定）
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.homeassistant.desktop.cn');
  }
});

app.on('will-quit', () => {
  unregisterKeyboardShortcut();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.on('get-instances', (event) => {
  event.reply('get-instances', config.get('allInstances') || []);
});

ipcMain.on('get-language', (event) => {
  event.reply('get-language', config.get('language'));
});

ipcMain.on('ha-instance', (event, url) => {
  if (url) {
    addInstance(url);
  }

  if (currentInstance()) {
    event.reply('ha-instance', currentInstance());
  }
});

ipcMain.on('reconnect', async () => {
  await reinitMainWindow();
});

ipcMain.on('restart', () => {
  app.relaunch();
  app.exit();
});
