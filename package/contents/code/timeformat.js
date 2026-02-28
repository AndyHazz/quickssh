.pragma library

/**
 * Format a timestamp as a human-readable "time ago" string.
 *
 * @param {number} timestamp - Unix epoch in milliseconds
 * @param {number} [now]     - current time (ms); defaults to Date.now()
 * @returns {string}
 */
function formatTimeAgo(timestamp, now) {
    if (!timestamp || timestamp <= 0) return ""
    if (typeof now === 'undefined') now = Date.now()
    var diff = now - timestamp
    var seconds = Math.floor(diff / 1000)
    if (seconds < 60) return "just now"
    var minutes = Math.floor(seconds / 60)
    if (minutes < 60) return minutes === 1 ? "1 min ago" : minutes + " mins ago"
    var hours = Math.floor(minutes / 60)
    if (hours < 24) return hours === 1 ? "1 hour ago" : hours + " hours ago"
    var days = Math.floor(hours / 24)
    return days === 1 ? "1 day ago" : days + " days ago"
}

if (typeof module !== 'undefined') module.exports = { formatTimeAgo }
