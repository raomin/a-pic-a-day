#!/bin/bash

# A Pic a Day Bot Service Manager
# Usage: ./manage-service.sh [start|stop|restart|status|logs|enable|disable]

SERVICE_NAME="a-pic-a-day.service"

case "$1" in
    start)
        echo "Starting A Pic a Day Bot..."
        sudo systemctl start $SERVICE_NAME
        ;;
    stop)
        echo "Stopping A Pic a Day Bot..."
        sudo systemctl stop $SERVICE_NAME
        ;;
    restart)
        echo "Restarting A Pic a Day Bot..."
        sudo systemctl restart $SERVICE_NAME
        ;;
    status)
        echo "Checking A Pic a Day Bot status..."
        sudo systemctl status $SERVICE_NAME
        ;;
    logs)
        echo "Showing recent logs..."
        sudo journalctl -u $SERVICE_NAME --lines=50 --no-pager
        ;;
    follow-logs)
        echo "Following logs (press Ctrl+C to exit)..."
        sudo journalctl -u $SERVICE_NAME -f
        ;;
    enable)
        echo "Enabling A Pic a Day Bot to start at boot..."
        sudo systemctl enable $SERVICE_NAME
        ;;
    disable)
        echo "Disabling A Pic a Day Bot from starting at boot..."
        sudo systemctl disable $SERVICE_NAME
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|follow-logs|enable|disable}"
        echo ""
        echo "Commands:"
        echo "  start       - Start the A Pic a Day Bot service"
        echo "  stop        - Stop the A Pic a Day Bot service"
        echo "  restart     - Restart the A Pic a Day Bot service"
        echo "  status      - Show current status of the service"
        echo "  logs        - Show recent log entries"
        echo "  follow-logs - Follow log entries in real-time"
        echo "  enable      - Enable service to start at boot"
        echo "  disable     - Disable service from starting at boot"
        exit 1
        ;;
esac