#!/bin/bash

# ETH Vault Project Stop Script
set -e

echo "🛑 Stopping ETH Vault Project services..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Stop Docker services
stop_docker_services() {
    if command -v docker-compose &> /dev/null; then
        if [ -f "docker-compose.yml" ]; then
            print_status "Stopping Docker services..."
            docker-compose down
            print_status "Docker services stopped ✅"
        fi
    fi
}

# Stop manual services
stop_manual_services() {
    print_status "Stopping manual services..."
    
    # Stop Hardhat node
    if [ -f "hardhat.pid" ]; then
        HARDHAT_PID=$(cat hardhat.pid)
        if ps -p $HARDHAT_PID > /dev/null 2>&1; then
            kill $HARDHAT_PID
            print_status "Hardhat node stopped (PID: $HARDHAT_PID)"
        fi
        rm -f hardhat.pid
    fi
    
    # Stop frontend
    if [ -f "frontend.pid" ]; then
        FRONTEND_PID=$(cat frontend.pid)
        if ps -p $FRONTEND_PID > /dev/null 2>&1; then
            kill $FRONTEND_PID
            print_status "Frontend stopped (PID: $FRONTEND_PID)"
        fi
        rm -f frontend.pid
    fi
    
    # Stop exporter
    if [ -f "exporter.pid" ]; then
        EXPORTER_PID=$(cat exporter.pid)
        if ps -p $EXPORTER_PID > /dev/null 2>&1; then
            kill $EXPORTER_PID
            print_status "Exporter stopped (PID: $EXPORTER_PID)"
        fi
        rm -f exporter.pid
    fi
    
    # Kill any remaining processes
    pkill -f "hardhat node" || true
    pkill -f "vite" || true
    pkill -f "vault-metrics-exporter" || true
}

# Clean up log files
cleanup_logs() {
    print_status "Cleaning up log files..."
    rm -f hardhat.log frontend.log exporter.log
    print_status "Log files cleaned ✅"
}

# Main execution
main() {
    stop_docker_services
    stop_manual_services
    cleanup_logs
    
    print_status "🎉 All services stopped successfully!"
    echo ""
    echo "To restart the project, run:"
    echo "   ./scripts/setup.sh"
}

# Run main function
main "$@"