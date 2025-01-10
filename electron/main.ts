import { app, BrowserWindow, ipcMain, desktopCapturer, WebContents, clipboard, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { keyboard, Key } from '@nut-tree-fork/nut-js';

keyboard.config.autoDelayMs = 0;

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;

function logToFile(message: string) {
  const logPath = app.getPath('userData') + '/app.log';
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logPath, `${timestamp}: ${message}\n`);
}

async function createWindow() {
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
  logToFile(`Starting app in ${isDev ? 'development' : 'production'} mode`);

  // Resolve icon path differently for dev mode
  let iconPath;
  if (isDev) {
    // In development, try multiple possible locations
    const devPossiblePaths = [
      path.resolve(__dirname, '..', 'icons'),
      path.resolve(__dirname, '..', 'public', 'icons'),
      path.resolve(process.cwd(), 'public', 'icons'),
      path.resolve(process.cwd(), 'build', 'icons')
    ];

    for (const basePath of devPossiblePaths) {
      const testPath = path.join(basePath, process.platform === 'darwin' ? 'icon.icns' : 'icon.ico');
      logToFile(`Trying dev icon path: ${testPath}`);
      if (fs.existsSync(testPath)) {
        iconPath = testPath;
        logToFile(`Found icon at: ${testPath}`);
        break;
      }
    }

    if (!iconPath) {
      logToFile('Warning: Could not find icon file in development mode');
      // Fallback to a path that will be logged for debugging
      iconPath = path.resolve(process.cwd(), 'public', 'icons', process.platform === 'darwin' ? 'icon.icns' : 'icon.ico');
    }
  } else {
    // Production path resolution (existing code)
    const possiblePaths = [
      path.join(process.resourcesPath, 'public', 'icons'),
      path.join(app.getAppPath(), 'public', 'icons'),
      path.join(__dirname, '..', 'public', 'icons')
    ];

    for (const basePath of possiblePaths) {
      const testPath = path.join(basePath, process.platform === 'darwin' ? 'icon.icns' : 'icon.ico');
      if (fs.existsSync(testPath)) {
        iconPath = testPath;
        break;
      }
      logToFile(`Tried icon path: ${testPath} - exists: ${fs.existsSync(testPath)}`);
    }

    if (!iconPath) {
      logToFile('Warning: Could not find icon file in any expected location');
      iconPath = path.join(__dirname, '..', 'public', 'icons', process.platform === 'darwin' ? 'icon.icns' : 'icon.ico');
    }
  }
  
  logToFile(`Using icon path: ${iconPath}`);
  try {
    const iconDir = path.dirname(iconPath);
    if (!fs.existsSync(iconDir)) {
      logToFile(`Icon directory doesn't exist: ${iconDir}`);
    } else {
      logToFile(`Icon directory contents: ${fs.readdirSync(iconDir)}`);
    }
  } catch (error) {
    logToFile(`Error checking icon path: ${error}`);
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    // For macOS, set the app icon explicitly
    ...(process.platform === 'darwin' ? {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 10, y: 10 }
    } : {}),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,  // Temporarily disable for debugging
      devTools: true
    },
  });

  // Set dock icon explicitly for macOS
  if (process.platform === 'darwin' && fs.existsSync(iconPath)) {
    try {
      const dockIcon = nativeImage.createFromPath(iconPath);
      if (!dockIcon.isEmpty()) {
        app.dock.setIcon(dockIcon);
      } else {
        logToFile('Warning: Dock icon image is empty');
      }
    } catch (error) {
      logToFile(`Error setting dock icon: ${error}`);
    }
  }

  // Set permissions for media access
  if (mainWindow) {
    mainWindow.webContents.session.setPermissionRequestHandler((
      webContents: WebContents,
      permission: string,
      callback: (granted: boolean) => void
    ) => {
      const allowedPermissions = ['media', 'display-capture', 'screen', 'mediaKeySystem'];
      if (allowedPermissions.includes(permission)) {
        callback(true);
      } else {
        callback(false);
      }
    });

    // Enable screen capture
    mainWindow.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
      mainWindow?.webContents.send('show-screen-picker');
      callback({}); // Let the renderer handle source selection
    });

    let loadUrl: string;
    if (isDev) {
      loadUrl = 'http://localhost:3000';
    } else {
      // In production, use the app.getAppPath() to get the correct base path
      const appPath = app.getAppPath();
      // Remove .asar from the path to access unpacked resources
      const basePath = appPath.replace('.asar', '.asar.unpacked');
      const indexPath = path.join(basePath, 'build', 'index.html');
      
      // Log more details about the paths
      logToFile(`Base path: ${basePath}`);
      logToFile(`Index path: ${indexPath}`);
      logToFile(`Directory contents of build:`);
      try {
        const buildContents = fs.readdirSync(path.join(basePath, 'build'));
        logToFile(JSON.stringify(buildContents, null, 2));
      } catch (error) {
        logToFile(`Error reading build directory: ${error}`);
      }
      
      loadUrl = `file://${indexPath}`;
    }
    
    logToFile(`App path: ${app.getAppPath()}`);
    logToFile(`Attempting to load URL: ${loadUrl}`);
    logToFile(`Build path exists: ${fs.existsSync(loadUrl.replace('file://', ''))}`);

    try {
      await mainWindow.loadURL(loadUrl);
      logToFile('Successfully loaded the window URL');
    } catch (error) {
      logToFile(`Error loading URL: ${error}`);
    }

    // Log when the page finishes loading
    mainWindow.webContents.on('did-finish-load', () => {
      logToFile('Page finished loading');
    });

    // Log any errors that occur during page load
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      logToFile(`Failed to load: ${errorDescription} (${errorCode})`);
    });

    // Add console logging from the renderer process
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      logToFile(`Console [${level}]: ${message} (${sourceId}:${line})`);
    });

    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  }

  createOverlayWindow();
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 800,
    height: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  overlayWindow.setIgnoreMouseEvents(true);
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            background: transparent;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          }
          #subtitles {
            background-color: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 15px 30px;
            border-radius: 10px;
            font-size: 24px;
            font-weight: 500;
            text-align: center;
            max-width: 80%;
            opacity: 0;
            transition: opacity 0.2s ease-in-out;
            position: relative;
            text-rendering: optimizeLegibility;
            -webkit-font-smoothing: antialiased;
          }
          #subtitles.visible {
            opacity: 1;
          }
        </style>
      </head>
      <body>
        <div id="subtitles"></div>
        <script>
          const { ipcRenderer } = require('electron');
          const subtitles = document.getElementById('subtitles');
          
          ipcRenderer.on('update-subtitles', (event, text) => {
            if (text) {
              // First remove the visible class to trigger fade out
              subtitles.classList.remove('visible');
              
              // Wait for the fade out transition to complete
              setTimeout(() => {
                subtitles.textContent = text;
                subtitles.style.display = 'block';
                // Force a reflow to ensure the transition works
                subtitles.offsetHeight;
                subtitles.classList.add('visible');
              }, 200);
            } else {
              subtitles.classList.remove('visible');
              setTimeout(() => {
                subtitles.style.display = 'none';
                subtitles.textContent = '';
              }, 200);
            }
          });
        </script>
      </body>
    </html>
  `;

  overlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
}

// Handle IPC for screen sharing
ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 150, height: 150 }
  });
  return sources;
});

// Add this with other IPC handlers
ipcMain.handle('read-selection', async () => {
  return await getSelectedText();
});

// Add this after the other ipcMain handlers
ipcMain.on('write-text', async (event, content) => {
  try {
    // Save the current clipboard content
    const previousClipboard = clipboard.readText();
    
    // Set new content to clipboard
    clipboard.writeText(content);
    
    // Simulate Cmd+V (for macOS) or Ctrl+V (for other platforms)
    const modifier = process.platform === 'darwin' ? Key.LeftCmd : Key.LeftControl;
    await keyboard.pressKey(modifier, Key.V);
    await keyboard.releaseKey(modifier, Key.V);
    
    // Restore previous clipboard content after a short delay
    setTimeout(() => {
      clipboard.writeText(previousClipboard);
    }, 100);
  } catch (error) {
    logToFile(`Error writing text: ${error}`);
  }
});

// Add these new IPC handlers before app.on('ready', ...)
ipcMain.handle('list-windows', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 0, height: 0 }  // Set to 0 for better performance since we don't need thumbnails
  });
  
  return sources.map(source => ({
    id: source.id,
    title: source.name,
    display_id: source.display_id,
    appIcon: source.appIcon
  }));
});

ipcMain.handle('focus-window', async (event, windowId: string) => {
  try {
    if (process.platform === 'darwin') {
      // First get the window details to get its title
      const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 0, height: 0 }
      });
      
      const targetWindow = sources.find(source => source.id === windowId);
      if (!targetWindow) {
        console.error('Window not found:', windowId);
        return false;
      }

      const { exec } = require('child_process');
      // Escape any double quotes in the window title
      const escapedTitle = targetWindow.name.replace(/"/g, '\\"');
      const script = `
        tell application "System Events"
          set targetWindow to "${escapedTitle}"
          repeat with p in processes
            if exists (window 1 of p whose name contains targetWindow) then
              set frontmost of p to true
              return
            end if
          end repeat
        end tell
      `;
      
      return new Promise((resolve) => {
        exec(`osascript -e '${script}'`, (error: any) => {
          if (error) {
            console.error('Error focusing window:', error);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    }
    return false;
  } catch (error) {
    console.error('Error focusing window:', error);
    return false;
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.on('update-subtitles', (event, text) => {
  if (overlayWindow) {
    overlayWindow.webContents.send('update-subtitles', text);
    if (text) {
      overlayWindow.showInactive();
    } else {
      overlayWindow.hide();
    }
  }
});

ipcMain.on('remove-subtitles', () => {
  if (overlayWindow) {
    overlayWindow.hide();
  }
});

// Add this after the other ipcMain handlers
ipcMain.on('paste-content', async (event, content) => {
  try {
    // Save the current clipboard content
    const previousClipboard = clipboard.readText();
    
    // Set new content to clipboard
    clipboard.writeText(content);
    
    // Simulate Cmd+V (for macOS) or Ctrl+V (for other platforms)
    const modifier = process.platform === 'darwin' ? Key.LeftCmd : Key.LeftControl;
    await keyboard.pressKey(modifier, Key.V);
    await keyboard.releaseKey(modifier, Key.V);
    
    // Restore previous clipboard content after a short delay
    setTimeout(() => {
      clipboard.writeText(previousClipboard);
    }, 100);
  } catch (error) {
    logToFile(`Error pasting content: ${error}`);
  }
});

async function getSelectedText() {
  try {
    // Save current clipboard content
    const previousClipboard = clipboard.readText();
    
    // Simulate Cmd+C (for macOS) or Ctrl+C (for other platforms)
    const modifier = process.platform === 'darwin' ? Key.LeftCmd : Key.LeftControl;
    await keyboard.pressKey(modifier, Key.C);
    await keyboard.releaseKey(modifier, Key.C);
    
    // Wait a bit for the clipboard to update
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Get the selected text from clipboard
    const selectedText = clipboard.readText();
    console.log("selectedText", selectedText);
    
    // Restore previous clipboard content
    clipboard.writeText(previousClipboard);
    
    return selectedText;
  } catch (error) {
    logToFile(`Error getting selected text: ${error}`);
    return '';
  }
}

// Add this with other IPC handlers
ipcMain.handle('get-selected-text', async () => {
  return await getSelectedText();
}); 