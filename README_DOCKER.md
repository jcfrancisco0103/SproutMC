# Docker/Podman Deployment Guide

This quick reference shows how to run SproutMC with Docker or Podman.

## One-Command Startup

```bash
./start-docker.sh
```

This automatically:
- Detects Docker or Podman
- Builds the image
- Starts all services
- Shows the access URL

## Manual Docker Commands

```bash
# Build
docker build -t sproutmc:latest .

# Run with docker-compose
docker-compose up -d
docker-compose logs -f

# Stop
docker-compose down
```

## Podman (Docker Alternative)

```bash
# Same commands, just replace 'docker' with 'podman'
podman build -t sproutmc:latest .
podman-compose up -d
podman logs -f sproutmc
```

## Key Differences

| Feature | Docker | Podman |
|---------|--------|--------|
| Setup | More complex | Simple |
| Daemon | Required | No daemon |
| Rootless | Optional | Default |
| Performance | Excellent | Excellent |
| Compatibility | Universal | Linux/macOS |

## Configuration

Edit `docker-compose.yml` to customize:

```yaml
ports:
  - "8080:3000"  # Change port

environment:
  - NODE_OPTIONS=--max-old-space-size=4096  # Increase RAM

deploy:
  resources:
    limits:
      cpus: '4'     # CPU cores
      memory: 4G    # Memory limit
```

## Persistence

Data is stored in named volumes:
- `sproutmc_data` - Configuration, logs
- `sproutmc_instances` - Server worlds, plugins
- `sproutmc_backups` - Backups
- `sproutmc_redis` - Cache (optional)

To backup:
```bash
docker run --rm -v sproutmc_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/sproutmc-backup.tar.gz -C / data
```

## Performance Tuning

**For large servers (100+ players):**
```yaml
environment:
  - NODE_OPTIONS=--max-old-space-size=8192

deploy:
  resources:
    limits:
      cpus: '4'
      memory: 8G
    reservations:
      cpus: '2'
      memory: 4G
```

**Monitor resource usage:**
```bash
docker stats sproutmc
```

## Troubleshooting

```bash
# View logs
docker-compose logs sproutmc

# Restart
docker-compose restart sproutmc

# Shell access
docker-compose exec sproutmc sh

# Check Java
docker-compose exec sproutmc java -version

# Force rebuild
docker-compose down
docker-compose up -d --build
```

See [DOCKER_GUIDE.md](DOCKER_GUIDE.md) for full details.
