#!/bin/bash

# =================================================================
# 🌐 DOMAIN-ONLY SETUP SCRIPT
# =================================================================
# Version: 1.0
# Purpose: Setup domain, SSL certificates, and basic Nginx only
# Application setup: Manual (as requested)
# =================================================================

set -e  # Exit on any error

# Script metadata
SCRIPT_VERSION="1.0"
SCRIPT_START_TIME=$(date '+%Y-%m-%d %H:%M:%S')

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration variables
DOMAIN=""
SSL_EMAIL=""
WEB_ROOT="/var/www/html"
NGINX_AVAILABLE="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"

# Logging
LOG_FILE="/tmp/domain-setup-$(date +%Y%m%d-%H%M%S).log"

# ===================================================================
# 🎨 UTILITY FUNCTIONS
# ===================================================================

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Log to file
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    # Display with colors
    case "$level" in
        "INFO")
            echo -e "${BLUE}[INFO]${NC} $message"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} $message"
            ;;
        "WARNING")
            echo -e "${YELLOW}[WARNING]${NC} $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message"
            ;;
        "HEADER")
            echo ""
            echo -e "${CYAN}====================================================================${NC}"
            echo -e "${WHITE}${BOLD} $message${NC}"
            echo -e "${CYAN}====================================================================${NC}"
            echo ""
            ;;
    esac
}

# Error handler
error_exit() {
    local error_message="$1"
    local line_number="${2:-unknown}"
    
    log "ERROR" "Script failed at line $line_number: $error_message"
    echo ""
    echo -e "${RED}❌ DOMAIN SETUP FAILED!${NC}"
    echo -e "${RED}Error: $error_message${NC}"
    echo -e "${YELLOW}📄 Full log: $LOG_FILE${NC}"
    exit 1
}

# Trap errors
trap 'error_exit "Unexpected error occurred" $LINENO' ERR

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if running as root/sudo
check_privileges() {
    if [[ $EUID -ne 0 ]]; then
        log "ERROR" "This script must be run as root or with sudo"
        echo "Please run: sudo $0"
        exit 1
    fi
}

# Input validation functions
validate_domain() {
    local domain="$1"
    if [[ "$domain" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        return 0  # IP address is valid
    elif [[ "$domain" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$ ]] || [[ "$domain" =~ ^[a-zA-Z0-9-]{1,63}\.[a-zA-Z]{2,}$ ]]; then
        return 0  # Domain is valid
    else
        return 1  # Invalid
    fi
}

validate_email() {
    local email="$1"
    if [[ "$email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        return 0
    else
        return 1
    fi
}

# Interactive input function
prompt_input() {
    local prompt="$1"
    local var_name="$2"
    local default_value="${3:-}"
    local validation_func="${4:-}"
    
    while true; do
        if [[ -n "$default_value" ]]; then
            echo -n -e "${YELLOW}$prompt${NC} [${CYAN}$default_value${NC}]: "
        else
            echo -n -e "${YELLOW}$prompt${NC}: "
        fi
        
        read input
        
        # Use default if empty
        if [[ -z "$input" && -n "$default_value" ]]; then
            input="$default_value"
        fi
        
        # Validate input if validation function provided
        if [[ -n "$validation_func" ]]; then
            if $validation_func "$input"; then
                eval "$var_name='$input'"
                break
            else
                echo -e "${RED}❌ Invalid input. Please try again.${NC}"
                continue
            fi
        else
            eval "$var_name='$input'"
            break
        fi
    done
}

# ===================================================================
# 🔧 CONFIGURATION FUNCTIONS
# ===================================================================

show_banner() {
    log "HEADER" "🌐 DOMAIN-ONLY SETUP v$SCRIPT_VERSION"
    
    echo -e "${BLUE}This script will setup ONLY:${NC}"
    echo -e "  ✅ Domain configuration"
    echo -e "  ✅ SSL certificates (Let's Encrypt)"
    echo -e "  ✅ Basic Nginx configuration"
    echo -e "  ✅ Firewall rules for web traffic"
    echo ""
    echo -e "${YELLOW}You will handle manually:${NC}"
    echo -e "  📦 Node.js & application deployment"
    echo -e "  ⚙️  Environment files & configuration"
    echo -e "  🔄 PM2 process management"
    echo -e "  🗄️  Database setup"
    echo ""
}

get_configuration() {
    log "HEADER" "🔧 DOMAIN CONFIGURATION"
    
    # Get public IP for reference
    local public_ip=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "unknown")
    echo "Your server's public IP: ${GREEN}$public_ip${NC}"
    echo ""
    
    # Domain configuration
    prompt_input "Enter your domain name" DOMAIN "$public_ip" "validate_domain"
    
    # SSL Email
    prompt_input "Enter email for SSL certificates" SSL_EMAIL "admin@$DOMAIN" "validate_email"
    
    echo ""
    log "SUCCESS" "Configuration collected"
}

show_configuration() {
    log "HEADER" "📋 CONFIGURATION SUMMARY"
    
    echo -e "${YELLOW}🌐 Domain Settings:${NC}"
    echo "  🏠 Domain: ${GREEN}$DOMAIN${NC}"
    echo "  📧 SSL Email: ${GREEN}$SSL_EMAIL${NC}"
    echo "  📂 Web Root: ${GREEN}$WEB_ROOT${NC}"
    echo ""
    echo -e "${YELLOW}📄 Logging:${NC}"
    echo "  📋 Setup Log: ${CYAN}$LOG_FILE${NC}"
    echo ""
}

# ===================================================================
# 🔧 INSTALLATION FUNCTIONS
# ===================================================================

install_dependencies() {
    log "INFO" "Installing required packages..."
    
    # Update package lists
    apt update -qq
    
    # Install essential packages
    apt install -y -qq \
        nginx \
        certbot \
        python3-certbot-nginx \
        ufw \
        curl \
        wget
    
    log "SUCCESS" "Dependencies installed"
}

configure_firewall() {
    log "INFO" "Configuring firewall..."
    
    # Configure UFW
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow essential ports
    ufw allow ssh
    ufw allow 80/tcp   # HTTP
    ufw allow 443/tcp  # HTTPS
    
    # Enable firewall
    ufw --force enable
    
    log "SUCCESS" "Firewall configured"
}

create_nginx_config() {
    log "INFO" "Creating Nginx configuration..."
    
    # Create basic HTML page
    mkdir -p "$WEB_ROOT"
    cat > "$WEB_ROOT/index.html" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>$DOMAIN - Ready for Deployment</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; }
        .status { color: #27ae60; font-size: 18px; }
        .next-steps { text-align: left; margin-top: 30px; }
        .step { margin: 10px 0; padding: 10px; background: #ecf0f1; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🌐 $DOMAIN</h1>
        <p class="status">✅ Domain and SSL setup complete!</p>
        <p>Your domain is now ready for application deployment.</p>
        
        <div class="next-steps">
            <h3>Next Steps:</h3>
            <div class="step">1. Deploy your Node.js application</div>
            <div class="step">2. Configure your .env files</div>
            <div class="step">3. Setup PM2 process management</div>
            <div class="step">4. Update Nginx configuration for your app</div>
        </div>
        
        <p><small>Setup completed at: $(date)</small></p>
    </div>
</body>
</html>
EOF

    # Create Nginx server config
    cat > "$NGINX_AVAILABLE/$DOMAIN" << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_PLACEHOLDER;
    
    root /var/www/html;
    index index.html index.htm;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Handle static files
    location / {
        try_files $uri $uri/ =404;
    }
    
    # Future proxy configuration (for your app)
    # Uncomment and modify these lines when you deploy your application:
    # location /api/ {
    #     proxy_pass http://localhost:3001;
    #     proxy_http_version 1.1;
    #     proxy_set_header Upgrade $http_upgrade;
    #     proxy_set_header Connection 'upgrade';
    #     proxy_set_header Host $host;
    #     proxy_set_header X-Real-IP $remote_addr;
    #     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    #     proxy_set_header X-Forwarded-Proto $scheme;
    #     proxy_cache_bypass $http_upgrade;
    # }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
EOF
    
    # Replace placeholder with actual domain
    sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$NGINX_AVAILABLE/$DOMAIN"

    # Enable the site
    ln -sf "$NGINX_AVAILABLE/$DOMAIN" "$NGINX_ENABLED/"
    
    # Remove default Nginx site
    rm -f "$NGINX_ENABLED/default"
    
    # Test Nginx configuration
    nginx -t
    
    # Restart Nginx
    systemctl restart nginx
    systemctl enable nginx
    
    log "SUCCESS" "Nginx configured"
}

setup_ssl() {
    log "INFO" "Setting up SSL certificate..."
    
    # Check if domain is IP address
    if [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || [[ "$DOMAIN" =~ ^[a-f0-9:]+$ ]]; then
        log "WARNING" "Cannot get Let's Encrypt certificate for IP address. Using self-signed certificate."
        
        # Create self-signed certificate
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout /etc/ssl/private/$DOMAIN.key \
            -out /etc/ssl/certs/$DOMAIN.crt \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"
        
        log "SUCCESS" "Self-signed SSL certificate created"
        
    else
        # Try to get Let's Encrypt certificate
        log "INFO" "Requesting Let's Encrypt certificate for $DOMAIN..."
        
        if certbot --nginx -d "$DOMAIN" --email "$SSL_EMAIL" --agree-tos --non-interactive --redirect; then
            log "SUCCESS" "Let's Encrypt SSL certificate obtained"
        else
            log "WARNING" "Let's Encrypt failed. Check domain DNS configuration."
            log "INFO" "You can manually setup SSL later with: certbot --nginx -d $DOMAIN"
        fi
    fi
}

# ===================================================================
# 🔍 TESTING & COMPLETION
# ===================================================================

test_setup() {
    log "INFO" "Testing domain setup..."
    
    # Test HTTP
    if curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN" | grep -q "200\|301\|302"; then
        log "SUCCESS" "HTTP access working"
    else
        log "WARNING" "HTTP access test failed"
    fi
    
    # Test HTTPS
    if curl -s -k -o /dev/null -w "%{http_code}" "https://$DOMAIN" | grep -q "200"; then
        log "SUCCESS" "HTTPS access working"
    else
        log "WARNING" "HTTPS access test failed"
    fi
    
    # Test Nginx
    if systemctl is-active --quiet nginx; then
        log "SUCCESS" "Nginx is running"
    else
        log "ERROR" "Nginx is not running"
    fi
}

show_completion() {
    log "HEADER" "🎉 DOMAIN SETUP COMPLETE"
    
    echo -e "${GREEN}✅ Domain setup completed successfully!${NC}"
    echo ""
    echo -e "${YELLOW}🌐 Your domain is accessible at:${NC}"
    echo "  🔗 HTTP:  http://$DOMAIN"
    echo "  🔒 HTTPS: https://$DOMAIN"
    echo ""
    echo -e "${YELLOW}📂 Web root directory:${NC}"
    echo "  📁 $WEB_ROOT"
    echo ""
    echo -e "${YELLOW}⚙️  Nginx configuration:${NC}"
    echo "  📄 $NGINX_AVAILABLE/$DOMAIN"
    echo ""
    echo -e "${YELLOW}🔄 Next steps for your application:${NC}"
    echo "  1. Deploy your Node.js app to a directory (e.g., /var/www/padoo-delivery)"
    echo "  2. Install Node.js and dependencies"
    echo "  3. Configure your .env files"
    echo "  4. Setup PM2 for process management"
    echo "  5. Update Nginx config to proxy to your app (uncomment proxy sections)"
    echo ""
    echo -e "${YELLOW}📄 Useful commands:${NC}"
    echo "  • Reload Nginx: ${CYAN}sudo systemctl reload nginx${NC}"
    echo "  • Test Nginx config: ${CYAN}sudo nginx -t${NC}"
    echo "  • View logs: ${CYAN}sudo tail -f /var/log/nginx/error.log${NC}"
    echo "  • SSL renewal: ${CYAN}sudo certbot renew${NC}"
    echo ""
    echo -e "${GREEN}📋 Setup log saved to: $LOG_FILE${NC}"
}

# ===================================================================
# 🚀 MAIN EXECUTION
# ===================================================================

main() {
    # Initialize
    show_banner
    check_privileges
    
    log "INFO" "Starting Domain Setup v$SCRIPT_VERSION"
    log "INFO" "Started at: $SCRIPT_START_TIME"
    
    # Get configuration
    get_configuration
    show_configuration
    
    # Confirmation
    echo ""
    echo -e "${YELLOW}⚠️  This will setup domain and SSL certificates only.${NC}"
    echo -e "${YELLOW}📋 Estimated time: 2-5 minutes${NC}"
    echo ""
    
    while true; do
        read -p "Continue with domain setup? (y/N): " -n 1 -r
        echo ""
        case $REPLY in
            [Yy]* ) 
                break
                ;;
            [Nn]* | "" ) 
                log "INFO" "Setup cancelled by user"
                echo -e "${YELLOW}Setup cancelled. You can run this script again anytime.${NC}"
                exit 0
                ;;
            * ) 
                echo -e "${RED}Please answer y (yes) or n (no).${NC}"
                ;;
        esac
    done
    
    log "HEADER" "🚀 STARTING DOMAIN SETUP"
    
    # Execute setup steps
    install_dependencies
    configure_firewall  
    create_nginx_config
    setup_ssl
    test_setup
    show_completion
    
    log "SUCCESS" "Domain setup completed at $(date '+%Y-%m-%d %H:%M:%S')"
    
    # Copy log to permanent location
    mkdir -p /var/log/nginx 2>/dev/null || true
    if cp "$LOG_FILE" "/var/log/nginx/domain-setup.log" 2>/dev/null; then
        echo -e "${GREEN}📄 Setup log also saved to: /var/log/nginx/domain-setup.log${NC}"
    fi
}

# Execute main function
main "$@" 