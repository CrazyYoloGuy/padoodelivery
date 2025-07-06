#!/bin/bash

# ===================================================================
# 🚀 PADOO DELIVERY - BULLETPROOF VPS SETUP SCRIPT
# ===================================================================
# Version: 2.0
# Description: Fully automated VPS setup for Padoo Delivery
# Features: Extensive logging, error handling, progress tracking
# ===================================================================

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# ===================================================================
# 🎨 COLORS AND STYLING
# ===================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ===================================================================
# 📊 CONFIGURATION & VARIABLES
# ===================================================================
SCRIPT_VERSION="2.0"
SCRIPT_START_TIME=$(date '+%Y-%m-%d %H:%M:%S')
LOG_FILE="/tmp/padoo-setup-$(date '+%Y%m%d-%H%M%S').log"
PROGRESS_FILE="/tmp/padoo-progress.txt"

# Configuration variables (will be set via prompts)
DOMAIN=""
SSL_EMAIL=""
SUPABASE_URL=""
SUPABASE_ANON_KEY=""
APP_NAME="padoo-delivery"
APP_PORT=""
NODE_VERSION=""
USER="${USER:-$(whoami)}"
APP_DIR="/var/www/padoo-delivery"
SWAP_SIZE=""

# System Detection
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "unknown")
OS_INFO=$(lsb_release -d 2>/dev/null | cut -f2 || echo "Unknown Linux")

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

validate_port() {
    local port="$1"
    if [[ "$port" =~ ^[0-9]+$ ]] && [[ "$port" -ge 1024 ]] && [[ "$port" -le 65535 ]]; then
        return 0
    else
        return 1
    fi
}

validate_url() {
    local url="$1"
    if [[ "$url" =~ ^https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,} ]]; then
        return 0
    else
        return 1
    fi
}

# Progress tracking
TOTAL_STEPS=12
CURRENT_STEP=0

# ===================================================================
# 🛠️ UTILITY FUNCTIONS
# ===================================================================

# Initialize logging
init_logging() {
    echo "# PADOO DELIVERY VPS SETUP LOG" > "$LOG_FILE"
    echo "# Started: $SCRIPT_START_TIME" >> "$LOG_FILE"
    echo "# Version: $SCRIPT_VERSION" >> "$LOG_FILE"
    echo "# Public IP: $PUBLIC_IP" >> "$LOG_FILE"
    echo "# OS: $OS_INFO" >> "$LOG_FILE"
    echo "# Domain: $DOMAIN" >> "$LOG_FILE"
    echo "# User: $USER" >> "$LOG_FILE"
    echo "# =================================" >> "$LOG_FILE"
    echo ""
}

# Enhanced logging function
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
        "STEP")
            echo -e "${PURPLE}[STEP $CURRENT_STEP/$TOTAL_STEPS]${NC} $message"
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

# Interactive input function with validation
prompt_input() {
    local prompt="$1"
    local var_name="$2"
    local default_value="${3:-}"
    local validation_func="${4:-}"
    local is_secret="${5:-false}"
    
    while true; do
        if [[ -n "$default_value" ]]; then
            if [[ "$is_secret" == "true" ]]; then
                echo -n -e "${YELLOW}$prompt${NC} [${default_value:0:8}...]: "
            else
                echo -n -e "${YELLOW}$prompt${NC} [${CYAN}$default_value${NC}]: "
            fi
        else
            echo -n -e "${YELLOW}$prompt${NC}: "
        fi
        
        if [[ "$is_secret" == "true" ]]; then
            read -s input
            echo ""
        else
            read input
        fi
        
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

# Interactive configuration function
get_user_configuration() {
    log "HEADER" "🔧 CONFIGURATION SETUP"
    
    echo -e "${BLUE}Please provide the following configuration details:${NC}"
    echo -e "${YELLOW}💡 Press Enter to use default values shown in brackets${NC}"
    echo ""
    
    # Domain configuration
    echo -e "${CYAN}🌐 DOMAIN CONFIGURATION${NC}"
    echo "Your server's public IP: ${GREEN}$PUBLIC_IP${NC}"
    prompt_input "Enter your domain name (or use IP)" DOMAIN "$PUBLIC_IP" "validate_domain"
    
    # SSL Email
    echo ""
    echo -e "${CYAN}🔒 SSL CONFIGURATION${NC}"
    prompt_input "Enter email for SSL certificates" SSL_EMAIL "admin@$DOMAIN" "validate_email"
    
    # Application Port
    echo ""
    echo -e "${CYAN}🚪 APPLICATION SETTINGS${NC}"
    prompt_input "Enter application port" APP_PORT "3001" "validate_port"
    
    # Node.js Version
    prompt_input "Enter Node.js version" NODE_VERSION "18"
    
    # Swap Size
    prompt_input "Enter swap file size (e.g., 2G, 4G)" SWAP_SIZE "2G"
    
    # Database Configuration
    echo ""
    echo -e "${CYAN}🗄️  DATABASE CONFIGURATION${NC}"
    echo -e "${YELLOW}📝 You can get these from your Supabase dashboard${NC}"
    
    prompt_input "Enter Supabase URL" SUPABASE_URL "https://your-project.supabase.co" "validate_url"
    prompt_input "Enter Supabase Anonymous Key" SUPABASE_ANON_KEY "your-supabase-anon-key-here" "" "true"
    
    echo ""
    log "SUCCESS" "Configuration collected successfully"
}

# Progress tracking
update_progress() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    local step_name="$1"
    local percentage=$((CURRENT_STEP * 100 / TOTAL_STEPS))
    
    echo "$CURRENT_STEP/$TOTAL_STEPS - $step_name - ${percentage}%" > "$PROGRESS_FILE"
    log "STEP" "($percentage%) $step_name"
}

# Enhanced error handler
error_exit() {
    local error_message="$1"
    local line_number="${2:-unknown}"
    local exit_code="${3:-1}"
    
    log "ERROR" "Script failed at line $line_number: $error_message"
    log "ERROR" "Exit code: $exit_code"
    log "ERROR" "Check the full log at: $LOG_FILE"
    
    echo ""
    echo -e "${RED}❌ SETUP FAILED!${NC}"
    echo -e "${RED}Error: $error_message${NC}"
    echo -e "${YELLOW}📄 Full log available at: $LOG_FILE${NC}"
    echo ""
    echo -e "${YELLOW}🔍 Last 15 log entries:${NC}"
    echo -e "${CYAN}===========================================${NC}"
    tail -15 "$LOG_FILE" | while read line; do
        if [[ "$line" =~ ERROR ]]; then
            echo -e "${RED}$line${NC}"
        elif [[ "$line" =~ WARNING ]]; then
            echo -e "${YELLOW}$line${NC}"
        elif [[ "$line" =~ SUCCESS ]]; then
            echo -e "${GREEN}$line${NC}"
        else
            echo -e "${WHITE}$line${NC}"
        fi
    done
    echo -e "${CYAN}===========================================${NC}"
    
    echo ""
    echo -e "${YELLOW}🆘 Common solutions:${NC}"
    echo -e "  • Check internet connection: ${CYAN}ping google.com${NC}"
    echo -e "  • Retry installation: ${CYAN}sudo ./vps-setup.sh${NC}"
    echo -e "  • Check system resources: ${CYAN}free -h && df -h${NC}"
    echo -e "  • View full log: ${CYAN}less $LOG_FILE${NC}"
    
    # Copy log to permanent location if possible
    if [[ -d "/var/log" ]]; then
        cp "$LOG_FILE" "/var/log/padoo-setup-failed.log" 2>/dev/null || true
        echo -e "  • Failed log saved to: ${CYAN}/var/log/padoo-setup-failed.log${NC}"
    fi
    
    exit $exit_code
}

# Trap errors with line numbers
trap 'error_exit "Unexpected error occurred" $LINENO $?' ERR

# Function to retry operations
retry_operation() {
    local max_attempts="$1"
    local delay="$2"
    local description="$3"
    shift 3
    local command=("$@")
    
    local attempt=1
    while [[ $attempt -le $max_attempts ]]; do
        log "INFO" "Attempt $attempt/$max_attempts: $description"
        
        if "${command[@]}" >> "$LOG_FILE" 2>&1; then
            log "SUCCESS" "$description completed successfully"
            return 0
        else
            local exit_code=$?
            log "WARNING" "Attempt $attempt failed (exit code: $exit_code)"
            
            if [[ $attempt -lt $max_attempts ]]; then
                log "INFO" "Retrying in $delay seconds..."
                sleep "$delay"
            else
                log "ERROR" "$description failed after $max_attempts attempts"
                return $exit_code
            fi
        fi
        
        ((attempt++))
    done
}

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

# Generate secure password
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Wait with spinner
wait_with_spinner() {
    local pid=$1
    local message="$2"
    local spin='-\|/'
    local i=0
    
    echo -n "$message "
    while kill -0 $pid 2>/dev/null; do
        i=$(( (i+1) %4 ))
        printf "\r$message ${spin:$i:1}"
        sleep 0.1
    done
    printf "\r$message ✅\n"
}

# ===================================================================
# 🔍 SYSTEM VALIDATION FUNCTIONS
# ===================================================================

validate_system() {
    update_progress "Validating System Requirements"
    
    log "INFO" "Checking system requirements..."
    
    # Check OS
    if ! grep -q "Ubuntu" /etc/os-release; then
        log "WARNING" "This script is optimized for Ubuntu. Proceeding anyway..."
    fi
    
    # Check disk space (need at least 2GB)
    local available_space=$(df / | tail -1 | awk '{print $4}')
    if [[ $available_space -lt 2097152 ]]; then  # 2GB in KB
        log "ERROR" "Insufficient disk space. Need at least 2GB free."
        exit 1
    fi
    
    # Check memory (warn if less than 1GB)
    local total_mem=$(free -m | awk 'NR==2{print $2}')
    if [[ $total_mem -lt 1024 ]]; then
        log "WARNING" "Low memory detected ($total_mem MB). Consider upgrading for better performance."
    fi
    
    log "SUCCESS" "System validation completed"
}

# ===================================================================
# 🔧 INSTALLATION FUNCTIONS
# ===================================================================

setup_system_dependencies() {
    update_progress "Installing System Dependencies"
    
    log "INFO" "Updating package lists..."
    retry_operation 3 5 "Package list update" apt update -qq
    
    log "INFO" "Upgrading existing packages..."
    retry_operation 3 10 "System upgrade" apt upgrade -y -qq
    
    log "INFO" "Installing essential packages..."
    
    # Split package installation into groups for better error handling
    local essential_packages=(
        "curl" "wget" "git" "unzip" "vim" "nano" 
        "htop" "tree" "jq" "bc" "dnsutils" "net-tools"
    )
    
    local system_packages=(
        "software-properties-common" "build-essential" 
        "python3-pip" "logrotate"
    )
    
    local security_packages=(
        "ufw" "fail2ban"
    )
    
    local web_packages=(
        "nginx" "certbot" "python3-certbot-nginx"
    )
    
    local database_packages=(
        "postgresql-client" "redis-tools"
    )
    
    # Install each group separately with retry logic
    for package_group in "essential_packages" "system_packages" "security_packages" "web_packages" "database_packages"; do
        local -n packages=$package_group
        local group_name=$(echo "$package_group" | sed 's/_/ /g' | sed 's/packages//')
        
        log "INFO" "Installing $group_name packages: ${packages[*]}"
        
        if ! retry_operation 3 5 "Installing $group_name packages" apt install -y -qq "${packages[@]}"; then
            log "WARNING" "Failed to install some $group_name packages, trying individually..."
            
            # Try installing each package individually
            for package in "${packages[@]}"; do
                if ! retry_operation 2 3 "Installing $package" apt install -y -qq "$package"; then
                    log "ERROR" "Failed to install $package. This may cause issues later."
                fi
            done
        fi
    done
    
    log "SUCCESS" "System dependencies installation completed"
}

setup_swap() {
    update_progress "Configuring Swap Memory"
    
    local current_swap=$(free | grep Swap | awk '{print $2}')
    if [[ $current_swap -eq 0 ]]; then
        log "INFO" "Creating ${SWAP_SIZE} swap file..."
        {
            fallocate -l "$SWAP_SIZE" /swapfile
            chmod 600 /swapfile
            mkswap /swapfile
            swapon /swapfile
            echo '/swapfile none swap sw 0 0' >> /etc/fstab
        } >> "$LOG_FILE" 2>&1
        log "SUCCESS" "Swap file created and activated"
    else
        log "INFO" "Swap already configured ($(echo "scale=1; $current_swap/1024/1024" | bc)GB)"
    fi
}

install_nodejs() {
    update_progress "Installing Node.js ${NODE_VERSION}.x"
    
    if command_exists node; then
        local current_version=$(node --version | sed 's/v//' | cut -d. -f1)
        if [[ "$current_version" -ge "$NODE_VERSION" ]]; then
            log "SUCCESS" "Node.js already installed: $(node --version)"
            
            # Still install global packages if missing
            if ! command_exists pm2; then
                log "INFO" "Installing missing global packages..."
                retry_operation 3 5 "Installing global npm packages" npm install -g pm2@latest nodemon@latest
            fi
            return 0
        fi
    fi
    
    log "INFO" "Installing Node.js ${NODE_VERSION}.x repository..."
    
    # Download and install NodeSource repository with retry
    if ! retry_operation 3 5 "Adding NodeSource repository" curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" -o "/tmp/nodesource_setup.sh"; then
        error_exit "Failed to download NodeSource setup script" $LINENO
    fi
    
    if ! retry_operation 2 3 "Setting up NodeSource repository" bash "/tmp/nodesource_setup.sh"; then
        error_exit "Failed to setup NodeSource repository" $LINENO
    fi
    
    log "INFO" "Installing Node.js package..."
    if ! retry_operation 3 5 "Installing Node.js" apt-get install -y nodejs; then
        error_exit "Failed to install Node.js" $LINENO
    fi
    
    # Verify installation
    if ! command_exists node || ! command_exists npm; then
        error_exit "Node.js installation verification failed" $LINENO
    fi
    
    local installed_version=$(node --version)
    local npm_version=$(npm --version)
    log "SUCCESS" "Node.js $installed_version and npm $npm_version installed"
    
    log "INFO" "Installing global npm packages..."
    
    # Configure npm for better performance and reliability
    npm config set registry https://registry.npmjs.org/
    npm config set timeout 300000  # 5 minutes timeout
    npm config set retries 3
    
    # Install global packages with retry
    local global_packages=("pm2@latest" "nodemon@latest")
    
    for package in "${global_packages[@]}"; do
        log "INFO" "Installing global package: $package"
        if ! retry_operation 3 10 "Installing $package" npm install -g "$package"; then
            log "ERROR" "Failed to install $package globally"
        fi
    done
    
    # Verify PM2 installation
    if ! command_exists pm2; then
        error_exit "PM2 installation failed" $LINENO
    fi
    
    log "SUCCESS" "All Node.js components installed successfully"
}

setup_pm2() {
    update_progress "Configuring PM2 Process Manager"
    
    log "INFO" "Setting up PM2 startup script..."
    {
        pm2 startup systemd -u "$USER" --hp "/home/$USER" --silent
    } >> "$LOG_FILE" 2>&1
    
    log "SUCCESS" "PM2 configured for automatic startup"
}

configure_firewall() {
    update_progress "Configuring Firewall & Security"
    
    log "INFO" "Setting up UFW firewall..."
    {
        ufw --force enable
        ufw allow ssh
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw allow "$APP_PORT/tcp"
    } >> "$LOG_FILE" 2>&1
    
    log "INFO" "Configuring Fail2Ban..."
    {
        systemctl enable fail2ban
        systemctl start fail2ban
        
        cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled = true
port = 22
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 2

[nginx-req-limit]
enabled = true
filter = nginx-req-limit
logpath = /var/log/nginx/error.log
maxretry = 10
EOF
        
        systemctl restart fail2ban
    } >> "$LOG_FILE" 2>&1
    
    log "SUCCESS" "Security configuration completed"
}

# ===================================================================
# 🌐 APPLICATION SETUP FUNCTIONS
# ===================================================================

setup_application() {
    update_progress "Setting Up Application Directory"
    
    log "INFO" "Creating application directory..."
    mkdir -p "$APP_DIR"
    
    # Copy files from current directory (where script is run)
    local script_dir=$(pwd)
    log "INFO" "Copying application files from $script_dir to $APP_DIR..."
    
    {
        cp -r "$script_dir"/* "$APP_DIR/"
        chown -R "$USER:$USER" "$APP_DIR"
        
        # Create logs directory
        mkdir -p /var/log/padoo-delivery
        chown -R "$USER:$USER" /var/log/padoo-delivery
    } >> "$LOG_FILE" 2>&1
    
    log "SUCCESS" "Application directory created and files copied"
}

create_environment_file() {
    update_progress "Creating Environment Configuration"
    
    log "INFO" "Generating secure environment configuration..."
    
    local jwt_secret=$(generate_password)
    local session_secret=$(generate_password)
    local encryption_key=$(generate_password)
    
    cat > "$APP_DIR/.env" << EOF
# Application Configuration
PORT=$APP_PORT
NODE_ENV=production
HOST=0.0.0.0
DOMAIN=$DOMAIN

# Supabase Configuration
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

# Security Secrets
JWT_SECRET=$jwt_secret
SESSION_SECRET=$session_secret
ENCRYPTION_KEY=$encryption_key

# Application Settings
APP_NAME=Padoo Delivery
APP_VERSION=1.0.0

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=/var/log/padoo-delivery/app.log

# Performance Settings
NODE_OPTIONS="--max-old-space-size=512"

# Email Configuration
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=$SSL_EMAIL

# Monitoring
HEALTH_CHECK_INTERVAL=30000
SETUP_COMPLETED=$(date '+%Y-%m-%d %H:%M:%S')
EOF
    
    chmod 600 "$APP_DIR/.env"
    chown "$USER:$USER" "$APP_DIR/.env"
    
    log "SUCCESS" "Environment file created with secure configuration"
    log "INFO" "Generated secrets: JWT(${jwt_secret:0:8}...), Session(${session_secret:0:8}...), Encryption(${encryption_key:0:8}...)"
}

install_dependencies() {
    update_progress "Installing Application Dependencies"
    
    cd "$APP_DIR"
    
    # Configure npm for this directory
    log "INFO" "Configuring npm settings..."
    npm config set audit-level moderate
    npm config set fund false
    npm config set update-notifier false
    
    log "INFO" "Checking for package.json..."
    if [[ -f "package.json" ]]; then
        log "SUCCESS" "Found existing package.json"
        
        # Validate package.json
        if ! jq empty package.json 2>/dev/null; then
            log "ERROR" "package.json is not valid JSON"
            error_exit "Invalid package.json file" $LINENO
        fi
        
        log "INFO" "Installing Node.js dependencies from package.json..."
        
        # Clean install with retry mechanism
        if [[ -d "node_modules" ]]; then
            log "INFO" "Removing existing node_modules..."
            rm -rf node_modules package-lock.json
        fi
        
        # Install dependencies with multiple retry attempts
        if ! retry_operation 3 10 "Installing npm dependencies" npm ci --production --no-audit --no-fund; then
            log "WARNING" "npm ci failed, trying npm install..."
            if ! retry_operation 3 10 "Installing npm dependencies (fallback)" npm install --production --no-audit --no-fund; then
                error_exit "Failed to install npm dependencies" $LINENO
            fi
        fi
        
    else
        log "WARNING" "package.json not found, creating default package.json..."
        
        # Create a comprehensive package.json
        cat > package.json << 'EOF'
{
  "name": "padoo-delivery-app",
  "version": "1.0.0",
  "description": "A modern delivery tracking application",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "pm2:start": "pm2 start ecosystem.config.js",
    "pm2:stop": "pm2 stop padoo-delivery",
    "pm2:restart": "pm2 restart padoo-delivery",
    "pm2:logs": "pm2 logs padoo-delivery"
  },
  "keywords": [
    "delivery",
    "tracking",
    "logistics",
    "express",
    "supabase"
  ],
  "author": "Padoo Delivery Team",
  "license": "MIT",
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "bcryptjs": "^3.0.2",
    "body-parser": "^1.20.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "pg": "^8.16.0",
    "uuid": "^11.1.0",
    "ws": "^8.14.2"
  },
  "engines": {
    "node": ">=16.0.0",
    "npm": ">=8.0.0"
  }
}
EOF
        
        log "INFO" "Installing default dependencies..."
        if ! retry_operation 3 10 "Installing default npm dependencies" npm install --production --no-audit --no-fund; then
            error_exit "Failed to install default dependencies" $LINENO
        fi
    fi
    
    # Verify critical dependencies
    log "INFO" "Verifying critical dependencies..."
    local critical_packages=("express" "dotenv" "@supabase/supabase-js")
    
    for package in "${critical_packages[@]}"; do
        if ! npm list "$package" --depth=0 >/dev/null 2>&1; then
            log "WARNING" "Critical package $package not found, installing..."
            if ! retry_operation 2 5 "Installing critical package $package" npm install "$package" --save --no-audit --no-fund; then
                log "ERROR" "Failed to install critical package: $package"
            fi
        else
            log "SUCCESS" "Verified: $package"
        fi
    done
    
    # Check for vulnerabilities
    log "INFO" "Checking for security vulnerabilities..."
    if npm audit --audit-level high 2>/dev/null; then
        log "SUCCESS" "No high-severity vulnerabilities found"
    else
        log "WARNING" "Some vulnerabilities detected. Run 'npm audit fix' if needed."
    fi
    
    # Display installation summary
    local package_count=$(npm list --depth=0 --json 2>/dev/null | jq '.dependencies | length' 2>/dev/null || echo "unknown")
    log "SUCCESS" "Dependencies installation completed ($package_count packages installed)"
}

# ===================================================================
# 🌐 NGINX & SSL SETUP
# ===================================================================

configure_nginx() {
    update_progress "Configuring Nginx Web Server"
    
    log "INFO" "Creating optimized Nginx configuration..."
    
    cat > "/etc/nginx/sites-available/$APP_NAME" << EOF
# Rate limiting zones
limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone \$binary_remote_addr zone=login:10m rate=5r/s;

# Upstream for load balancing (future)
upstream padoo_app {
    server localhost:$APP_PORT;
    keepalive 64;
}

server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    
    # Hide server info
    server_tokens off;
    
    # Client settings
    client_max_body_size 10M;
    client_body_timeout 30s;
    client_header_timeout 30s;
    
    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain text/css text/xml text/javascript
        application/javascript application/xml+rss application/json
        application/xml image/svg+xml;
    
    # Static files caching
    location ~* \.(jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root $APP_DIR;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    location ~* \.(css|js)$ {
        root $APP_DIR;
        expires 30d;
        add_header Cache-Control "public";
    }
    
    # Special files
    location = /manifest.json {
        root $APP_DIR;
        expires 1d;
        add_header Cache-Control "public";
    }
    
    location = /sw.js {
        root $APP_DIR;
        expires 0;
        add_header Cache-Control "no-cache";
    }
    
    # API with rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://padoo_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Login with rate limiting
    location /login {
        limit_req zone=login burst=10 nodelay;
        proxy_pass http://padoo_app;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Main application proxy
    location / {
        proxy_pass http://padoo_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Health check
    location /health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }
    
    # Security: Block sensitive files
    location ~ /\\. {
        deny all;
        access_log off;
    }
    
    location ~ \\.(env|log|sql)$ {
        deny all;
        access_log off;
    }
}
EOF
    
    # Enable site and test configuration
    {
        ln -sf "/etc/nginx/sites-available/$APP_NAME" "/etc/nginx/sites-enabled/"
        rm -f /etc/nginx/sites-enabled/default
        nginx -t
        systemctl restart nginx
        systemctl enable nginx
    } >> "$LOG_FILE" 2>&1
    
    log "SUCCESS" "Nginx configured and started"
}

setup_ssl() {
    update_progress "Setting Up SSL Certificates"
    
    # Check if domain is IP address
    if [[ $DOMAIN =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        log "INFO" "Domain is IP address, creating self-signed certificate..."
        {
            mkdir -p /etc/ssl/private
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout /etc/ssl/private/padoo-selfsigned.key \
                -out /etc/ssl/certs/padoo-selfsigned.crt \
                -subj "/C=US/ST=State/L=City/O=Padoo/CN=$DOMAIN" 2>/dev/null
            
            # Update Nginx config for SSL
            sed -i '/listen 80;/a\    listen 443 ssl http2;' "/etc/nginx/sites-available/$APP_NAME"
            sed -i '/listen 443 ssl http2;/a\    ssl_certificate /etc/ssl/certs/padoo-selfsigned.crt;' "/etc/nginx/sites-available/$APP_NAME"
            sed -i '/ssl_certificate \/etc\/ssl\/certs/a\    ssl_certificate_key /etc/ssl/private/padoo-selfsigned.key;' "/etc/nginx/sites-available/$APP_NAME"
            sed -i '/ssl_certificate_key/a\    ssl_protocols TLSv1.2 TLSv1.3;' "/etc/nginx/sites-available/$APP_NAME"
            
            nginx -t && systemctl reload nginx
        } >> "$LOG_FILE" 2>&1
        log "SUCCESS" "Self-signed SSL certificate created"
        
    elif [[ "$DOMAIN" != "localhost" ]] && [[ "$SSL_EMAIL" != "admin@localhost" ]]; then
        log "INFO" "Attempting to get Let's Encrypt certificate for $DOMAIN..."
        
        # Check if domain resolves to this server
        local domain_ip=$(dig +short "$DOMAIN" 2>/dev/null | tail -n1)
        if [[ "$domain_ip" == "$PUBLIC_IP" ]]; then
            {
                certbot --nginx -d "$DOMAIN" --email "$SSL_EMAIL" \
                    --agree-tos --non-interactive --redirect
                systemctl enable certbot.timer
            } >> "$LOG_FILE" 2>&1
            log "SUCCESS" "Let's Encrypt SSL certificate installed"
        else
            log "WARNING" "Domain $DOMAIN doesn't point to this server ($PUBLIC_IP). SSL skipped."
            log "INFO" "Update DNS and run: certbot --nginx -d $DOMAIN --email $SSL_EMAIL"
        fi
    else
        log "INFO" "SSL setup skipped (localhost or invalid domain)"
    fi
}

# ===================================================================
# 📊 MONITORING & PM2 SETUP
# ===================================================================

setup_pm2_application() {
    update_progress "Configuring Application with PM2"
    
    cd "$APP_DIR"
    
    log "INFO" "Creating PM2 ecosystem configuration..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '$APP_NAME',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: $APP_PORT
    },
    error_file: '/var/log/padoo-delivery/error.log',
    out_file: '/var/log/padoo-delivery/out.log',
    log_file: '/var/log/padoo-delivery/combined.log',
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '1G',
    watch: false,
    ignore_watch: ['node_modules', 'logs', '.git'],
    env_production: {
      NODE_ENV: 'production',
      PORT: $APP_PORT
    }
  }]
};
EOF

    log "INFO" "Starting application with PM2..."
    {
        pm2 delete "$APP_NAME" 2>/dev/null || true
        pm2 start ecosystem.config.js --env production
pm2 save
    } >> "$LOG_FILE" 2>&1
    
    # Wait for app to start
    sleep 5
    
    # Check if app is running
    if pm2 list | grep -q "$APP_NAME.*online"; then
        log "SUCCESS" "Application started successfully with PM2"
    else
        log "ERROR" "Application failed to start"
        pm2 logs "$APP_NAME" --lines 10 >> "$LOG_FILE"
        return 1
    fi
}

setup_monitoring() {
    update_progress "Setting Up Monitoring & Health Checks"
    
    cd "$APP_DIR"
    
    log "INFO" "Creating comprehensive monitoring system..."
    
    # Health check script
cat > health-check.sh << 'EOF'
#!/bin/bash
APP_NAME="padoo-delivery"
APP_PORT=3001
LOG_FILE="/var/log/padoo-delivery/health.log"
MAX_MEMORY_MB=800

log_health() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}
    
check_pm2() {
    if ! pm2 list | grep -q "$APP_NAME.*online"; then
        log_health "ERROR" "PM2 process offline, restarting..."
        pm2 restart "$APP_NAME"
        return 1
    fi
    return 0
}

check_http() {
    local response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$APP_PORT/health" || echo "000")
    if [[ "$response" != "200" ]]; then
        log_health "ERROR" "HTTP health check failed (code: $response), restarting..."
        pm2 restart "$APP_NAME"
        return 1
    fi
    return 0
}

check_memory() {
    local memory_usage=$(pm2 show "$APP_NAME" 2>/dev/null | grep "memory usage" | awk '{print $4}' | sed 's/M//' || echo "0")
    if [[ -n "$memory_usage" ]] && [[ "$memory_usage" -gt "$MAX_MEMORY_MB" ]]; then
        log_health "WARN" "High memory usage: ${memory_usage}MB, restarting..."
        pm2 restart "$APP_NAME"
        return 1
    fi
    return 0
}

check_disk() {
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [[ "$disk_usage" -gt 90 ]]; then
        log_health "ERROR" "Critical disk usage: ${disk_usage}%"
        find /var/log -name "*.log" -mtime +7 -delete 2>/dev/null
        return 1
    fi
    return 0
}

main() {
    local errors=0
    check_pm2 || ((errors++))
    check_http || ((errors++))
    check_memory || ((errors++))
    check_disk || ((errors++))
    
    if [[ $errors -eq 0 ]]; then
        log_health "INFO" "All health checks passed"
    else
        log_health "WARN" "$errors check(s) failed"
    fi
}

main
EOF
    
    # System monitor script
    cat > system-monitor.sh << 'EOF'
#!/bin/bash
LOG_FILE="/var/log/padoo-delivery/system.log"

log_stats() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local cpu=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    local memory=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
    local disk=$(df / | tail -1 | awk '{print $5}')
    local load=$(uptime | awk -F'load average:' '{print $2}' | xargs)
    
    echo "[$timestamp] CPU: ${cpu}%, Memory: ${memory}%, Disk: ${disk}, Load: ${load}" >> "$LOG_FILE"
}

log_stats
EOF
    
    # Status dashboard script
    cat > status.sh << 'EOF'
#!/bin/bash

print_color() {
    echo -e "\033[${1}m${2}\033[0m"
}

print_color "36" "🚀 PADOO DELIVERY SYSTEM STATUS"
echo "================================================"

# Application Status
if pm2 list | grep -q "padoo-delivery.*online"; then
    print_color "32" "✅ Application: Running"
    pm2 show padoo-delivery | grep -E "(uptime|restarts|memory|cpu)"
else
    print_color "31" "❌ Application: Stopped"
fi

echo ""

# System Services
services=("nginx" "fail2ban" "ufw")
for service in "${services[@]}"; do
    if systemctl is-active --quiet "$service"; then
        print_color "32" "✅ $service: Active"
    else
        print_color "31" "❌ $service: Inactive"
    fi
done

echo ""
print_color "36" "📊 System Resources:"
echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
echo "Memory: $(free | grep Mem | awk '{printf "%.1f%%", $3/$2 * 100.0}')"
echo "Disk: $(df / | tail -1 | awk '{print $5}')"
echo "Load:$(uptime | awk -F'load average:' '{print $2}')"

echo ""
print_color "36" "📝 Recent Health Logs:"
if [[ -f "/var/log/padoo-delivery/health.log" ]]; then
    tail -5 /var/log/padoo-delivery/health.log
else
    echo "No health logs found"
fi

echo ""
print_color "33" "🔧 Quick Commands:"
echo "  pm2 logs padoo-delivery  - View app logs"
echo "  pm2 restart padoo-delivery - Restart app"
echo "  ./status.sh - Show this status"
EOF
    
    chmod +x health-check.sh system-monitor.sh status.sh
    
    # Setup log rotation
    cat > /etc/logrotate.d/padoo-delivery << EOF
/var/log/padoo-delivery/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 644 $USER $USER
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
    
    # Setup cron jobs
    log "INFO" "Setting up automated monitoring..."
    {
        # Remove existing cron jobs
        crontab -l 2>/dev/null | grep -v "/var/www/padoo-delivery" | crontab -
        
        # Add new cron jobs
        (crontab -l 2>/dev/null; cat << EOF
# Padoo Delivery Monitoring
*/5 * * * * $APP_DIR/health-check.sh
*/15 * * * * $APP_DIR/system-monitor.sh
0 2 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
0 3 * * * find /var/log/padoo-delivery -name "*.log" -mtime +7 -delete
EOF
        ) | crontab -
    } >> "$LOG_FILE" 2>&1
    
    log "SUCCESS" "Monitoring and health checks configured"
}

# ===================================================================
# 🎯 MAIN EXECUTION
# ===================================================================

show_banner() {
    clear
    echo -e "${CYAN}"
    cat << 'EOF'
    ╔═══════════════════════════════════════════════╗
    ║           🚀 PADOO DELIVERY SETUP             ║
    ║              Version 2.0                      ║
    ║                                               ║
    ║     Bulletproof VPS Setup with Logging       ║
    ╚═══════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

show_configuration() {
    log "HEADER" "📋 CONFIGURATION SUMMARY"
    
    echo -e "${BLUE}Please review your configuration before proceeding:${NC}"
    echo ""
    
    echo -e "${YELLOW}🖥️  System Information:${NC}"
    echo "  📍 Public IP: ${GREEN}$PUBLIC_IP${NC}"
    echo "  💻 OS: ${GREEN}$OS_INFO${NC}"
    echo "  👤 User: ${GREEN}$USER${NC}"
    echo ""
    
    echo -e "${YELLOW}🌐 Network Configuration:${NC}"
    echo "  🏠 Domain/IP: ${GREEN}$DOMAIN${NC}"
    echo "  📧 SSL Email: ${GREEN}$SSL_EMAIL${NC}"
    echo "  🚪 App Port: ${GREEN}$APP_PORT${NC}"
    echo ""
    
    echo -e "${YELLOW}⚙️  Application Settings:${NC}"
    echo "  📂 Install Directory: ${GREEN}$APP_DIR${NC}"
    echo "  📦 Node.js Version: ${GREEN}$NODE_VERSION.x${NC}"
    echo "  💾 Swap Size: ${GREEN}$SWAP_SIZE${NC}"
    echo ""
    
    echo -e "${YELLOW}🗄️  Database Configuration:${NC}"
    if [[ "$SUPABASE_URL" == "https://your-project.supabase.co" ]]; then
        echo "  🔗 Supabase URL: ${RED}$SUPABASE_URL (PLACEHOLDER - UPDATE LATER)${NC}"
    else
        echo "  🔗 Supabase URL: ${GREEN}${SUPABASE_URL:0:50}...${NC}"
    fi
    
    if [[ "$SUPABASE_ANON_KEY" == "your-supabase-anon-key-here" ]]; then
        echo "  🔑 Supabase Key: ${RED}$SUPABASE_ANON_KEY (PLACEHOLDER - UPDATE LATER)${NC}"
    else
        echo "  🔑 Supabase Key: ${GREEN}${SUPABASE_ANON_KEY:0:20}...${NC}"
    fi
    echo ""
    
    echo -e "${YELLOW}📄 Logging:${NC}"
    echo "  📋 Setup Log: ${CYAN}$LOG_FILE${NC}"
    echo "  📊 Progress File: ${CYAN}$PROGRESS_FILE${NC}"
    echo ""
    
    if [[ "$SUPABASE_URL" == "https://your-project.supabase.co" ]] || [[ "$SUPABASE_ANON_KEY" == "your-supabase-anon-key-here" ]]; then
        echo -e "${RED}⚠️  WARNING: You're using placeholder Supabase settings!${NC}"
        echo -e "${YELLOW}   The app will install but won't fully work until you update these.${NC}"
        echo -e "${YELLOW}   You can update them later in: $APP_DIR/.env${NC}"
        echo ""
    fi
}

run_final_tests() {
    log "HEADER" "🧪 RUNNING FINAL TESTS"
    
    # Test application
    log "INFO" "Testing application health..."
    sleep 10  # Give app time to fully start
    
    local health_response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$APP_PORT/health" || echo "000")
    if [[ "$health_response" == "200" ]]; then
        log "SUCCESS" "Application health check passed"
    else
        log "WARNING" "Application health check failed (HTTP $health_response)"
    fi
    
    # Test Nginx
    log "INFO" "Testing Nginx configuration..."
    if nginx -t &>/dev/null; then
        log "SUCCESS" "Nginx configuration is valid"
    else
        log "ERROR" "Nginx configuration has errors"
    fi
    
    # Test PM2
    log "INFO" "Testing PM2 status..."
    if pm2 list | grep -q "$APP_NAME.*online"; then
        log "SUCCESS" "PM2 application is running"
    else
        log "ERROR" "PM2 application is not running"
    fi
    
    # Test services
    local services=("nginx" "fail2ban")
    for service in "${services[@]}"; do
        if systemctl is-active --quiet "$service"; then
            log "SUCCESS" "$service is active"
        else
            log "WARNING" "$service is not active"
        fi
    done
}

show_completion_summary() {
    local setup_duration=$(($(date +%s) - $(date -d "$SCRIPT_START_TIME" +%s)))
    
    log "HEADER" "🎉 SETUP COMPLETED SUCCESSFULLY!"
    
    echo -e "${GREEN}✅ Installation completed in ${setup_duration} seconds!${NC}"
    echo ""
    
    # Show access URLs
    echo -e "${CYAN}🌐 Your Application URLs:${NC}"
    if [[ $DOMAIN =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo -e "  🏠 Main Site: ${WHITE}http://$DOMAIN${NC}"
        echo -e "  🔒 HTTPS: ${WHITE}https://$DOMAIN${NC} ${YELLOW}(self-signed)${NC}"
    else
        echo -e "  🏠 Main Site: ${WHITE}http://$DOMAIN${NC}"
        if grep -q "ssl_certificate" "/etc/nginx/sites-available/$APP_NAME" 2>/dev/null; then
            echo -e "  🔒 HTTPS: ${WHITE}https://$DOMAIN${NC} ${GREEN}(SSL enabled)${NC}"
        fi
    fi
    echo -e "  🚚 Driver App: ${WHITE}http://$DOMAIN/mainapp${NC}"
    echo -e "  🏪 Shop Portal: ${WHITE}http://$DOMAIN/mainapp/shop${NC}"
    echo -e "  📊 Dashboard: ${WHITE}http://$DOMAIN/dashboard${NC}"
    echo ""
    
    # Show management commands
    echo -e "${CYAN}📊 Management Commands:${NC}"
    echo -e "  ${YELLOW}./status.sh${NC}                 - System status dashboard"
    echo -e "  ${YELLOW}pm2 status${NC}                  - Application status"
    echo -e "  ${YELLOW}pm2 logs padoo-delivery${NC}     - View logs"
    echo -e "  ${YELLOW}pm2 restart padoo-delivery${NC}  - Restart app"
    echo ""
    
    # Show important files
    echo -e "${CYAN}📁 Important Files:${NC}"
    echo -e "  ${YELLOW}Setup Log:${NC} $LOG_FILE"
    echo -e "  ${YELLOW}App Config:${NC} $APP_DIR/.env"
    echo -e "  ${YELLOW}Nginx Config:${NC} /etc/nginx/sites-available/$APP_NAME"
    echo -e "  ${YELLOW}Health Logs:${NC} /var/log/padoo-delivery/"
    echo ""
    
    # Show next steps
    echo -e "${CYAN}📝 Next Steps:${NC}"
    if [[ "$SUPABASE_URL" == "https://your-project.supabase.co" ]]; then
        echo -e "  ${RED}1. UPDATE SUPABASE CONFIG:${NC} Edit $APP_DIR/.env"
        echo -e "     Then run: ${YELLOW}pm2 restart padoo-delivery${NC}"
    fi
    echo -e "  ${GREEN}2. Visit your application:${NC} http://$DOMAIN"
    echo -e "  ${GREEN}3. Create admin account:${NC} http://$DOMAIN/dashboard"
    echo -e "  ${GREEN}4. Check system status:${NC} ./status.sh"
    echo ""
    
    echo -e "${PURPLE}🎊 Enjoy your Padoo Delivery platform!${NC}"
    echo -e "${PURPLE}📞 For support, check the logs at: $LOG_FILE${NC}"
}

# ===================================================================
# 🚀 MAIN EXECUTION FLOW
# ===================================================================

main() {
    # Initialize
    show_banner
    check_privileges
    init_logging
    
    log "INFO" "Starting Padoo Delivery VPS Setup v$SCRIPT_VERSION"
    log "INFO" "Started at: $SCRIPT_START_TIME"
    
    # Get user configuration interactively
    get_user_configuration
    
    # Show final configuration summary
    show_configuration
    
    # Final confirmation
    echo ""
    echo -e "${YELLOW}⚠️  This will install and configure Padoo Delivery on this VPS.${NC}"
    echo -e "${YELLOW}📋 Total steps: $TOTAL_STEPS${NC}"
    echo -e "${YELLOW}⏱️  Estimated time: 10-15 minutes${NC}"
    echo ""
    echo -e "${CYAN}The following will be installed:${NC}"
    echo -e "  • Node.js $NODE_VERSION.x with npm"
    echo -e "  • PM2 process manager"
    echo -e "  • Nginx web server"
    echo -e "  • SSL certificates"
    echo -e "  • Security tools (UFW, Fail2Ban)"
    echo -e "  • Health monitoring system"
    echo ""
    
    while true; do
        read -p "Continue with installation? (y/N): " -n 1 -r
        echo ""
        case $REPLY in
            [Yy]* ) 
                break
                ;;
            [Nn]* | "" ) 
                log "INFO" "Installation cancelled by user"
                echo -e "${YELLOW}Installation cancelled. You can run this script again anytime.${NC}"
                exit 0
                ;;
            * ) 
                echo -e "${RED}Please answer y (yes) or n (no).${NC}"
                ;;
        esac
    done
    
    log "HEADER" "🚀 STARTING INSTALLATION"
    log "INFO" "Using configuration: Domain=$DOMAIN, Port=$APP_PORT, Node.js=$NODE_VERSION"
    
    # Execute all setup steps with enhanced error handling
    set +e  # Temporarily disable exit on error for individual step handling
    
    local failed_steps=()
    
    # Execute each step and track failures
    execute_step() {
        local step_name="$1"
        local step_function="$2"
        
        log "INFO" "Executing: $step_name"
        if $step_function; then
            log "SUCCESS" "Completed: $step_name"
            return 0
        else
            log "ERROR" "Failed: $step_name"
            failed_steps+=("$step_name")
            return 1
        fi
    }
    
    # Execute all setup steps
    execute_step "System Validation" validate_system
    execute_step "System Dependencies" setup_system_dependencies
    execute_step "Swap Configuration" setup_swap
    execute_step "Node.js Installation" install_nodejs
    execute_step "PM2 Setup" setup_pm2
    execute_step "Firewall Configuration" configure_firewall
    execute_step "Application Setup" setup_application
    execute_step "Environment Configuration" create_environment_file
    execute_step "Dependencies Installation" install_dependencies
    execute_step "Nginx Configuration" configure_nginx
    execute_step "SSL Setup" setup_ssl
    execute_step "PM2 Application Setup" setup_pm2_application
    execute_step "Monitoring Setup" setup_monitoring
    
    set -e  # Re-enable exit on error
    
    # Check for failed steps
    if [[ ${#failed_steps[@]} -gt 0 ]]; then
        log "WARNING" "Some steps failed: ${failed_steps[*]}"
        echo ""
        echo -e "${YELLOW}⚠️  Installation completed with warnings.${NC}"
        echo -e "${YELLOW}Failed steps: ${failed_steps[*]}${NC}"
        echo -e "${YELLOW}Check the logs for details: $LOG_FILE${NC}"
        echo ""
    fi
    
    # Final tests and summary
    run_final_tests
    show_completion_summary
    
    log "SUCCESS" "Setup completed at $(date '+%Y-%m-%d %H:%M:%S')"
    
    # Copy log to permanent location
    mkdir -p /var/log/padoo-delivery 2>/dev/null || true
    if cp "$LOG_FILE" /var/log/padoo-delivery/setup.log 2>/dev/null; then
        chown "$USER:$USER" /var/log/padoo-delivery/setup.log 2>/dev/null || true
        echo -e "${GREEN}📄 Setup log saved to: /var/log/padoo-delivery/setup.log${NC}"
    else
        echo -e "${YELLOW}📄 Setup log available at: $LOG_FILE${NC}"
    fi
}

# Run main function
main "$@" 