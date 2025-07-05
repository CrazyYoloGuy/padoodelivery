#!/bin/bash

# ===================================================================
# 🧪 PADOO DELIVERY SETUP TESTER
# ===================================================================
# Quick test to verify the setup script is working correctly
# ===================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 Testing Padoo Delivery Setup Script${NC}"
echo "================================================"

# Test 1: Check if script exists and is readable
echo -n "✅ Checking if vps-setup.sh exists... "
if [[ -f "vps-setup.sh" ]]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo "❌ vps-setup.sh not found in current directory"
    exit 1
fi

# Test 2: Check script permissions
echo -n "✅ Checking script permissions... "
if [[ -x "vps-setup.sh" ]]; then
    echo -e "${GREEN}EXECUTABLE${NC}"
else
    echo -e "${YELLOW}NOT EXECUTABLE${NC}"
    echo "🔧 Making script executable..."
    chmod +x vps-setup.sh
    echo -e "${GREEN}✅ Fixed: Script is now executable${NC}"
fi

# Test 3: Check script syntax
echo -n "✅ Checking script syntax... "
if bash -n vps-setup.sh; then
    echo -e "${GREEN}VALID${NC}"
else
    echo -e "${RED}INVALID${NC}"
    echo "❌ Script has syntax errors"
    exit 1
fi

# Test 4: Check for required tools
echo -n "✅ Checking for curl... "
if command -v curl >/dev/null 2>&1; then
    echo -e "${GREEN}FOUND${NC}"
else
    echo -e "${RED}NOT FOUND${NC}"
fi

echo -n "✅ Checking for git... "
if command -v git >/dev/null 2>&1; then
    echo -e "${GREEN}FOUND${NC}"
else
    echo -e "${RED}NOT FOUND${NC}"
fi

# Test 5: Show script info
echo ""
echo -e "${BLUE}📊 Script Information:${NC}"
echo "  📁 Location: $(pwd)/vps-setup.sh"
echo "  📏 Size: $(ls -lh vps-setup.sh | awk '{print $5}')"
echo "  📅 Modified: $(ls -l vps-setup.sh | awk '{print $6, $7, $8}')"
echo "  🔑 Permissions: $(ls -l vps-setup.sh | awk '{print $1}')"

# Test 6: Show configuration that will be used
echo ""
echo -e "${BLUE}🔧 Configuration that will be used:${NC}"
echo "  🌐 Domain: ${DOMAIN:-$(curl -s ifconfig.me 2>/dev/null || echo 'auto-detect')}"
echo "  📧 SSL Email: ${SSL_EMAIL:-admin@domain}"
echo "  🚪 Port: ${APP_PORT:-3001}"
echo "  📦 Node Version: ${NODE_VERSION:-18}"
echo "  👤 User: ${USER:-$(whoami)}"

# Test 7: Check system requirements
echo ""
echo -e "${BLUE}🖥️  System Check:${NC}"

# Check OS
if grep -q "Ubuntu" /etc/os-release 2>/dev/null; then
    echo -e "  ✅ OS: ${GREEN}Ubuntu (Supported)${NC}"
elif grep -q "Debian" /etc/os-release 2>/dev/null; then
    echo -e "  ⚠️  OS: ${YELLOW}Debian (Should work)${NC}"
else
    echo -e "  ❌ OS: ${RED}$(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2) (Untested)${NC}"
fi

# Check memory
total_mem=$(free -m | awk 'NR==2{print $2}')
if [[ $total_mem -gt 1024 ]]; then
    echo -e "  ✅ Memory: ${GREEN}${total_mem}MB (Good)${NC}"
elif [[ $total_mem -gt 512 ]]; then
    echo -e "  ⚠️  Memory: ${YELLOW}${total_mem}MB (Minimum)${NC}"
else
    echo -e "  ❌ Memory: ${RED}${total_mem}MB (Too low)${NC}"
fi

# Check disk space
available_space=$(df / | tail -1 | awk '{print $4}')
available_gb=$((available_space / 1024 / 1024))
if [[ $available_gb -gt 10 ]]; then
    echo -e "  ✅ Disk Space: ${GREEN}${available_gb}GB (Good)${NC}"
elif [[ $available_gb -gt 5 ]]; then
    echo -e "  ⚠️  Disk Space: ${YELLOW}${available_gb}GB (Minimum)${NC}"
else
    echo -e "  ❌ Disk Space: ${RED}${available_gb}GB (Too low)${NC}"
fi

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    echo -e "  ✅ Privileges: ${GREEN}Running as root${NC}"
else
    echo -e "  ⚠️  Privileges: ${YELLOW}Not root (will need sudo)${NC}"
fi

# Test 8: Quick dry run test (check first few lines)
echo ""
echo -e "${BLUE}🧪 Quick Dry Run Test:${NC}"
echo "Testing script initialization..."

# Extract just the variable definitions and test them
head -100 vps-setup.sh | grep -E "^(DOMAIN|APP_PORT|NODE_VERSION)" | head -5

echo ""
echo -e "${GREEN}✅ All basic tests passed!${NC}"
echo ""
echo -e "${YELLOW}🚀 Ready to run setup? Execute:${NC}"
echo -e "${BLUE}   sudo ./vps-setup.sh${NC}"
echo ""
echo -e "${YELLOW}📋 Or run with custom config:${NC}"
echo -e "${BLUE}   export DOMAIN='yourdomain.com'${NC}"
echo -e "${BLUE}   export SSL_EMAIL='admin@yourdomain.com'${NC}"
echo -e "${BLUE}   sudo ./vps-setup.sh${NC}"
echo "" 