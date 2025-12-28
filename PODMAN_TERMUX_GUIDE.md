# SproutMC on Termux with Podman

Quick setup guide for running SproutMC in Ubuntu running on Termux using Podman.

## Installation Steps

### 1. Install Podman and podman-compose

```bash
# Update package lists
sudo apt-get update

# Install Podman (if not already installed)
sudo apt-get install -y podman

# Install podman-compose via pip
pip install podman-compose
```

### 2. Verify Installation

```bash
podman --version
podman-compose --version
```

Expected output:
```
podman version 3.4.4
podman-compose version 1.5.0
```

## Running SproutMC

### Option 1: Automated Setup (Recommended)

```bash
cd /root/SproutMC
chmod +x start-docker.sh
./start-docker.sh
```

The script will:
- Auto-detect Podman ✓
- Build the container image
- Start SproutMC service
- Show the access URL

### Option 2: Manual Podman Commands

```bash
cd /root/SproutMC

# Build image
podman build -t sproutmc:latest .

# Start services
podman-compose up -d

# View logs
podman-compose logs -f sproutmc

# Check if running
podman ps

# Access at: http://localhost:3000
```

## Accessing from Phone

If you want to access SproutMC from your phone on the same network:

```bash
# Find Termux IP address
hostname -I

# Access from phone using:
# http://<TERMUX_IP>:3000
```

## Common Commands

### View Logs
```bash
podman-compose logs -f sproutmc
```

### Stop Services
```bash
podman-compose stop
```

### Restart Services
```bash
podman-compose restart
```

### Remove Everything
```bash
podman-compose down
```

### Get Shell Inside Container
```bash
podman-compose exec sproutmc sh
```

### Check Resources
```bash
podman stats sproutmc
```

## Troubleshooting

### Error: "podman-compose: command not found"

**Fix:**
```bash
pip install podman-compose
```

Or ensure it's in PATH:
```bash
export PATH="$HOME/.local/bin:$PATH"
podman-compose --version
```

### Error: "java: command not found"

The Docker image should include Java 17. Verify:
```bash
podman-compose exec sproutmc java -version
```

If missing, the image wasn't built correctly. Rebuild:
```bash
podman build --no-cache -t sproutmc:latest .
```

### Port 3000 Already in Use

Edit `docker-compose.yml`:
```yaml
ports:
  - "8080:3000"  # Use 8080 instead
```

Then restart:
```bash
podman-compose down
podman-compose up -d
```

### Container Keeps Restarting

Check logs:
```bash
podman logs sproutmc
```

Common causes:
- Missing config.json
- Java path incorrect
- Insufficient memory

### Permissions Issues

If you get permission errors, run with sudo:
```bash
sudo podman-compose up -d
sudo podman-compose logs -f sproutmc
```

Or use rootless Podman (more complex):
```bash
# Skip if using root (faster for Termux)
podman system migrate
```

## Memory Management

For large Minecraft servers on Termux (limited RAM), adjust:

Edit `docker-compose.yml`:
```yaml
environment:
  - NODE_OPTIONS=--max-old-space-size=1024  # 1GB for Node
deploy:
  resources:
    limits:
      memory: 2G  # Total container limit
```

## Data Persistence

All data is stored in named volumes:
```bash
# List volumes
podman volume ls

# View volume location
podman volume inspect sproutmc_data
```

Volumes persist across:
- Container restarts
- Image rebuilds
- `podman-compose down`

## Performance Tips for Termux

1. **Keep Termux updated:**
   ```bash
   apt-get update && apt-get upgrade -y
   ```

2. **Monitor resource usage:**
   ```bash
   podman stats sproutmc
   ```

3. **Allocate appropriate RAM:**
   - Small server: 1-2GB (Node) + 2-4GB (Minecraft)
   - Medium: 2-4GB (Node) + 4-8GB (Minecraft)

4. **Use `--cpus` limit** to prevent system slowdown:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '2'  # Adjust based on device cores
   ```

5. **Check Termux storage:**
   ```bash
   df -h
   ```

## Uninstall

To remove everything:

```bash
# Stop containers
podman-compose down -v

# Remove image
podman rmi sproutmc:latest

# Remove podman-compose (optional)
pip uninstall podman-compose -y
```

## Next Steps

1. Start SproutMC:
   ```bash
   ./start-docker.sh
   ```

2. Access at `http://localhost:3000`

3. Configure in Settings:
   - Instance Root
   - Java Path
   - Server Jar
   - JVM Args

4. Create/upload a Minecraft server jar

5. Start your server and monitor with `podman stats sproutmc`

## Support

- See [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) for full details
- See [PERFORMANCE_GUIDE.md](PERFORMANCE_GUIDE.md) for tuning
- See [README_DOCKER.md](README_DOCKER.md) for commands

---

**Status:** ✅ Ready to deploy on Termux!
