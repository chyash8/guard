#!/bin/bash

# Guard System Stop Script
# This script stops both the VoIP listener and Guard dashboard

echo "🛑 Stopping Guard System..."

# Stop VoIP listener processes
echo "🎤 Stopping VoIP listener..."
pkill -f "node.*index.js.*listen.*3333" && echo "✅ VoIP listener stopped" || echo "⚠️  No VoIP listener found"

# Stop any Vite development servers
echo "🌐 Stopping Guard dashboard..."
pkill -f "vite.*dev" && echo "✅ Guard dashboard stopped" || echo "⚠️  No Guard dashboard found"

echo "✅ Guard System stopped"
