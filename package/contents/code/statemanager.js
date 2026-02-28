.pragma library

/**
 * Check if a host is in the favorites list.
 * @param {string[]} favorites - current favorites array
 * @param {string} host - host alias to check
 * @returns {boolean}
 */
function isFavorite(favorites, host) {
    return favorites.indexOf(host) >= 0
}

/**
 * Toggle a host in the favorites list (add if absent, remove if present).
 * @param {string[]} favorites - current favorites array
 * @param {string} host - host alias to toggle
 * @returns {string[]} new favorites array
 */
function toggleFavorite(favorites, host) {
    var favs = favorites.slice()
    var idx = favs.indexOf(host)
    if (idx >= 0) {
        favs.splice(idx, 1)
    } else {
        favs.push(host)
    }
    return favs
}

/**
 * Check if a group is collapsed.
 * @param {string[]} collapsedGroups - current collapsed groups array
 * @param {string} groupName - group name to check
 * @returns {boolean}
 */
function isGroupCollapsed(collapsedGroups, groupName) {
    return collapsedGroups.indexOf(groupName) >= 0
}

/**
 * Toggle a group's collapsed state (collapse if expanded, expand if collapsed).
 * @param {string[]} collapsedGroups - current collapsed groups array
 * @param {string} groupName - group name to toggle
 * @returns {string[]} new collapsed groups array
 */
function toggleGroup(collapsedGroups, groupName) {
    var groups = collapsedGroups.slice()
    var idx = groups.indexOf(groupName)
    if (idx >= 0) {
        groups.splice(idx, 1)
    } else {
        groups.push(groupName)
    }
    return groups
}

/**
 * Record a connection timestamp for a host.
 * @param {object} history - current connection history {alias: timestamp}
 * @param {string} hostAlias - host alias
 * @param {number} [now] - current time (ms); defaults to Date.now()
 * @returns {object} new history object
 */
function recordConnection(history, hostAlias, now) {
    var newHistory = {}
    for (var key in history) {
        newHistory[key] = history[key]
    }
    newHistory[hostAlias] = (typeof now !== 'undefined') ? now : Date.now()
    return newHistory
}

if (typeof module !== 'undefined') module.exports = {
    isFavorite,
    toggleFavorite,
    isGroupCollapsed,
    toggleGroup,
    recordConnection
}
