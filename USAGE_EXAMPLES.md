# 📚 Usage Examples - Padoo Delivery VPS Setup

## 🎯 Example 1: First-Time Setup with Domain

```bash
# On your VPS server
cd ~/padoodelivery
chmod +x vps-setup.sh
sudo ./vps-setup.sh
```

**Interactive Prompts:**
```
🌐 DOMAIN CONFIGURATION
Your server's public IP: 142.93.15.123
Enter your domain name (or use IP) [142.93.15.123]: delivery.mycompany.com

🔒 SSL CONFIGURATION
Enter email for SSL certificates [admin@delivery.mycompany.com]: admin@mycompany.com

🚪 APPLICATION SETTINGS
Enter application port [3001]: 3001
Enter Node.js version [18]: 18
Enter swap file size (e.g., 2G, 4G) [2G]: 4G

🗄️ DATABASE CONFIGURATION
Enter Supabase URL [https://your-project.supabase.co]: https://abcd1234.supabase.co
Enter Supabase Anonymous Key [your-supabase-anon-key-here]: eyJhbGciOiJIUzI1NiIsIn...
```

**Result:** Full production setup with real SSL certificate and custom domain.

---

## 🎯 Example 2: Quick Testing Setup (Use Defaults)

```bash
cd ~/padoodelivery
chmod +x vps-setup.sh
sudo ./vps-setup.sh
```

**Just Press Enter for All Prompts:**
```
🌐 DOMAIN CONFIGURATION
Enter your domain name (or use IP) [142.93.15.123]: [ENTER]

🔒 SSL CONFIGURATION  
Enter email for SSL certificates [admin@142.93.15.123]: [ENTER]

🚪 APPLICATION SETTINGS
Enter application port [3001]: [ENTER]
Enter Node.js version [18]: [ENTER]
Enter swap file size [2G]: [ENTER]

🗄️ DATABASE CONFIGURATION
Enter Supabase URL [https://your-project.supabase.co]: [ENTER]
Enter Supabase Anonymous Key [your-supabase-anon-key-here]: [ENTER]
```

**Result:** Quick setup using server IP, self-signed SSL, placeholder database (update later).

---

## 🎯 Example 3: Advanced Production Setup

```bash
cd ~/padoodelivery
chmod +x vps-setup.sh
sudo ./vps-setup.sh
```

**Configuration for High-Traffic Setup:**
```
🌐 DOMAIN CONFIGURATION
Enter your domain name (or use IP) [142.93.15.123]: api.padoodelivery.com

🔒 SSL CONFIGURATION
Enter email for SSL certificates [admin@api.padoodelivery.com]: devops@padoodelivery.com

🚪 APPLICATION SETTINGS
Enter application port [3001]: 3001
Enter Node.js version [18]: 20
Enter swap file size [2G]: 8G

🗄️ DATABASE CONFIGURATION  
Enter Supabase URL: https://prod-abc123.supabase.co
Enter Supabase Anonymous Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Result:** Production-ready setup with Node.js 20, 8GB swap, and production database.

---

## 🛠️ Example 4: Troubleshooting Failed Setup

If setup fails, you'll see:
```
❌ SETUP FAILED!
Error: Failed to install npm dependencies

🔍 Last 15 log entries:
==========================================
[2024-01-15 10:30:15] [ERROR] npm install failed with exit code 1
[2024-01-15 10:30:15] [INFO] Retrying in 5 seconds...
[2024-01-15 10:30:20] [ERROR] npm install failed again
==========================================

🆘 Common solutions:
  • Check internet connection: ping google.com
  • Retry installation: sudo ./vps-setup.sh
  • Check system resources: free -h && df -h
  • View full log: less /tmp/padoo-setup-20240115-103000.log
```

**How to Fix:**
```bash
# Check internet and resources
ping google.com
free -h
df -h

# Try running again
sudo ./vps-setup.sh
```

---

## 📄 Example 5: Viewing Logs and Status

**After successful setup:**
```bash
# Check application status
./status.sh

# View setup log
less /var/log/padoo-delivery/setup.log

# Monitor application
pm2 logs padoo-delivery

# Check health logs
tail -f /var/log/padoo-delivery/health.log
```

**Status output example:**
```
🚀 PADOO DELIVERY SYSTEM STATUS
================================================
✅ Application: Running
✅ Nginx: Active
✅ fail2ban: Active
✅ ufw: Active

📊 System Resources:
CPU: 5.2%
Memory: 45.8%
Disk: 15%
Load: 0.15, 0.12, 0.08

📝 Recent Health Logs:
[2024-01-15 10:45:00] [INFO] All health checks passed
[2024-01-15 10:50:00] [INFO] All health checks passed
```

---

## 🔧 Example 6: Post-Setup Configuration

**Update Supabase settings after setup:**
```bash
# Edit environment file
sudo nano /var/www/padoo-delivery/.env

# Update these lines:
SUPABASE_URL=https://your-real-project.supabase.co
SUPABASE_ANON_KEY=your-real-supabase-key

# Restart application
pm2 restart padoo-delivery
```

**Add domain later:**
```bash
# Update DNS to point to your server IP first
# Then get SSL certificate
sudo certbot --nginx -d yourdomain.com --email admin@yourdomain.com

# Update environment
sudo nano /var/www/padoo-delivery/.env
# Change DOMAIN=yourdomain.com

pm2 restart padoo-delivery
```

---

## 📱 Example 7: Testing Your App

**After setup completes, test your application:**

```bash
# Test health endpoint
curl http://your-domain/health

# Test landing page
curl -I http://your-domain/

# Test API (if configured)
curl http://your-domain/api/health
```

**Access via browser:**
- 🏠 **Landing Page**: `http://your-domain/`
- 🚚 **Driver Login**: `http://your-domain/login`
- 🏪 **Shop Portal**: `http://your-domain/mainapp/shop`
- 📊 **Admin Dashboard**: `http://your-domain/dashboard`

---

## 🆘 Common Scenarios & Solutions

### Scenario: "Script seems stuck"
```bash
# Check if script is still running
ps aux | grep vps-setup

# Check the progress file
cat /tmp/padoo-progress.txt

# Check recent log entries
tail -f /tmp/padoo-setup-*.log
```

### Scenario: "Want to restart setup"
```bash
# Stop any running processes
sudo pkill -f vps-setup
pm2 delete padoo-delivery 2>/dev/null || true

# Clean up and restart
sudo rm -rf /var/www/padoo-delivery
sudo ./vps-setup.sh
```

### Scenario: "Need to update configuration"
```bash
# Edit environment file
sudo nano /var/www/padoo-delivery/.env

# Restart application
pm2 restart padoo-delivery

# Check if changes took effect
./status.sh
```

---

## 💡 Pro Tips

1. **Always test DNS first** if using a domain:
   ```bash
   dig yourdomain.com
   nslookup yourdomain.com
   ```

2. **Monitor during setup**:
   ```bash
   # In another terminal, watch progress
   watch -n 2 'cat /tmp/padoo-progress.txt'
   ```

3. **Keep backups** of your configuration:
   ```bash
   # After successful setup
   cp /var/www/padoo-delivery/.env ~/padoo-backup.env
   ```

4. **Regular health checks**:
   ```bash
   # Add to your crontab for notifications
   0 */6 * * * /var/www/padoo-delivery/status.sh | mail -s "Padoo Status" admin@yourdomain.com
   ```

Happy deployment! 🚀 