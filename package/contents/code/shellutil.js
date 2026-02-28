.pragma library

/**
 * Escape a string for safe inclusion in a single-quoted shell argument.
 *
 * Wraps the value in single quotes and escapes any internal single quotes
 * using the standard POSIX technique: ' → '\''
 *
 * @param {string} s - value to quote
 * @returns {string} safely quoted shell argument
 */
function shellQuote(s) {
    return "'" + s.replace(/'/g, "'\\''") + "'"
}

/**
 * Test whether a string contains only valid hostname/IP characters.
 *
 * Allows: letters, digits, dots, hyphens, colons (for IPv6), underscores.
 * Rejects anything containing shell metacharacters.
 *
 * @param {string} s - hostname to validate
 * @returns {boolean} true if safe for shell interpolation
 */
function isSafeHostname(s) {
    return /^[a-zA-Z0-9.\-_:]+$/.test(s)
}

// Allow Node.js test runners to import this module
if (typeof module !== 'undefined') module.exports = { shellQuote, isSafeHostname }
