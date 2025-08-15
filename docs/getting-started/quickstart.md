# Quick Start Guide

Get VolumeViz up and running in just 5 minutes! This guide will help you quickly deploy VolumeViz and start analyzing your Docker volumes.

## 🚀 5-Minute Setup

### Prerequisites

Before you start, make sure you have:
- Docker and Docker Compose installed
- At least 1GB free disk space
- 512MB available RAM

### Step 1: Get VolumeViz

```bash
# Clone the repository
git clone https://github.com/mantonx/volumeviz.git
cd volumeviz
```

### Step 2: Quick Start with SQLite (Fastest)

For the quickest setup, use SQLite:

```bash
# Start VolumeViz with SQLite backend
make dev-sqlite

# Wait for services to start (about 30 seconds)
# Open your browser
open http://localhost:3000
```

That's it! VolumeViz is now running with a SQLite database.

### Step 3: Access the Dashboard

1. **Open your browser** to http://localhost:3000
2. **View the dashboard** with real-time volume information
3. **Explore volumes** using the interactive file browser
4. **Analyze storage** with built-in analytics tools

## 📋 What You'll See

### Dashboard Overview
Upon first load, you'll see:
- **Volume Summary**: Overview of all detected Docker volumes
- **Storage Usage**: Visual representation of space utilization
- **Recent Activity**: Latest file system changes
- **Quick Actions**: Common tasks and operations

### Sample Data
VolumeViz includes sample data to help you explore features:
- Demo volumes with realistic file structures
- Sample analytics and reports
- Example alerts and monitoring scenarios

## 🏗️ Production Setup (Optional)

For production use, set up with PostgreSQL:

```bash
# Start PostgreSQL backend
docker compose -f docker-compose.dev.yml up -d postgres

# Run database migrations
make migrate-up

# Start VolumeViz with PostgreSQL
make run-backend

# In another terminal, start the frontend
cd frontend && npm run dev
```

## 🔧 Configuration

### Environment Variables

Key configuration options:

```bash
# Database Type (sqlite or postgres)
DB_TYPE=sqlite

# API Port
API_PORT=8080

# Frontend Port  
FRONTEND_PORT=3000

# Log Level (debug, info, warn, error)
LOG_LEVEL=info
```

### Docker Volumes to Analyze

VolumeViz automatically discovers Docker volumes on your system. To analyze specific volumes:

```bash
# List available Docker volumes
docker volume ls

# VolumeViz will automatically detect and analyze these volumes
```

## 📊 First Analysis

### Explore Your First Volume

1. **Navigate to Explorer**: Click "Explorer" in the main navigation
2. **Select a Volume**: Choose from the list of detected volumes
3. **Browse Files**: Navigate through the directory structure
4. **View Analytics**: Check file sizes, types, and usage patterns

### Generate Your First Report

1. **Go to Analytics**: Click "Analytics" in the navigation
2. **Select Volume**: Choose a volume to analyze
3. **View Insights**: See storage breakdown by file type, size distribution
4. **Identify Opportunities**: Look for duplicate files or large unused files

### Set Up Your First Alert

1. **Visit Alerts**: Navigate to "Alerts" section
2. **Create Alert**: Set up storage threshold monitoring
3. **Configure Notification**: Choose notification preferences
4. **Test Alert**: Verify alert configuration

## 🛠️ Common Tasks

### Adding New Volumes

VolumeViz automatically detects new Docker volumes. To force a rescan:

```bash
# Trigger volume discovery
curl -X POST http://localhost:8080/api/v1/volumes/scan
```

### Viewing API Documentation

Access the interactive API documentation:

```bash
# Open API docs
open http://localhost:8080/docs
```

### Checking System Health

Monitor system status:

```bash
# Health check endpoint
curl http://localhost:8080/health

# Detailed system information
curl http://localhost:8080/api/v1/system/info
```

## 🔍 Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Check what's using the port
lsof -i :8080
lsof -i :3000

# Use different ports
export API_PORT=8081
export FRONTEND_PORT=3001
```

**Database Connection Issues**
```bash
# Check database status
make db-status

# Reset database
make db-reset
```

**Frontend Not Loading**
```bash
# Check frontend logs
cd frontend && npm run dev

# Clear cache and restart
rm -rf frontend/node_modules/.cache
cd frontend && npm install && npm run dev
```

### Getting Help

If you encounter issues:

1. **Check Logs**: Look at application logs for error messages
2. **Verify Prerequisites**: Ensure Docker and required tools are installed
3. **Reset Environment**: Try a clean restart with `make clean && make dev-sqlite`
4. **Consult Documentation**: Check the full documentation for detailed guides
5. **Ask for Help**: Create an issue on GitHub or start a discussion

## 🎯 Next Steps

Now that VolumeViz is running:

1. **Explore Features**: Try the volume explorer, analytics, and alerts
2. **Read User Guide**: Check out the [User Guide](../user-guide/dashboard.md) for detailed feature explanations
3. **API Integration**: Explore the [API Documentation](../api/overview.md) for programmatic access
4. **Production Deployment**: When ready, see the [Deployment Guide](../deployment/production.md)

## 📚 Learning Resources

- **User Guide**: Comprehensive feature documentation
- **API Reference**: Complete API endpoint documentation
- **Video Tutorials**: Step-by-step video guides (coming soon)
- **Community Examples**: Real-world usage examples

---

**Congratulations! You now have VolumeViz running and can start analyzing your Docker volumes. Explore the interface and discover insights about your storage usage.**
