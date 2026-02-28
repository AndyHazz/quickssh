#!/bin/bash
set -e
kpackagetool6 -t Plasma/Applet -u package/ 2>/dev/null || kpackagetool6 -t Plasma/Applet -i package/
echo "SquiSSH installed successfully!"
echo "Enable it: Right-click system tray → Configure System Tray → SquiSSH"
