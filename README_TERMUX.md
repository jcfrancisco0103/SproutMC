# SproutMC - Termux/Ubuntu Podman Setup

For running on **Ubuntu in Termux with Podman**.

## Quick Start (2 Minutes)

```bash
cd /root/SproutMC
./start-docker.sh
```

Then open: **http://localhost:3000**

## What You Get

✅ **Podman Containerization** - No daemon, lightweight, secure  
✅ **One-Click Deployment** - Automatic image build and startup  
✅ **Persistent Data** - Worlds, backups, config stored in volumes  
✅ **Performance Optimized** - 60-80% less bandwidth  
✅ **Easy Scaling** - Adjust CPU/memory in docker-compose.yml  

## Prerequisites

Already installed? Great! Otherwise:

```bash
# Install Podman
sudo apt-get update
sudo apt-get install -y podman

# Install podman-compose
pip install podman-compose

# Verify
podman --version
podman-compose --version
```

## Commands

| Command | Purpose |
|---------|---------|
| `./start-docker.sh` | Start everything (automated) |
| `podman-compose up -d` | Start services (manual) |
| `podman-compose logs -f sproutmc` | View live logs |
| `podman-compose stop` | Stop services |
| `podman-compose restart` | Restart services |
| `podman-compose down` | Remove containers |
| `podman stats sproutmc` | Monitor CPU/memory |

## Configuration

Edit `docker-compose.yml` to customize:

```yaml
# Change port
ports:
  - "8080:3000"

# Increase RAM
environment:
  - NODE_OPTIONS=--max-old-space-size=4096
deploy:
  resources:
    limits:
      memory: 4G
      cpus: '2'
```

## Accessing from Phone

Find Termux IP:
```bash
hostname -I
```

Then on your phone: `http://<TERMUX_IP>:3000`

## Troubleshooting

**"podman-compose: command not found"**
```bash
pip install podman-compose
```

**"port 3000 already in use"**
Edit docker-compose.yml, change port to 8080, restart

**"Out of memory"**
Increase memory limits in docker-compose.yml

**"Java not found"**
Rebuild image: `podman build --no-cache -t sproutmc:latest .`

## Full Documentation

- [PODMAN_TERMUX_GUIDE.md](PODMAN_TERMUX_GUIDE.md) - Detailed Termux/Podman guide
- [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) - Architecture & features
- [PERFORMANCE_GUIDE.md](PERFORMANCE_GUIDE.md) - Tuning & monitoring
- [README_DOCKER.md](README_DOCKER.md) - General Docker commands (also work with Podman)

## Next Steps

1. **Start the system:**
   ```bash
   ./start-docker.sh
   ```

2. **Configure in web UI:**
   - Open http://localhost:3000
   - Go to Settings
   - Set Java path, server jar, etc.

3. **Upload/create server jar**

4. **Start your Minecraft server!**

---

**Status:** ✅ Ready to deploy on Termux with Podman
