#!/bin/bash

# ETH Vault Project Setup Script
set -e

echo "🏗️  Setting up ETH Vault Project..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ required. Current version: $(node -v)"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_warning "Docker is not installed. Some features will not be available."
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_warning "Docker Compose is not installed. Some features will not be available."
    fi
    
    print_status "Prerequisites check completed ✅"
}

# Install contract dependencies
install_contract_deps() {
    print_status "Installing contract dependencies..."
    cd contracts
    npm install
    cd ..
    print_status "Contract dependencies installed ✅"
}

# Install frontend dependencies
install_frontend_deps() {
    print_status "Installing frontend dependencies..."
    cd frontend
    
    # Remove problematic node_modules if exists
    if [ -d "node_modules" ]; then
        print_warning "Removing existing node_modules..."
        rm -rf node_modules
    fi
    
    npm install
    cd ..
    print_status "Frontend dependencies installed ✅"
}

# Install monitoring dependencies
install_monitoring_deps() {
    print_status "Installing monitoring dependencies..."
    cd monitoring/exporter
    npm install
    cd ../..
    print_status "Monitoring dependencies installed ✅"
}

# Setup Aderyn (if Rust is available)
setup_aderyn() {
    print_status "Setting up Aderyn for security auditing..."
    
    if command -v cargo &> /dev/null; then
        print_status "Installing Aderyn..."
        cargo install aderyn || print_warning "Aderyn installation failed. You can install it manually later."
    else
        print_warning "Rust/Cargo not found. Aderyn will not be installed."
        print_warning "To install Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
        print_warning "Then run: cargo install aderyn"
    fi
}

# Create environment files
create_env_files() {
    print_status "Creating environment files..."
    
    # Frontend .env
    cat > frontend/.env << EOF
VITE_HARDHAT_RPC_URL=http://localhost:8545
VITE_VAULT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
EOF
    
    # Monitoring .env
    cat > monitoring/exporter/.env << EOF
RPC_URL=http://localhost:8545
VAULT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
PORT=8080
EOF
    
    print_status "Environment files created ✅"
}

# Start Hardhat node
start_hardhat_node() {
    print_status "Starting Hardhat node..."
    cd contracts
    
    # Kill any existing Hardhat processes
    pkill -f "hardhat node" || true
    
    # Start Hardhat node in background
    npx hardhat node > ../hardhat.log 2>&1 &
    HARDHAT_PID=$!
    
    # Wait for node to start
    sleep 5
    
    if ps -p $HARDHAT_PID > /dev/null; then
        print_status "Hardhat node started (PID: $HARDHAT_PID) ✅"
        echo $HARDHAT_PID > ../hardhat.pid
    else
        print_error "Failed to start Hardhat node"
        exit 1
    fi
    
    cd ..
}

# Deploy contracts
deploy_contracts() {
    print_status "Deploying contracts..."
    cd contracts
    
    # Deploy VaultV1
    npx hardhat run scripts/deploy.js --network localhost
    
    if [ -f "deployment-info.json" ]; then
        print_status "Contracts deployed successfully ✅"
        
        # Update frontend with actual contract address
        VAULT_ADDRESS=$(cat deployment-info.json | grep -o '"proxy":"[^"]*' | cut -d'"' -f4)
        if [ ! -z "$VAULT_ADDRESS" ]; then
            sed -i "s/0x5FbDB2315678afecb367f032d93F642f64180aa3/$VAULT_ADDRESS/g" ../frontend/.env
            sed -i "s/0x5FbDB2315678afecb367f032d93F642f64180aa3/$VAULT_ADDRESS/g" ../monitoring/exporter/.env
            print_status "Updated contract address: $VAULT_ADDRESS"
        fi
    else
        print_error "Contract deployment failed"
        exit 1
    fi
    
    cd ..
}

# Run tests
run_tests() {
    print_status "Running contract tests..."
    cd contracts
    npx hardhat test
    cd ..
    print_status "Tests completed ✅"
}

# Run audit
run_audit() {
    if command -v aderyn &> /dev/null; then
        print_status "Running security audit..."
        cd contracts
        node scripts/audit.js
        cd ..
        print_status "Audit completed ✅"
    else
        print_warning "Aderyn not available. Skipping audit."
    fi
}

# Start services
start_services() {
    print_status "Starting services..."
    
    if command -v docker-compose &> /dev/null; then
        print_status "Starting with Docker Compose..."
        docker-compose up -d
        print_status "Services started with Docker ✅"
    else
        print_status "Starting services manually..."
        
        # Start monitoring exporter
        cd monitoring/exporter
        npm start > ../../exporter.log 2>&1 &
        EXPORTER_PID=$!
        echo $EXPORTER_PID > ../../exporter.pid
        cd ../..
        
        # Start frontend
        cd frontend
        npm run dev > ../frontend.log 2>&1 &
        FRONTEND_PID=$!
        echo $FRONTEND_PID > ../frontend.pid
        cd ..
        
        print_status "Services started manually ✅"
    fi
}

# Print access information
print_access_info() {
    print_status "🎉 Setup completed successfully!"
    echo ""
    echo "📱 Access your applications:"
    echo "   Frontend Dashboard: http://localhost:3000"
    echo "   Grafana Monitoring: http://localhost:3001 (admin/admin)"
    echo "   Prometheus: http://localhost:9090"
    echo "   Metrics API: http://localhost:8080/stats"
    echo ""
    echo "📁 Important files:"
    echo "   Contract deployment: contracts/deployment-info.json"
    echo "   Audit report: contracts/aderyn_report.md (if generated)"
    echo "   Hardhat logs: hardhat.log"
    echo ""
    echo "🔧 Next steps:"
    echo "   1. Connect your wallet to the frontend"
    echo "   2. Make test deposits and withdrawals"
    echo "   3. Monitor metrics in Grafana"
    echo "   4. Review audit report for security findings"
    echo ""
    echo "🛑 To stop services:"
    echo "   Docker: docker-compose down"
    echo "   Manual: ./scripts/stop.sh"
}

# Main execution
main() {
    echo "🚀 ETH Vault Project Setup"
    echo "=========================="
    
    check_prerequisites
    install_contract_deps
    install_frontend_deps
    install_monitoring_deps
    setup_aderyn
    create_env_files
    start_hardhat_node
    deploy_contracts
    run_tests
    run_audit
    start_services
    print_access_info
}

# Run main function
main "$@"