
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function verifyUninstall() {
  console.log('🔍 Uninstall Verification Report');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Check userData directory
  const userDataPath = path.join(process.env.APPDATA, 'Time Tracking App');
  const userDataExists = fs.existsSync(userDataPath);
  console.log(`UserData Directory (${userDataPath}): ${userDataExists ? '❌ EXISTS' : '✅ REMOVED'}`);

  // Check additional paths
  const extraPaths = [
    path.join(process.env.USERPROFILE, '.time-tracking-app', 'token.json'),
    path.join(process.env.APPDATA, 'time-tracking-app', 'token.json'),
  ];
  const extraFilesExist = extraPaths.some((p) => fs.existsSync(p));
  console.log(`Extra Files: ${extraFilesExist ? '❌ EXISTS' : '✅ REMOVED'}`);

  // Check registry
  let registryExists = false;
  try {
    execSync('reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Time Tracking App"');
    registryExists = true;
  } catch (error) {
    registryExists = false;
  }
  console.log(`Registry Entry: ${registryExists ? '❌ EXISTS' : '✅ REMOVED'}`);

  // Summary
  const allClean = !userDataExists && !extraFilesExist && !registryExists;
  console.log(`\nSummary: ${allClean ? '✅ Uninstall Successful' : '❌ Uninstall Incomplete'}`);
  if (!allClean) {
    console.log('Remaining items:');
    if (userDataExists) console.log(`- ${userDataPath}`);
    if (extraFilesExist) console.log(`- Extra files in ${extraPaths.join(', ')}`);
    if (registryExists) console.log('- Registry entry');
  }

  process.exit(allClean ? 0 : 1);
}

verifyUninstall();

// const fs = require('fs');
// const path = require('path');

// function getTokenPaths() {
//   return [
//     path.join(process.env.APPDATA, 'time-tracking-app', 'token.json'),
//     path.join(process.env.LOCALAPPDATA, 'Time Tracking App', 'token.json'),
//     path.join(process.env.USERPROFILE, 'token.json'),
//     path.join(process.env.APPDATA, 'Roaming', 'time-tracking-app', 'token.json'),
//     path.join(process.env.USERPROFILE, 'AppData', 'Roaming', 'time-tracking-app', 'token.json'),
//     path.join(process.env.LOCALAPPDATA, 'time-tracking-app', 'token.json'),
//     path.join(process.env.USERPROFILE, 'AppData', 'Local', 'time-tracking-app', 'token.json')
//   ];
// }

// function checkTokenFiles() {
//   console.log('🔍 Token File Verification Report');
//   console.log('--------------------------------');
//   console.log(`Verification Timestamp: ${new Date().toISOString()}`);
//   console.log(`Current User: ${process.env.USERNAME}`);
//   console.log(`User Profile: ${process.env.USERPROFILE}`);
//   console.log('');

//   const tokenPaths = getTokenPaths();
//   console.log('Token Paths to Check:');
//   tokenPaths.forEach(path => console.log(`- ${path}`));
//   console.log('');

//   const tokenStatus = tokenPaths.map(filePath => {
//     try {
//       const exists = fs.existsSync(filePath);
//       let details = null;
      
//       if (exists) {
//         try {
//           details = fs.statSync(filePath);
//         } catch (statError) {
//           console.warn(`⚠️ Unable to get file stats for ${filePath}: ${statError.message}`);
//         }
//       }

//       return {
//         path: filePath,
//         exists: exists,
//         details: details
//       };
//     } catch (error) {
//       console.error(`❌ Error checking ${filePath}: ${error.message}`);
//       return {
//         path: filePath,
//         exists: false,
//         error: error.message
//       };
//     }
//   });

//   console.log('Token File Status:');
//   tokenStatus.forEach(token => {
//     const status = token.exists ? '❌ EXISTS' : '✅ REMOVED';
//     console.log(`${status}: ${token.path}`);
    
//     if (token.exists && token.details) {
//       console.log(`   Size: ${token.details.size} bytes`);
//       console.log(`   Last Modified: ${token.details.mtime}`);
//     }
//   });

//   const remainingTokens = tokenStatus.filter(token => token.exists);

//   console.log('\nSummary:');
//   console.log(`Total Paths Checked: ${tokenPaths.length}`);
//   console.log(`Remaining Token Files: ${remainingTokens.length}`);

//   if (remainingTokens.length === 0) {
//     console.log('\n✅ Token Removal Verification: SUCCESSFUL');
//     process.exit(0);
//   } else {
//     console.log('\n❌ Token Removal Verification: FAILED');
//     console.log('Remaining Token Files:');
//     remainingTokens.forEach(token => {
//       console.log(`- ${token.path}`);
//     });
//     process.exit(1);
//   }
// }

// // Ensure the script runs even if environment variables are not set
// try {
//   checkTokenFiles();
// } catch (globalError) {
//   console.error('🚨 Critical Error in Token Verification:', globalError);
//   process.exit(1);
// }