# 🚀 QUICK START - Padoo Delivery VPS Setup

## ⚡ Super Simple Setup (2 commands)

```bash
# Make the script executable
chmod +x vps-setup.sh

# Run the interactive setup
sudo ./vps-setup.sh
```

That's it! The script will:
- ✅ **Ask for your configuration** (domain, database, etc.)
- ✅ **Validate all inputs** with smart defaults
- ✅ **Handle everything automatically** with full logging
- ✅ **Retry failed operations** automatically
- ✅ **Show detailed progress** with colored output

## 🎯 What Happens During Setup

The script will show you:
- ✅ **Real-time progress** (Step X/12)
- 📊 **Detailed logging** of every action
- 🎨 **Colorized output** for easy reading
- ⏱️ **Time tracking** for each step
- 🧪 **Final tests** to verify everything works

## 📋 Setup Steps (Automatic)

1. **System Validation** - Check requirements
2. **Dependencies** - Install system packages
3. **Swap Memory** - Configure swap if needed
4. **Node.js** - Install Node.js 18.x
5. **PM2** - Setup process manager
6. **Security** - Configure firewall & Fail2Ban
7. **Application** - Copy files and setup directories
8. **Environment** - Create secure configuration
9. **Dependencies** - Install npm packages
10. **Nginx** - Configure web server
11. **SSL** - Setup certificates (auto-detected)
12. **Monitoring** - Health checks and logging

## 🔧 Configuration Options

The script will **interactively ask** for all configuration during setup:

### 🌐 Domain Configuration
- **Domain/IP**: Your domain name or use your server's IP
- **SSL Email**: Email for SSL certificate (Let's Encrypt)

### 🚪 Application Settings  
- **Port**: Application port (default: 3001)
- **Node.js Version**: Which version to install (default: 18)
- **Swap Size**: Memory swap file size (default: 2G)

### 🗄️ Database Settings
- **Supabase URL**: Your Supabase project URL
- **Supabase Key**: Your Supabase anonymous key

### 💡 Smart Defaults
- Press **Enter** to use recommended defaults
- **Auto-detection**: Script detects your server's public IP
- **Validation**: All inputs are validated in real-time
- **Secure input**: Database keys are hidden when typing

## 📊 During Setup You'll See

### Interactive Configuration
```
🔧 CONFIGURATION SETUP
====================================================================
Please provide the following configuration details:
💡 Press Enter to use default values shown in brackets

🌐 DOMAIN CONFIGURATION
Your server's public IP: 142.93.XXX.XXX
Enter your domain name (or use IP) [142.93.XXX.XXX]: yourdomain.com

🔒 SSL CONFIGURATION  
Enter email for SSL certificates [admin@yourdomain.com]: admin@yourdomain.com

🚪 APPLICATION SETTINGS
Enter application port [3001]: 3001
Enter Node.js version [18]: 18

🗄️ DATABASE CONFIGURATION
📝 You can get these from your Supabase dashboard
Enter Supabase URL [https://your-project.supabase.co]: https://abc123.supabase.co
Enter Supabase Anonymous Key [your-supabase-anon-key-here]: ••••••••••••••••••••
```

### Installation Progress
```
📋 CONFIGURATION SUMMARY
====================================================================
🖥️ System Information:
  📍 Public IP: 142.93.XXX.XXX
  💻 OS: Ubuntu 22.04.3 LTS

[STEP 1/12] (8%) Validating System Requirements
[INFO] Checking system requirements...
[SUCCESS] System validation completed

[STEP 2/12] (16%) Installing System Dependencies  
[INFO] Installing essential packages: curl wget git...
[SUCCESS] System dependencies installation completed
```

## ✅ After Setup Complete

You'll get a detailed summary showing:
- 🌐 **All your access URLs**
- 📊 **Management commands**
- 📁 **Important file locations**
- 📝 **Next steps to take**
- 🔧 **Quick troubleshooting commands**

## 🎯 Access Your App

After successful setup:
- **Main App**: `http://YOUR_IP/`
- **Driver Login**: `http://YOUR_IP/login`
- **Shop Portal**: `http://YOUR_IP/mainapp/shop`
- **Admin Dashboard**: `http://YOUR_IP/dashboard`

## 📄 Logs & Monitoring

- **Setup Log**: `/tmp/padoo-setup-TIMESTAMP.log`
- **App Logs**: `/var/log/padoo-delivery/`
- **Status Check**: `./status.sh`
- **Health Monitor**: Runs automatically every 5 minutes

## 🆘 If Something Goes Wrong

1. **Check the setup log** (location shown during setup)
2. **Run status check**: `./status.sh`
3. **View recent logs**: `tail -f /var/log/padoo-delivery/health.log`
4. **Restart if needed**: `pm2 restart padoo-delivery`

## 💡 Pro Tips

- ✅ **Run on fresh Ubuntu 20.04+ VPS**
- ✅ **Have at least 1GB RAM and 10GB disk**
- ✅ **Set up your domain DNS first** (for real SSL)
- ✅ **Configure Supabase** after setup for full functionality

---

## 🚀 Ready? Just run:

```bash
chmod +x vps-setup.sh && sudo ./vps-setup.sh
```

The script will guide you through everything! 🎉 