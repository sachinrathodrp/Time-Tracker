
    const { contextBridge, ipcRenderer } = require('electron');

    // Expose animation methods to renderer
    contextBridge.exposeInMainWorld('windowAnimations', {
      slideIn: () => {
        const style = document.createElement('style');
        style.textContent = `
          @keyframes slideIn {
            from { 
              transform: translateX(100%); 
              opacity: 0;
            }
            to { 
              transform: translateX(0); 
              opacity: 1;
            }
          }
          body {
            animation: slideIn 0.5s ease-out;
          }
        `;
        document.head.appendChild(style);
      },
      breatheEffect: () => {
        const style = document.createElement('style');
        style.textContent = `
          @keyframes breathe {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.02); }
          }
          body {
            animation: breathe 3s ease-in-out infinite;
          }
        `;
        document.head.appendChild(style);
      },
      hoverGlow: () => {
        const style = document.createElement('style');
        style.textContent = `
          @keyframes glowPulse {
            0%, 100% { 
              box-shadow: 0 0 5px rgba(44, 62, 80, 0.3);
            }
            50% { 
              box-shadow: 0 0 15px rgba(44, 62, 80, 0.6);
            }
          }
          body {
            transition: all 0.3s ease;
          }
          body:hover {
            animation: glowPulse 2s infinite;
          }
        `;
        document.head.appendChild(style);
      }
    });
  