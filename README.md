<p align="center">
  <img src="docs/logo.png" alt="Quick SSH" width="128">
</p>

<h1 align="center">Quick SSH</h1>

<p align="center">
  A KDE Plasma 6 system tray widget for quick SSH connections from your <code>~/.ssh/config</code>.
</p>

<!-- TODO: Add screenshot -->

## Features

- Parses `~/.ssh/config` automatically — no duplicate configuration
- One-click SSH connections in your preferred terminal
- Host grouping with `#GroupStart` / `#GroupEnd` comments
- Custom icons per host with `#Icon` directive
- **Connection history** with "Recent" group showing last 24 hours
- **Wake-on-LAN** via `#MAC` directive (right-click offline hosts)
- **Per-host custom commands** via `#Command` directive
- Pin favorite hosts to the top
- Live online/offline status via ping
- Search/filter hosts, or connect to arbitrary hostnames
- One-click SFTP file manager access
- mDNS/Avahi network host discovery
- Status change notifications
- Configurable terminal emulator, config path, and ping timeout

## Installation

### From KDE Store

Search for "Quick SSH" in **Get New Widgets** on your Plasma panel.

### From Source

```bash
git clone https://github.com/AndyHazz/quickssh.git
cd quickssh
./install.sh
```

Then right-click your system tray → **Configure System Tray** → enable **Quick SSH**.

## SSH Config Format

Quick SSH reads your standard `~/.ssh/config` and adds optional directives via comments:

```ssh-config
# GroupStart Production
# Icon network-server-database
# Command tail -f /var/log/syslog
# Command systemctl status nginx
Host prod-db
    HostName 10.0.1.10
    User admin

Host prod-web
    HostName 10.0.1.20
    User deploy
# GroupEnd

# GroupStart Home Lab
# Icon computer
# MAC aa:bb:cc:dd:ee:ff
Host pihole
    HostName 192.168.1.50
    User pi

Host nas
    HostName 192.168.1.100
    User admin
# GroupEnd

# Hosts without a group appear under "Ungrouped"
Host personal-vps
    HostName example.com
    User me
```

### Directives

| Directive | Description |
|-----------|-------------|
| `# GroupStart <name>` | Start a named group |
| `# GroupEnd` | Close the current group |
| `# Icon <name or path>` | Set a KDE icon or image path for the next host |
| `# MAC <xx:xx:xx:xx:xx:xx>` | Set MAC address for Wake-on-LAN on the next host |
| `# Command <command>` | Add a custom command for the next host (repeatable) |

These are standard SSH comments and won't affect your SSH connections.

## Configuration

Right-click the widget icon → **Configure Quick SSH...**

| Option | Default | Description |
|--------|---------|-------------|
| Terminal command | `ghostty -e` | Command prefix to launch SSH (e.g., `konsole -e`, `alacritty -e`) |
| SSH config file | `~/.ssh/config` | Path to your SSH config |
| Show connection status | `true` | Ping hosts to show online/offline dots |
| Ping timeout | `2` seconds | Timeout for status pings |
| Show host count badge | `false` | Show host count on tray icon |
| Discover network hosts | `false` | Find SSH servers on LAN via Avahi/mDNS |
| Notify on status change | `false` | Desktop notifications when hosts go online/offline |

## Requirements

- KDE Plasma 6
- `kpackagetool6` (included with Plasma 6)
- `wakeonlan` (optional, for Wake-on-LAN feature)

## License

GPL-3.0
