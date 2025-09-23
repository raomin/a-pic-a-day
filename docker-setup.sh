#!/bin/bash

# A Pic a Day Bot - Docker Setup Script
# This script helps set up the Docker environment for the bot

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}===================================================${NC}"
    echo -e "${BLUE}  A Pic a Day Bot - Docker Setup${NC}"
    echo -e "${BLUE}===================================================${NC}"
}

print_step() {
    echo -e "${GREEN}[STEP]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        echo "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        echo "Visit: https://docs.docker.com/compose/install/"
        exit 1
    fi
}

# Create data directories
create_directories() {
    print_step "Creating data directories..."
    mkdir -p data/{database,logs,auth}
    echo "✓ Created data/database"
    echo "✓ Created data/logs" 
    echo "✓ Created data/auth"
}

# Setup environment file
setup_env() {
    print_step "Setting up environment configuration..."
    
    if [ ! -f "data/.env" ]; then
        cp .env.example data/.env
        echo "✓ Created data/.env from template"
        print_warning "Please edit data/.env with your configuration before starting the bot!"
        echo "  Required: TARGET_GROUP_ID, BOT_ADMIN_PHONE, TIMEZONE"
    else
        echo "✓ Environment file already exists"
    fi
}

# Set proper permissions
set_permissions() {
    print_step "Setting proper permissions..."
    chmod -R 755 data/
    echo "✓ Set permissions for data directories"
}

# Main setup function
main() {
    print_header
    
    check_docker
    create_directories
    setup_env
    set_permissions
    
    echo
    echo -e "${GREEN}🎉 Docker setup completed successfully!${NC}"
    echo
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Edit data/.env with your bot configuration"
    echo "2. Run: docker-compose up -d"
    echo "3. Check logs: docker-compose logs -f"
    echo "4. Stop bot: docker-compose down"
    echo
    echo -e "${YELLOW}Note: You'll need to scan the QR code when the bot starts for the first time.${NC}"
}

# Run main function
main "$@"