const { app, BrowserWindow, ipcMain, screen, dialog, autoUpdater } = require('electron');
const path = require('path');
const fs = require('fs');
const activeWin = require('active-win');
const powerMonitor = require('electron').powerMonitor;
const AutoLaunch = require('electron-auto-launch');

let mainWindow; // Main login window
let homeWindow; // Home window after login

// Create the login window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 500,
    resizable: false,
    center: true, // Ensure the window opens in the center of the screen
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, '/assets/icons/icon256.png'),
    autoHideMenuBar: true,
  });

  mainWindow.loadFile('src/index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create the home window with side-snapping behavior
function createHomeWindow() {
  // Get primary display
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workArea;

  // Window dimensions
  const windowWidth = 280;
  const windowHeight = 25;

  // Create home window
  homeWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: width - windowWidth,
    y: 0,
    resizable: true,
    alwaysOnTop: true,
    transparent: true,
    frame: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
    icon: path.join(__dirname, '/assets/icons/icon256.png'),
    autoHideMenuBar: true,
    useContentSize: true,
  });

  // Mini icon window
  let miniIconWindow = null;

  // Side-snapping logic
  function snapToSide(x, y) {
    const snapThreshold = 50; // Pixels from screen edge
    const screenWidth = primaryDisplay.workArea.width;
    const snappedWidth = windowWidth;
    
    // Snap to left side
    if (x <= snapThreshold) {
      homeWindow.setBounds({
        x: 0,
        y: y,
        width: snappedWidth,
        height: windowHeight
      });
      return 'left';
    } 
    // Snap to right side
    else if (x >= screenWidth - snappedWidth - snapThreshold) {
      homeWindow.setBounds({
        x: screenWidth - snappedWidth,
        y: y,
        width: snappedWidth,
        height: windowHeight
      });
      return 'right';
    }
    
    return null;
  }

  // Dragging event handler
  let isDragging = false;
  let dragStartPos = { x: 0, y: 0 };

  homeWindow.on('move', () => {
    const [x, y] = homeWindow.getPosition();
    const snappedSide = snapToSide(x, y);

    // Send snapped side information to renderer
    homeWindow.webContents.send('window-snapped', snappedSide);
  });

  // Create mini icon window
  function createMiniIconWindow() {
    // Destroy existing mini icon window if it exists
    if (miniIconWindow && !miniIconWindow.isDestroyed()) {
      miniIconWindow.destroy();
    }

    // Get the current position of the home window
    const [homeX, homeY] = homeWindow.getPosition();
    const [homeWidth, homeHeight] = homeWindow.getSize();
    const screenWidth = primaryDisplay.workArea.width;

    // Determine mini icon position based on home window's side
    const miniIconX = homeX === 0 
      ? homeWidth  // Left side: position at right edge of home window
      : homeX + homeWidth - 50; // Right side: position at right edge of home window

    // Calculate mini icon position based on home window
    miniIconWindow = new BrowserWindow({
      width: 35,
      height: 50,
      x: miniIconX+20,
      y: homeY + homeHeight - 28, // Position at bottom of home window
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      }
    });

    // Create mini icon content directly in memory
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
        }
        svg {
          transition: transform 0.2s ease;
          max-width: 100%;
          max-height: 100%;
          -webkit-app-region: no-drag;
        }
        svg:hover {
          transform: scale(1.2);
        }
      </style>
    </head>
    <body>
      <svg width="30px" height="30px" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path id="sidebar" d="M49.984,56l-35.989,0c-3.309,0 -5.995,-2.686 -5.995,-5.995l0,-36.011c0,-3.308 2.686,-5.995 5.995,-5.995l35.989,0c3.309,0 5.995,2.687 5.995,5.995l0,36.011c0,3.309 -2.686,5.995 -5.995,5.995Zm-25.984,-4.001l0,-39.999l-9.012,0c-1.65,0 -2.989,1.339 -2.989,2.989l0,34.021c0,1.65 1.339,2.989 2.989,2.989l9.012,0Zm24.991,-39.999l-20.991,0l0,39.999l20.991,0c1.65,0 2.989,-1.339 2.989,-2.989l0,-34.021c0,-1.65 -1.339,-2.989 -2.989,-2.989Z" fill="#3498db"/>
        <path id="code" d="M19.999,38.774l-6.828,-6.828l6.828,-6.829l2.829,2.829l-4,4l4,4l-2.829,2.828Z" fill="#2ecc71"/>
      </svg>
      <script>
        // Hover event to show home window
        document.body.addEventListener('mouseenter', () => {
          require('electron').ipcRenderer.send('show-home-window-on-hover');
        });

        // Click event to show home window
        document.body.addEventListener('click', () => {
          require('electron').ipcRenderer.send('show-home-window');
        });
      </script>
    </body>
    </html>
    `;

    // Load the mini icon content directly
    miniIconWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(miniIconContent)}`);

    // Prevent mini icon window from closing
    miniIconWindow.on('close', (event) => {
      event.preventDefault();
    });

    // Update mini icon position when home window moves
    homeWindow.on('move', () => {
      if (miniIconWindow && !miniIconWindow.isDestroyed()) {
        const [homeX, homeY] = homeWindow.getPosition();
        const [homeWidth, homeHeight] = homeWindow.getSize();
        const screenWidth = primaryDisplay.workArea.width;

        // Determine mini icon position based on home window's side
        const miniIconX = homeX === 0 
          ? homeWidth  // Left side: position at right edge of home window
          : homeX + homeWidth - 50; // Right side: position at right edge of home window

        miniIconWindow.setBounds({
          x: miniIconX,
          y: homeY + homeHeight
        });
      }
    });
  }

  // Auto-hide logic
  let hideTimer = null;
  let isMouseOverHomeWindow = false;

  // Track mouse enter and leave events
  homeWindow.webContents.on('did-finish-load', () => {
    homeWindow.webContents.executeJavaScript(`
      document.addEventListener('mouseenter', () => {
        require('electron').ipcRenderer.send('home-window-mouse-enter');
      });
      document.addEventListener('mouseleave', () => {
        require('electron').ipcRenderer.send('home-window-mouse-leave');
      });
    `);
  });

  // IPC handlers for mouse events
  ipcMain.on('home-window-mouse-enter', () => {
    isMouseOverHomeWindow = true;
    // Clear hide timer when mouse is over home window
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  });

  ipcMain.on('home-window-mouse-leave', () => {
    isMouseOverHomeWindow = false;
    // Restart hide timer when mouse leaves home window
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!isMouseOverHomeWindow) {
        homeWindow.hide();
        createMiniIconWindow();
      }
    }, 10000);
  });

  // Hover-to-show handler for mini icon
  ipcMain.on('show-home-window-on-hover', () => {
    // Show home window
    homeWindow.show();
    
    // Hide mini icon window
    if (miniIconWindow && !miniIconWindow.isDestroyed()) {
      miniIconWindow.hide();
    }

    // Clear any existing timer
    if (hideTimer) clearTimeout(hideTimer);
  });

  // Modified show home window handler
  ipcMain.on('show-home-window', () => {
    // Show home window
    homeWindow.show();
    
    // Hide mini icon window
    if (miniIconWindow && !miniIconWindow.isDestroyed()) {
      miniIconWindow.hide();
    }

    // Reset hide timer
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!isMouseOverHomeWindow) {
        homeWindow.hide();
        createMiniIconWindow();
      }
    }, 10000);
  });

  // Auto-hide logic for initial show
  homeWindow.on('ready-to-show', () => {
    homeWindow.show();
    
    // Clear any existing timer
    if (hideTimer) clearTimeout(hideTimer);

    // Set timer to hide window after 10 seconds
    hideTimer = setTimeout(() => {
      if (!isMouseOverHomeWindow) {
        homeWindow.hide();
        createMiniIconWindow();
      }
    }, 10000);
  });

  // Load home window content
  homeWindow.loadFile('src/home.html');

  // Make window draggable with side-snapping
  homeWindow.webContents.on('did-finish-load', () => {
    homeWindow.webContents.insertCSS(`
      body {
        -webkit-app-region: drag;
        overflow: hidden !important;
        user-select: none;
      }
      button, input, a, svg {
        -webkit-app-region: no-drag;
      }
    `);

    // Inject side-snapping logic into renderer
    homeWindow.webContents.executeJavaScript(`
      // Visual indication for side-snapping
      window.addEventListener('message', (event) => {
        if (event.data.type === 'window-snapped') {
          const body = document.body;
          if (event.data.side === 'left') {
            body.style.background = 'linear-gradient(to right, rgba(44,62,80,0.1), transparent)';
          } else if (event.data.side === 'right') {
            body.style.background = 'linear-gradient(to left, rgba(44,62,80,0.1), transparent)';
          } else {
            body.style.background = 'transparent';
          }
        }
      });
    `);
  });

  // Prevent complete closure
  homeWindow.on('close', (event) => {
    event.preventDefault();
    homeWindow.hide();
    createMiniIconWindow();
  });

  // IPC handler to show home window
  ipcMain.on('show-home-window', () => {
    // Show home window
    homeWindow.show();
    
    // Hide mini icon window
    if (miniIconWindow && !miniIconWindow.isDestroyed()) {
      miniIconWindow.hide();
    }

    // Reset hide timer
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      homeWindow.hide();
      createMiniIconWindow();
    }, 10000);
  });
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
  // Always destroy existing windows first
  if (mainWindow) {
    mainWindow.close();
    mainWindow = null;
  }
  if (homeWindow) {
    homeWindow.close();
    homeWindow = null;
  }

  // Check token and create appropriate window
  const tokenValid = checkForToken();
  
  if (tokenValid) {
    console.log('Token is valid. Creating home window.');
    createHomeWindow();
  } else {
    console.log('Token is invalid. Creating main window.');
    createMainWindow();
  }
}

// Modify app ready event to handle window initialization
app.whenReady().then(() => {
  setupAutoStart();
  setupAutoLaunch();

  // Initialize window based on token
  initializeWindow();

  // Mac-specific window handling
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      initializeWindow();
    }
  });
});

// Handle login success to update token and windows
ipcMain.on('login-success', (event, tokenData) => {
  try {
    const tokenPath = path.join(app.getPath('userData'), 'token.json');
    fs.writeFileSync(tokenPath, JSON.stringify(tokenData));
    
    // Reinitialize window after successful login
    initializeWindow();
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
  const mainWindow = createMainWindow();
  
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
      buttons: ['Take a Break', 'Continue'],
      defaultId: 0,
      title: 'Comput Labs',
      message: options.message
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

function setupAutoLaunch() {
  const appLauncher = new AutoLaunch({
    name: 'Time Tracking App',
    path: app.getPath('exe'),
    isHidden: true  // Run in background without showing window
  });

  // Global method to disable auto-launch completely
  global.disableAutoLaunch = async () => {
    try {
      await appLauncher.disable();
      console.log('Auto-launch completely disabled for uninstallation');
      
      // Optional: Remove from Windows Registry (additional cleanup)
      try {
        const { exec } = require('child_process');
        exec('reg delete "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Time Tracking App" /f', 
          (error, stdout, stderr) => {
            if (error) {
              console.warn(`Registry cleanup warning: ${error.message}`);
              return;
            }
            console.log('Windows Registry entry removed');
          }
        );
      } catch (registryError) {
        console.error('Failed to remove registry entry:', registryError);
      }
    } catch (err) {
      console.error('Failed to disable auto-launch:', err);
    }
  };

  // Enable auto-start by default
  appLauncher.enable()
    .then(() => console.log('Auto-launch enabled'))
    .catch((err) => console.error('Failed to enable auto-launch:', err));

  // Optional: Method to toggle auto-start
  global.toggleAutoStart = async (enable) => {
    try {
      if (enable) {
        await appLauncher.enable();
        console.log('Auto-launch enabled');
      } else {
        await appLauncher.disable();
        console.log('Auto-launch disabled');
      }
    } catch (err) {
      console.error('Failed to toggle auto-launch:', err);
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
