# SproutMC on Termux - Complete Setup Guide

Running SproutMC on Ubuntu in Termux with Podman or native mode.

## Quick Decision Tree

**Do you want containers (Podman)?**
- ✅ YES → See "Podman Setup" section
- ❌ NO → Skip to "Native Mode Setup" section

---

## Option 1: Podman Setup (Recommended if Podman works)

### Prerequisites

```bash
# Install Podman
sudo apt-get update
sudo apt-get install -y podman

# Install podman-compose
pip install podman-compose

# Verify
podman-compose --version
```

### Start SproutMC with Podman

```bash
cd /root/SproutMC
./start-docker.sh
```

The script will:
1. Auto-detect Podman
2. Build the container image
3. Start services
4. Show access URL

### If Build Fails

If you see `Error: cannot re-exec process` or similar Podman errors:

1. **Try with sudo:**
   ```bash
   sudo podman build -t sproutmc:latest .
   sudo podman-compose up -d
   ```

2. **Or use Docker instead** (if installed):
   ```bash
   docker build -t sproutmc:latest .
   docker-compose up -d
   ```

3. **Or fall back to Native Mode** (see below)

### Podman Commands

```bash
# View logs
podman-compose logs -f sproutmc

# Stop
podman-compose stop

# Restart
podman-compose restart

# Remove
podman-compose down

# Monitor resources
podman stats sproutmc
```

---

## Option 2: Native Mode Setup (Fallback)

If Podman/Docker don't work on your Termux, run natively:

### Start Native Mode

```bash
cd /root/SproutMC
./start-termux-native.sh
```

This script will:
1. Check Node.js (install if needed)
2. Check Java (install if needed)
3. Install npm dependencies
4. Start SproutMC server

### Manual Native Start

```bash
cd /root/SproutMC
npm install
npm start
```

Then open: http://localhost:3000

### Native Mode Commands

```bash
# Start in background
nohup npm start > logs/output.log 2>&1 &

# View logs
tail -f logs/output.log

# Stop (find PID first)
ps aux | grep "node src/server.js"
kill <PID>

# Auto-start with systemd
sudo nano /etc/systemd/system/sproutmc.service
```

Create this service file:

```ini
[Unit]
Description=SproutMC Minecraft Server Wrapper
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/SproutMC
ExecStart=/usr/bin/node /root/SproutMC/src/server.js
Restart=always
RestartSec=10
Environment="PORT=3000"
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable sproutmc
sudo systemctl start sproutmc
sudo systemctl status sproutmc
```

---

## Configuration

### Web UI Settings

1. Open http://localhost:3000
2. Go to **Settings**
3. Configure:
   - **Instance Root**: `/root/SproutMC/instances/default`
   - **Java Path**: `/usr/bin/java`
   - **Server Jar**: `server.jar` (relative to instance root)
   - **JVM Args**: `-Xmx1G -Xms1G` (adjust based on available RAM)

### config.json

Edit directly for advanced settings:

```json
{
  "port": 3000,
  "instanceRoot": "instances/default",
  "javaPath": "/usr/bin/java",
  "serverJar": "server.jar",
  "jvmArgs": "-Xmx1G -Xms1G",
  "auth": {
    "enabled": false,
    "users": {}
  }
}
```

---

## Troubleshooting

### Podman Build Fails

```
Error: cannot re-exec process
Error: Cannot pull image
```

**Solution:**
1. Try with sudo: `sudo podman build -t sproutmc:latest .`
2. Or use Docker: `docker build -t sproutmc:latest .`
3. Or switch to Native Mode: `./start-termux-native.sh`

### Port 3000 Already in Use

**For Podman/Docker:**
Edit `docker-compose.yml`:
```yaml
ports:
  - "8080:3000"  # Use 8080 instead
```

**For Native:**
Edit `config.json`:
```json
{
  "port": 8080
}
```

### Java Not Found

```bash
# Check if installed
java -version

# If not installed
sudo apt-get update
sudo apt-get install -y openjdk-17-jre-headless

# Find Java path
which java
```

### Out of Memory

**For Podman/Docker:**
Edit `docker-compose.podman.yml`:
```yaml
environment:
  - NODE_OPTIONS=--max-old-space-size=1024
deploy:
  resources:
    limits:
      memory: 1G
```

**For Native:**
Edit `config.json`:
```json
{
  "jvmArgs": "-Xmx512M -Xms512M"
}
```

### Can't Connect from Phone

```bash
# Get Termux IP
hostname -I

# Access from phone:
# http://<TERMUX_IP>:3000
```

---

## Performance Tips for Termux

1. **Use smaller JVM allocation:**
   - Set JVM args to `-Xmx1G -Xms1G` or less
   - Monitor with `free -h` command

2. **Monitor resource usage:**
   - Podman: `podman stats sproutmc`
   - Native: `top` or `htop`

3. **Keep system updated:**
   ```bash
   apt-get update && apt-get upgrade -y
   ```

4. **Clean up old data:**
   ```bash
   rm -rf instances/default/logs/*
   rm -rf instances/default/cache
   ```

5. **Use SSD storage if possible** (faster than SD card)

---

## Accessing from Network

### From Same WiFi Network

```bash
# Find Termux IP
ip -4 addr show

# Access from phone:
http://<IP>:3000
```

### From Internet (Advanced)

Use ngrok or playit.gg:
```bash
# ngrok
ngrok http 3000

# Then access via public URL
```

---

## Uninstall

### Remove Podman Setup

```bash
podman-compose down -v
podman rmi sproutmc:latest
pip uninstall podman-compose -y
```

### Remove Native Installation

```bash
rm -rf /root/SproutMC
# Or just keep it and don't run it
```

---

## Next Steps

### 1. Choose Your Setup

- **Podman:** `./start-docker.sh`
- **Native:** `./start-termux-native.sh`
- **Manual Native:** `npm start`

### 2. Access Web UI

Open http://localhost:3000

### 3. Configure Settings

- Set Java path
- Set server jar location
- Adjust JVM memory

### 4. Add Server

- Upload server jar to `instances/default/`
- Or create new instance in Settings

### 5. Start Server

- Click Start in web UI
- Monitor in Console tab
- Check metrics in Metrics tab

---

## Getting Help

- **Podman issues:** See [PODMAN_TERMUX_GUIDE.md](PODMAN_TERMUX_GUIDE.md)
- **Performance:** See [PERFORMANCE_GUIDE.md](PERFORMANCE_GUIDE.md)
- **General help:** See [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md)

---

**Status:** ✅ Ready for Termux!
- Podman support: ✅
- Native fallback: ✅
- Full documentation: ✅
