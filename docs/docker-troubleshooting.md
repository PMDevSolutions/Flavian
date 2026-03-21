# Docker Troubleshooting Guide

Common Docker issues and solutions for local WordPress development with this template.

**Related:** [LOCAL-DEVELOPMENT.md](../LOCAL-DEVELOPMENT.md) | [General Troubleshooting](./TROUBLESHOOTING.md)

---

## Table of Contents

1. [Docker Desktop Won't Start](#1-docker-desktop-wont-start)
2. [Port 8080 or 8081 Already in Use](#2-port-8080-or-8081-already-in-use)
3. [Database Connection Refused on First Start](#3-database-connection-refused-on-first-start)
4. [Volume Permission Denied (Linux)](#4-volume-permission-denied-linux)
5. [Mounted Theme/Plugin Files Not Visible in WordPress](#5-mounted-themeplugin-files-not-visible-in-wordpress)
6. [Container Keeps Restarting](#6-container-keeps-restarting)
7. [MySQL Data Corruption After Unclean Shutdown](#7-mysql-data-corruption-after-unclean-shutdown)
8. [Cannot Connect Between Containers (Networking)](#8-cannot-connect-between-containers-networking)
9. [Docker Compose "Version" Warning](#9-docker-compose-version-warning)
10. [Slow File I/O on macOS](#10-slow-file-io-on-macos)
11. [WSL2 Backend Issues (Windows)](#11-wsl2-backend-issues-windows)
12. [Out of Disk Space / Large Docker Volumes](#12-out-of-disk-space--large-docker-volumes)
13. [WP-CLI "Not Found" Inside Container](#13-wp-cli-not-found-inside-container)
14. [phpMyAdmin Cannot Connect to Database](#14-phpmyadmin-cannot-connect-to-database)
15. [Environment Variables Not Loading from .env](#15-environment-variables-not-loading-from-env)

---

## 1. Docker Desktop Won't Start

**Symptoms:** `docker compose` commands fail with "Cannot connect to the Docker daemon" or Docker Desktop stays on "Starting..."

**Solutions:**

| Platform | Fix |
|----------|-----|
| **Windows** | Ensure WSL2 is enabled: `wsl --status`. If missing, run `wsl --install` and restart. |
| **macOS** | Grant Docker Desktop full disk access in System Settings > Privacy & Security. |
| **Linux** | Start the daemon: `sudo systemctl start docker`. Add yourself to the docker group: `sudo usermod -aG docker $USER` then log out/in. |

**All platforms:**
1. Open Docker Desktop and wait for the green status icon.
2. If stuck, quit Docker Desktop completely and relaunch.
3. Verify with: `docker info`

---

## 2. Port 8080 or 8081 Already in Use

**Symptoms:** `Bind for 0.0.0.0:8080 failed: port is already allocated`

**Find the conflict:**
```bash
# Windows (PowerShell)
netstat -ano | findstr :8080

# macOS / Linux
lsof -i :8080
```

**Fix — Option A: Stop the conflicting process.**

**Fix — Option B: Change the port in `docker-compose.yml`:**
```yaml
services:
  wordpress:
    ports:
      - "9090:80"   # WordPress on port 9090 instead of 8080
  phpmyadmin:
    ports:
      - "9091:80"   # phpMyAdmin on port 9091 instead of 8081
```

After changing ports, update the install URL:
```bash
docker compose exec wordpress wp option update siteurl "http://localhost:9090" --allow-root
docker compose exec wordpress wp option update home "http://localhost:9090" --allow-root
```

---

## 3. Database Connection Refused on First Start

**Symptoms:** "Error establishing a database connection" in the browser, or WordPress container logs show `MySql Connection Error: (2002) Connection refused`

**Why:** MySQL takes 30-60 seconds to initialise on first run. WordPress may attempt to connect before MySQL is ready.

**Solutions:**
1. **Wait and refresh.** Give MySQL up to 60 seconds on first boot.
2. **Check MySQL is running:**
   ```bash
   docker compose ps db
   # Should show "Up" / "running"
   ```
3. **Check logs for MySQL errors:**
   ```bash
   docker compose logs db
   ```
4. **Verify credentials match.** The `WORDPRESS_DB_*` variables in `docker-compose.yml` (or `.env`) must match the `MYSQL_*` variables:
   | WordPress var | Must match MySQL var |
   |---|---|
   | `WORDPRESS_DB_HOST` | Service name (`db`) |
   | `WORDPRESS_DB_USER` | `MYSQL_USER` |
   | `WORDPRESS_DB_PASSWORD` | `MYSQL_PASSWORD` |
   | `WORDPRESS_DB_NAME` | `MYSQL_DATABASE` |
5. **Nuclear option — reset everything:**
   ```bash
   ./wordpress-local.sh clean
   ./wordpress-local.sh start
   ./wordpress-local.sh install
   ```

---

## 4. Volume Permission Denied (Linux)

**Symptoms:** WordPress cannot write to `wp-content/themes` or `wp-content/plugins` inside the container, or you see `Permission denied` errors in logs.

**Why:** On native Linux, Docker runs as root inside the container (UID 33 for `www-data`), but bind-mounted host directories may be owned by your user (UID 1000).

**Solutions:**

**Option A — Fix host directory ownership:**
```bash
sudo chown -R 33:33 themes/ plugins/ mu-plugins/
```

**Option B — Match UIDs (recommended for development):**
Add to `docker-compose.yml` under the `wordpress` service:
```yaml
user: "${UID:-1000}:${GID:-1000}"
```

**Option C — Use permissive mode (development only):**
```bash
chmod -R 777 themes/ plugins/ mu-plugins/
```

> **Note:** This issue does not affect macOS or Windows (Docker Desktop uses a VM, so file ownership is handled transparently).

---

## 5. Mounted Theme/Plugin Files Not Visible in WordPress

**Symptoms:** Files exist on your host in `themes/` or `plugins/` but WordPress doesn't see them.

**Solutions:**

1. **Verify the volume mounts in `docker-compose.yml`:**
   ```yaml
   volumes:
     - ./themes:/var/www/html/wp-content/themes
     - ./plugins:/var/www/html/wp-content/plugins
     - ./mu-plugins:/var/www/html/wp-content/mu-plugins
   ```
2. **Check inside the container:**
   ```bash
   docker compose exec wordpress ls /var/www/html/wp-content/themes/
   ```
3. **Named volume conflict:** The `wordpress_data` named volume persists WordPress core files. If you started containers before adding the bind mounts, the named volume may have populated `wp-content/themes` first, causing Docker to ignore the bind mount. Fix:
   ```bash
   ./wordpress-local.sh clean   # Removes named volumes
   ./wordpress-local.sh start   # Recreates with correct mounts
   ./wordpress-local.sh install
   ```
4. **Restart containers** after changing `docker-compose.yml`:
   ```bash
   docker compose down && docker compose up -d
   ```

---

## 6. Container Keeps Restarting

**Symptoms:** `docker compose ps` shows a container in `Restarting` state with increasing restart counts.

**Diagnose:**
```bash
docker compose logs wordpress   # or 'db' for MySQL
```

**Common causes and fixes:**

| Cause | Fix |
|-------|-----|
| MySQL not ready | WordPress auto-retries; wait 60 seconds |
| Corrupt MySQL data | `./wordpress-local.sh clean` and restart |
| Invalid `.env` values | Check `.env` for typos or missing values |
| Port conflict inside container | Check no other service occupies port 80 internally |

If a container keeps crash-looping, stop and remove it:
```bash
docker compose down
docker compose up -d
```

---

## 7. MySQL Data Corruption After Unclean Shutdown

**Symptoms:** MySQL container won't start, logs show `InnoDB: Recovery failed` or `Table is marked as crashed`.

**Why:** Shutting down Docker without stopping containers (e.g., killing Docker Desktop, system crash, or force-quitting) can corrupt InnoDB files.

**Solutions:**

1. **Try recovery mode.** Add to the `db` service in `docker-compose.yml`:
   ```yaml
   command: --innodb-force-recovery=1
   ```
   Start containers, export your data, then remove the flag and clean:
   ```bash
   docker compose exec db mysqldump -u wordpress -pwordpress wordpress > backup.sql
   ./wordpress-local.sh clean
   ./wordpress-local.sh start
   ```

2. **Skip recovery — reset the database:**
   ```bash
   ./wordpress-local.sh clean
   ./wordpress-local.sh start
   ./wordpress-local.sh install
   ```

**Prevention:** Always stop containers gracefully:
```bash
./wordpress-local.sh stop
# or
docker compose down
```

---

## 8. Cannot Connect Between Containers (Networking)

**Symptoms:** WordPress can't reach the database at hostname `db`, or phpMyAdmin shows "Connection refused".

**Solutions:**

1. **Verify all containers are on the same network:**
   ```bash
   docker network ls
   docker network inspect flavian_default
   ```
   All three services (wordpress, db, phpmyadmin) should appear in the network.

2. **Use the service name, not `localhost`.** Within Docker Compose, containers reach each other by service name. The database host is `db`, not `localhost` or `127.0.0.1`.

3. **Recreate the network:**
   ```bash
   docker compose down
   docker compose up -d
   ```

4. **Check for custom networks.** If you've added a custom `networks:` block in `docker-compose.yml`, ensure all services are attached to it.

---

## 9. Docker Compose "Version" Warning

**Symptoms:** Warning: `the attribute 'version' is obsolete`

**Why:** Docker Compose V2 (the `docker compose` plugin, not the standalone `docker-compose`) ignores the `version` key. The warning is harmless.

**Fix (optional):** Remove the `version: '3.8'` line from `docker-compose.yml`. The file remains compatible with both V1 and V2.

**Check your Compose version:**
```bash
docker compose version    # V2 (plugin)
docker-compose --version  # V1 (standalone, legacy)
```

> This project's `wordpress-local.sh` uses `docker-compose` (V1 syntax). If you only have V2 installed, either install the standalone binary or alias it: `alias docker-compose="docker compose"`.

---

## 10. Slow File I/O on macOS

**Symptoms:** Page loads take 5-10+ seconds, especially on large themes. `docker compose logs` shows no errors.

**Why:** macOS Docker Desktop uses a Linux VM. File synchronisation between host and VM has historically been slow for bind mounts.

**Solutions:**

1. **Use VirtioFS (recommended).** In Docker Desktop: Settings > General > "Choose file sharing implementation" > **VirtioFS**. Restart Docker Desktop.
2. **Reduce mounted paths.** Only mount what you need (the template already does this — `themes/`, `plugins/`, `mu-plugins/` only).
3. **Use Mutagen-based sync.** Docker Desktop offers this as an alternative file sync option in Settings > General.
4. **Avoid watching too many files.** Large `node_modules` or `.git` directories inside mounted volumes slow sync. They should not be inside `themes/` or `plugins/`.

---

## 11. WSL2 Backend Issues (Windows)

**Symptoms:** Docker Desktop fails to start, shows "WSL 2 is not installed", or containers are extremely slow.

**Solutions:**

1. **Install/update WSL2:**
   ```powershell
   wsl --install
   wsl --update
   ```
2. **Set WSL2 as default:**
   ```powershell
   wsl --set-default-version 2
   ```
3. **Enable WSL2 backend in Docker Desktop:** Settings > General > "Use the WSL 2 based engine" (checked).
4. **Allocate resources.** Create or edit `%USERPROFILE%\.wslconfig`:
   ```ini
   [wsl2]
   memory=4GB
   processors=2
   ```
   Then restart WSL: `wsl --shutdown`
5. **Store project files in WSL filesystem for best performance.** Accessing files on the Windows filesystem (`/mnt/c/...`) from WSL is slower than native WSL paths (`~/projects/...`).

---

## 12. Out of Disk Space / Large Docker Volumes

**Symptoms:** `No space left on device` errors, Docker builds fail, or containers won't start.

**Solutions:**

1. **Check Docker disk usage:**
   ```bash
   docker system df
   ```
2. **Prune unused resources:**
   ```bash
   docker system prune          # Remove stopped containers, unused networks, dangling images
   docker volume prune          # Remove unused volumes (⚠️ deletes data!)
   docker image prune -a        # Remove all unused images
   ```
3. **Increase disk allocation.** Docker Desktop: Settings > Resources > Disk image size.
4. **Check volume sizes:**
   ```bash
   docker system df -v
   ```

> **Warning:** `docker volume prune` will delete the `wordpress_data` and `db_data` volumes if containers are stopped. Only run it when you're prepared to lose local WordPress data.

---

## 13. WP-CLI "Not Found" Inside Container

**Symptoms:** `wp: command not found` when running WP-CLI commands via `docker compose exec`.

**Solutions:**

1. **Use the helper script:**
   ```bash
   ./wordpress-local.sh shell
   # Then run wp commands inside the container
   wp theme list --allow-root
   ```

2. **Always include `--allow-root`** when running as root in Docker:
   ```bash
   docker compose exec wordpress wp theme list --allow-root
   ```

3. **If WP-CLI is genuinely missing** from the WordPress image:
   ```bash
   docker compose exec wordpress bash -c \
     "curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && \
      chmod +x wp-cli.phar && \
      mv wp-cli.phar /usr/local/bin/wp"
   ```

---

## 14. phpMyAdmin Cannot Connect to Database

**Symptoms:** phpMyAdmin shows "Connection refused" or login fails at `http://localhost:8081`.

**Solutions:**

1. **Check the `db` container is running:**
   ```bash
   docker compose ps db
   ```
2. **Verify phpMyAdmin environment variables in `.env`:**
   - `PMA_HOST` should be `db` (the Docker service name)
   - `PMA_USER` and `PMA_PASSWORD` must match `MYSQL_USER` / `MYSQL_PASSWORD`
3. **Wait for MySQL to finish initialising** (30-60 seconds on first run).
4. **Restart phpMyAdmin:**
   ```bash
   docker compose restart phpmyadmin
   ```

---

## 15. Environment Variables Not Loading from .env

**Symptoms:** Containers start but WordPress shows "Error establishing a database connection", or env vars appear blank in container inspection.

**Why:** Docker Compose looks for a `.env` file in the same directory as `docker-compose.yml`. If the file is missing, misspelled, or has syntax errors, variables resolve to empty strings.

**Solutions:**

1. **Verify `.env` exists** in the project root alongside `docker-compose.yml`.
2. **Check syntax.** Each line should be `KEY=value` with no spaces around `=`:
   ```env
   WORDPRESS_DB_HOST=db
   WORDPRESS_DB_USER=wordpress
   WORDPRESS_DB_PASSWORD=wordpress
   WORDPRESS_DB_NAME=wordpress
   MYSQL_ROOT_PASSWORD=rootpassword
   PMA_USER=wordpress
   PMA_PASSWORD=wordpress
   ```
3. **No quotes needed** unless the value contains spaces.
4. **Verify values reach containers:**
   ```bash
   docker compose exec wordpress env | grep WORDPRESS
   ```
5. **Restart after changes:**
   ```bash
   docker compose down && docker compose up -d
   ```

---

## Platform-Specific Notes

### macOS (Docker Desktop)

- Use **VirtioFS** for file sharing (Settings > General) — significantly faster than gRPC FUSE.
- If you see "Docker Desktop requires a newer macOS version", update macOS or use an older Docker Desktop release.
- Rosetta 2 emulation on Apple Silicon can slow x86 images. Use ARM-native images where available (the official `wordpress:latest` and `mysql:8.0` images support ARM64).

### Linux (Native Docker Engine)

- Run `docker` without `sudo` by adding your user to the `docker` group: `sudo usermod -aG docker $USER`
- File permissions are the most common issue — see [Issue #4](#4-volume-permission-denied-linux).
- If using Docker Desktop for Linux (not Docker Engine), the VM layer adds the same file sharing overhead as macOS.
- Install Docker Compose V2 plugin: `sudo apt install docker-compose-plugin`

### Windows (Docker Desktop + WSL2)

- **WSL2 backend is required** — Hyper-V backend is deprecated for most use cases.
- For best performance, clone the project into the WSL2 filesystem (`\\wsl$\Ubuntu\home\...`) rather than `/mnt/c/`.
- If Git Bash or MINGW is your shell, prefix interactive commands with `winpty`: `winpty docker compose exec wordpress bash`
- See [Issue #11](#11-wsl2-backend-issues-windows) for WSL2 setup.

---

## FAQ

### Q: Do I need Docker Desktop, or can I use Docker Engine directly?

**A:** On macOS and Windows, Docker Desktop is required (it provides the Linux VM). On Linux, you can use either Docker Engine (lighter, no VM) or Docker Desktop for Linux. Both work with this template.

### Q: Can I use Podman instead of Docker?

**A:** Podman is largely Docker-compatible. Run `podman compose up -d` instead of `docker compose up -d`. You may need to adjust volume mount syntax and ensure `podman-compose` is installed. This is not officially tested with this template.

### Q: How do I completely reset my local WordPress?

**A:**
```bash
./wordpress-local.sh clean    # Removes containers AND volumes
./wordpress-local.sh start    # Fresh containers
./wordpress-local.sh install  # Reinstall WordPress
```

### Q: Can I run multiple WordPress sites simultaneously?

**A:** Yes, but you must use different ports. Copy `docker-compose.yml`, change the port mappings (e.g., `8082:80`), and use a different project name:
```bash
docker compose -p mysite2 up -d
```

### Q: How do I access WordPress from another device on my network?

**A:** Use your machine's local IP instead of `localhost`:
```bash
# Find your IP
# Windows: ipconfig
# macOS/Linux: ifconfig or ip addr
```
Then visit `http://<your-ip>:8080`. You may need to update the WordPress site URL:
```bash
docker compose exec wordpress wp option update siteurl "http://<your-ip>:8080" --allow-root
docker compose exec wordpress wp option update home "http://<your-ip>:8080" --allow-root
```

### Q: Why does `docker-compose` (with hyphen) vs `docker compose` (with space) matter?

**A:** `docker-compose` is the standalone V1 tool (Python-based, legacy). `docker compose` is the V2 plugin (Go-based, current). This project's `wordpress-local.sh` uses V1 syntax. Both produce identical results for this template. If you only have V2, alias it: `alias docker-compose="docker compose"`.

### Q: My WordPress admin password isn't working. How do I reset it?

**A:**
```bash
docker compose exec wordpress wp user update admin --user_pass=newpassword --allow-root
```

### Q: How do I update WordPress core inside Docker?

**A:**
```bash
docker compose exec wordpress wp core update --allow-root
```
Or pull a newer WordPress image:
```bash
docker compose pull wordpress
docker compose up -d
```

---

## Quick Diagnostic Checklist

Run these commands to diagnose most issues:

```bash
# 1. Is Docker running?
docker info > /dev/null 2>&1 && echo "Docker OK" || echo "Docker NOT running"

# 2. Are containers up?
docker compose ps

# 3. Any errors in logs?
docker compose logs --tail=50

# 4. Can WordPress reach the database?
docker compose exec wordpress wp db check --allow-root

# 5. Are volumes mounted correctly?
docker compose exec wordpress ls /var/www/html/wp-content/themes/

# 6. Is the site responding?
curl -sI http://localhost:8080 | head -1

# 7. Disk space OK?
docker system df
```

If all checks pass and you're still stuck, try a full reset:
```bash
./wordpress-local.sh clean && ./wordpress-local.sh start && ./wordpress-local.sh install
```
