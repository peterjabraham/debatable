#!/bin/bash
# reset-cache.sh - NUCLEAR OPTION - Absolute reset for Great Debate MVP

echo "=================================================================="
echo "NUCLEAR RESET for Great Debate MVP - ABSOLUTE SILENT MODE ACTIVATED"
echo "=================================================================="

# Stop EVERYTHING
echo "Stopping all processes..."
# Kill Node processes
pkill -f "node" || true
# Kill npm processes
pkill -f "npm" || true
# Kill any process with 'great' in the name
pkill -f "great" || true

# Give processes time to die
sleep 1

# Force kill any stragglers
echo "Force killing any remaining processes..."
for pid in $(ps -ef | grep -E 'node|npm|great' | grep -v grep | awk '{print $2}'); do
  echo "Force killing process: $pid"
  kill -9 $pid 2>/dev/null || true
done

# Kill anything on relevant ports
echo "Freeing up all development ports..."
for port in 3000 3001 3002 3003 3030 3031 8000 8080; do
  for pid in $(lsof -i :$port | grep LISTEN | awk '{print $2}'); do
    echo "Killing process on port $port: $pid"
    kill -9 $pid 2>/dev/null || true
  done
done

echo ""
echo "NUCLEAR CACHE REMOVAL..."
# Remove absolutely everything cached
sudo rm -rf .next || rm -rf .next || true
sudo rm -rf node_modules/.cache || rm -rf node_modules/.cache || true
sudo rm -rf .vercel || rm -rf .vercel || true
sudo rm -rf .turbo || rm -rf .turbo || true
rm -rf storage || true
mkdir -p storage || true

# Clear npm cache 
echo "Nuking npm cache..."
npm cache clean --force || true

# More terminal output to make it clear something happened
echo ""
echo "=================================================================="
echo "CRITICAL: You MUST clear your browser storage:"
echo ""
echo "1. Open Chrome Developer Tools (F12)"
echo "2. Go to Application tab"
echo "3. Select 'Storage' in the left sidebar"
echo "4. Click 'Clear site data' button at the bottom"
echo "5. Confirm the clear"
echo "=================================================================="

echo ""
echo "Creating NUCLEAR SILENT MODE configuration..."
# Create ultra-minimal .env.local file
cat > .env.local << EOF
# NUCLEAR SILENT MODE
NEXT_PUBLIC_API_BASE_URL=http://localhost:3030
API_PORT=3030
USE_MOCK_DATA=true
REACT_STRICT_MODE=false
DISABLE_API_TESTING=true
DEBUG_MODE=false
NEXT_PUBLIC_DEBUG_MODE=false
NEXTAUTH_DEBUG=false
MVP_MODE=nuclear
EOF

echo ""
echo "=================================================================="
echo "NUCLEAR RESET COMPLETE"
echo "Run 'npm run mvp' to start in ABSOLUTE SILENT MODE"
echo "==================================================================" 