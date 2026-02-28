.pragma library

/**
 * Parse avahi-browse output into a list of discovered SSH hosts.
 *
 * @param {string} output       - raw stdout from `avahi-browse -tpr _ssh._tcp`
 * @param {string[]} configuredHostnames - hostnames/IPs already in the SSH config (lowercase)
 * @returns {Array<{host, hostname, user, icon, status}>}
 */
function parseDiscoveredHosts(output, configuredHostnames) {
    var configured = {}
    for (var i = 0; i < configuredHostnames.length; i++) {
        configured[configuredHostnames[i].toLowerCase()] = true
    }

    var hosts = []
    var seen = {}
    var lines = output.split("\n")

    for (var j = 0; j < lines.length; j++) {
        var line = lines[j]
        if (!line.startsWith("=")) continue
        var fields = line.split(";")
        if (fields.length < 9) continue
        if (fields[2] !== "IPv4") continue

        var name = fields[3]
        var mdnsHost = fields[6]
        var address = fields[7]

        if (configured[address.toLowerCase()]) continue
        if (configured[mdnsHost.toLowerCase()]) continue
        if (seen[address]) continue
        seen[address] = true

        hosts.push({
            host: name,
            hostname: address,
            user: "",
            icon: "network-wired",
            status: "online"
        })
    }
    return hosts
}

if (typeof module !== 'undefined') module.exports = { parseDiscoveredHosts }
