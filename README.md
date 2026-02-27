# Quick SSH

A KDE Plasma 6 system tray widget for quick SSH connections from your `~/.ssh/config`.

<!-- TODO: Add screenshot -->

## Features

- Parses `~/.ssh/config` automatically
- One-click SSH connections in your preferred terminal
- Host grouping with custom `#GroupStart`/`#GroupEnd` comments
- Custom icons per host with `#Icon` comments
- Live connection status via ping
- Search/filter hosts
- Right-click to copy SSH commands or hostnames
- Configurable terminal emulator, config path, and ping timeout

## Installation

```bash
git clone https://github.com/AndyHazz/quickssh.git
cd quickssh
./install.sh
```

Then right-click your system tray → **Configure System Tray** → enable **Quick SSH**.

## SSH Config Format

Quick SSH reads your standard `~/.ssh/config` and adds optional grouping directives:

```ssh-config
# GroupStart Production
# Icon network-server-database
Host prod-db
    HostName 10.0.1.10
    User admin

Host prod-web
    HostName 10.0.1.20
    User deploy
# GroupEnd

# GroupStart Development
Host dev-server
    HostName 192.168.1.100
    User dev
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
| `# Icon <name>` | Set a KDE icon for the next Host block |

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

## Requirements

- KDE Plasma 6
- `kpackagetool6` (included with Plasma 6)

## License

GPL-3.0
