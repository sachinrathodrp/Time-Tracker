const { app, BrowserWindow, ipcMain, screen, dialog, autoUpdater } = require('electron');
const path = require('path');
const fs = require('fs');
const activeWin = require('active-win');
const powerMonitor = require('electron').powerMonitor;
const AutoLaunch = require('electron-auto-launch');

let mainWindow; // Main login window
let homeWindow; // Home window after login
let miniIconWindow = null; // Mini-icon window for home window


// Create the login window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 500,
    resizable: false,
    skipTaskbar: true,
    center: true, // Ensure the window opens in the center of the screen
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: process.platform === 'darwin'
      ? path.join(__dirname, 'assets/icons/icon512.icns')
      : path.join(__dirname, 'assets/icons/icon256.png'),
    autoHideMenuBar: true,
  });

  mainWindow.loadFile('src/index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Function to create the home window with mac and windows support
function createHomeWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workArea;

  const windowWidth = 280;
  const windowHeight = 25;

 homeWindow = new BrowserWindow({
     width: windowWidth,
     height: windowHeight,
     x: width - windowWidth,
     y: 0,
     resizable: true,
     alwaysOnTop: true,
     transparent: true, // Keep transparency
     frame: false,
     hasShadow: false,
     skipTaskbar: true,
     vibrancy: 'light', // Add vibrancy for better transparency
     webPreferences: {
       nodeIntegration: true,
       contextIsolation: false,
       enableRemoteModule: true,
       webviewTag: true,
     },
     roundedCorners: true,
     icon: process.platform === 'darwin'
       ? path.join(__dirname, 'assets/icons/icon512.icns')
       : path.join(__dirname, 'assets/icons/icon256.png'),
     autoHideMenuBar: true,
     useContentSize: true,
     backgroundColor: '#00000000', // Fully transparent background
   });
 
 // Add this after loading the file
 homeWindow.webContents.on('did-finish-load', () => {
   // Inject CSS to hide scrollbars and add rounded corners
   homeWindow.webContents.insertCSS(`
    body {
        -webkit-app-region: drag;
        overflow: hidden !important;
        user-select: none  !important;
        background: rgba(255, 255, 255, 0.9)  !important;
        border-radius: 10px  !important; /* Add rounded corners */
        backdrop-filter: blur(10px);
      }
      button, input, a, svg {
        -webkit-app-region: no-drag;
      }
  `);
 });

  // Side-snapping logic (Windows-only)
  if (process.platform !== 'darwin') {
    function snapToSide(x, y) {
      const snapThreshold = 50;
      const screenWidth = primaryDisplay.workArea.width;
      const snappedWidth = windowWidth;
      if (x <= snapThreshold) {
        homeWindow.setBounds({ x: 0, y, width: snappedWidth, height: windowHeight });
        return 'left';
      } else if (x >= screenWidth - snappedWidth - snapThreshold) {
        homeWindow.setBounds({ x: screenWidth - snappedWidth, y, width: snappedWidth, height: windowHeight });
        return 'right';
      }
      return null;
    }

    homeWindow.on('move', () => {
      const [x, y] = homeWindow.getPosition();
      const snappedSide = snapToSide(x, y);
      homeWindow.webContents.send('window-snapped', snappedSide);
    });
  }

  // Mini-icon window creation
  function createMiniIconWindow() {
    if (miniIconWindow && !miniIconWindow.isDestroyed()) {
      miniIconWindow.destroy();
    }

    const updateMiniIconPosition = () => {
      if (miniIconWindow && !miniIconWindow.isDestroyed() && homeWindow && !homeWindow.isDestroyed()) {
        const [homeX, homeY] = homeWindow.getPosition();
        const [homeWidth, homeHeight] = homeWindow.getSize();
        
        // Adjust X position to be always near the right edge of home window
        const miniIconX = homeX + homeWidth - 50;
        
        // Adjust Y position to be always at the bottom of home window
        const miniIconY = homeY + homeHeight - 28;
        
        miniIconWindow.setBounds({ 
          x: miniIconX + 20, 
          y: miniIconY,
          width: 35,
          height: 50
        });
      }
    };

    miniIconWindow = new BrowserWindow({
      width: 35,
      height: 50,
      x: 0, // Temporary position, will be updated immediately
      y: 0, // Temporary position, will be updated immediately
      frame: false,
      transparent: process.platform !== 'darwin',
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
      // Add border radius
      borderRadius: 10,
    });

    // Initial positioning
    updateMiniIconPosition();

    const miniIconContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          html, body { 
            margin: 0; 
            padding: 0; 
            overflow: hidden; 
            background: transparent; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            cursor: pointer; 
            -webkit-app-region: drag; 
            user-select: none; 
            border-radius: 10px; 
          }
          svg { transition: transform 0.2s ease; max-width: 100%; max-height: 100%; -webkit-app-region: no-drag; }
          svg:hover { transform: scale(1.2); }
        </style>
      </head>
      <body>
        <svg width="30px" height="30px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 8V12L15 15" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="12" cy="12" r="10" stroke="#2ecc71" stroke-width="2" opacity="0.2"/>
        </svg>
        <script>
          const { ipcRenderer } = require('electron');
          document.body.addEventListener('mouseenter', () => ipcRenderer.send('show-home-window-on-hover'));
          document.body.addEventListener('click', () => ipcRenderer.send('show-home-window'));
        </script>
      </body>
      </html>
    `;

    miniIconWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(miniIconContent)}`);
    miniIconWindow.on('close', (event) => event.preventDefault());

    // Multiple event listeners to ensure accurate positioning
    homeWindow.on('move', updateMiniIconPosition);
    homeWindow.on('resize', updateMiniIconPosition);
    
    // Additional positioning check after a short delay to handle complex window movements
    setTimeout(updateMiniIconPosition, 100);
  }

  // Auto-hide logic
  let hideTimer = null;
  let isMouseOverHomeWindow = false;

  homeWindow.webContents.on('did-finish-load', () => {
    homeWindow.webContents.executeJavaScript(`
      document.addEventListener('mouseenter', () => require('electron').ipcRenderer.send('home-window-mouse-enter'));
      document.addEventListener('mouseleave', () => require('electron').ipcRenderer.send('home-window-mouse-leave'));
    `);
  });

  ipcMain.on('home-window-mouse-enter', () => {
    isMouseOverHomeWindow = true;
    if (hideTimer) clearTimeout(hideTimer);
  });

  ipcMain.on('home-window-mouse-leave', () => {
    isMouseOverHomeWindow = false;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!isMouseOverHomeWindow) {
        homeWindow.hide();
        if (!miniIconWindow || miniIconWindow.isDestroyed()) createMiniIconWindow();
        miniIconWindow.show();
      }
    }, 10000);
  });

  ipcMain.on('show-home-window-on-hover', () => {
    homeWindow.show();
    if (miniIconWindow && !miniIconWindow.isDestroyed()) miniIconWindow.hide();
    if (hideTimer) clearTimeout(hideTimer);
  });

  ipcMain.on('show-home-window', () => {
    homeWindow.show();
    if (miniIconWindow && !miniIconWindow.isDestroyed()) miniIconWindow.hide();
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!isMouseOverHomeWindow) {
        homeWindow.hide();
        if (!miniIconWindow || miniIconWindow.isDestroyed()) createMiniIconWindow();
        miniIconWindow.show();
      }
    }, 10000);
  });

  homeWindow.on('ready-to-show', () => {
    homeWindow.show();
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!isMouseOverHomeWindow) {
        homeWindow.hide();
        if (!miniIconWindow || miniIconWindow.isDestroyed()) createMiniIconWindow();
        miniIconWindow.show();
      }
    }, 10000);
  });

  homeWindow.loadFile('src/home.html');
  homeWindow.on('close', (event) => {
    event.preventDefault();
    homeWindow.hide();
    if (!miniIconWindow || miniIconWindow.isDestroyed()) createMiniIconWindow();
    miniIconWindow.show();
  });
}

// Uninstall Cleanup Function with mac and windows support
function resetApplicationState() {
  const cleanupPaths = [
    path.join(app.getPath('userData'), 'token.json'),
    path.join(app.getPath('home'), '.time-tracking-app', 'token.json'),
    path.join(app.getPath('appData'), 'time-tracking-app', 'token.json'),
  ];

  cleanupPaths.forEach((tokenPath) => {
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
      console.log(`Removed ${tokenPath}`);
    }
  });

  global.isAuthenticated = false;
  global.userToken = null;
}

// Uninstall Cleanup Function with mac and windows support
function createLoginWindow() {
  if (mainWindow) mainWindow.close();
  if (!checkForToken()) resetApplicationState();
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
    resizable: false,
    autoHideMenuBar: true,
    title: 'Time Tracker - Login',
    icon: process.platform === 'darwin'
      ? path.join(__dirname, 'assets/icons/icon512.icns')
      : path.join(__dirname, 'assets/icons/icon256.png'),
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.webContents.session.clearStorageData({
    storages: ['appcache', 'cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers'],
  });
  mainWindow.on('closed', () => (mainWindow = null));
}


// Check for token in storage
function checkForToken() {
  try {
    const tokenPath = path.join(app.getPath('userData'), 'token.json');
    console.log('Checking token at path:', tokenPath);

    // If no token file exists, return false
    if (!fs.existsSync(tokenPath)) {
      console.log('No token file found');
      return false;
    }

    // Read and parse token file
    const fileContent = fs.readFileSync(tokenPath, 'utf-8');
    console.log('Token file content:', fileContent);

    const tokenData = JSON.parse(fileContent);
    
    // Log expiration if it exists
    if (tokenData.expiration) {
      console.log('Token expiration:', tokenData.expiration);
      const expirationDate = new Date(tokenData.expiration);
      if (expirationDate <= new Date()) {
        console.log('Token has expired.');
        return false; // Token is expired
      }
    }

    // Validate token structure and expiration
    const isTokenValid = tokenData && 
                         tokenData.token && 
                         (!tokenData.expiration || 
                          new Date(tokenData.expiration) > new Date());

    console.log('Token validation result:', isTokenValid);
    return isTokenValid;
  } catch (error) {
    console.error('Error checking token:', error);
    return false;
  }
}

// Function to initialize the correct window
function initializeWindow() {
  // Clear any existing windows first
  const existingWindows = BrowserWindow.getAllWindows();
  existingWindows.forEach(window => {
    if (!window.isDestroyed()) {
      window.close();
    }
  });

  // Reset global window references
  mainWindow = null;
  homeWindow = null;
  miniIconWindow = null;

  // Check token and create appropriate window
  const tokenValid = checkForToken();
  
  console.log('Token validity check result:', tokenValid);
  
  if (tokenValid) {
    console.log('Token is valid. Creating home window.');
    createHomeWindow();
  } else {
    console.log('Token is invalid. Creating login window.');
    createLoginWindow();
  }
}

// Modify app ready event handler
app.on('ready', () => {
  // Ensure only one instance of the app can run
  const gotTheLock = app.requestSingleInstanceLock();
  
  if (!gotTheLock) {
    console.log('Another instance of the app is already running.');
    app.quit();
    return;
  }

  // Additional check to ensure clean startup
  if (process.argv.includes('--squirrel-uninstall')) {
    performUninstallCleanup(false); // Perform actual cleanup
    app.quit();
  } else {
    // Additional error handling wrapper
    try {
      initializeWindow();
      setupAutoLaunch();
    } catch (error) {
      console.error('Failed to initialize app:', error);
      dialog.showErrorBox('Startup Error', 'Failed to start the application. Please restart.');
      app.quit();
    }
  }

  // Handle second instance attempts more explicitly
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Prevent any further instances from launching
    event.preventDefault();
    
    // Bring existing window to front if another instance is attempted
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      const mainWindow = windows[0];
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
});

// Add global error handler
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  resetApplicationState();
  createLoginWindow();
});

// Handle login success to update token and windows
ipcMain.on('login-success', (event, tokenData) => {
  try {
    const tokenPath = path.join(app.getPath('userData'), 'token.json');
    fs.writeFileSync(tokenPath, JSON.stringify(tokenData));
    
    // Close all existing windows
    const existingWindows = BrowserWindow.getAllWindows();
    existingWindows.forEach(window => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });

    // Reset global window references
    mainWindow = null;
    homeWindow = null;
    miniIconWindow = null;

    // Create home window after successful login
    createHomeWindow();
  } catch (error) {
    console.error('Error saving token:', error);
    dialog.showErrorBox('Login Error', 'Failed to save login token');
  }
});

// Ensure proper window management
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('get-active-window', async () => {
  try {
    const activeWindow = await activeWin(); // Get the active window information
    return activeWindow;
  } catch (error) {
    console.error('Error in get-active-window:', error.message);
    return null;
  }
});

// Handle logout event
ipcMain.on('logout', () => {
  // Clear the token file
  const tokenPath = path.join(app.getPath('userData'), 'token.json');
  if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);

  // Destroy all existing windows
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(window => {
    if (!window.isDestroyed()) {
      window.destroy(); // Use destroy instead of close to forcefully remove the window
    }
  });

  // Explicitly create a new login window
  const mainWindow = createLoginWindow();
  
  // Ensure no other windows can be created during logout
  if (homeWindow) {
    homeWindow.close();
    homeWindow = null;
  }
});

ipcMain.on("quit-app", (event) => {
  // Show confirmation dialog
  const { dialog } = require('electron');
  const windows = BrowserWindow.getAllWindows();
  
  const response = dialog.showMessageBoxSync({
    type: 'warning',
    buttons: ['Quit Application'],
    defaultId: 1,
    title: 'Confirm Exit',
    message: 'Do you want to quit the Time Tracking App?',
    detail: 'All your tracking data will be automatically saved\n• Any ongoing tracking will be paused\n• You can resume tracking when you reopen the app',
    iconPath: path.join(__dirname, 'assets', 'icon.png'),
    cancelId: 1
  });

  // If user clicks "Cancel", do nothing
  if (response === 1) return;

  try {
    // Send a signal to renderer processes to prepare for quit
    windows.forEach(window => {
      window.webContents.send('prepare-quit');
    });

    // Wait a short moment to allow renderer to save data
    setTimeout(() => {
      // Close all windows
      windows.forEach(window => {
        if (!window.isDestroyed()) {
          window.destroy();
        }
      });

      // Quit the application
      app.quit();
    }, 1000);
  } catch (error) {
    console.error('Error during app quit:', error);
    app.quit();
  }
});

// Idle Tracking Variables
let idleDetectionEnabled = false;
let idleCheckTimer = null;

// Setup idle time monitoring
ipcMain.on('start-idle-monitoring', (event, threshold) => {
  // Clear any existing idle monitoring
  if (idleCheckTimer) {
    clearInterval(idleCheckTimer);
  }

  idleDetectionEnabled = true;

  // Use Electron's powerMonitor for system idle detection
  idleCheckTimer = setInterval(() => {
    const idleTime = powerMonitor.getSystemIdleTime(); // Returns seconds of system idle time
    
    // Send idle time to renderer process
    event.reply('system-idle-time', idleTime);
  }, 5000); // Check every 5 seconds

  console.log(`Idle monitoring started with threshold: ${threshold} seconds`);
});

// Stop idle monitoring
ipcMain.on('stop-idle-monitoring', () => {
  if (idleCheckTimer) {
    clearInterval(idleCheckTimer);
    idleCheckTimer = null;
  }
  idleDetectionEnabled = false;
  console.log('Idle monitoring stopped');
});

// Show system-level idle dialog
ipcMain.on('show-idle-dialog', (event, options) => {
  // Find the home window
  const windows = BrowserWindow.getAllWindows();
  const homeWindow = windows.find(win => win.getTitle() === 'Home');

  if (homeWindow) {
    dialog.showMessageBox(homeWindow, {
      type: 'question',
      buttons: ['Take a Break', 'Continue Tracking'],
      defaultId: 0,
      title: 'Idle Time Detected',
      message: options.message,
      detail: 'Your time tracking will be paused. You can resume when ready.'
    }).then(result => {
      // Send response back to renderer
      event.reply('idle-dialog-response', 
        result.response === 0 ? 'break' : 'continue'
      );
    });
  }
});

function setupAutoStart() {
  // Use Electron's built-in method for auto-start
  app.setLoginItemSettings({
    openAtLogin: true,
    path: process.execPath,
    args: [],
    name: 'Compüt Labs Time Tracking',
    enabled: true
  });

  // Optional: Check if auto-start is enabled
  const loginItemSettings = app.getLoginItemSettings();
  console.log('Auto-start is:', loginItemSettings.openAtLogin ? 'Enabled' : 'Disabled');

  // Optional: Add auto-update check
  if (process.env.NODE_ENV === 'production') {
    autoUpdater.checkForUpdatesAndNotify();
  }
}

// Function to setup auto-launch with mac and windows support
function setupAutoLaunch() {
  const exePath = app.isPackaged ? process.execPath : app.getPath('exe');
  const appLauncher = new AutoLaunch({
    name: 'Comput Labs Time Tracking',
    path: exePath,
    isHidden: true,
  });

  appLauncher.isEnabled()
    .then((isEnabled) => {
      if (!isEnabled) appLauncher.enable();
    })
    .catch((err) => console.error('Failed to enable auto-launch:', err));

  // Backup method using Electron API
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
    path: exePath,
    name: 'Comput Labs Time Tracking',
  });

  global.disableAutoLaunch = () => {
    try {
      appLauncher.disable();
      console.log('Auto-launch disabled via appLauncher');

      if (process.platform === 'win32') {
        try {
          execSync('reg delete "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Comput Labs Time Tracking" /f');
          console.log('Windows Registry entry removed');
        } catch (regError) {
          console.warn('Failed to remove registry entry:', regError.message);
        }
      } else if (process.platform === 'darwin') {
        app.setLoginItemSettings({ openAtLogin: false });
        console.log('macOS Login Item removed');
      }
    } catch (err) {
      console.error('Failed to disable auto-launch:', err);
    }
  };
}

app.on('error', (error) => {
  console.error('Electron app encountered an error:', error);
  dialog.showErrorBox('App Startup Error', `Failed to start the application: ${error.message}`);
});

app.on('will-quit', (event) => {
  console.log('App is about to quit');
});

app.on('quit', (event, exitCode) => {
  console.log(`App quit with exit code: ${exitCode}`);
});

// Enhanced localStorage removal utility
function clearLocalStorage() {
  try {
    // Paths to potential localStorage storage
    const localStoragePaths = [
      path.join(app.getPath('userData'), 'LocalStorage'),
      path.join(app.getPath('home'), '.time-tracking-app', 'LocalStorage'),
      path.join(process.env.APPDATA, 'time-tracking-app', 'LocalStorage')
    ];

    let localStorageCleared = true;

    localStoragePaths.forEach(storagePath => {
      try {
        if (fs.existsSync(storagePath)) {
          // Remove all files in LocalStorage directory
          fs.readdirSync(storagePath).forEach(file => {
            const fullPath = path.join(storagePath, file);
            try {
              if (fs.statSync(fullPath).isFile()) {
                fs.unlinkSync(fullPath);
                console.log(`Removed localStorage file: ${fullPath}`);
              }
            } catch (fileRemoveError) {
              console.error(`Failed to remove localStorage file ${fullPath}:`, fileRemoveError);
              localStorageCleared = false;
            }
          });

          // Attempt to remove the directory itself
          try {
            fs.rmdirSync(storagePath);
            console.log(`Removed localStorage directory: ${storagePath}`);
          } catch (dirRemoveError) {
            console.warn(`Could not remove localStorage directory ${storagePath}:`, dirRemoveError);
          }
        }
      } catch (storagePathError) {
        console.error(`Error processing localStorage path ${storagePath}:`, storagePathError);
        localStorageCleared = false;
      }
    });

    return localStorageCleared;
  } catch (error) {
    console.error('Comprehensive localStorage cleanup error:', error);
    return false;
  }
}

// Function to perform uninstall cleanup
// function performUninstallCleanup(dryRun = false) {
//   try {
//     const userDataPath = app.getPath('userData');
//     console.log(`Cleanup target: ${userDataPath}`);

//     if (dryRun) {
//       console.log(`Dry run: Would remove directory ${userDataPath}`);
//     } else if (fs.existsSync(userDataPath)) {
//       fs.rmSync(userDataPath, { recursive: true, force: true });
//       console.log(`Removed userData directory: ${userDataPath}`);
//     } else {
//       console.log(`userData directory does not exist: ${userDataPath}`);
//     }

//     // Remove extra files
//     const extraPaths = [
//       path.join(app.getPath('home'), '.time-tracking-app', 'token.json'),
//       path.join(process.env.APPDATA, 'time-tracking-app', 'token.json'),
//     ];

//     extraPaths.forEach((filePath) => {
//       if (dryRun) {
//         console.log(`Dry run: Would remove ${filePath}`);
//       } else if (fs.existsSync(filePath)) {
//         try {
//           fs.unlinkSync(filePath);
//           console.log(`Removed additional file: ${filePath}`);
//         } catch (error) {
//           console.error(`Failed to remove ${filePath}: ${error.message}`);
//         }
//       } else {
//         console.log(`File does not exist: ${filePath}`);
//       }
//     });

//     // Disable auto-launch and remove registry entries
//     if (global.disableAutoLaunch) {
//       if (dryRun) {
//         console.log('Dry run: Would disable auto-launch');
//       } else {
//         global.disableAutoLaunch();
//       }
//     }

//     console.log('Uninstallation cleanup completed successfully');
//     return true;
//   } catch (error) {
//     console.error('Uninstall cleanup failed:', error);
//     return false;
//   }
// }

// Function to perform uninstall cleanup with mac and windows support
function performUninstallCleanup(dryRun = false) {
  try {
    const userDataPath = app.getPath('userData'); // e.g., ~/Library/Application Support/ on macOS, %APPDATA% on Windows
    if (dryRun) {
      console.log(`Dry run: Would remove ${userDataPath}`);
    } else if (fs.existsSync(userDataPath)) {
      fs.rmSync(userDataPath, { recursive: true, force: true });
      console.log(`Removed ${userDataPath}`);
    }

    const extraPaths = [
      path.join(app.getPath('home'), '.time-tracking-app', 'token.json'),
      path.join(app.getPath('appData'), 'time-tracking-app', 'token.json'),
    ];

    extraPaths.forEach((filePath) => {
      if (dryRun) {
        console.log(`Dry run: Would remove ${filePath}`);
      } else if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`Removed ${filePath}`);
        } catch (error) {
          console.error(`Failed to remove ${filePath}: ${error.message}`);
        }
      }
    });

    if (global.disableAutoLaunch) {
      if (dryRun) {
        console.log('Dry run: Would disable auto-launch');
      } else {
        global.disableAutoLaunch();
      }
    }

    console.log('Uninstallation cleanup completed');
    return true;
  } catch (error) {
    console.error('Uninstall cleanup failed:', error);
    return false;
  }
}

// Add dry-run support for testing
ipcMain.on('test-uninstall', (event) => {
  const result = performUninstallCleanup(true); // Dry run
  event.reply('test-uninstall-result', result);
});

// Add IPC handler for uninstallation (if not already present)
ipcMain.on('perform-uninstall', (event) => {
  const cleanupResult = performUninstallCleanup();
  event.reply('uninstall-complete', cleanupResult);
  
  // Quit the application after cleanup
  if (cleanupResult) {
    app.quit();
  }
});

// Enhanced IPC handler for showing message boxes from renderer process
ipcMain.on('show-message-box', (event, options) => {
  try {
    // Find the most appropriate parent window
    const windows = BrowserWindow.getAllWindows();
    const parentWindow = windows.find(win => 
      win.getTitle() === 'Home' || 
      win.getTitle() === 'Time Tracker - Login'
    ) || windows[0];

    // Validate and set default options
    const messageBoxOptions = {
      type: options.type || 'info',
      title: options.title || 'Notification',
      message: options.message || '',
      buttons: options.buttons || ['OK'],
      defaultId: options.defaultId || 0,
      cancelId: options.cancelId || -1,
      detail: options.detail || '',
      checkboxLabel: options.checkboxLabel || '',
      icon: options.icon ? path.join(__dirname, options.icon) : undefined
    };

    // Show message box with comprehensive error handling
    dialog.showMessageBox(parentWindow, messageBoxOptions)
      .then(result => {
        // Send back detailed response
        event.reply('message-box-response', {
          response: result.response,
          checkboxChecked: result.checkboxChecked
        });
      })
      .catch(err => {
        console.error('Error showing message box:', err);
        event.reply('message-box-error', {
          message: err.message,
          stack: err.stack
        });
      });
  } catch (error) {
    console.error('Critical error in message box handler:', error);
    event.reply('message-box-critical-error', {
      message: error.message,
      stack: error.stack
    });
  }
});

// Optional: Add global method for manual cleanup
global.performUninstallCleanup = performUninstallCleanup;
