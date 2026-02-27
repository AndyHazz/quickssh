.pragma library

/**
 * Parse SSH config file contents into grouped host list.
 *
 * Recognizes:
 *   #GroupStart <name>  — start a named group
 *   #GroupEnd           — close current group
 *   #Icon <name>        — set icon for next Host block
 *   #MAC xx:xx:xx:xx:xx:xx — set MAC address for next Host (Wake-on-LAN)
 *   #Command <cmd>      — add custom command for next Host (repeatable)
 *   Host <name>         — start host entry (skip wildcards)
 *   HostName <value>    — set hostname
 *   User <value>        — set user
 *
 * Returns: { groups: [{name: string, hosts: [{host, hostname, user, icon, mac, commands}]}] }
 */
function parseConfig(text) {
    var lines = text.split("\n")
    var groups = []
    var currentGroupName = ""
    var currentGroup = { name: "", hosts: [] }
    var currentHost = null
    var pendingIcon = ""
    var pendingMac = ""
    var pendingCommands = []

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim()

        // Group directives
        if (line.match(/^#\s*GroupStart\s+(.+)/i)) {
            var match = line.match(/^#\s*GroupStart\s+(.+)/i)
            if (currentHost) {
                currentGroup.hosts.push(currentHost)
                currentHost = null
            }
            if (currentGroup.hosts.length > 0) {
                groups.push(currentGroup)
            }
            currentGroupName = match[1].trim()
            currentGroup = { name: currentGroupName, hosts: [] }
            continue
        }

        if (line.match(/^#\s*GroupEnd/i)) {
            if (currentHost) {
                currentGroup.hosts.push(currentHost)
                currentHost = null
            }
            if (currentGroup.hosts.length > 0) {
                groups.push(currentGroup)
            }
            currentGroupName = ""
            currentGroup = { name: "", hosts: [] }
            continue
        }

        // Icon directive
        if (line.match(/^#\s*Icon\s+(.+)/i)) {
            var iconMatch = line.match(/^#\s*Icon\s+(.+)/i)
            pendingIcon = iconMatch[1].trim()
            continue
        }

        // MAC directive (for Wake-on-LAN)
        if (line.match(/^#\s*MAC\s+([0-9A-Fa-f:]{17})/i)) {
            var macMatch = line.match(/^#\s*MAC\s+([0-9A-Fa-f:]{17})/i)
            pendingMac = macMatch[1].trim()
            continue
        }

        // Command directive (repeatable — accumulates into array)
        if (line.match(/^#\s*Command\s+(.+)/i)) {
            var cmdMatch = line.match(/^#\s*Command\s+(.+)/i)
            pendingCommands.push(cmdMatch[1].trim())
            continue
        }

        // Skip other comments and blank lines
        if (line.startsWith("#") || line === "") {
            continue
        }

        // Host directive
        if (line.match(/^Host\s+(.+)/i)) {
            var hostMatch = line.match(/^Host\s+(.+)/i)
            var hostNames = hostMatch[1].trim().split(/\s+/)

            // Save previous host
            if (currentHost) {
                currentGroup.hosts.push(currentHost)
            }

            currentHost = null

            // Process each host name (skip wildcards)
            for (var h = 0; h < hostNames.length; h++) {
                var name = hostNames[h]
                if (name.indexOf("*") !== -1 || name.indexOf("?") !== -1) {
                    continue
                }
                // For multi-host lines, create separate entries
                if (currentHost === null) {
                    currentHost = {
                        host: name,
                        hostname: name,
                        user: "",
                        icon: pendingIcon || "network-server",
                        status: "unknown",
                        mac: pendingMac,
                        commands: pendingCommands.slice()
                    }
                } else {
                    // Push previous and start new for multi-host
                    currentGroup.hosts.push(currentHost)
                    currentHost = {
                        host: name,
                        hostname: name,
                        user: "",
                        icon: pendingIcon || "network-server",
                        status: "unknown",
                        mac: pendingMac,
                        commands: pendingCommands.slice()
                    }
                }
            }
            pendingIcon = ""
            pendingMac = ""
            pendingCommands = []
            continue
        }

        // Host properties
        if (currentHost) {
            if (line.match(/^HostName\s+(.+)/i)) {
                currentHost.hostname = line.match(/^HostName\s+(.+)/i)[1].trim()
            } else if (line.match(/^User\s+(.+)/i)) {
                currentHost.user = line.match(/^User\s+(.+)/i)[1].trim()
            }
        }
    }

    // Don't forget the last host/group
    if (currentHost) {
        currentGroup.hosts.push(currentHost)
    }
    if (currentGroup.hosts.length > 0) {
        groups.push(currentGroup)
    }

    return { groups: groups }
}
