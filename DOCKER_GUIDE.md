# Docker & Podman Setup Guide

## Quick Start with Docker

### Build and Run
```bash
# Build the image
docker build -t sproutmc:latest .

# Run with docker-compose (recommended)
docker-compose up -d

# Or run manually with volumes
docker run -d \
  --name sproutmc \
  -p 3000:3000 \
  -v sproutmc_data:/app/data \
  -v sproutmc_logs:/app/logs \
  -v sproutmc_backups:/app/backups \
  -v sproutmc_instances:/app/instances \
  -v $(pwd)/config.json:/app/config.json:ro \
  --restart unless-stopped \
  sproutmc:latest
```

### Stop and Clean Up
```bash
# Stop the service
docker-compose down

# Remove volumes (WARNING: deletes data)
docker-compose down -v

# View logs
docker-compose logs -f sproutmc
```

## Podman Setup (Docker Alternative)

Podman is a drop-in replacement for Docker with no daemon required.

### Installation
**Ubuntu/Debian:**
```bash
sudo apt-get install -y podman
```

**Fedora/RHEL:**
```bash
sudo dnf install -y podman podman-docker
```

**macOS:**
```bash
brew install podman
# Start podman machine
podman machine init
podman machine start
```

### Using Podman
Simply replace `docker` with `podman` in any command:

```bash
# Build
podman build -t sproutmc:latest .

# Run with podman-compose (install: pip install podman-compose)
podman-compose up -d

# Or direct run
podman run -d \
  --name sproutmc \
  -p 3000:3000 \
  -v sproutmc_data:/app/data \
  -v sproutmc_logs:/app/logs \
  -v sproutmc_backups:/app/backups \
  -v sproutmc_instances:/app/instances \
  -v $(pwd)/config.json:/app/config.json:ro \
  --restart=always \
  sproutmc:latest

# View logs
podman logs -f sproutmc
```

### Rootless Podman
For enhanced security, run Podman without root:
```bash
podman system migrate
podman run --userns=keep-id -d \
  --name sproutmc \
  -p 3000:3000 \
  -v sproutmc_data:/app/data:Z \
  -v sproutmc_logs:/app/logs:Z \
  -v sproutmc_backups:/app/backups:Z \
  -v sproutmc_instances:/app/instances:Z \
  -v $(pwd)/config.json:/app/config.json:ro,Z \
  sproutmc:latest
```

## Network Access

Once running, access SproutMC at:
- **Local:** http://localhost:3000
- **Remote:** http://<your-ip>:3000

## Troubleshooting

### Java not found in container
The Dockerfile includes OpenJDK 17. Check if your image built correctly:
```bash
docker exec sproutmc java -version
```

### Port already in use
Change the port mapping in docker-compose.yml:
```yaml
ports:
  - "8080:3000"  # Access at http://localhost:8080
```

### Out of memory
Increase in docker-compose.yml:
```yaml
environment:
  - NODE_OPTIONS=--max-old-space-size=4096
deploy:
  resources:
    limits:
      memory: 4G
```

### View container logs
```bash
docker-compose logs -f sproutmc
# Or with Podman:
podman logs -f sproutmc
```

## Performance Tips

1. **Redis caching** - Enabled in compose file (optional)
2. **Volume performance** - Use named volumes for better I/O on Docker Desktop
3. **Resource limits** - Adjust `deploy.resources` in docker-compose.yml
4. **Monitoring** - Use `docker stats` or `podman stats` to monitor resource usage

## Production Deployment

For production, consider:
- Using a reverse proxy (nginx, Traefik)
- Setting up persistent volume backups
- Enabling HTTPS with certificate management
- Using environment variables for secrets
- Regular backups of `/app/data` and `/app/instances`
