const { ipcRenderer } = require('electron');
//testing api url
// const apiUrl = 'https://testing-backend-3uc6s.ondigitalocean.app/api/v1/signin';

// Resolute partners main api url
const apiUrl ='https://my-app-7fjx6.ondigitalocean.app/api/v1/signin'

//Localhost api url
// const apiUrl = 'http://localhost:8000/api/v1/signin';
// Check if a user is already logged in

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (token) {
    ipcRenderer.send('login-success', { token }); // Notify the main process
    window.location.href = 'home.html'; // Redirect to home page
  }
});

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
      console.error('Error response:', errorText);
      alert('Login failed: ' + errorText);
      return;
    }

    const data = await response.json();
    alert(JSON.stringify(JSON.stringify(data.user.fullName), null, 2));
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
