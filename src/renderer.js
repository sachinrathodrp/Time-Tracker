const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const { dialog } = require('electron');

//testing api url
// const apiUrl = 'https://testing-backend-3uc6s.ondigitalocean.app/api/v1/signin';

// Resolute partners main api url
const apiUrl ='https://my-app-7fjx6.ondigitalocean.app/api/v1/signin'

//Localhost api url
// const apiUrl = 'http://localhost:8000/api/v1/signin';

// Enhanced Token Management
// Robust Token Verification Function
function verifyAndResetToken() {
  try {
    const userDataPath = require('electron').remote.app.getPath('userData');
    const tokenPath = path.join(userDataPath, 'token.json');

    // Check if token exists and is valid
    if (fs.existsSync(tokenPath)) {
      const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      
      // Validate token structure and expiration
      if (!isValidToken(tokenData)) {
        console.warn('Invalid or expired token detected. Resetting authentication.');
        fs.unlinkSync(tokenPath);
        localStorage.clear();
        ipcRenderer.send('reset-to-login');
        return false;
      }
      return true;
    }
    
    // No token found
    console.log('No valid token found. Redirecting to login.');
    ipcRenderer.send('reset-to-login');
    return false;
  } catch (error) {
    console.error('Token verification failed:', error);
    ipcRenderer.send('reset-to-login');
    return false;
  }
}

// Token Validation Helper
function isValidToken(tokenData) {
  // Implement comprehensive token validation
  if (!tokenData || !tokenData.token) return false;
  
  // Check token expiration (example: 30 days)
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const tokenAge = Date.now() - (tokenData.timestamp || 0);
  
  return tokenAge < THIRTY_DAYS;
}

// Global Error Handling
window.addEventListener('error', (event) => {
  console.error('Unhandled error:', event.error);
  ipcRenderer.send('reset-to-login');
});

// IPC Listeners for Authentication Management
ipcRenderer.on('token-invalid', () => {
  console.warn('Received token-invalid signal');
  localStorage.clear();
  verifyAndResetToken();
});

// Initial Token Check on Page Load
document.addEventListener('DOMContentLoaded', () => {
  // Verify token before allowing access to main application
  if (!verifyAndResetToken()) {
    // Redirect to login or show login modal
    ipcRenderer.send('reset-to-login');
  } else {
    const token = localStorage.getItem('token');
    if (token) {
      ipcRenderer.send('login-success', { token }); // Notify the main process
      window.location.href = 'home.html'; // Redirect to home page
    }
  }
});

// Expose verification method globally
window.verifyAndResetToken = verifyAndResetToken;

// Login Form Submission
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email, password }),
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error response:', errorText);
      alert('Login failed: ' + errorText);
      return;
    }

    const data = await response.json();
    ipcRenderer.send('show-message-box', {
      type: 'info',
      title: 'Welcome',
      message: `Welcome, ${data.user.fullName}!`
    });
    if (data.token) {
      localStorage.setItem('data', JSON.stringify(data));
      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', data.user._id);

      ipcRenderer.send('login-success', { token: data.token, userId: data.user._id });
      window.location.href = 'home.html';
    } else {
      alert('Login failed: No token received');
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('Login failed: Unable to connect to the server');
  }
});
