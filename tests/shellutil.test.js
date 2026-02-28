import { describe, it, expect } from 'vitest'
import { shellQuote, isSafeHostname } from '../package/contents/code/shellutil.js'

describe('shellQuote', () => {
    it('wraps a simple string in single quotes', () => {
        expect(shellQuote('hello')).toBe("'hello'")
    })

    it('escapes single quotes in the string', () => {
        expect(shellQuote("it's")).toBe("'it'\\''s'")
    })

    it('handles strings with multiple single quotes', () => {
        expect(shellQuote("a'b'c")).toBe("'a'\\''b'\\''c'")
    })

    it('handles empty string', () => {
        expect(shellQuote('')).toBe("''")
    })

    it('preserves shell operators inside quotes (they become literal)', () => {
        expect(shellQuote('cd / && rm -rf /')).toBe("'cd / && rm -rf /'")
    })

    it('preserves backticks inside quotes', () => {
        expect(shellQuote('echo `whoami`')).toBe("'echo `whoami`'")
    })

    it('preserves $() expansion syntax inside quotes', () => {
        expect(shellQuote('echo $(whoami)')).toBe("'echo $(whoami)'")
    })

    it('preserves double quotes inside single quotes', () => {
        expect(shellQuote('echo "hello"')).toBe("'echo \"hello\"'")
    })

    it('handles newlines in string', () => {
        expect(shellQuote('line1\nline2')).toBe("'line1\nline2'")
    })

    it('handles semicolons and pipes', () => {
        expect(shellQuote('cmd1; cmd2 | cmd3')).toBe("'cmd1; cmd2 | cmd3'")
    })
})

describe('isSafeHostname', () => {
    it('accepts a simple hostname', () => {
        expect(isSafeHostname('myserver')).toBe(true)
    })

    it('accepts an IPv4 address', () => {
        expect(isSafeHostname('192.168.1.100')).toBe(true)
    })

    it('accepts an IPv6 address', () => {
        expect(isSafeHostname('::1')).toBe(true)
        expect(isSafeHostname('fe80::1')).toBe(true)
    })

    it('accepts a FQDN', () => {
        expect(isSafeHostname('server.example.com')).toBe(true)
    })

    it('accepts hostnames with hyphens and underscores', () => {
        expect(isSafeHostname('my-server_01')).toBe(true)
    })

    it('rejects semicolons', () => {
        expect(isSafeHostname('host; rm -rf /')).toBe(false)
    })

    it('rejects backticks', () => {
        expect(isSafeHostname('host`whoami`')).toBe(false)
    })

    it('rejects $() syntax', () => {
        expect(isSafeHostname('$(evil)')).toBe(false)
    })

    it('rejects pipes', () => {
        expect(isSafeHostname('host | evil')).toBe(false)
    })

    it('rejects ampersands', () => {
        expect(isSafeHostname('host && evil')).toBe(false)
    })

    it('rejects spaces', () => {
        expect(isSafeHostname('host name')).toBe(false)
    })

    it('rejects empty string', () => {
        expect(isSafeHostname('')).toBe(false)
    })

    it('rejects newlines', () => {
        expect(isSafeHostname('host\nevil')).toBe(false)
    })
})
