# SproutMC on Termux - Native Mode Guide

Your system is configured to run **natively on Termux** (no containers needed).

## ✅ Status

- ✅ Node.js 18+ ready
- ✅ Java OpenJDK 21 ready  
- ✅ All dependencies installed
- ✅ Performance optimizations applied
- ✅ Graceful shutdown configured

## 🚀 Start SproutMC

### Option 1: Automated (Recommended)
```bash
./start-docker.sh
```

This script will:
- Detect Termux environment
- Switch to native mode automatically
- Start the server
- Show http://localhost:3000

### Option 2: Direct Native Start
```bash
./start-termux-native.sh
```

### Option 3: Manual Start
```bash
npm start
```

All three methods run the same thing - the server will start at **http://localhost:3000**

## 🌐 Access

Open your browser to: **http://localhost:3000**

From another device on same WiFi:
```bash
# Find Termux IP
hostname -I

# Then access: http://<IP>:3000
```

## ⚙️ Configuration

Open http://localhost:3000 → Settings:

1. **Java Path**: `/usr/bin/java`
2. **Instance Root**: `instances/default`
3. **Server Jar**: `server.jar`
4. **JVM Args**: `-Xmx1G -Xms1G` (adjust for your device)

Or edit `config.json` directly:

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

## 💾 Upload Server

1. Click **Files** in the web UI
2. Navigate to `instances/default/`
3. Upload your `server.jar`

Or manually:
```bash
# Copy server jar to instances directory
cp /path/to/server.jar instances/default/server.jar
```

## ▶️ Start Minecraft Server

1. In web UI, click green **Start** button
2. Monitor in **Console** tab
3. Check **Metrics** for performance
4. Server is ready when it says "Done!"

## 🛑 Stop Server

### Graceful Stop
- In web UI: Click **Stop** button
- Or in console: `Ctrl+C` (waits 10 seconds for cleanup)

### Force Stop
- Press `Ctrl+C` multiple times
- Or: `kill <process_id>`

## 📊 Monitor Performance

```bash
# Check resource usage
free -h          # RAM
df -h            # Disk space
top              # All processes

# Monitor server logs
tail -f logs/*.log
```

## 🔄 Run in Background

To keep running after closing terminal:

```bash
# Start in background
nohup npm start > logs/output.log 2>&1 &

# Find process ID
ps aux | grep "node src/server.js"

# View logs
tail -f logs/output.log

# Stop it
kill <PID>
```

## ⚡ Performance Features

✅ **HTTP Compression** - 60-80% bandwidth reduction  
✅ **Graceful Shutdown** - 10-second cleanup window  
✅ **Memory Optimization** - Configurable JVM size  
✅ **Static Caching** - Production-optimized  
✅ **Error Handling** - Robust exception catching  

## 🆘 Troubleshooting

### Port 3000 Already in Use
Edit `config.json`:
```json
{
  "port": 8080
}
```

Then restart server.

### Java Not Found
```bash
apt-get install -y openjdk-17-jre-headless
```

### Out of Memory
Reduce JVM in `config.json`:
```json
{
  "jvmArgs": "-Xmx512M -Xms512M"
}
```

### Can't Connect from Phone
```bash
# Check Termux IP
ip -4 addr show

# Use that IP from phone:
# http://<TERMUX_IP>:3000
```

### Server Won't Start
Check logs:
```bash
tail -f logs/*.log
```

## 📁 Directory Structure

```
/root/SproutMC/
├── src/
│   └── server.js           Main application
├── public/                 Web UI files
├── instances/
│   └── default/            Minecraft server instance
│       ├── server.jar      Server executable
│       ├── server.properties
│       ├── world/          Game world data
│       ├── plugins/        Plugin mods
│       └── logs/           Server logs
├── data/                   App data & config
├── logs/                   Application logs
├── backups/                Server backups
└── config.json             Main configuration
```

## 🎯 Next Steps

1. **Start server**: `./start-docker.sh` or `npm start`
2. **Open UI**: http://localhost:3000
3. **Configure**: Set Java path, server jar, JVM args
4. **Upload jar**: Paste your server.jar file
5. **Start game**: Click Start button
6. **Play!** Connect to localhost:25565

## 📚 More Info

- [TERMUX_SETUP.md](TERMUX_SETUP.md) - Full guide
- [PERFORMANCE_GUIDE.md](PERFORMANCE_GUIDE.md) - Tuning tips
- [README_DOCKER.md](README_DOCKER.md) - General commands

## ✨ Why Native Mode on Termux?

- ✅ **Works perfectly** - No container overhead
- ✅ **Simpler** - No Podman/Docker configuration
- ✅ **Faster** - Direct system access
- ✅ **Smaller footprint** - Less memory needed
- ✅ **Better for Termux** - Avoids kernel limitations

---

**Status:** ✅ Ready to run natively on Termux!

Start with: `./start-docker.sh` or `./start-termux-native.sh`
