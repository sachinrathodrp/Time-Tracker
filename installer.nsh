; NSIS Uninstaller Script
!macro customUnInstall
  ; Delete token files
  Delete "$LOCALAPPDATA\time-tracking-app\token.json"
  Delete "$APPDATA\time-tracking-app\token.json"
  RMDir "$APPDATA\time-tracking-app"
  
  ; Remove registry entry
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Time Tracking App"
!macroend