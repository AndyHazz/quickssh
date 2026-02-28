.pragma library

/**
 * Build a host item for the display model.
 *
 * @param {object} h            - host object from parsed config
 * @param {object} history      - connectionHistory map {alias: timestamp}
 * @param {boolean} discovered  - whether the host was discovered via avahi
 * @returns {object} model item
 */
function hostItem(h, history, discovered) {
    var lastConn = (history && history[h.host]) || 0
    return {
        isHeader: false,
        host: h.host,
        hostname: h.hostname,
        user: h.user,
        icon: h.icon,
        status: h.status,
        discovered: discovered || false,
        lastConnected: lastConn,
        mac: h.mac || "",
        commands: h.commands || []
    }
}

/**
 * Sort an array of host objects by the given sort order.
 *
 * @param {Array} hosts   - array of host objects
 * @param {string} order  - "config", "recent", or "alphabetical"
 * @param {object} history - connectionHistory map {alias: timestamp}
 */
function sortHosts(hosts, order, history) {
    if (order === "alphabetical") {
        hosts.sort(function(a, b) {
            return a.host.toLowerCase().localeCompare(b.host.toLowerCase())
        })
    } else if (order === "recent") {
        hosts.sort(function(a, b) {
            var aTime = (history[a.host] || 0)
            var bTime = (history[b.host] || 0)
            if (aTime !== bTime) return bTime - aTime
            return 0 // preserve config order for never-connected hosts
        })
    }
    // "config" — no sorting, preserve original order
}

/**
 * Build the filtered display model from parsed config groups.
 *
 * @param {object} opts
 * @param {Array}  opts.groupedHosts      - parsed groups from parseConfig()
 * @param {string} opts.searchText        - current search filter (lowercased)
 * @param {boolean} opts.hideUnreachable  - whether to hide offline hosts
 * @param {boolean} opts.enableGrouping   - whether to show group headers
 * @param {string} opts.sortOrder         - "config", "recent", or "alphabetical"
 * @param {string[]} opts.favorites       - list of favorite host aliases
 * @param {string[]} opts.collapsedGroups - list of collapsed group names
 * @param {object} opts.connectionHistory - {alias: timestamp} map
 * @param {Array}  opts.discoveredHosts   - avahi-discovered hosts
 * @param {boolean} opts.discoverHosts    - whether discovery is enabled
 * @param {number} [opts.now]             - current time (ms); defaults to Date.now()
 * @returns {Array} model items
 */
function buildFilteredModel(opts) {
    var items = []
    var search = (opts.searchText || "").toLowerCase()
    var hideOffline = opts.hideUnreachable || false
    var grouping = opts.enableGrouping !== false
    var sortOrder = opts.sortOrder || "config"
    var history = opts.connectionHistory || {}
    var now = opts.now || Date.now()
    var oneDayMs = 24 * 60 * 60 * 1000

    var favSet = {}
    var favorites = opts.favorites || []
    for (var f = 0; f < favorites.length; f++) {
        favSet[favorites[f]] = true
    }

    var collapsedSet = {}
    var collapsed = opts.collapsedGroups || []
    for (var c = 0; c < collapsed.length; c++) {
        collapsedSet[collapsed[c]] = true
    }

    function isGroupCollapsed(groupName) {
        return !!collapsedSet[groupName]
    }

    // Whether to create a separate "Recent" section
    var showRecentGroup = grouping && sortOrder !== "recent"

    var favoriteHosts = []
    var recentHosts = []
    var groups = opts.groupedHosts || []

    for (var i = 0; i < groups.length; i++) {
        var group = groups[i]
        var filteredHosts = []

        for (var j = 0; j < group.hosts.length; j++) {
            var h = group.hosts[j]
            if (hideOffline && h.status !== "online") continue
            if (search !== "" &&
                h.host.toLowerCase().indexOf(search) < 0 &&
                h.hostname.toLowerCase().indexOf(search) < 0 &&
                (h.user || "").toLowerCase().indexOf(search) < 0) continue

            var lastConn = history[h.host] || 0
            var isRecent = lastConn > 0 && (now - lastConn) < oneDayMs

            if (favSet[h.host]) {
                favoriteHosts.push(h)
            } else if (showRecentGroup && isRecent) {
                recentHosts.push(h)
            } else {
                filteredHosts.push(h)
            }
        }

        if (filteredHosts.length > 0) {
            if (grouping) {
                var groupName = group.name || "Ungrouped"
                var groupCollapsed = isGroupCollapsed(groupName)

                sortHosts(filteredHosts, sortOrder, history)

                items.push({
                    isHeader: true,
                    groupName: groupName,
                    hostCount: filteredHosts.length,
                    collapsed: groupCollapsed
                })

                if (groupCollapsed) continue
            }

            if (!grouping) {
                // Flat mode: just collect, sort later
            }

            for (var k = 0; k < filteredHosts.length; k++) {
                items.push(hostItem(filteredHosts[k], history, false))
            }
        }
    }

    // When ungrouped, sort the entire flat list
    if (!grouping) {
        sortHosts(items.map(function(it) { return it }), sortOrder, history)
        // Re-sort items in place by extracting host objects
        if (sortOrder === "alphabetical") {
            items.sort(function(a, b) {
                return a.host.toLowerCase().localeCompare(b.host.toLowerCase())
            })
        } else if (sortOrder === "recent") {
            items.sort(function(a, b) {
                var aTime = (a.lastConnected || 0)
                var bTime = (b.lastConnected || 0)
                if (aTime !== bTime) return bTime - aTime
                return 0
            })
        }
    }

    // Prepend Recent section (only when grouping is on and sort is not "recent")
    if (showRecentGroup && recentHosts.length > 0) {
        recentHosts.sort(function(a, b) {
            return (history[b.host] || 0) - (history[a.host] || 0)
        })

        var recentCollapsed = isGroupCollapsed("Recent")
        items.unshift({
            isHeader: true,
            groupName: "Recent",
            hostCount: recentHosts.length,
            collapsed: recentCollapsed
        })
        if (!recentCollapsed) {
            for (var r = recentHosts.length - 1; r >= 0; r--) {
                items.splice(1, 0, hostItem(recentHosts[r], history, false))
            }
        }
    }

    // Prepend favorites section
    if (favoriteHosts.length > 0) {
        sortHosts(favoriteHosts, sortOrder, history)
        if (grouping) {
            items.unshift({
                isHeader: true,
                groupName: "Favorites",
                hostCount: favoriteHosts.length,
                collapsed: false
            })
        }
        for (var m = favoriteHosts.length - 1; m >= 0; m--) {
            items.splice(grouping ? 1 : 0, 0, hostItem(favoriteHosts[m], history, false))
        }
    }

    // Append discovered network hosts
    var discoverEnabled = opts.discoverHosts || false
    var discoveredHosts = opts.discoveredHosts || []
    if (discoverEnabled && discoveredHosts.length > 0) {
        var discoveredFiltered = []
        for (var d = 0; d < discoveredHosts.length; d++) {
            var dh = discoveredHosts[d]
            if (search !== "" &&
                dh.host.toLowerCase().indexOf(search) < 0 &&
                dh.hostname.toLowerCase().indexOf(search) < 0) continue
            discoveredFiltered.push(dh)
        }
        if (discoveredFiltered.length > 0) {
            var discoveredCollapsed = isGroupCollapsed("Discovered")
            items.push({
                isHeader: true,
                groupName: "Discovered",
                hostCount: discoveredFiltered.length,
                collapsed: discoveredCollapsed
            })
            if (!discoveredCollapsed) {
                for (var e = 0; e < discoveredFiltered.length; e++) {
                    items.push(hostItem(discoveredFiltered[e], history, true))
                }
            }
        }
    }

    return items
}

if (typeof module !== 'undefined') module.exports = { buildFilteredModel, hostItem, sortHosts }
