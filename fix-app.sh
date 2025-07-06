#!/bin/bash

# Fix script for Padoo Delivery app
# This script will fix common issues with the application

echo "🔧 Starting Padoo Delivery fix script..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root or with sudo"
  exit 1
fi

# Set variables
APP_DIR="/var/www/padoodelivery"
DOMAIN="padoodelivery.xyz"

echo "📁 Setting correct permissions..."
# Set correct ownership and permissions
chown -R www-data:www-data $APP_DIR
chmod -R 755 $APP_DIR

# Create standalone-mode.css if it doesn't exist
echo "🎨 Creating missing CSS files..."
if [ ! -f "$APP_DIR/standalone-mode.css" ]; then
  cat > "$APP_DIR/standalone-mode.css" << EOL
/* Standalone mode styles */
.standalone-app {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
}

.standalone-install-prompt {
  display: none;
}

@media (display-mode: standalone) {
  body {
    overscroll-behavior: none;
  }
  
  .standalone-only {
    display: block;
  }
  
  .browser-only {
    display: none;
  }
}
EOL
  echo "✅ Created standalone-mode.css"
else
  echo "✅ standalone-mode.css already exists"
fi

# Create standalone-detector.js if it doesn't exist
if [ ! -f "$APP_DIR/standalone-detector.js" ]; then
  cat > "$APP_DIR/standalone-detector.js" << EOL
// Detect if app is running in standalone mode
(function() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                      (window.navigator.standalone) || 
                      document.referrer.includes('android-app://');
  
  if (isStandalone) {
    document.documentElement.classList.add('standalone-mode');
  }
  
  window.isStandalone = isStandalone;
})();
EOL
  echo "✅ Created standalone-detector.js"
else
  echo "✅ standalone-detector.js already exists"
fi

# Create pwa-utils.js if it doesn't exist
if [ ! -f "$APP_DIR/pwa-utils.js" ]; then
  cat > "$APP_DIR/pwa-utils.js" << EOL
// PWA Utilities
class PWAUtils {
  constructor() {
    this.init();
  }
  
  init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(reg => console.log('Service Worker registered'))
          .catch(err => console.error('Service Worker registration failed:', err));
      });
    }
  }
}

// Initialize PWA Utils
new PWAUtils();
EOL
  echo "✅ Created pwa-utils.js"
else
  echo "✅ pwa-utils.js already exists"
fi

echo "🔧 Updating Nginx configuration..."
# Update Nginx configuration for proper MIME types
cat > /etc/nginx/sites-available/$DOMAIN << EOL
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Redirect HTTP to HTTPS
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name $DOMAIN www.$DOMAIN;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    # Root directory
    root $APP_DIR;
    
    # Proper MIME types for CSS and JS files
    location ~* \.(css)$ {
        add_header Content-Type text/css;
        expires 7d;
        access_log off;
    }
    
    location ~* \.(js)$ {
        add_header Content-Type application/javascript;
        expires 7d;
        access_log off;
    }
    
    # Proxy all requests to Node.js server
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Serve static files directly
    location ~* \.(jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
        try_files \$uri \$uri/ @proxy;
    }
    
    location @proxy {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOL

# Test Nginx configuration
echo "🔍 Testing Nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
  echo "✅ Nginx configuration is valid"
  echo "🔄 Restarting Nginx..."
  systemctl restart nginx
else
  echo "❌ Nginx configuration is invalid. Please check the errors above."
  exit 1
fi

# Update .env file to use port 3001
echo "🔧 Updating Node.js port configuration..."
if [ -f "$APP_DIR/.env" ]; then
  sed -i 's/PORT=.*/PORT=3001/' $APP_DIR/.env
  echo "✅ Updated PORT in .env to 3001"
else
  echo "PORT=3001" > $APP_DIR/.env
  echo "✅ Created .env with PORT=3001"
fi

# Fix UI issues in notification components
echo "🎨 Fixing UI issues in notification components..."

# Update mass actions in notifications page
NOTIFICATIONS_FILES=(
  "$APP_DIR/mainapp/shop/js/app.js"
  "$APP_DIR/mainapp/delivery/js/app.js"
)

for file in "${NOTIFICATIONS_FILES[@]}"; do
  if [ -f "$file" ]; then
    # Backup the file
    cp "$file" "${file}.bak"
    
    # Replace refresh button with mass actions dropdown
    sed -i 's/class="refresh-btn"/class="mass-actions-btn"/g' "$file"
    sed -i 's/<button[^>]*id="refresh-btn"[^>]*>.*<\/button>/<div class="mass-actions-dropdown">\n            <button id="mass-actions-btn" class="secondary-btn">\n                <i class="fas fa-tasks"><\/i>\n                Mass Actions\n                <i class="fas fa-chevron-down"><\/i>\n            <\/button>\n            <div class="dropdown-menu" id="mass-actions-menu">\n                <a href="#" id="mass-delete-btn"><i class="fas fa-trash-alt"><\/i> Delete All<\/a>\n                <a href="#" id="mass-accept-btn"><i class="fas fa-check-double"><\/i> Accept All<\/a>\n                <a href="#" id="mass-mark-read-btn"><i class="fas fa-envelope-open"><\/i> Mark All as Read<\/a>\n            <\/div>\n        <\/div>/g' "$file"
    
    echo "✅ Updated mass actions in $file"
  fi
done

# Add CSS for mass actions to all CSS files
CSS_FILES=(
  "$APP_DIR/mainapp/shop/css/styles.css"
  "$APP_DIR/mainapp/delivery/css/styles.css"
)

for file in "${CSS_FILES[@]}"; do
  if [ -f "$file" ]; then
    # Backup the file
    cp "$file" "${file}.bak"
    
    # Add mass actions CSS if not already present
    if ! grep -q "mass-actions-dropdown" "$file"; then
      cat >> "$file" << EOL

/* Mass Actions Dropdown */
.mass-actions-dropdown {
    position: relative;
}

.dropdown-menu {
    position: absolute;
    top: 100%;
    right: 0;
    z-index: 10;
    min-width: 220px;
    background: white;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
    padding: 8px 0;
    margin-top: 8px;
    display: none;
}

.mass-actions-dropdown:hover .dropdown-menu {
    display: block;
}

.dropdown-menu a {
    display: block;
    padding: 10px 16px;
    color: var(--text-primary, #111827);
    text-decoration: none;
    font-size: 14px;
    transition: all 0.2s ease;
}

.dropdown-menu a:hover {
    background: #f3f4f6;
}

.dropdown-menu a i {
    margin-right: 8px;
    width: 16px;
    text-align: center;
}

.secondary-btn {
    padding: 8px 16px;
    background: #f3f4f6;
    color: var(--text-primary, #111827);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
}

.secondary-btn:hover {
    background: #e5e7eb;
}

@media (max-width: 768px) {
    .mass-actions-dropdown {
        position: static;
    }
    
    .dropdown-menu {
        width: 100%;
        right: auto;
        left: 0;
    }
}
EOL
      echo "✅ Added mass actions CSS to $file"
    else
      echo "✅ Mass actions CSS already exists in $file"
    fi
  fi
done

# Install PM2 if not already installed
echo "🔄 Checking for PM2..."
if ! command -v pm2 &> /dev/null; then
  echo "📦 Installing PM2..."
  npm install -g pm2
fi

# Restart the Node.js server
echo "🚀 Restarting the Node.js server..."
cd $APP_DIR
pm2 delete server 2>/dev/null || true
pm2 start server.js
pm2 save

echo "✅ Fix completed successfully!"
echo "🌐 Your app should now be accessible at https://$DOMAIN"
echo ""
echo "📝 Additional notes:"
echo "1. If you're still seeing MIME type errors, try clearing your browser cache"
echo "2. The app is now configured to run on port 3001"
echo "3. Mass action buttons have been added to notification components"
echo ""
echo "Thank you for using Padoo Delivery!" 