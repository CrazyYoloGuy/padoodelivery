#!/bin/bash

# =================================================================
# 🔧 FIX NGINX PROXY - Forward Domain to Node.js App
# =================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

DOMAIN="padoodelivery.xyz"
APP_PORT="3001"

echo -e "${CYAN}🔧 FIXING NGINX PROXY CONFIGURATION${NC}"
echo -e "${BLUE}Domain: $DOMAIN${NC}"
echo -e "${BLUE}App Port: $APP_PORT${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}❌ This script must be run as root or with sudo${NC}"
    echo "Please run: sudo $0"
    exit 1
fi

# Test if app is running
echo -e "${YELLOW}🔍 Testing if app is running on port $APP_PORT...${NC}"
if curl -s http://localhost:$APP_PORT > /dev/null; then
    echo -e "${GREEN}✅ App is running on port $APP_PORT${NC}"
else
    echo -e "${RED}❌ App is not responding on port $APP_PORT${NC}"
    echo -e "${YELLOW}Make sure your app is running: pm2 start server.js${NC}"
    exit 1
fi

# Create Nginx configuration
echo -e "${YELLOW}⚙️  Creating Nginx configuration...${NC}"

cat > /etc/nginx/sites-available/$DOMAIN << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name padoodelivery.xyz;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Proxy all requests to Node.js app
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # WebSocket support for real-time features
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
EOF

# Enable the site
echo -e "${YELLOW}🔗 Enabling site...${NC}"
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/

# Remove default site if it exists
if [ -f /etc/nginx/sites-enabled/default ]; then
    echo -e "${YELLOW}🗑️  Removing default site...${NC}"
    rm -f /etc/nginx/sites-enabled/default
fi

# Test Nginx configuration
echo -e "${YELLOW}🧪 Testing Nginx configuration...${NC}"
if nginx -t; then
    echo -e "${GREEN}✅ Nginx configuration is valid${NC}"
else
    echo -e "${RED}❌ Nginx configuration has errors${NC}"
    exit 1
fi

# Restart Nginx
echo -e "${YELLOW}🔄 Restarting Nginx...${NC}"
systemctl restart nginx

# Test the connection
echo -e "${YELLOW}🌐 Testing domain connection...${NC}"
sleep 2

# Test HTTP
if curl -s -I http://$DOMAIN | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✅ HTTP connection working${NC}"
else
    echo -e "${RED}❌ HTTP connection failed${NC}"
fi

# Check if app is accessible
echo -e "${YELLOW}🔍 Testing app accessibility...${NC}"
if curl -s http://$DOMAIN | grep -q "DOCTYPE\|html\|Padoo"; then
    echo -e "${GREEN}✅ App is accessible through domain${NC}"
else
    echo -e "${YELLOW}⚠️  App might not be fully accessible yet${NC}"
fi

echo ""
echo -e "${GREEN}🎉 PROXY CONFIGURATION COMPLETE!${NC}"
echo ""
echo -e "${CYAN}📱 Your app should now be accessible at:${NC}"
echo -e "  🌐 http://$DOMAIN"
echo -e "  🔐 http://$DOMAIN/login"
echo -e "  🏪 http://$DOMAIN/mainapp/shop"
echo -e "  📊 http://$DOMAIN/dashboard"
echo ""
echo -e "${YELLOW}🔒 To setup SSL (HTTPS):${NC}"
echo -e "  sudo certbot --nginx -d $DOMAIN"
echo ""
echo -e "${YELLOW}📋 Useful commands:${NC}"
echo -e "  • Check Nginx status: ${CYAN}sudo systemctl status nginx${NC}"
echo -e "  • Check app logs: ${CYAN}pm2 logs${NC}"
echo -e "  • Restart app: ${CYAN}pm2 restart server${NC}"
echo -e "  • Test config: ${CYAN}sudo nginx -t${NC}" 