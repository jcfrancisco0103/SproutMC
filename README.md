# SproutMC Wrapper

A lightweight web UI to manage a Minecraft server: start/stop, live console, files, plugins, backups, scheduled tasks, worlds management, settings, and metrics — all from your browser.

## Features
- Start, Stop, Kill controls and auto EULA acceptance
- Live console with searchable history and local download
- Files manager with inline text editor and auto-close on save
- Plugins upload/delete and Backups create/restore/download
- Scheduled tasks (restart, backup, command, announce)
- Worlds management (save-all, reset, download)
- Settings: instance root, Java path, server jar, JVM args, auto-restart
- Aikar’s Flags toggle for JVM tuning
- Metrics with labeled charts: CPU %, RAM % of system, Disk used, TPS
- Terminal runner for on-host commands
- Polished, colorful UI with transitions and status pills

## Requirements
- Node.js 16+ (18 recommended)
- Java 17 (OpenJDK)
- Git

## Quick Start (Linux/macOS/Windows)
1. Clone: `git clone https://github.com/jcfrancisco0103/SproutMC.git`
2. Enter: `cd SproutMC`
3. Run: `npm start`
4. Open `http://localhost:3000`
5. Go to Settings and configure:
   - `Instance Root`: a writable folder (e.g., `instances/default`)
   - `Java Path`: typically `/usr/bin/java` on Linux, `C:\Program Files\Java\...\bin\java.exe` on Windows
   - `Server Jar`: path to your server jar under instance root
   - Toggle `Use Aikar Flags` if desired

## Termux + Ubuntu
- Use the installer script inside your Ubuntu session on Termux:
  - `chmod +x run-termux-ubuntu.sh`
  - `PORT=3000 ./run-termux-ubuntu.sh`
- The script:
  - Installs deps (git, Java 17, tmux, curl)
  - Ensures modern Node (NodeSource 18 or nvm fallback) to avoid syntax errors like `Unexpected token '?'`
  - Uses the current repo or clones to `/root/SproutMC`
  - Creates a minimal `config.json` if missing and starts the wrapper

## Auto-Start on Xubuntu (systemd)
Create `/etc/systemd/system/sproutmc.service`:
```
[Unit]
Description=SproutMC Wrapper
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/<user>/SproutMC
ExecStart=/usr/bin/node /home/<user>/SproutMC/src/server.js
Environment=PORT=3000
User=<user>
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
Enable and start:
```
sudo systemctl daemon-reload
sudo systemctl enable --now sproutmc
```
Open the UI automatically at login (XFCE):
```
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/sproutmc.desktop <<EOF
[Desktop Entry]
Type=Application
Name=SproutMC UI
Comment=Open SproutMC Web UI
Exec=sh -c 'sleep 5; xdg-open http://localhost:3000'
X-GNOME-Autostart-enabled=true
EOF
```

## Updating
- Check and apply updates from Settings
- If you have local changes, the update endpoint stashes them before pulling to avoid merge conflicts

## Tunneling (remote access)
- playit.gg or ngrok: forward to `127.0.0.1:3000`
- Ensure `ufw allow 3000/tcp` if you expose directly

## Notes
- Place your server jar under `instanceRoot` and set `Server Jar` path accordingly
- “Use Aikar Flags” appends recommended JVM flags at startup
- Metrics are periodically collected; RAM is plotted as percent of system memory

## Troubleshooting
- Node < 16 causes modern syntax errors in dependencies. Upgrade Node to 18+.
- If Termux + Ubuntu shows dpkg overwrite errors while installing Node:
  - The installer purges conflicting `libnode-dev` and falls back to `nvm` if needed
- If static assets don’t load, hard refresh the browser (Ctrl+F5)

## License
- MIT
