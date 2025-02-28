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

// Create the home window with side-snapping behavior
// function createHomeWindow() {
//   // Get primary display
//   const primaryDisplay = screen.getPrimaryDisplay();
//   const { width, height } = primaryDisplay.workArea;

//   // Window dimensions
//   const windowWidth = 280;
//   const windowHeight = 25;

//   // Create home window
//   homeWindow = new BrowserWindow({
//     width: windowWidth,
//     height: windowHeight,
//     x: width - windowWidth,
//     y: 0,
//     resizable: true,
//     alwaysOnTop: true,
//     transparent: true,
//     frame: false,
//     hasShadow: false,
//     skipTaskbar: true,
//     webPreferences: {
//       nodeIntegration: true,
//       contextIsolation: false,
//       enableRemoteModule: true,
//     },
//     icon: path.join(__dirname, '/assets/icons/icon256.png'),
//     autoHideMenuBar: true,
//     useContentSize: true,
//   });

//   // Mini icon window
//   let miniIconWindow = null;

//   // Side-snapping logic
//   function snapToSide(x, y) {
//     const snapThreshold = 50; // Pixels from screen edge
//     const screenWidth = primaryDisplay.workArea.width;
//     const snappedWidth = windowWidth;
    
//     // Snap to left side
//     if (x <= snapThreshold) {
//       homeWindow.setBounds({
//         x: 0,
//         y: y,
//         width: snappedWidth,
//         height: windowHeight
//       });
//       return 'left';
//     } 
//     // Snap to right side
//     else if (x >= screenWidth - snappedWidth - snapThreshold) {
//       homeWindow.setBounds({
//         x: screenWidth - snappedWidth,
//         y: y,
//         width: snappedWidth,
//         height: windowHeight
//       });
//       return 'right';
//     }
    
//     return null;
//   }

//   // Dragging event handler
//   let isDragging = false;
//   let dragStartPos = { x: 0, y: 0 };

//   homeWindow.on('move', () => {
//     const [x, y] = homeWindow.getPosition();
//     const snappedSide = snapToSide(x, y);

//     // Send snapped side information to renderer
//     homeWindow.webContents.send('window-snapped', snappedSide);
//   });

//   // Create mini icon window
//   function createMiniIconWindow() {
//     // Destroy existing mini icon window if it exists
//     if (miniIconWindow && !miniIconWindow.isDestroyed()) {
//       miniIconWindow.destroy();
//     }

//     // Get the current position of the home window
//     const [homeX, homeY] = homeWindow.getPosition();
//     const [homeWidth, homeHeight] = homeWindow.getSize();
//     const screenWidth = primaryDisplay.workArea.width;

//     // Determine mini icon position based on home window's side
//     const miniIconX = homeX === 0 
//       ? homeWidth  // Left side: position at right edge of home window
//       : homeX + homeWidth - 50; // Right side: position at right edge of home window

//     // Calculate mini icon position based on home window
//     miniIconWindow = new BrowserWindow({
//       width: 35,
//       height: 50,
//       x: miniIconX+20,
//       y: homeY + homeHeight - 28, // Position at bottom of home window
//       frame: false,
//       transparent: true,
//       alwaysOnTop: true,
//       resizable: false,
//       skipTaskbar: true,
//       webPreferences: {
//         nodeIntegration: true,
//         contextIsolation: false,
//       }
//     });

//     // Create mini icon content directly in memory
//     const miniIconContent = `
//     <!DOCTYPE html>
//     <html>
//     <head>
//       <style>
//         html, body { 
//           margin: 0; 
//           padding: 0; 
//           overflow: hidden; 
//           background: transparent; 
//           display: flex; 
//           justify-content: center; 
//           align-items: center; 
//           cursor: pointer;
//           -webkit-app-region: drag;
//           user-select: none;
//         }
//         svg {
//           transition: transform 0.2s ease;
//           max-width: 100%;
//           max-height: 100%;
//           -webkit-app-region: no-drag;
//         }
//         svg:hover {
//           transform: scale(1.2);
//         }
//       </style>
//     </head>
//     <body>
//       <svg width="30px" height="30px" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
//         <path id="sidebar" d="M49.984,56l-35.989,0c-3.309,0 -5.995,-2.686 -5.995,-5.995l0,-36.011c0,-3.308 2.686,-5.995 5.995,-5.995l35.989,0c3.309,0 5.995,2.687 5.995,5.995l0,36.011c0,3.309 -2.686,5.995 -5.995,5.995Zm-25.984,-4.001l0,-39.999l-9.012,0c-1.65,0 -2.989,1.339 -2.989,2.989l0,34.021c0,1.65 1.339,2.989 2.989,2.989l9.012,0Zm24.991,-39.999l-20.991,0l0,39.999l20.991,0c1.65,0 2.989,-1.339 2.989,-2.989l0,-34.021c0,-1.65 -1.339,-2.989 -2.989,-2.989Z" fill="#3498db"/>
//         <path id="code" d="M19.999,38.774l-6.828,-6.828l6.828,-6.829l2.829,2.829l-4,4l4,4l-2.829,2.828Z" fill="#2ecc71"/>
//       </svg>
//       <script>
//         // Hover event to show home window
//         document.body.addEventListener('mouseenter', () => {
//           require('electron').ipcRenderer.send('show-home-window-on-hover');
//         });

//         // Click event to show home window
//         document.body.addEventListener('click', () => {
//           require('electron').ipcRenderer.send('show-home-window');
//         });
//       </script>
//     </body>
//     </html>
//     `;

//     // Load the mini icon content directly
//     miniIconWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(miniIconContent)}`);

//     // Prevent mini icon window from closing
//     miniIconWindow.on('close', (event) => {
//       event.preventDefault();
//     });

//     // Update mini icon position when home window moves
//     homeWindow.on('move', () => {
//       if (miniIconWindow && !miniIconWindow.isDestroyed()) {
//         const [homeX, homeY] = homeWindow.getPosition();
//         const [homeWidth, homeHeight] = homeWindow.getSize();
//         const screenWidth = primaryDisplay.workArea.width;

//         // Determine mini icon position based on home window's side
//         const miniIconX = homeX === 0 
//           ? homeWidth  // Left side: position at right edge of home window
//           : homeX + homeWidth - 50; // Right side: position at right edge of home window

//         miniIconWindow.setBounds({
//           x: miniIconX,
//           y: homeY + homeHeight
//         });
//       }
//     });
//   }

//   // Auto-hide logic
//   let hideTimer = null;
//   let isMouseOverHomeWindow = false;

//   // Track mouse enter and leave events
//   homeWindow.webContents.on('did-finish-load', () => {
//     homeWindow.webContents.executeJavaScript(`
//       document.addEventListener('mouseenter', () => {
//         require('electron').ipcRenderer.send('home-window-mouse-enter');
//       });
//       document.addEventListener('mouseleave', () => {
//         require('electron').ipcRenderer.send('home-window-mouse-leave');
//       });
//     `);
//   });

//   // IPC handlers for mouse events
//   ipcMain.on('home-window-mouse-enter', () => {
//     isMouseOverHomeWindow = true;
//     // Clear hide timer when mouse is over home window
//     if (hideTimer) {
//       clearTimeout(hideTimer);
//       hideTimer = null;
//     }
//   });

//   ipcMain.on('home-window-mouse-leave', () => {
//     isMouseOverHomeWindow = false;
//     // Restart hide timer when mouse leaves home window
//     if (hideTimer) clearTimeout(hideTimer);
//     hideTimer = setTimeout(() => {
//       if (!isMouseOverHomeWindow) {
//         homeWindow.hide();
//         createMiniIconWindow();
//       }
//     }, 10000);
//   });

//   // Hover-to-show handler for mini icon
//   ipcMain.on('show-home-window-on-hover', () => {
//     // Show home window
//     homeWindow.show();
    
//     // Hide mini icon window
//     if (miniIconWindow && !miniIconWindow.isDestroyed()) {
//       miniIconWindow.hide();
//     }

//     // Clear any existing timer
//     if (hideTimer) clearTimeout(hideTimer);
//   });

//   // Modified show home window handler
//   ipcMain.on('show-home-window', () => {
//     // Show home window
//     homeWindow.show();
    
//     // Hide mini icon window
//     if (miniIconWindow && !miniIconWindow.isDestroyed()) {
//       miniIconWindow.hide();
//     }

//     // Reset hide timer
//     if (hideTimer) clearTimeout(hideTimer);
//     hideTimer = setTimeout(() => {
//       if (!isMouseOverHomeWindow) {
//         homeWindow.hide();
//         createMiniIconWindow();
//       }
//     }, 10000);
//   });

//   // Auto-hide logic for initial show
//   homeWindow.on('ready-to-show', () => {
//     homeWindow.show();
    
//     // Clear any existing timer
//     if (hideTimer) clearTimeout(hideTimer);

//     // Set timer to hide window after 10 seconds
//     hideTimer = setTimeout(() => {
//       if (!isMouseOverHomeWindow) {
//         homeWindow.hide();
//         createMiniIconWindow();
//       }
//     }, 10000);
//   });

//   // Load home window content
//   homeWindow.loadFile('src/home.html');

//   // Make window draggable with side-snapping
//   homeWindow.webContents.on('did-finish-load', () => {
//     console.log('Home window content loaded successfully.');
//     homeWindow.webContents.insertCSS(`
//       body {
//         -webkit-app-region: drag;
//         overflow: hidden !important;
//         user-select: none;
//       }
//       button, input, a, svg {
//         -webkit-app-region: no-drag;
//       }
//     `);

//     // Inject side-snapping logic into renderer
//     homeWindow.webContents.executeJavaScript(`
//       // Visual indication for side-snapping
//       window.addEventListener('message', (event) => {
//         if (event.data.type === 'window-snapped') {
//           const body = document.body;
//           if (event.data.side === 'left') {
//             body.style.background = 'linear-gradient(to right, rgba(44,62,80,0.1), transparent)';
//           } else if (event.data.side === 'right') {
//             body.style.background = 'linear-gradient(to left, rgba(44,62,80,0.1), transparent)';
//           } else {
//             body.style.background = 'transparent';
//           }
//         }
//       });
//     `);
//   });

//   // Prevent complete closure
//   homeWindow.on('close', (event) => {
//     event.preventDefault();
//     homeWindow.hide();
//     createMiniIconWindow();
//   });

//   // IPC handler to show home window
//   ipcMain.on('show-home-window', () => {
//     // Show home window
//     homeWindow.show();
    
//     // Hide mini icon window
//     if (miniIconWindow && !miniIconWindow.isDestroyed()) {
//       miniIconWindow.hide();
//     }

//     // Reset hide timer
//     if (hideTimer) clearTimeout(hideTimer);
//     hideTimer = setTimeout(() => {
//       homeWindow.hide();
//       createMiniIconWindow();
//     }, 10000);
//   });
// }

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
     transparent: process.platform !== 'darwin', // macOS doesn't support full transparency
     frame: false,
     hasShadow: false,
     skipTaskbar: true,
     webPreferences: {
       nodeIntegration: true,
       contextIsolation: false,
       enableRemoteModule: true,
       // Add this to enable custom CSS
       webviewTag: true,
     },
     icon: process.platform === 'darwin'
       ? path.join(__dirname, 'assets/icons/icon512.icns')
       : path.join(__dirname, 'assets/icons/icon256.png'),
     autoHideMenuBar: true,
     useContentSize: true,
   });
 
 // Add this after loading the file
 homeWindow.webContents.on('did-finish-load', () => {
   // Inject CSS to hide scrollbars
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

    const [homeX, homeY] = homeWindow.getPosition();
    const [homeWidth, homeHeight] = homeWindow.getSize();
    const miniIconX = homeX === 0 ? homeWidth : homeX + homeWidth - 50;

    miniIconWindow = new BrowserWindow({
      width: 35,
      height: 50,
      x: miniIconX + 20,
      y: homeY + homeHeight - 28,
      frame: false,
      transparent: process.platform !== 'darwin',
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    const miniIconContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          html, body { margin: 0; padding: 0; overflow: hidden; background: transparent; display: flex; justify-content: center; align-items: center; cursor: pointer; -webkit-app-region: drag; user-select: none; }
          svg { transition: transform 0.2s ease; max-width: 100%; max-height: 100%; -webkit-app-region: no-drag; }
          svg:hover { transform: scale(1.2); }
        </style>
      </head>
      <body>
        <svg width="30px" height="30px" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M49.984,56l-35.989,0c-3.309,0 -5.995,-2.686 -5.995,-5.995l0,-36.011c0,-3.308 2.686,-5.995 5.995,-5.995l35.989,0c3.309,0 5.995,2.687 5.995,5.995l0,36.011c0,3.309 -2.686,5.995 -5.995,5.995Zm-25.984,-4.001l0,-39.999l-9.012,0c-1.65,0 -2.989,1.339 -2.989,2.989l0,34.021c0,1.65 1.339,2.989 2.989,2.989l9.012,0Zm24.991,-39.999l-20.991,0l0,39.999l20.991,0c1.65,0 2.989,-1.339 2.989,-2.989l0,-34.021c0,-1.65 -1.339,-2.989 -2.989,-2.989Z" fill="#3498db"/>
          <path d="M19.999,38.774l-6.828,-6.828l6.828,-6.829l2.829,2.829l-4,4l4,4l-2.829,2.828Z" fill="#2ecc71"/>
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

    homeWindow.on('move', () => {
      if (miniIconWindow && !miniIconWindow.isDestroyed()) {
        const [hx, hy] = homeWindow.getPosition();
        const [hw, hh] = homeWindow.getSize();
        const newX = hx === 0 ? hw : hx + hw - 50;
        miniIconWindow.setBounds({ x: newX, y: hy + hh });
      }
    });
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
// Enhanced Window Reset and Initialization
// function resetApplicationState() {
//   try {
//     // Remove all existing tokens and user-specific data
//     const cleanupPaths = [
//       path.join(app.getPath('userData'), 'token.json'),
//       path.join(app.getPath('home'), '.time-tracking-app', 'token.json'),
//       path.join(process.env.APPDATA, 'time-tracking-app', 'token.json')
//     ];

//     cleanupPaths.forEach(tokenPath => {
//       try {
//         if (fs.existsSync(tokenPath)) {
//           fs.unlinkSync(tokenPath);
//           console.log(`Removed token file: ${tokenPath}`);
//         }
//       } catch (tokenRemovalError) {
//         console.error(`Failed to remove token file ${tokenPath}:`, tokenRemovalError);
//       }
//     });

//     // Clear all localStorage and browser storage
//     clearLocalStorage();

//     // Reset any persistent app-wide configurations
//     global.isAuthenticated = false;
//     global.userToken = null;

//     console.log('Application state reset successfully');
//     return true;
//   } catch (error) {
//     console.error('Failed to reset application state:', error);
//     return false;
//   }
// }

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

// Modify existing createLoginWindow function
// function createLoginWindow() {
//   // Ensure previous windows are closed
//   if (mainWindow) {
//     mainWindow.close();
//     mainWindow = null;
//   }

//   // Reset application state only if necessary
//   if (!checkForToken()) {
//     resetApplicationState();
//   }

//   // Create login window with enhanced configuration
//   mainWindow = new BrowserWindow({
//     width: 400,
//     height: 600,
//     webPreferences: {
//       nodeIntegration: true,
//       contextIsolation: false,
//       enableRemoteModule: true
//     },
//     resizable: false,
//     autoHideMenuBar: true,
//     title: 'Time Tracker - Login'
//   });

//   mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  
//   // Clear cache and storage before loading
//   mainWindow.webContents.session.clearStorageData({
//     storages: ['appcache', 'cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers']
//   });

//   // Enhanced error handling
//   mainWindow.webContents.on('did-fail-load', () => {
//     console.error('Failed to load login window');
//     app.relaunch();
//     app.exit(0);
//   });

//   mainWindow.on('closed', () => {
//     mainWindow = null;
//   });
// }


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
  
  console.log('Token validity check result:', tokenValid);
  
  if (tokenValid) {
    console.log('Token is valid. Creating home window.');
    createHomeWindow();
  } else {
    console.log('Token is invalid. Creating main window.');
    createLoginWindow();
  }
}

// Modify app ready event handler
app.on('ready', () => {
  // Additional check to ensure clean startup
  if (process.argv.includes('--squirrel-uninstall')) {
    performUninstallCleanup(false); // Perform actual cleanup
    app.quit();
  } else {
    initializeWindow();
    setupAutoLaunch();
  }
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

// function setupAutoLaunch() {
//   const appLauncher = new AutoLaunch({
//     name: 'Time Tracking App',
//     path: app.getPath('exe'),
//     isHidden: true  // Run in background without showing window
//   });
//   console.log('app path',app.getPath('exe'))

//   // Global method to disable auto-launch completely
//   global.disableAutoLaunch = async () => {
//     try {
//       await appLauncher.disable();
//       console.log('Auto-launch completely disabled for uninstallation');
      
//       // Optional: Remove from Windows Registry (additional cleanup)
//       try {
//         const { exec } = require('child_process');
//         exec('reg delete "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Time Tracking App" /f', 
//           (error, stdout, stderr) => {
//             if (error) {
//               console.warn(`Registry cleanup warning: ${error.message}`);
//               return;
//             }
//             console.log('Windows Registry entry removed');
//           }
//         );
//       } catch (registryError) {
//         console.error('Failed to remove registry entry:', registryError);
//       }
//     } catch (err) {
//     console.error('Failed to disable auto-launch:', err);
//     }
//   };

//   // Enable auto-start by default
//   appLauncher.enable()
//     .then(() => console.log('Auto-launch enabled'))
//     .catch((err) => console.error('Failed to enable auto-launch:', err));

//   // Optional: Method to toggle auto-start
//   global.toggleAutoStart = async (enable) => {
//     try {
//       if (enable) {
//         await appLauncher.enable();
//         console.log('Auto-launch enabled');
//       } else {
//         await appLauncher.disable();
//         console.log('Auto-launch disabled');
//       }
//     } catch (err) {
//       console.error('Failed to toggle auto-launch:', err);
//     }
//   };
// }

// function setup launch
// function setupAutoLaunch() {
//   // **Fix Executable Path: Use Installed Path in Production**
//   const exePath = app.isPackaged
//     ? path.dirname(process.execPath) + `\\${path.basename(process.execPath)}` // Installed EXE path
//     : process.execPath; // Development mode (Electron binary)

//   console.log('Corrected App Executable Path:', exePath);

//   const appLauncher = new AutoLaunch({
//     name: 'Time Tracking App',
//     path: exePath
//   });

//   // **Check if auto-launch is enabled before enabling**
//   appLauncher.isEnabled()
//     .then((isEnabled) => {
//       if (!isEnabled) {
//         return appLauncher.enable();
//       }
//     })
//     .then(() => console.log('✅ Auto-launch is now enabled'))
//     .catch((err) => console.error('❌ Failed to enable auto-launch:', err));

//   // **Backup Auto-Start using Electron API**
//   app.setLoginItemSettings({
//     openAtLogin: true,
//     openAsHidden: true, // Start in background
//     path: exePath
//   });

//   console.log('✅ Auto-start configured via setLoginItemSettings');

//   // **Disable Auto-Launch Completely**
//   global.disableAutoLaunch = async () => {
//     try {
//       await appLauncher.disable();
//       console.log('🚫 Auto-launch completely disabled');

//       // **Remove from Windows Registry**
//       exec(
//         'reg delete "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Time Tracking App" /f',
//         (error, stdout, stderr) => {
//           if (error) {
//             console.warn(`⚠️ Registry cleanup warning: ${error.message}`);
//           } else {
//             console.log('✅ Windows Registry entry removed successfully.');
//           }
//         }
//       );
//     } catch (err) {
//       console.error('❌ Failed to disable auto-launch:', err);
//     }
//   };

//   // **Toggle Auto-Start**
//   global.toggleAutoStart = async (enable) => {
//     try {
//       if (enable) {
//         await appLauncher.enable();
//         console.log('✅ Auto-launch enabled');
//       } else {
//         await appLauncher.disable();
//         console.log('🚫 Auto-launch disabled');
//       }
//     } catch (err) {
//       console.error('❌ Failed to toggle auto-launch:', err);
//     }
//   };
// }

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
