#!/bin/bash

# Check if the script is run with sudo
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root"
    exit 1
fi

action=$1
if [ "$action" != "block" ] && [ "$action" != "unblock" ]; then
    echo "Invalid action. Use 'block' or 'unblock'"
    exit 1
fi

rfkill $action wifi
exit $?