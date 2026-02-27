# Quick SSH — KDE Plasma 6 Widget Design

**Date:** 2026-02-27
**Package ID:** `com.github.andyhazz.quickssh`
**Approach:** Pure QML + JavaScript (no native dependencies)

## Overview

A KDE Plasma 6 system tray widget that parses `~/.ssh/config` and provides one-click SSH connections via the user's chosen terminal emulator.

## Features

- **Host list** from SSH config with host name, user, and hostname display
- **Comment-based grouping** via `#GroupStart <name>` / `#GroupEnd` in SSH config
- **Per-host icons** via `#Icon <name>` comments (Freedesktop icon names or local file paths)
- **Search/filter** bar to quickly find hosts
- **Connection status** dots (online/offline) via parallel pings on popup open
- **Configurable terminal** command (default: detected terminal, e.g., `ghostty -e`)
- **Right-click context menu** with "Copy SSH command" and "Copy hostname"
- **Collapsible groups** with persisted expand/collapse state

## Architecture

### File Structure

```
com.github.andyhazz.quickssh/
├── metadata.json                        # KDE plugin metadata
└── contents/
    ├── ui/
    │   ├── main.qml                    # PlasmoidItem root
    │   ├── CompactRepresentation.qml   # Tray icon
    │   ├── FullRepresentation.qml      # Popup: search + grouped host list
    │   ├── HostDelegate.qml            # Single host row
    │   ├── GroupHeader.qml             # Collapsible group section header
    │   └── configGeneral.qml           # Settings page
    ├── config/
    │   └── main.xml                    # Configuration schema
    └── code/
        └── sshconfig.js                # SSH config parser + helpers
```

### Data Flow

1. `main.qml` loads → calls `sshconfig.js:parseConfig()` to read SSH config file
2. Parser returns structured data: `{ groups: [{name, hosts: [{host, hostname, user, icon, status}]}] }`
3. `FullRepresentation.qml` displays grouped, searchable host list
4. On popup open → parallel ping checks update status dots
5. On host click → spawns `<terminal_command> ssh <host_alias>`

## SSH Config Parsing

### Directives Recognized

| Pattern | Action |
|---------|--------|
| `#GroupStart <name>` | Start named group context |
| `#GroupEnd` | Close current group, revert to "Ungrouped" |
| `#Icon <name>` | Set icon for next Host block |
| `Host <name>` | Start new host entry (skip `Host *` wildcards) |
| `HostName <value>` | Set hostname on current host |
| `User <value>` | Set user on current host |

### Not Parsed (intentionally)

`Include`, `Match`, `ProxyJump`, `Port`, `IdentityFile` — not needed for display/connect.

### Icon Resolution

1. `#Icon` value → Freedesktop icon name OR local file path (`~/.local/share/icons/foo.svg`)
2. No `#Icon` → default `utilities-terminal` icon

## UI Design

### Compact Representation (Tray Icon)

- `utilities-terminal` or `network-connect` icon from Breeze theme
- Optional badge showing online host count (configurable)

### Full Representation (Popup)

```
┌─────────────────────────────────┐
│ 🔍 [Search hosts...         ]  │
├─────────────────────────────────┤
│ ▾ Network                       │
│   [🖥] ● asus      andyhazz@.. │
│   [⏵] ● plexypi   ubuntu@pl.. │
│   [◉] ● pihole    pi@pi.hole  │
│                                 │
│ ▾ Ungrouped                     │
│   [🖥] ● dietpi   root@dietpi  │
├─────────────────────────────────┤
│ ⟳ Refresh    ⚙ Settings        │
└─────────────────────────────────┘
```

### Interactions

- **Click host** → opens terminal with SSH, closes popup
- **Right-click host** → "Copy SSH command", "Copy hostname"
- **Click group header** → collapse/expand (state persisted)
- **Search** → real-time filter by host name, hostname, or user
- **Status dots** → green (online), grey (unknown), red outline (unreachable)

### Settings Page

- **Terminal command** — text field, default auto-detected (e.g., `ghostty -e`)
- **SSH config path** — text field, default `~/.ssh/config`
- **Show connection status** — checkbox, default on
- **Ping timeout** — seconds, default 2
- **Show host count badge** — checkbox, default off

## Connection Status

- Triggered on popup open (not background polling)
- Parallel `ping -c 1 -W <timeout> <hostname>` via PlasmaCore.DataSource
- Host list shows immediately with spinner indicators, dots update as pings complete

## Process Launching

- Execute: `<terminal_command> ssh <host_alias>`
- Uses Host alias (not raw hostname) so all SSH config directives apply
- Spawned via DataSource executable type

## Target Environment

- KDE Plasma 6.0+ (tested on 6.6.1)
- Qt 6.x
- No build step — pure QML/JS, installable via `plasmapkg2 -i`
- Distributable via KDE Store
