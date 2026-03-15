# Local WordPress Development with Docker

## Quick Start (3 steps)

**1. Start WordPress:**
```bash
./wordpress-local.sh start
```

**2. Install WordPress (first time only):**
```bash
./wordpress-local.sh install
```

**3. Activate your theme:**
```bash
./wordpress-local.sh activate-theme your-theme
```

**4. Open in browser:**
- **Site:** http://localhost:8080
- **Admin:** http://localhost:8080/wp-admin (admin/admin)
- **Database:** http://localhost:8081 (phpMyAdmin)

---

## What This Sets Up

Docker Compose creates 3 containers:
1. **WordPress** (port 8080) - Your development site
2. **MySQL** (internal) - Database server
3. **phpMyAdmin** (port 8081) - Database management UI

Your `themes/`, `plugins/`, and `mu-plugins/` directories are automatically mounted into WordPress, so changes you make locally appear instantly.

---

## Common Commands

### Starting & Stopping
```bash
./wordpress-local.sh start      # Start WordPress
./wordpress-local.sh stop       # Stop WordPress
./wordpress-local.sh restart    # Restart WordPress
./wordpress-local.sh status     # Check if running
```

### Theme Management
```bash
./wordpress-local.sh list-themes              # List all themes
./wordpress-local.sh activate-theme my-theme  # Activate a theme
```

### Debugging
```bash
./wordpress-local.sh logs       # View WordPress logs (Ctrl+C to exit)
./wordpress-local.sh shell      # Open bash shell in WordPress container
```

### Clean Slate
```bash
./wordpress-local.sh clean      # Delete all data, start fresh (⚠️ destructive!)
```

---

## Testing Your Figma-to-FSE Themes

**Workflow:**

1. **Generate theme using Claude Code:**
   ```
   User: "Convert this Figma design to WordPress FSE theme"
   Claude: [Creates theme in themes/my-theme/]
   ```

2. **Start WordPress (if not running):**
   ```bash
   ./wordpress-local.sh start
   ```

3. **Activate the theme:**
   ```bash
   ./wordpress-local.sh activate-theme my-theme
   ```

4. **View in browser:**
   ```
   http://localhost:8080
   ```

5. **Make changes:**
   - Edit files in `themes/my-theme/`
   - Refresh browser to see changes
   - No rebuild needed for template/theme.json changes

---

## Directory Structure

```
project-root/
├── docker-compose.yml          ← Docker configuration
├── wordpress-local.sh          ← Helper script
├── themes/                     ← Your themes (mounted to WordPress)
│   └── my-theme/
│       ├── theme.json
│       ├── templates/
│       └── parts/
├── plugins/                    ← Your plugins (mounted to WordPress)
└── mu-plugins/                 ← Must-use plugins (mounted to WordPress)
```

**WordPress stores core files, uploads, and database in Docker volumes** (persists when you stop/start, removed with `clean`).

---

## Troubleshooting

### "Docker is not running"
**Solution:** Open Docker Desktop and wait for it to start (green icon in system tray).

### "Port 8080 already in use"
**Solution:** Stop other services using port 8080, or edit `docker-compose.yml` to use a different port:
```yaml
ports:
  - "8000:80"  # Change 8080 to 8000 (or any free port)
```

### "Theme not showing up"
**Solution:**
1. Check theme exists: `ls themes/`
2. Restart WordPress: `./wordpress-local.sh restart`
3. Refresh theme list in admin: Appearance → Themes

### "Changes not appearing"
**Solution:**
1. Hard refresh browser: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)
2. Clear WordPress cache (if using caching plugin)
3. Check file was saved correctly

### "Database connection error"
**Solution:**
1. Wait 30 seconds (MySQL takes time to initialize first time)
2. Check containers are running: `./wordpress-local.sh status`
3. If still failing, restart: `./wordpress-local.sh restart`

---

## WP-CLI Commands

You can run any WP-CLI command via Docker:

```bash
# General format
docker-compose exec wordpress wp <command> --allow-root

# Examples
docker-compose exec wordpress wp plugin list --allow-root
docker-compose exec wordpress wp theme list --allow-root
docker-compose exec wordpress wp db export /tmp/backup.sql --allow-root
docker-compose exec wordpress wp search-replace 'old-domain.com' 'localhost:8080' --allow-root
```

---

## Database Access

**phpMyAdmin:** http://localhost:8081

**Credentials:**
- Server: `db`
- Username: `wordpress`
- Password: `wordpress`
- Database: `wordpress`

**Direct MySQL connection:**
```bash
docker-compose exec db mysql -u wordpress -pwordpress wordpress
```

---

## Stopping WordPress

**Temporary stop (preserves data):**
```bash
./wordpress-local.sh stop
```

**Complete removal (deletes everything):**
```bash
./wordpress-local.sh clean
```

---

## Performance Tips

1. **Use WSL2 backend** (Docker Desktop → Settings → General → Use WSL2)
2. **Allocate more resources** (Docker Desktop → Settings → Resources)
3. **Restart Docker Desktop** if slow after long usage

---

## Next Steps

Once WordPress is running:

1. **Test your generated theme:**
   ```bash
   ./wordpress-local.sh activate-theme your-theme
   ```
   View at: http://localhost:8080

2. **Create test content:**
   - Add pages in WordPress admin
   - Test different templates
   - Verify responsive design

3. **Iterate on designs:**
   - Edit theme.json for token changes
   - Modify templates in themes/your-theme/templates/
   - Refresh browser to see changes

4. **Generate more themes:**
   - Use Claude Code with Figma URLs
   - Test multiple themes side-by-side
   - Compare Figma designs vs rendered output

---

**Need help?** Run `./wordpress-local.sh help` for command reference.
