# Home Assistant Desktop - Chinese Version

## Language Versions

[中文](README.md)/English 

This is a Chinese localized and Windows-optimized Home Assistant desktop client.

## Features

### Localization
- All menu items translated to Chinese
- Settings interface fully localized
- Error messages translated
- Added Chinese font support

### Windows Optimizations
- Single instance lock (prevents duplicate launches)
- Double-click tray icon to quickly open window
- Tray icon tooltip
- Optimized window size for Chinese display
- Taskbar pinning support
- Added window margins to avoid edge sticking
- Optimized dark theme display

## Keyboard Shortcuts

- `Ctrl + Alt + X` - Show/Hide window
- `Ctrl + Alt + Enter` - Toggle fullscreen mode

## Usage

1. Install dependencies:
```bash
npm install
```

2. Run development mode:
```bash
npm start
```

3. Build Windows version:
```bash
npm run build-local-win
```

## System Requirements

- Windows 10/11
- Node.js 16 or higher

## Original Project

This project is based on [iprodanovbg/homeassistant-desktop](https://github.com/iprodanovbg/homeassistant-desktop) with Chinese localization and optimizations.

## License

Apache License 2.0
