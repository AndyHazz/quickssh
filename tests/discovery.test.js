import { describe, it, expect } from 'vitest'
import { parseDiscoveredHosts } from '../package/contents/code/discovery.js'

describe('parseDiscoveredHosts', () => {
    // ── Standard avahi output ────────────────────────────────────────

    it('parses standard avahi-browse output', () => {
        const output = '=;eth0;IPv4;myhost;_ssh._tcp;local;myhost.local;192.168.1.50;22;'
        const result = parseDiscoveredHosts(output, [])
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            host: 'myhost',
            hostname: '192.168.1.50',
            user: '',
            icon: 'network-wired',
            status: 'online'
        })
    })

    it('parses multiple hosts from avahi output', () => {
        const output = [
            '=;eth0;IPv4;host1;_ssh._tcp;local;host1.local;192.168.1.10;22;',
            '=;eth0;IPv4;host2;_ssh._tcp;local;host2.local;192.168.1.11;22;'
        ].join('\n')
        const result = parseDiscoveredHosts(output, [])
        expect(result).toHaveLength(2)
        expect(result[0].host).toBe('host1')
        expect(result[1].host).toBe('host2')
    })

    // ── IPv6 filtering ───────────────────────────────────────────────

    it('filters out IPv6 entries', () => {
        const output = [
            '=;eth0;IPv4;host1;_ssh._tcp;local;host1.local;192.168.1.10;22;',
            '=;eth0;IPv6;host1;_ssh._tcp;local;host1.local;fe80::1;22;'
        ].join('\n')
        const result = parseDiscoveredHosts(output, [])
        expect(result).toHaveLength(1)
        expect(result[0].hostname).toBe('192.168.1.10')
    })

    // ── Duplicate addresses ──────────────────────────────────────────

    it('deduplicates entries with the same IP address', () => {
        const output = [
            '=;eth0;IPv4;host1;_ssh._tcp;local;host1.local;192.168.1.10;22;',
            '=;wlan0;IPv4;host1;_ssh._tcp;local;host1.local;192.168.1.10;22;'
        ].join('\n')
        const result = parseDiscoveredHosts(output, [])
        expect(result).toHaveLength(1)
    })

    // ── Already-configured hosts ─────────────────────────────────────

    it('excludes hosts whose address matches existing config', () => {
        const output = '=;eth0;IPv4;myhost;_ssh._tcp;local;myhost.local;192.168.1.50;22;'
        const result = parseDiscoveredHosts(output, ['192.168.1.50'])
        expect(result).toHaveLength(0)
    })

    it('excludes hosts whose mDNS hostname matches existing config', () => {
        const output = '=;eth0;IPv4;myhost;_ssh._tcp;local;myhost.local;192.168.1.50;22;'
        const result = parseDiscoveredHosts(output, ['myhost.local'])
        expect(result).toHaveLength(0)
    })

    it('matches configured hostnames case-insensitively', () => {
        const output = '=;eth0;IPv4;MyHost;_ssh._tcp;local;MyHost.local;192.168.1.50;22;'
        const result = parseDiscoveredHosts(output, ['MYHOST.LOCAL'])
        expect(result).toHaveLength(0)
    })

    // ── Malformed lines ──────────────────────────────────────────────

    it('ignores lines that do not start with =', () => {
        const output = [
            '+;eth0;IPv4;host1;_ssh._tcp;local',
            '=;eth0;IPv4;host2;_ssh._tcp;local;host2.local;192.168.1.20;22;'
        ].join('\n')
        const result = parseDiscoveredHosts(output, [])
        expect(result).toHaveLength(1)
        expect(result[0].host).toBe('host2')
    })

    it('ignores lines with fewer than 9 fields', () => {
        const output = [
            '=;eth0;IPv4;short;_ssh',
            '=;eth0;IPv4;host2;_ssh._tcp;local;host2.local;192.168.1.20;22;'
        ].join('\n')
        const result = parseDiscoveredHosts(output, [])
        expect(result).toHaveLength(1)
    })

    // ── Empty output ─────────────────────────────────────────────────

    it('returns empty array for empty string', () => {
        expect(parseDiscoveredHosts('', [])).toEqual([])
    })

    it('returns empty array for whitespace-only output', () => {
        expect(parseDiscoveredHosts('\n\n', [])).toEqual([])
    })

    // ── Mixed valid and invalid lines ────────────────────────────────

    it('handles a mix of valid, invalid, and IPv6 lines', () => {
        const output = [
            '+ eth0 IPv4 host1 _ssh._tcp local',
            '=;eth0;IPv6;host2;_ssh._tcp;local;host2.local;fe80::1;22;',
            '=;eth0;IPv4;host3;_ssh._tcp;local;host3.local;192.168.1.30;22;',
            '=;short',
            '=;eth0;IPv4;host4;_ssh._tcp;local;host4.local;192.168.1.40;22;'
        ].join('\n')
        const result = parseDiscoveredHosts(output, [])
        expect(result).toHaveLength(2)
        expect(result[0].host).toBe('host3')
        expect(result[1].host).toBe('host4')
    })
})
