const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { ipcRenderer } = require('electron');

// Declare trackingData as a global variable
let trackingData = {};

let startTime = 0;
let elapsedTime = 0;
let timerInterval = null;
let trackingInterval = null;
let saveInterval = null;
let batchRecords = [];
const batchSize = 5; // Reduced from 10 to 5 for more frequent uploads
const recordsPerPage = 10;
const dataFilePath = path.join(__dirname, 'tracking-data.json');
// testing api url
// const apiUrl = 'https://testing-backend-3uc6s.ondigitalocean.app/api/v1/tracking-data/create';

// Resolute partners main api url
 const apiUrl ='https://my-app-7fjx6.ondigitalocean.app/api/v1/tracking-data/create'

//Localhot api url
//const apiUrl = 'http://localhost:8000/api/v1/tracking-data/create';
let lastWindow = null;
let lastWindowStartTime = null;

// Batch Upload Configuration
const BATCH_UPLOAD_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds
const MAX_BATCH_RECORDS = 10;
let batchUploadTimer = null;

// Electron Idle Time Tracking
 const IDLE_THRESHOLD = 30 * 60; // 30 minutes in seconds (1800 seconds)
//const IDLE_THRESHOLD = 1 * 60; // 1 minutes in seconds (60 seconds)
let idleDetectionEnabled = false;
let isIdleAlertShown = false;

// ** Start Idle Monitoring **
function startElectronIdleTracking() {
  ipcRenderer.removeAllListeners('system-idle-time'); // Prevent duplicate listeners
  ipcRenderer.send('start-idle-monitoring', IDLE_THRESHOLD);

  ipcRenderer.on('system-idle-time', (event, idleTime) => {
    // Add an additional check for tracking state
    if (!isTracking) return; // Only proceed if tracking is active
    if (!timerInterval) return; // Only show idle alerts if tracking is active
    if (idleTime < IDLE_THRESHOLD) return; // Ignore if idle time is below threshold
    if (isIdleAlertShown) return; // Prevent multiple alerts in one idle session

    // Check if the user has resumed activity before triggering dialog
    if (Date.now() - lastActivityTimestamp < IDLE_THRESHOLD * 1000) {
      console.log("User resumed activity before idle confirmation. Skipping alert.");
      return;
    }

    console.log(`User has been idle for ${idleTime} seconds. Showing confirmation dialog.`);
    isIdleAlertShown = true; // Prevent duplicate popups

    ipcRenderer.send('show-idle-dialog', {
      message: `You've been inactive for ${IDLE_THRESHOLD} seconds.\nDo you want to take a break or continue tracking?`
    });
  });

  ipcRenderer.on('idle-dialog-response', (event, response) => {
    stopTracking();
    if (response === 'break') {
      console.log("User chose to take a break. Stopping tracking.");
      
      // Explicitly call stopTracking function
      stopTracking();

      // Ensure button is updated to "Start" state
      const startStopBtn = document.getElementById('start-stop-btn');
      if (startStopBtn) {
        startStopBtn.innerHTML = `
          <svg width="20px" height="20px" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path fill="#4CAF50" d="M38,42H10c-2.2,0-4-1.8-4-4V10c0-2.2,1.8-4,4-4h28c2.2,0,4,1.8,4,4v28C42,40.2,40.2,42,38,42z"/>
            <polygon fill="#ffffff" points="31,24 20,16 20,32"/>
          </svg>
        `;
      }
    } else {
      console.log("User chose to continue tracking.");
      isIdleAlertShown = false; // Reset flag so next idle period can trigger a new alert
      
      // Start tracking again
      startTracking();

      // Update button to "Stop" state
      const startStopBtn = document.getElementById('start-stop-btn');
      if (startStopBtn) {
        startStopBtn.innerHTML = `
          <svg width="20px" height="20px" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path fill="#F44336" d="M38,42H10c-2.2,0-4-1.8-4-4V10c0-2.2,1.8-4,4-4h28c2.2,0,4,1.8,4,4v28C42,40.2,40.2,42,38,42z"/>
            <polygon fill="#ffffff" points="16,16 32,16 32,32 16,32"/>
          </svg>
        `;
      }
    }
  });

  console.log("Electron idle tracking started.");
}


// ** Stop Idle Monitoring **
function stopElectronIdleTracking() {
  ipcRenderer.send('stop-idle-monitoring');
  ipcRenderer.removeAllListeners('system-idle-time');
  ipcRenderer.removeAllListeners('idle-dialog-response');
  isIdleAlertShown = false; // Reset flag
  console.log("Electron idle tracking stopped.");
}

// Enhanced Idle Time Tracking
let lastActivityTimestamp = Date.now();
let idleCheckInterval = null;

// ** Reset Idle Timer on Activity **
function trackUserActivity() {
  lastActivityTimestamp = Date.now();
  isIdleAlertShown = false; // Reset idle alert flag when user is active
}

// Advanced idle state detection
function checkIdleState() {
  if (!timerInterval) return; // Don't check idle state if not tracking

  const currentTime = Date.now();
  const idleDuration = currentTime - lastActivityTimestamp;

  // Check if idle time exceeds threshold and alert hasn't been shown
  if (idleDuration >= IDLE_THRESHOLD && !isIdleAlertShown) {
    isIdleAlertShown = true;
    
    // Pause tracking and show confirmation
    const shouldContinue = confirm(`You've been inactive for 30 seconds. 
Do you want to take a break or continue tracking?

Click 'OK' to take a break or 'Cancel' to continue tracking.`);

    if (shouldContinue) {
      // User wants to take a break
      clearInterval(timerInterval);
      clearInterval(trackingInterval);
      clearInterval(saveInterval);
      clearInterval(idleCheckInterval);
      timerInterval = null;

      try {
        console.log("Attempting to save and upload idle time data...");
        saveTrackingData();
        uploadBatchToDatabase();
      } catch (error) {
        console.error('Error during idle time data upload:', error);
      }

      // Update UI
      updateTimerDisplay();
      updateTable();
      updateInsights();

      // Change button to "Start"
      document.getElementById('start-stop-btn').innerHTML = `
        <svg width="20px" height="20px" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <path fill="#4CAF50" d="M38,42H10c-2.2,0-4-1.8-4-4V10c0-2.2,1.8-4,4-4h28c2.2,0,4,1.8,4,4v28C42,40.2,40.2,42,38,42z"/>
          <polygon fill="#ffffff" points="31,24 20,16 20,32"/>
        </svg>
      `;
    } else {
      // User wants to continue tracking
      lastActivityTimestamp = Date.now();
      isIdleAlertShown = false;
    }
  }
}

// ** Stop Tracking Function **
// function stopTracking() {
//   if (!isTracking) return; // Prevent stopping if already stopped

//   console.log("Stopping tracking...");

//   clearInterval(timerInterval);
//   clearInterval(trackingInterval);
//   clearInterval(saveInterval);
//   clearInterval(idleCheckInterval);

//   timerInterval = null;
//   trackingInterval = null;
//   saveInterval = null;
//   idleCheckInterval = null;
//   isTracking = false;
//   startTime = 0;

//   saveTrackingData(); // Save progress before stopping

//    // Upload any pending batch records and wait for it to complete
//    try {
//      uploadBatchToDatabase();
//     console.log(" Batch uploaded successfully after stopping tracking.");
//   } catch (error) {
//     console.error(" Error uploading batch after stopping tracking:", error);
//   }

//   // Fix: Update Button UI to "Start"
//   document.getElementById('start-stop-btn').innerHTML = `
//       <svg width="20px" height="20px" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
//           <path fill="#4CAF50" d="M38,42H10c-2.2,0-4-1.8-4-4V10c0-2.2,1.8-4,4-4h28c2.2,0,4,1.8,4,4v28C42,40.2,40.2,42,38,42z"/>
//           <polygon fill="#ffffff" points="31,24 20,16 20,32"/>
//       </svg>
//   `;

//   updateTimerDisplay();
//   updateTable();
//   updateInsights();

//   console.log("Tracking stopped successfully.");
// }
async function stopTracking() {
  try {
    console.log('Attempting to stop tracking...');
    if (!isTracking) {
      console.warn('Not currently tracking. Ignoring stop request.');
      return;
    }

    clearInterval(timerInterval);
    clearInterval(trackingInterval);
    clearInterval(saveInterval);
    timerInterval = null;
    trackingInterval = null;
    saveInterval = null;

    const now = Date.now();
    const sessionTime = Math.floor((now - startTime) / 1000);
    elapsedTime += sessionTime;

    if (lastWindow && lastWindowStartTime) {
      const durationMs = now - lastWindowStartTime;
      if (durationMs > 1000) {
        const dateKey = new Date().toISOString().split('T')[0];
        const userId = localStorage.getItem('userId') || 'test-user';

        const newRecord = {
          id: userId,
          app: lastWindow.owner.name,
          title: lastWindow.title,
          startTime: new Date(lastWindowStartTime).toISOString(),
          endTime: new Date(now).toISOString(),
          duration: `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`,
          timestamp: new Date(lastWindowStartTime).toISOString(),
          type: "active"
        };

        console.log("Finalizing last window record on stop:", newRecord);
        if (!trackingData[dateKey]) trackingData[dateKey] = [];
        trackingData[dateKey].push(newRecord);
        batchRecords.push(newRecord);
      }
    }

    await saveTrackingData();
    await uploadBatchToDatabase();
    saveTimerData();

    isTracking = false;
    startTime = 0;
    localStorage.setItem('lastStopTime', now.toString());
    lastWindow = null;
    lastWindowStartTime = null;

    updateTimerDisplay(elapsedTime);
    updateTable();
    updateInsights();

    const startStopBtn = document.getElementById('start-stop-btn');
    if (startStopBtn) {
      startStopBtn.innerHTML = `
        <svg width="20px" height="20px" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <path fill="#4CAF50" d="M38,42H10c-2.2,0-4-1.8-4-4V10c0-2.2,1.8-4,4-4h28c2.2,0,4,1.8,4,4v28C42,40.2,40.2,42,38,42z"/>
          <polygon fill="#ffffff" points="31,24 20,16 20,32"/>
        </svg>
      `;
    } else {
      console.error('Start-stop button not found in DOM during stop');
    }

    console.log(`Tracking stopped. Total Elapsed Time: ${elapsedTime}s, Session Time: ${sessionTime}s, Stop Time: ${new Date(now).toISOString()}`);
  } catch (error) {
    console.error('Error stopping tracking:', error);
    isTracking = false;
  }
}
// Enhanced resetTimerState function with precise reset and logging
function resetTimerState() {
  try {
    console.log(' 🔄 Resetting Timer State');

    // Stop all existing intervals
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    if (trackingInterval) {
      clearInterval(trackingInterval);
      trackingInterval = null;
    }

    if (saveInterval) {
      clearInterval(saveInterval);
      saveInterval = null;
    }

    // Reset all timer-related variables
    elapsedTime = 0;
    startTime = 0;
    isTracking = false;

    // Comprehensive state reset
    lastWindow = null;
    lastWindowStartTime = null;
    batchRecords = [];

    // Save reset state
    try {
      saveTimerData();
    } catch (saveError) {
      console.error(' ❌ Failed to save reset timer state:', saveError);
    }

    // Update UI
    updateTimerDisplay();
    updateTable();
    updateInsights();

    // Reset start/stop button to initial state
    const startStopBtn = document.getElementById('start-stop-btn');
    if (startStopBtn) {
      startStopBtn.innerHTML = `
        <svg width="20px" height="20px" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <path fill="#4CAF50" d="M38,42H10c-2.2,0-4-1.8-4-4V10c0-2.2,1.8-4,4-4h28c2.2,0,4,1.8,4,4v28C42,40.2,40.2,42,38,42z"/>
          <polygon fill="#ffffff" points="31,24 20,16 20,32"/>
        </svg>
      `;
    }

    console.log(' ✅ Timer State Reset Complete');
  } catch (error) {
    console.error(' 🚨 Critical Error in resetTimerState:', {
      message: error.message,
      stack: error.stack
    });
  }
}

// Comprehensive activity event listeners
const ACTIVITY_EVENTS = [
  'mousemove', 'mousedown', 'click', 'scroll',
  'keypress', 'keydown', 'keyup', 'input',
  'touchstart', 'touchend', 'touchmove', 'wheel',
  'focus', 'select', 'drag', 'dragstart', 'dragend'
];

// ** Setup Activity Tracking **
ACTIVITY_EVENTS.forEach(eventName => {
  document.addEventListener(eventName, trackUserActivity);
});

// ** Start Idle Monitoring on Page Load **
document.addEventListener('DOMContentLoaded', () => {
  startElectronIdleTracking();
});

// Load Today's Duration from File
function loadTodaysDuration(userId) {
  const dateKey = new Date().toISOString().split('T')[0];
  console.log(`Loading duration for user ${userId} on ${dateKey}...`);

  // Log the full file path
  console.log(`Attempting to load tracking data from: ${dataFilePath}`);

  // Ensure directory exists
  const dataDirectory = path.dirname(dataFilePath);
  if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, { recursive: true });
    console.log(`Created directory: ${dataDirectory}`);
  }

  // Create file if it doesn't exist
  if (!fs.existsSync(dataFilePath)) {
    try {
      const initialData = {};
      initialData[dateKey] = [];

      fs.writeFileSync(dataFilePath, JSON.stringify(initialData, null, 2));
      console.log(`Created new tracking data file at: ${dataFilePath}`);
    } catch (createError) {
      console.error(`Error creating tracking data file: ${createError.message}`);
      return 0;
    }
  }

  try {
    const data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));

    if (!data[dateKey]) {
      data[dateKey] = [];
      fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    }

    // Filter records by userId
    const userRecords = data[dateKey].filter(record => record.id === userId);

    if (userRecords.length === 0) {
      console.log(`No records found for user ${userId} on ${dateKey}.`);
      return 0;
    }

    // Sum up the duration of all today's records for the specific user
    const totalSeconds = userRecords.reduce((sum, record) => {
      return sum + parseDuration(record.duration || "0m 0s");
    }, 0);

    console.log(`Total duration for user ${userId} on ${dateKey}: ${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`);
    return totalSeconds;

  } catch (error) {
    console.error(`Error loading today's tracking data from ${dataFilePath}:`, error.message);
    return 0;
  }
}

// Fix: Added parseDuration function
function parseDuration(duration) {
  let totalSeconds = 0;

  // Fix: Ensure it correctly extracts duration values
  const hourMatch = duration.match(/(\d+)h/);
  const minuteMatch = duration.match(/(\d+)m/);
  const secondMatch = duration.match(/(\d+)s/);

  if (hourMatch) totalSeconds += parseInt(hourMatch[1], 10) * 3600; // Convert hours to seconds
  if (minuteMatch) totalSeconds += parseInt(minuteMatch[1], 10) * 60; // Convert minutes to seconds
  if (secondMatch) totalSeconds += parseInt(secondMatch[1], 10); // Keep seconds

  return totalSeconds;
}

// ** Clean up old data after 30 days **
function cleanupOldData() {
  const retentionDays = 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  if (!fs.existsSync(dataFilePath)) return;

  try {
    const existingData = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8')) || {};
    const newData = Object.fromEntries(
      Object.entries(existingData).filter(([date]) => new Date(date) >= cutoffDate)
    );

    fs.writeFileSync(dataFilePath, JSON.stringify(newData, null, 2));
    console.log(` Cleaned up data older than ${retentionDays} days.`);
  } catch (error) {
    console.error(' Error cleaning old data:', error);
  }
}

// Clean up old data after 30 days
function scheduleCleanup() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0); // Set to next midnight

  const timeUntilMidnight = midnight - now;

  setTimeout(() => {
    cleanupOldData();
    setInterval(cleanupOldData, 24 * 60 * 60 * 1000); // Run daily after the first cleanup
  }, timeUntilMidnight);
}

// Call scheduleCleanup on startup
scheduleCleanup();

// Modify loadTrackingData() to include auto-cleanup
function loadTrackingData() {
  try {
    // Try to load from localStorage first
    const localStorageData = localStorage.getItem('trackingData');
    if (localStorageData) {
      try {
        trackingData = JSON.parse(localStorageData);
        console.log('Loaded tracking data from localStorage');
        updateTable();
        updateInsights();
        return;
      } catch (parseError) {
        console.warn('Error parsing localStorage data, falling back to file');
      }
    }

    // Fallback to file if localStorage fails
    if (fs.existsSync(dataFilePath)) {
      try {
        const fileData = fs.readFileSync(dataFilePath, 'utf-8');
        trackingData = fileData ? JSON.parse(fileData) : {};
        console.log('Loaded tracking data from file');
      } catch (fileParseError) {
        console.error('Error parsing file data:', fileParseError);
        trackingData = {};
      }
    } else {
      trackingData = {};
      console.log('Created new tracking data storage');
    }

    updateTable();
    updateInsights();
  } catch (error) {
    console.error('Error loading tracking data:', error);
    trackingData = {};
  }
}

// ** Save Tracking Data Locally **
function saveTrackingData() {
  try {
    let existingData = {};

    if (fs.existsSync(dataFilePath)) {
      try {
        existingData = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8')) || {};
      } catch (parseError) {
        console.error('Error parsing existing tracking data:', parseError);
        existingData = {};
      }
    }

    const today = new Date().toISOString().split('T')[0];
    if (!existingData[today]) existingData[today] = [];

    // Merge records, ensuring idle records are included
    const mergedRecords = [...new Map(
      [...existingData[today], ...(trackingData[today] || [])]
        .map(item => [item.startTime + item.app + item.type, item]) // Unique key including type
    ).values()];

    existingData[today] = mergedRecords;

    // Save to localStorage
    localStorage.setItem('trackingData', JSON.stringify(existingData));
    fs.writeFileSync(dataFilePath, JSON.stringify(existingData, null, 2));
    console.log(`Tracking data saved successfully. Records for today: ${mergedRecords.length}`);
  } catch (error) {
    console.error('Error in saveTrackingData:', error);
  }
}

// ** Upload Batch to Database **
async function uploadBatchToDatabase() {
  if (batchRecords.length === 0) {
    console.log(" No new data to upload.");
    return;
  }

  // Trigger upload if batch reaches 20 records
  const shouldUpload =
    batchRecords.length >= MAX_BATCH_RECORDS ||
    batchRecords.length > 0;

  if (shouldUpload) {
    const userId = localStorage.getItem('userId') || 'test-user';
    const dateKey = new Date().toISOString().split('T')[0];
    const chunkSize = batchSize;
    let failedRecords = [];

    // Validate userId
    if (!userId) {
      console.error(" Error: No user ID found. Cannot upload tracking data.");
      return;
    }

    for (let i = 0; i < batchRecords.length; i += chunkSize) {
      const chunk = batchRecords.slice(i, i + chunkSize);

      let retryCount = 0;
      const maxRetries = 3;
      let success = false;

      while (retryCount < maxRetries) {
        try {
          console.log(` Preparing to upload batch data. 
            User ID: ${userId}
            Date: ${dateKey}
            Records in batch: ${chunk.length}`);

          const payload = {
            userId: userId,
            data: { [dateKey]: chunk }
          };

          const response = await axios.post(apiUrl, payload, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            timeout: 10000  // 10-second timeout
          });

          console.log(` Uploaded batch chunk ${i + 1} - ${i + chunk.length}`,
            `Status: ${response.status}`);

          success = true;
          break;
        } catch (error) {
          retryCount++;
          console.error(` Upload failed (Attempt ${retryCount}):`, error.message);
          await new Promise(resolve => setTimeout(resolve, 5000 * Math.pow(2, retryCount)));
        }
      }

      if (!success) {
        console.warn(` Failed to upload batch chunk. Retaining ${chunk.length} records.`);
        failedRecords.push(...chunk);
      }
    }

    // Update batch records with only failed records
    batchRecords = failedRecords;
    console.log(` Unuploaded records retained: ${batchRecords.length}`);
  }
}



// Enhanced Batch Upload Management
function setupBatchUploadSchedule() {
  // Clear any existing timer to prevent multiple schedules
  if (batchUploadTimer) {
    clearInterval(batchUploadTimer);
  }

  // Schedule batch upload every 10 minutes
  batchUploadTimer = setInterval(async () => {
    console.log(` Scheduled batch upload triggered. 
      Current batch records: ${batchRecords.length}`);

    await uploadBatchToDatabase();
  }, BATCH_UPLOAD_INTERVAL);
}


const dataKey = 'dailyTimerData';

// Enhanced day-wise timer tracking
function initializeTimer() {
  try {
    console.log('Initializing Timer...');
    const today = new Date().toLocaleDateString();
    const userId = localStorage.getItem('userId') || 'test-user';
    const timerKey = `dailyTimerData_${userId}_${today}`;
    const storedData = localStorage.getItem(timerKey);

    if (!storedData) {
      console.log(`No previous timer data found for user ${userId}. Starting fresh.`);
      elapsedTime = 0;
      isTracking = false;
      startTime = 0;
      saveTimerData();
      updateTimerDisplay(elapsedTime); // Display 00:00:00 initially
      return;
    }

    const parsedData = JSON.parse(storedData);
    console.log(`Loaded Timer Data for user ${userId}:`, parsedData);

    // Restore previous state, but do not resume tracking
    elapsedTime = parsedData.elapsedTime || 0;
    isTracking = false; // Always stop tracking on load
    startTime = 0; // Reset start time

    updateTimerDisplay(elapsedTime); // Show accumulated time from previous sessions
  } catch (error) {
    console.error('Error initializing timer:', error);
    resetTimerState();
  }
}

function saveTimerData() {
  try {
    const today = new Date().toLocaleDateString();
    const userId = localStorage.getItem('userId') || 'test-user';
    const timerKey = `dailyTimerData_${userId}_${today}`;
    
    // Calculate current session time if tracking
    const sessionTime = isTracking 
      ? Math.floor((Date.now() - startTime) / 1000) 
      : 0;

    const data = {
      userId: userId,
      date: today,
      elapsedTime: elapsedTime + sessionTime, // Include current session
      isTracking: isTracking,
      startTime: isTracking ? startTime : 0
    };

    localStorage.setItem(timerKey, JSON.stringify(data));
    console.log(` Timer data saved for user ${userId}:`, data);
  } catch (error) {
    console.error(' Error saving timer data:', error);
  }
}


// ** Update Timer **
// function updateTimer() {
//   try {
//     if (!isTracking) {
//       console.warn(' updateTimer called when not tracking');
//       return;
//     }

//     const now = Date.now();
    
//     if (!startTime) {
//       console.error(' Start time is not set during tracking');
//       isTracking = false;
//       return;
//     }

//     // Calculate precise session time
//     const sessionTimeMs = now - startTime;
//     const sessionTime = Math.floor(sessionTimeMs / 1000);
    
//     // Implement safeguards against unrealistic session times
//     if (sessionTime < 0) {
//       console.warn(' Negative session time detected. Resetting timer.');
//       startTime = now;
//       return;
//     }

//     if (sessionTime > 3600) { // More than 1 hour in a single interval
//       console.warn(` Unusually long session time: ${sessionTime} seconds`);
//       startTime = now; // Reset start time to prevent further anomalies
//       return;
//     }

//     // Increment elapsed time precisely
//     elapsedTime = Math.floor((now - (startTime - elapsedTime * 1000)) / 1000);
    
//     // Diagnostic logging with more context
//     console.log(` Timer Update: 
//       Total Elapsed: ${elapsedTime}s
//       Current Session: ${sessionTime}s
//       Start Time: ${new Date(startTime).toISOString()}
//       Current Time: ${new Date(now).toISOString()}`);

//     // Save timer data with error handling
//     try {
//       saveTimerData();
//     } catch (saveError) {
//       console.error(' Failed to save timer data:', saveError);
//     }

//     // Update display with precise elapsed time
//     updateTimerDisplay();

//   } catch (error) {
//     console.error(' Critical error in updateTimer:', {
//       message: error.message,
//       stack: error.stack
//     });
//     resetTimerState();
//   }
// }

function updateTimer() {
  if (!isTracking) {
    console.warn('updateTimer called when not tracking');
    return;
  }

  const now = Date.now();
  if (!startTime) {
    console.error('Start time is not set during tracking');
    isTracking = false;
    clearInterval(timerInterval); // Stop the interval if startTime is invalid
    return;
  }

  const currentSessionTime = Math.floor((now - startTime) / 1000);
  const totalTime = elapsedTime + currentSessionTime;

  if (currentSessionTime < 0) {
    console.warn('Negative session time detected. Resetting startTime.');
    startTime = now;
    return;
  }

  updateTimerDisplay(totalTime);
}
// ** Start Tracking Function **
// function startTracking() {
//   try {
//     console.log(' Attempting to start tracking...');
//     debugTimerState('Before Start');

//     if (isTracking) {
//       console.warn(' Already tracking. Ignoring start request.');
//       return;
//     }

//     isTracking = true;
//     startTime = Date.now();

//     // timerInterval = setInterval(updateTimer, 1000);
//     timerInterval = setInterval(() => {
//       updateTimer();
//     }, 1000); 
//     trackingInterval = setInterval(trackActiveWindow, 1000);
//     saveInterval = setInterval(saveTrackingData, 60000);

//     saveTimerData();

//     // Update start/stop button
//     document.getElementById('start-stop-btn').innerHTML = `
//       <svg width="20px" height="20px" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
//         <path fill="#F44336" d="M38,42H10c-2.2,0-4-1.8-4-4V10c0-2.2,1.8-4,4-4h28c2.2,0,4,1.8,4,4v28C42,40.2,40.2,42,38,42z"/>
//         <rect x="16" y="16" width="16" height="16" fill="#ffffff"/>
//       </svg>
//     `;

//     console.log(` Tracking started. 
//       Initial Elapsed Time: ${elapsedTime}s
//       Start Time: ${new Date(startTime).toISOString()}`);
    
//     debugTimerState('After Start');
//   } catch (error) {
//     console.error(' Error starting tracking:', error);
//     isTracking = false;
//   }
// }
async function startTracking() {
  try {
    console.log('Attempting to start tracking...');
    if (isTracking) {
      console.warn('Already tracking. Ignoring start request.');
      return;
    }

    const now = Date.now();
    isTracking = true;
    startTime = now;
    console.log('Tracking state set: isTracking =', isTracking, 'startTime =', new Date(startTime).toISOString());

    try {
      const lastStopTime = localStorage.getItem('lastStopTime');
      if (lastStopTime) {
        const idleDurationMs = now - parseInt(lastStopTime);
        if (idleDurationMs > 100) {
          const dateKey = new Date().toISOString().split('T')[0];
          const userId = localStorage.getItem('userId') || 'test-user';

          const idleRecord = {
            id: userId,
            app: "Idle",
            title: "Idle Time",
            startTime: new Date(parseInt(lastStopTime)).toISOString(),
            endTime: new Date(now).toISOString(),
            duration: `${Math.floor(idleDurationMs / 60000)}m ${Math.floor((idleDurationMs % 60000) / 1000)}s`,
            timestamp: new Date(parseInt(lastStopTime)).toISOString(),
            type: "idle"
          };

          console.log("Adding idle time record:", idleRecord);
          if (!trackingData) trackingData = {};
          if (!trackingData[dateKey]) trackingData[dateKey] = [];
          trackingData[dateKey].push(idleRecord);
          batchRecords.push(idleRecord);

          await saveTrackingData();
          await uploadBatchToDatabase();
          updateTable();
          updateInsights();
        } else {
          console.log(`Idle duration too short (${idleDurationMs}ms). Skipping idle record.`);
        }
        localStorage.removeItem('lastStopTime');
      } else {
        console.log("No previous stop time found. Starting fresh.");
      }
    } catch (idleError) {
      console.error('Error handling idle time:', idleError);
    }

    console.log('Setting intervals...');
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
    console.log('timerInterval set:', timerInterval);

    if (trackingInterval) clearInterval(trackingInterval);
    trackingInterval = setInterval(trackActiveWindow, 1000);
    console.log('trackingInterval set:', trackingInterval);

    if (saveInterval) clearInterval(saveInterval);
    saveInterval = setInterval(saveTrackingData, 60000);
    console.log('saveInterval set:', saveInterval);

    try {
      saveTimerData();
      updateTimerDisplay(elapsedTime);
    } catch (saveError) {
      console.error('Error saving timer data or updating display:', saveError);
    }

    try {
      const startStopBtn = document.getElementById('start-stop-btn');
      if (startStopBtn) {
        startStopBtn.innerHTML = `
          <svg width="20px" height="20px" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path fill="#F44336" d="M38,42H10c-2.2,0-4-1.8-4-4V10c0-2.2,1.8-4,4-4h28c2.2,0,4,1.8,4,4v28C42,40.2,40.2,42,38,42z"/>
            <rect x="16" y="16" width="16" height="16" fill="#ffffff"/>
          </svg>
        `;
      } else {
        console.error('Start-stop button not found in DOM');
      }
    } catch (btnError) {
      console.error('Error updating start-stop button:', btnError);
    }

    setTimeout(trackActiveWindow, 1000);

    console.log(`Tracking started successfully. Total Elapsed Time: ${elapsedTime}s, Start Time: ${new Date(now).toISOString()}`);
  } catch (error) {
    console.error('Error in startTracking:', error.message, error.stack);
    isTracking = false;
    if (timerInterval) clearInterval(timerInterval);
    if (trackingInterval) clearInterval(trackingInterval);
    if (saveInterval) clearInterval(saveInterval);
    timerInterval = null;
    trackingInterval = null;
    saveInterval = null;
    updateTimerDisplay(elapsedTime);
  }
}
// ** Stop Tracking Function **
// function stopTracking() {
//   try {
//     console.log(' Attempting to stop tracking...');
//     debugTimerState('Before Stop');

//     if (!isTracking) {
//       console.warn(' Not currently tracking. Ignoring stop request.');
//       return;
//     }

//     const now = Date.now();
//     const sessionTime = Math.floor((now - startTime) / 1000);
    
//     // Stop all intervals with error handling
//     clearInterval(timerInterval);
//     clearInterval(trackingInterval);
//     clearInterval(saveInterval);
    
//     // Update total elapsed time
//     elapsedTime += sessionTime;
    
//     // Reset tracking state
//     isTracking = false;
    
//     // Save final tracking data
//     saveTimerData();

//     // Upload any pending batch records
//    try {
//     uploadBatchToDatabase();
//     console.log('Batch upload successful.');
//    } catch (error) {
//     console.error('Error uploading batch:', error);
//    }

//     // Update start/stop button
//     document.getElementById('start-stop-btn').innerHTML = `
//       <svg width="20px" height="20px" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
//         <path fill="#4CAF50" d="M38,42H10c-2.2,0-4-1.8-4-4V10c0-2.2,1.8-4,4-4h28c2.2,0,4,1.8,4,4v28C42,40.2,40.2,42,38,42z"/>
//         <polygon fill="#ffffff" points="31,24 20,16 20,32"/>
//       </svg>
//     `;

//     // Update display
//     updateTimerDisplay();

//     console.log(` Tracking stopped. 
//       Total Elapsed Time: ${elapsedTime}s
//       Last Session Time: ${sessionTime}s`);
    
//     debugTimerState('After Stop');
//   } catch (error) {
//     console.error(' Error stopping tracking:', error);
//     isTracking = false;
//   }
// }

async function trackActiveWindow() {
  console.log("Running trackActiveWindow...");

  if (!isTracking || !timerInterval) {
    lastWindow = null;
    lastWindowStartTime = null;
    console.log("Tracking is stopped or timer not running. Skipping active window tracking.");
    return;
  }

  try {
    const result = await ipcRenderer.invoke('get-active-window');
    console.log("Raw active window result:", result);

    if (!result) {
      console.log("No active window data returned.");
      return;
    }

    const windowInfo = {
      owner: {
        name: result.owner?.name || result.process || result.processName || 'Unknown Process',
        path: result.owner?.path || result.path || ''
      },
      title: result.title || result.name || 'Untitled'
    };
    console.log("Normalized window info:", windowInfo);

    if (!shouldIgnoreWindow(windowInfo.owner.name, windowInfo.title)) {
      const now = Date.now();
      const dateKey = new Date().toISOString().split('T')[0];
      const userId = localStorage.getItem('userId') || 'test-user';

      if (!trackingData) trackingData = {};
      if (!trackingData[dateKey]) trackingData[dateKey] = [];

      if (!lastWindow || 
          lastWindow.owner.name !== windowInfo.owner.name || 
          lastWindow.title !== windowInfo.title) {
        if (lastWindow && lastWindowStartTime) {
          const durationMs = now - lastWindowStartTime;

          if (durationMs > 1000) {
            const newRecord = {
              id: userId,
              app: lastWindow.owner.name,
              title: lastWindow.title,
              startTime: new Date(lastWindowStartTime).toISOString(),
              endTime: new Date(now).toISOString(),
              duration: `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`,
              timestamp: new Date(lastWindowStartTime).toISOString(),
              type: "active"
            };

            console.log("Adding new active record:", newRecord);
            trackingData[dateKey].push(newRecord);
            batchRecords.push(newRecord);

            await saveTrackingData();
          }
        }

        lastWindow = windowInfo;
        lastWindowStartTime = now;
        console.log("Updated lastWindow:", lastWindow);
      }
    } else {
      console.log(`Window ignored: ${windowInfo.owner.name} - ${windowInfo.title}`);
    }
  } catch (error) {
    console.error("Error in trackActiveWindow:", error);
  }

  updateTable();
  updateInsights();

  if (batchRecords.length >= MAX_BATCH_RECORDS) {
    console.log(`Batch records reached ${MAX_BATCH_RECORDS}. Triggering upload.`);
    await uploadBatchToDatabase();
  }
}
// ** Active Window Tracking **
// async function trackActiveWindow() {
//   console.log("Running trackActiveWindow...");

//   if (!timerInterval) {
//     lastWindow = null;
//     lastWindowStartTime = null;
//     console.log(" Timer is not running. Skipping active window tracking.");
//     return;
//   }

//   const result = await ipcRenderer.invoke('get-active-window');
//   console.log(" Active window result:", result);

//   // Enhance compatibility with different library return structures
//   const windowInfo = result ? {
//     owner: {
//       name: result.owner?.name || result.process || result.processName || 'Unknown Process',
//       path: result.owner?.path || result.path || ''
//     },
//     title: result.title || result.name || 'Untitled'
//   } : null;

//   if (windowInfo && windowInfo.owner && windowInfo.title) {
//     // Check if the window should be tracked
//     if (!shouldIgnoreWindow(windowInfo.owner.name, windowInfo.title)) {
//       const now = Date.now();
//       const dateKey = new Date().toISOString().split('T')[0];
//       const userId = localStorage.getItem('userId') || 'test-user';

//       // Ensure trackingData is initialized
//       if (!trackingData) trackingData = {};
//       if (!trackingData[dateKey]) trackingData[dateKey] = [];

//       // Check if the active window has changed
//       if (!lastWindow ||
//         lastWindow.owner.name !== windowInfo.owner.name ||
//         lastWindow.title !== windowInfo.title) {
//         if (lastWindow && lastWindowStartTime) {
//           const durationMs = now - lastWindowStartTime;

//           if (durationMs > 1000) { // Avoid tiny records
//             const newRecord = {
//               id: userId,
//               app: lastWindow.owner.name,
//               title: lastWindow.title,
//               startTime: new Date(lastWindowStartTime).toISOString(),
//               endTime: new Date(now).toISOString(),
//               duration: `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`,
//               timestamp: new Date(lastWindowStartTime).toISOString(),
//             };

//             // Add to tracking data
//             trackingData[dateKey].push(newRecord);

//             // Update localStorage immediately
//             try {
//               // Log detailed information about the record being added
//               console.log(' 📝 Preparing to update localStorage:', {
//                 dateKey: dateKey,
//                 recordCount: trackingData[dateKey].length,
//                 newRecord: {
//                   app: lastWindow.owner.name,
//                   title: lastWindow.title,
//                   duration: `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`
//                 }
//               });

//               // Stringify and save to localStorage
//               const localStorageData = JSON.stringify(trackingData);
//               localStorage.setItem('trackingData', localStorageData);

//               // Verify the data was saved correctly
//               const verifiedData = localStorage.getItem('trackingData');
//               console.log(' ✅ localStorage update', {
//                 status: 'Success',
//                 savedRecordCount: JSON.parse(verifiedData)[dateKey].length,
//                 dataLength: localStorageData.length
//               });
//             } catch (error) {
//               console.error(' ❌ Error updating localStorage:', {
//                 message: error.message,
//                 stack: error.stack,
//                 data: trackingData[dateKey]
//               });

//               // Attempt to recover or log additional context
//               try {
//                 console.log(' 🔍 Additional Context:', {
//                   trackingDataExists: !!trackingData,
//                   dateKeyExists: !!trackingData[dateKey],
//                   recordCount: trackingData[dateKey]?.length || 0
//                 });
//               } catch (contextError) {
//                 console.error(' 🚨 Critical error gathering context:', contextError);
//               }
//             }

//             // Add to batch records
//             batchRecords.push(newRecord);

//             // Save tracking data
//             saveTrackingData();
//           }
//         }

//         lastWindow = windowInfo;
//         lastWindowStartTime = now;
//       }
//     } else {
//       console.log(" No trackable window detected or window is ignored.");
//       // Optional: Reset lastWindow if an ignored window is detected
//       if (lastWindow && lastWindowStartTime) {
//         const now = Date.now();
//         const durationMs = now - lastWindowStartTime;

//         // Only log if the previous window was tracked for more than a second
//         if (durationMs > 1000) {
//           console.log(` Ignored window detected. Previous window tracked for ${durationMs}ms`);
//         }

//         // Reset last window tracking
//         lastWindow = null;
//         lastWindowStartTime = null;
//       }
//     }
//   } else {
//     console.log(" No active window detected.");
//   }

//   updateTable();
//   updateInsights();

//   // Check if batch records have reached the threshold
//   if (batchRecords.length >= MAX_BATCH_RECORDS) {
//     console.log(` Batch records reached ${MAX_BATCH_RECORDS}. Triggering upload.`);
//     await uploadBatchToDatabase();
//   }
// }

// ** Active Window Tracking with adding data into batchRecords array on local storage and uploading to database **
async function trackActiveWindow() {
  console.log("Running trackActiveWindow...");

  if (!isTracking || !timerInterval) {
    lastWindow = null;
    lastWindowStartTime = null;
    console.log("Tracking is stopped or timer not running. Skipping active window tracking.");
    return;
  }

  try {
    const result = await ipcRenderer.invoke('get-active-window');
    console.log("Raw active window result:", result);

    if (!result) {
      console.log("No active window data returned.");
      return;
    }

    const windowInfo = {
      owner: {
        name: result.owner?.name || result.process || result.processName || 'Unknown Process',
        path: result.owner?.path || result.path || ''
      },
      title: result.title || result.name || 'Untitled'
    };
    console.log("Normalized window info:", windowInfo);

    if (!shouldIgnoreWindow(windowInfo.owner.name, windowInfo.title)) {
      const now = Date.now();
      const dateKey = new Date().toISOString().split('T')[0];
      const userId = localStorage.getItem('userId') || 'test-user';

      if (!trackingData) trackingData = {};
      if (!trackingData[dateKey]) trackingData[dateKey] = [];

      if (!lastWindow || 
          lastWindow.owner.name !== windowInfo.owner.name || 
          lastWindow.title !== windowInfo.title) {
        if (lastWindow && lastWindowStartTime) {
          const durationMs = now - lastWindowStartTime;

          if (durationMs > 1000) {
            const newRecord = {
              id: userId,
              app: lastWindow.owner.name,
              title: lastWindow.title,
              startTime: new Date(lastWindowStartTime).toISOString(),
              endTime: new Date(now).toISOString(),
              duration: `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`,
              timestamp: new Date(lastWindowStartTime).toISOString(),
              type: "active"
            };

            console.log("Adding new active record:", newRecord);
            trackingData[dateKey].push(newRecord);
            batchRecords.push(newRecord);

            await saveTrackingData();
          }
        }

        lastWindow = windowInfo;
        lastWindowStartTime = now;
        console.log("Updated lastWindow:", lastWindow);
      }
    } else {
      console.log(`Window ignored: ${windowInfo.owner.name} - ${windowInfo.title}`);
    }
  } catch (error) {
    console.error("Error in trackActiveWindow:", error);
  }

  updateTable();
  updateInsights();

  if (batchRecords.length >= MAX_BATCH_RECORDS) {
    console.log(`Batch records reached ${MAX_BATCH_RECORDS}. Triggering upload.`);
    await uploadBatchToDatabase();
  }
}

// ** Update Table **
function updateTable() {
  const tableBody = document.getElementById('table-body');
  tableBody.innerHTML = '';
  const dateKey = new Date().toISOString().split('T')[0];
  const dataForDate = trackingData[dateKey] || [];
  if (dataForDate.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4">No records found</td></tr>';
    return;
  }

  dataForDate.slice(0, recordsPerPage).forEach((record) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${new Date(record.timestamp).toLocaleDateString()}</td>
      <td>${record.app}</td>
      <td>${record.title}</td>
      <td>${record.duration}</td>
    `;
    tableBody.appendChild(row);
  });
}

// ** Insights Calculation **
function updateInsights() {
  const dateKey = new Date().toISOString().split('T')[0];
  const dataForDate = trackingData[dateKey] || [];
  const totalTime = dataForDate.reduce((sum, record) => sum + parseDuration(record.duration), 0);
  const averageTime = dataForDate.length > 0 ? totalTime / dataForDate.length : 0; // Add check for empty data
  document.getElementById('total-time').textContent = `${Math.floor(totalTime / 60)}m ${totalTime % 60}s`;
  document.getElementById('average-time').textContent = `${Math.floor(averageTime / 60)}m ${Math.floor(averageTime % 60)}s`;
  document.getElementById('tasks-completed').textContent = dataForDate.length;
}

// ** Logout Button Logic **
const logoutBtn = document.getElementById('logout-btn');
logoutBtn.addEventListener("click", async () => {
  try {
    console.log(" User clicked Logout");

    // Stop any ongoing tracking
    if (typeof stopTracking === 'function') {
      stopTracking();
    }

    // Ensure data is uploaded before logout
    if (typeof uploadBatchToDatabase === 'function') {
      await uploadBatchToDatabase();
    }

    // Clear local storage and session data
    localStorage.clear();
    
    // Send logout event to main process
    ipcRenderer.send('logout');
    
    // Prevent any further window interactions
    window.close();
  } catch (error) {
    console.error('Logout error:', error);
    // Force logout even if there's an error
    ipcRenderer.send('logout');
    window.close();
  }
});

// Modify Start/Stop Button to continue from total tracked duration
document.addEventListener('DOMContentLoaded', () => {

  initializeTimer();
  console.log(' DOM fully loaded and parsed');

  // Set up batch upload schedule
  setupBatchUploadSchedule();

  const startStopBtn = document.getElementById('start-stop-btn');
  // startStopBtn.addEventListener('click', async () => {
  //   if (isTracking) {
  //     await stopTracking();
  //   } else {
  //     await startTracking();
  //   }
  // });
  // Start Stop Button
  // startStopBtn.addEventListener('click',async () => {
  //   const today = new Date().toLocaleDateString();
  //   const userId = localStorage.getItem('userId') || 'test-user';
  //   const timerKey = `dailyTimerData_${userId}_${today}`;
    
  //   if (isTracking) {
  //     await stopTracking();
  //     // Stop Timer
  //     const now = Date.now();
  //     const currentSessionTime = Math.floor((now - startTime) / 1000);

  //     clearInterval(timerInterval);
  //     clearInterval(trackingInterval);
  //     clearInterval(saveInterval);
  //     timerInterval = null;
  //     isTracking = false;

  //     // Accurately accumulate elapsed time
  //     elapsedTime += currentSessionTime;
  //     startTime = 0;

  //     // Save final state
  //     saveTimerData();

  //     // Update display
  //     updateTimerDisplay();
     
  //     try {
  //       // Upload final batch
  //       uploadBatchToDatabase();
  //       console.log(" Batch uploaded successfully after stopping tracking.");
  //       // alert(" Batch uploaded successfully after stopping tracking."); 

  //     } catch (error) {
  //       console.error('Error uploading batch:', error);
  //       // alert(" Error uploading batch.", error);
  //     }

  //     // Change button to "Start"
  //     startStopBtn.innerHTML = `
  //       <svg width="20px" height="20px" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  //         <path fill="#4CAF50" d="M38,42H10c-2.2,0-4-1.8-4-4V10c0-2.2,1.8-4,4-4h28c2.2,0,4,1.8,4,4v28C42,40.2,40.2,42,38,42z"/>
  //         <polygon fill="#ffffff" points="31,24 20,16 20,32"/>
  //       </svg>
  //     `;

  //   } else {
  //     await startTracking();
  //     // Start Timer
  //     startTime = Date.now();
  //     isTracking = true;

  //     timerInterval = setInterval(updateTimer, 1000);
  //     trackingInterval = setInterval(trackActiveWindow, 1000);
  //     saveInterval = setInterval(saveTrackingData, 60000);

  //     // Save initial state
  //     saveTimerData();
     
  //     // Change button to "Stop"
  //     startStopBtn.innerHTML = `
  //       <svg width="20px" height="20px" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  //         <path fill="#F44336" d="M38,42H10c-2.2,0-4-1.8-4-4V10c0-2.2,1.8-4,4-4h28c2.2,0,4,1.8,4,4v28C42,40.2,40.2,42,38,42z"/>
  //         <rect x="16" y="16" width="16" height="16" fill="#ffffff"/>
  //       </svg>
  //     `;
  //   }
  // });

  if (startStopBtn) {
    startStopBtn.addEventListener('click', async () => {
      if (isTracking) {
        await stopTracking();
        startStopBtn.innerHTML = `
              <svg width="20px" height="20px" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path fill="#4CAF50" d="M38,42H10c-2.2,0-4-1.8-4-4V10c0-2.2,1.8-4,4-4h28c2.2,0,4,1.8,4,4v28C42,40.2,40.2,42,38,42z"/>
                <polygon fill="#ffffff" points="31,24 20,16 20,32"/>
              </svg>
            `;
      } else {
        await startTracking();
        startStopBtn.innerHTML = `
        <svg width="20px" height="20px" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <path fill="#F44336" d="M38,42H10c-2.2,0-4-1.8-4-4V10c0-2.2,1.8-4,4-4h28c2.2,0,4,1.8,4,4v28C42,40.2,40.2,42,38,42z"/>
          <rect x="16" y="16" width="16" height="16" fill="#ffffff"/>
        </svg>
      `;

      }
    });
  } else {
    console.error('Start-stop button not found in DOM on load');
  }

  // Handle Pause & Take a Break (Fix for "Yes, take a break" not stopping the timer)
  document.getElementById("take-break")?.addEventListener("click", async () => {
    console.log("User clicked 'Yes, take a break'");
  
    // Stop Timer Completely
    if (timerInterval) clearInterval(timerInterval);
    if (trackingInterval) clearInterval(trackingInterval);
    if (saveInterval) clearInterval(saveInterval);
    if (idleCheckInterval) clearInterval(idleCheckInterval);
    timerInterval = null;
    trackingInterval = null;
    saveInterval = null;
  
    // Calculate session time
    const now = Date.now();
    const sessionTime = Math.floor((now - startTime) / 1000);
    elapsedTime += sessionTime;
  
    // Finalize the last active window's tracking data
    if (lastWindow && lastWindowStartTime) {
      const durationMs = now - lastWindowStartTime;
      if (durationMs > 1000) {
        const dateKey = new Date().toISOString().split('T')[0];
        const userId = localStorage.getItem('userId') || 'test-user';
  
        const newRecord = {
          id: userId,
          app: lastWindow.owner.name,
          title: lastWindow.title,
          startTime: new Date(lastWindowStartTime).toISOString(),
          endTime: new Date(now).toISOString(),
          duration: `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`,
          timestamp: new Date(lastWindowStartTime).toISOString(),
          type: "active"
        };
  
        console.log("Finalizing last active window record on break:", newRecord);
        if (!trackingData) trackingData = {};
        if (!trackingData[dateKey]) trackingData[dateKey] = [];
        trackingData[dateKey].push(newRecord);
        batchRecords.push(newRecord);
  
        await saveTrackingData();
      }
    }
  
    // Reset state and store stop time
    isTracking = false;
    startTime = 0;
    const stopTime = now;
    lastWindow = null;
    lastWindowStartTime = null;
  
    localStorage.setItem('lastStopTime', stopTime.toString());
  
    // Save and Upload
    await uploadBatchToDatabase();
  
    // Update UI
    updateTimerDisplay(elapsedTime);
    updateTable();
    updateInsights();
  
    // Change the Start/Stop Button to "Start"
    const startStopBtn = document.getElementById('start-stop-btn');
    startStopBtn.innerHTML = `
      <svg width="20px" height="20px" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <path fill="#4CAF50" d="M38,42H10c-2.2,0-4-1.8-4-4V10c0-2.2,1.8-4,4-4h28c2.2,0,4,1.8,4,4v28C42,40.2,40.2,42,38,42z"/>
        <polygon fill="#ffffff" points="31,24 20,16 20,32"/>
      </svg>
    `;
    console.log("Tracking stopped successfully after taking a break. Stop Time:", new Date(stopTime).toISOString());
  });

  // Handle Menu Dropdown
  const menuBtn = document.getElementById("menu-btn");
  const menuDropdown = document.getElementById("menu-dropdown");
  const logoutBtn = document.getElementById("logout-btn");
  // const quitBtn = document.getElementById("quit-btn");

  menuBtn.addEventListener("click", (event) => {
    event.stopPropagation(); // Prevent event from bubbling up
    menuDropdown.classList.toggle("hidden");
  });

  document.addEventListener("click", (event) => {
    if (!menuBtn.contains(event.target) && !menuDropdown.contains(event.target)) {
      menuDropdown.classList.add("hidden");
    }
  });

  // Handle Logout
  logoutBtn.addEventListener("click", async () => {
    console.log(" User clicked Logout");

    // Ensure data is uploaded before logout
    await uploadBatchToDatabase();

    localStorage.clear(); // Clear user session
    ipcRenderer.send("logout"); // Send logout event to main process
    window.location.href = "index.html"; // Redirect to login page
  });

  // Handle Quit
  const quitBtn = document.getElementById("quit-btn");
  quitBtn.addEventListener("click", async () => {
    try {
      // Send quit request to main process
      ipcRenderer.send("quit-app");
    } catch (error) {
      console.error("Error during quit process:", error);
    }
  });

  // Listen for prepare-quit event from main process
  ipcRenderer.on('prepare-quit', async () => {
    try {
      // Final data save attempt
      if (typeof uploadBatchToDatabase === 'function') {
        await uploadBatchToDatabase();
      }
      
      if (typeof saveTrackingData === 'function') {
        saveTrackingData();
      }
    } catch (error) {
      console.error('Error during final data save:', error);
    }
  });

});

// Add event listeners to reset idle timeout
document.addEventListener("DOMContentLoaded", () => {
  console.log('DOM loaded, setting up activity tracking');

  document.addEventListener("mousemove", trackUserActivity);
  document.addEventListener("keydown", trackUserActivity);
  document.addEventListener("mousedown", trackUserActivity);
  document.addEventListener("touchstart", trackUserActivity);

  // Initial reset of idle timeout
  setupActivityTracking();
});

// Also, schedule cleanup every 24 hours
setInterval(cleanupOldData, 24 * 60 * 60 * 1000); // Runs daily

// List of ignored applications and titles
const IGNORED_APPS = [
  'System',
  'ShellHost',
  'Windows Explorer',
  'Program Manager',
  'Task Manager',
  'Task Switcher',
  'Desktop Window Manager',
  'Windows Shell Experience Host',
  'Microsoft Text Input Application',
  'Start',
  'Action Center',
  'Cortana',
  'Settings',
  'Microsoft Store',
  'Microsoft Edge Update',
  'Microsoft Edge WebView2',
  'Windows Security',
  'Windows Defender Security Center',
  'ShellHost',
  'Electron',
  'SearchHost.exe'
];

const IGNORED_TITLES = [
  'Desktop',
  'Start Menu',
  'Action Center',
  'Notification Center',
  'Microsoft Store',
  'Settings',
  'Windows Security',
  'Task View',
  'New Tab - Google Chrome',
  'Search'
];

// Function to check if an application or title should be ignored
function shouldIgnoreWindow(app, title) {
  return IGNORED_APPS.some(ignoredApp =>
    app.toLowerCase().includes(ignoredApp.toLowerCase())
  ) || IGNORED_TITLES.some(ignoredTitle =>
    title.toLowerCase().includes(ignoredTitle.toLowerCase())
  );
}

// ** Update Timer Display **
// function updateTimerDisplay() {
//   const totalSeconds = elapsedTime;
//   const hours = Math.floor(totalSeconds / 3600);
//   const minutes = Math.floor((totalSeconds % 3600) / 60);
//   const seconds = totalSeconds % 60;

//   const timerDisplay = document.getElementById('timer');
//   if (timerDisplay) {
//     timerDisplay.textContent = `${
//       hours.toString().padStart(2, '0')
//     }:${
//       minutes.toString().padStart(2, '0')
//     }:${
//       seconds.toString().padStart(2, '0')
//     }`;
//   }

//   console.log(`Updated Timer Display: ${hours}:${minutes}:${seconds}`);
// }


// ** Update Timer Display Function **
function updateTimerDisplay(totalSeconds) {
  // Check if totalSeconds is a valid number
  if (typeof totalSeconds !== 'number' || isNaN(totalSeconds)) {
    console.error('Invalid totalSeconds value:', totalSeconds);
    return; // Skip updating the display if the value is invalid
  }

  // Calculate hours, minutes, and seconds
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Update the timer display
  const timerDisplay = document.getElementById('timer');
  if (timerDisplay) {
    timerDisplay.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  console.log(`Updated Timer Display: ${hours}:${minutes}:${seconds}`);
}

// Enhanced Uninstallation Handler
function handleUninstall() {
  const { ipcRenderer } = require('electron');
  
  // Comprehensive Uninstallation Confirmation
  const confirmUninstall = confirm(
    ' Uninstallation Warning \n\n' +
    'This will permanently remove:\n' +
    '• All tracking data\n' +
    '• Application settings\n' +
    '• Local storage\n' +
    '• Authentication tokens\n\n' +
    'Are you absolutely sure you want to continue?'
  );
  
  if (confirmUninstall) {
    try {
      // Stop any active tracking
      if (window.stopTracking) {
        window.stopTracking();
      }
      
      // Comprehensive Browser Storage Cleanup
      const storageCleanupMethods = [
        () => {
          localStorage.clear();
          console.log('Browser localStorage cleared');
        },
        () => {
          sessionStorage.clear();
          console.log('Browser sessionStorage cleared');
        },
        () => {
          // Clear IndexedDB databases
          if (window.indexedDB) {
            window.indexedDB.databases().then(databases => {
              databases.forEach(db => {
                window.indexedDB.deleteDatabase(db.name);
                console.log(`Deleted IndexedDB: ${db.name}`);
              });
            });
          }
        }
      ];
      
      // Execute all cleanup methods
      storageCleanupMethods.forEach(method => {
        try {
          method();
        } catch (error) {
          console.error('Storage cleanup error:', error);
        }
      });
      
      // Send comprehensive uninstall request
      ipcRenderer.send('perform-uninstall', {
        reason: 'complete_app_removal',
        timestamp: Date.now()
      });
      
      // Listen for uninstallation result with enhanced feedback
      ipcRenderer.once('uninstall-complete', (event, result) => {
        if (result) {
          alert(' Uninstallation Successful!\n\n' +
                'All application data has been removed.\n' +
                'Thank you for using Time Tracker!');
        } else {
          alert(' Uninstallation Partially Failed\n\n' +
                'Some files could not be removed.\n' +
                'Please check application logs for details.');
        }
      });
      
    } catch (uninstallError) {
      console.error('Uninstallation process failed:', uninstallError);
      alert('Uninstallation encountered an unexpected error.');
    }
  }
}

// Add uninstall button to UI with enhanced visibility
function addUninstallButton() {
  const settingsContainer = document.querySelector('.settings-container');
  if (settingsContainer) {
    const uninstallButton = document.createElement('button');
    uninstallButton.textContent = ' Uninstall App';
    uninstallButton.classList.add('uninstall-btn', 'danger-btn');
    uninstallButton.style.cssText = `
      background-color: #ff4d4d;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 5px;
      cursor: pointer;
      transition: background-color 0.3s;
    `;
    uninstallButton.addEventListener('click', handleUninstall);
    
    // Add hover effect
    uninstallButton.addEventListener('mouseenter', (e) => {
      e.target.style.backgroundColor = '#ff6666';
    });
    uninstallButton.addEventListener('mouseleave', (e) => {
      e.target.style.backgroundColor = '#ff4d4d';
    });
    
    settingsContainer.appendChild(uninstallButton);
  }
}

// Call when home page is loaded
document.addEventListener('DOMContentLoaded', addUninstallButton);

window.addEventListener("beforeunload", () => {
  console.log(" App is closing. Saving timer state...");
  saveTimerData();
});