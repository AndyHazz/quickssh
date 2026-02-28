.pragma library

/**
 * Serialize grouped host model back to SSH config text.
 *
 * Reconstructs the full SSH config file from the in-memory model,
 * preserving all SquiSSH directives (#GroupStart, #Icon, #MAC, #Command)
 * and additional SSH options stored in each host's options[] array.
 *
 * Also writes rawBlocks (wildcard hosts, Match blocks, Include directives)
 * at the top of the file to prevent data loss on round-trip.
 *
 * @param {Array} groups - Array of {name, hosts[]} from parseConfig result
 * @param {Array} [rawBlocks] - Array of raw text strings to preserve
 * @returns {string} - Complete SSH config file text
 */
function serializeConfig(groups, rawBlocks) {
    var lines = []

    // Write preserved raw blocks first (Host *, Match, Include, etc.)
    if (rawBlocks && rawBlocks.length > 0) {
        for (var r = 0; r < rawBlocks.length; r++) {
            lines.push(rawBlocks[r])
            lines.push("")
        }
    }

    for (var i = 0; i < groups.length; i++) {
        var group = groups[i]
        var inGroup = group.name !== ""

        if (inGroup) {
            lines.push("# GroupStart " + group.name)
            lines.push("")
        }

        for (var j = 0; j < group.hosts.length; j++) {
            var host = group.hosts[j]

            // SquiSSH directives (before Host line)
            if (host.icon && host.icon !== "network-server") {
                lines.push("# Icon " + host.icon)
            }
            if (host.mac) {
                lines.push("# MAC " + host.mac)
            }
            if (host.commands) {
                for (var c = 0; c < host.commands.length; c++) {
                    lines.push("# Command " + host.commands[c])
                }
            }

            // Host line
            lines.push("Host " + host.host)

            // Standard SSH directives
            if (host.hostname && host.hostname !== host.host) {
                lines.push("    HostName " + host.hostname)
            }
            if (host.user) {
                lines.push("    User " + host.user)
            }
            if (host.port) {
                lines.push("    Port " + host.port)
            }
            if (host.identityFile) {
                lines.push("    IdentityFile " + host.identityFile)
            }

            // Additional SSH options
            if (host.options) {
                for (var o = 0; o < host.options.length; o++) {
                    var opt = host.options[o]
                    if (opt.key) {
                        lines.push("    " + opt.key + " " + opt.value)
                    }
                }
            }

            lines.push("")
        }

        if (inGroup) {
            lines.push("# GroupEnd")
            lines.push("")
        }
    }

    // Clean up multiple consecutive blank lines and ensure single trailing newline
    var result = lines.join("\n")
    result = result.replace(/\n{3,}/g, "\n\n")
    result = result.replace(/\s+$/, "")
    if (result.length > 0) {
        result += "\n"
    }
    return result
}

// Allow Node.js test runners to import this module
if (typeof module !== 'undefined') module.exports = { serializeConfig }
