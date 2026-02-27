#!/bin/bash
set -e
kpackagetool6 -t Plasma/Applet -u package/ 2>/dev/null || kpackagetool6 -t Plasma/Applet -i package/
echo "Quick SSH installed successfully!"
echo "Enable it: Right-click system tray → Configure System Tray → Quick SSH"
