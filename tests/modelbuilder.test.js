import { describe, it, expect } from 'vitest'
import { buildFilteredModel, hostItem, sortHosts } from '../package/contents/code/modelbuilder.js'

// Helper: create a minimal host object
function mkHost(alias, opts = {}) {
    return {
        host: alias,
        hostname: opts.hostname || alias + '.local',
        user: opts.user || '',
        icon: opts.icon || '',
        status: opts.status || 'online',
        mac: opts.mac || '',
        commands: opts.commands || []
    }
}

// Helper: default options
function defaultOpts(overrides = {}) {
    return {
        groupedHosts: [],
        searchText: '',
        hideUnreachable: false,
        enableGrouping: true,
        favorites: [],
        collapsedGroups: [],
        connectionHistory: {},
        discoveredHosts: [],
        discoverHosts: false,
        now: 1700000000000,
        ...overrides
    }
}

describe('hostItem', () => {
    it('creates a model item from a host object', () => {
        const h = mkHost('server1', { hostname: '10.0.0.1', user: 'admin', mac: 'aa:bb:cc:dd:ee:ff' })
        const item = hostItem(h, { server1: 1234 }, false)
        expect(item).toEqual({
            isHeader: false,
            host: 'server1',
            hostname: '10.0.0.1',
            user: 'admin',
            icon: '',
            status: 'online',
            discovered: false,
            lastConnected: 1234,
            mac: 'aa:bb:cc:dd:ee:ff',
            commands: []
        })
    })

    it('marks discovered hosts', () => {
        const h = mkHost('discovered1')
        const item = hostItem(h, {}, true)
        expect(item.discovered).toBe(true)
    })

    it('defaults lastConnected to 0 when not in history', () => {
        const h = mkHost('neverconnected')
        const item = hostItem(h, {}, false)
        expect(item.lastConnected).toBe(0)
    })

    it('defaults mac and commands when absent', () => {
        const h = { host: 'minimal', hostname: 'x', user: '', icon: 'x', status: 'unknown' }
        const item = hostItem(h, {}, false)
        expect(item.mac).toBe('')
        expect(item.commands).toEqual([])
    })
})

describe('buildFilteredModel', () => {
    // ── Basic rendering ──────────────────────────────────────────────

    it('returns empty array for empty groups', () => {
        expect(buildFilteredModel(defaultOpts())).toEqual([])
    })

    it('renders a single group with header and hosts', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'Servers', hosts: [mkHost('s1'), mkHost('s2')] }
            ]
        }))
        expect(result).toHaveLength(3)
        expect(result[0]).toMatchObject({ isHeader: true, groupName: 'Servers', hostCount: 2 })
        expect(result[1]).toMatchObject({ isHeader: false, host: 's1' })
        expect(result[2]).toMatchObject({ isHeader: false, host: 's2' })
    })

    it('uses "Ungrouped" for groups with empty name', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: '', hosts: [mkHost('s1')] }
            ]
        }))
        expect(result[0].groupName).toBe('Ungrouped')
    })

    it('renders multiple groups', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'A', hosts: [mkHost('a1')] },
                { name: 'B', hosts: [mkHost('b1'), mkHost('b2')] }
            ]
        }))
        expect(result).toHaveLength(5) // header + a1 + header + b1 + b2
    })

    // ── Search filtering ─────────────────────────────────────────────

    it('filters hosts by host alias', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'G', hosts: [mkHost('webserver'), mkHost('dbserver')] }
            ],
            searchText: 'web'
        }))
        const hosts = result.filter(i => !i.isHeader)
        expect(hosts).toHaveLength(1)
        expect(hosts[0].host).toBe('webserver')
    })

    it('filters hosts by hostname', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'G', hosts: [
                    mkHost('s1', { hostname: '10.0.0.1' }),
                    mkHost('s2', { hostname: '10.0.0.2' })
                ]}
            ],
            searchText: '10.0.0.2'
        }))
        const hosts = result.filter(i => !i.isHeader)
        expect(hosts).toHaveLength(1)
        expect(hosts[0].host).toBe('s2')
    })

    it('filters hosts by user', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'G', hosts: [
                    mkHost('s1', { user: 'admin' }),
                    mkHost('s2', { user: 'deploy' })
                ]}
            ],
            searchText: 'deploy'
        }))
        const hosts = result.filter(i => !i.isHeader)
        expect(hosts).toHaveLength(1)
        expect(hosts[0].host).toBe('s2')
    })

    it('search is case-insensitive', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'G', hosts: [mkHost('WebServer')] }
            ],
            searchText: 'WEBSERVER'
        }))
        const hosts = result.filter(i => !i.isHeader)
        expect(hosts).toHaveLength(1)
    })

    it('returns empty result when search matches nothing', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'G', hosts: [mkHost('server')] }
            ],
            searchText: 'zzzzz'
        }))
        expect(result).toEqual([])
    })

    // ── Favorites ────────────────────────────────────────────────────

    it('puts favorites at the top with a Favorites header', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'Servers', hosts: [mkHost('s1'), mkHost('s2'), mkHost('s3')] }
            ],
            favorites: ['s2']
        }))
        // Favorites header, s2, Servers header, s1, s3
        expect(result[0]).toMatchObject({ isHeader: true, groupName: 'Favorites', hostCount: 1 })
        expect(result[1]).toMatchObject({ host: 's2' })
        expect(result[2]).toMatchObject({ isHeader: true, groupName: 'Servers', hostCount: 2 })
    })

    it('omits Favorites header when grouping is disabled', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'Servers', hosts: [mkHost('s1'), mkHost('s2')] }
            ],
            favorites: ['s2'],
            enableGrouping: false
        }))
        // No headers at all
        const headers = result.filter(i => i.isHeader)
        expect(headers).toHaveLength(0)
        // s2 should still be first
        expect(result[0].host).toBe('s2')
    })

    // ── Recent hosts ─────────────────────────────────────────────────

    it('shows recent hosts (within 24 hours) in a Recent section', () => {
        const NOW = 1700000000000
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'G', hosts: [mkHost('recent'), mkHost('old'), mkHost('never')] }
            ],
            connectionHistory: {
                recent: NOW - 3600000,     // 1 hour ago
                old: NOW - 100000000       // ~27 hours ago
            },
            now: NOW
        }))
        // Recent header + recent host, then G header + old + never
        const recentHeader = result.find(i => i.isHeader && i.groupName === 'Recent')
        expect(recentHeader).toBeDefined()
        expect(recentHeader.hostCount).toBe(1)

        // "recent" appears after the Recent header
        const recentIdx = result.indexOf(recentHeader)
        expect(result[recentIdx + 1].host).toBe('recent')
    })

    it('sorts recent hosts by most recent first', () => {
        const NOW = 1700000000000
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'G', hosts: [mkHost('older'), mkHost('newer')] }
            ],
            connectionHistory: {
                older: NOW - 7200000,  // 2 hours ago
                newer: NOW - 3600000   // 1 hour ago
            },
            now: NOW
        }))
        const recentIdx = result.findIndex(i => i.isHeader && i.groupName === 'Recent')
        expect(result[recentIdx + 1].host).toBe('newer')
        expect(result[recentIdx + 2].host).toBe('older')
    })

    // ── Group collapsing ─────────────────────────────────────────────

    it('collapses groups — shows header only, no hosts', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'Collapsed', hosts: [mkHost('hidden1'), mkHost('hidden2')] }
            ],
            collapsedGroups: ['Collapsed']
        }))
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({
            isHeader: true,
            groupName: 'Collapsed',
            hostCount: 2,
            collapsed: true
        })
    })

    it('does not collapse groups not in collapsedGroups', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'Open', hosts: [mkHost('s1')] }
            ],
            collapsedGroups: ['Other']
        }))
        expect(result).toHaveLength(2) // header + host
        expect(result[0].collapsed).toBe(false)
    })

    // ── Offline hiding ───────────────────────────────────────────────

    it('hides offline hosts when hideUnreachable is true', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'G', hosts: [
                    mkHost('up', { status: 'online' }),
                    mkHost('down', { status: 'offline' }),
                    mkHost('checking', { status: 'checking' })
                ]}
            ],
            hideUnreachable: true
        }))
        const hosts = result.filter(i => !i.isHeader)
        expect(hosts).toHaveLength(1)
        expect(hosts[0].host).toBe('up')
    })

    it('shows all hosts when hideUnreachable is false', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'G', hosts: [
                    mkHost('up', { status: 'online' }),
                    mkHost('down', { status: 'offline' })
                ]}
            ],
            hideUnreachable: false
        }))
        const hosts = result.filter(i => !i.isHeader)
        expect(hosts).toHaveLength(2)
    })

    it('hides entire group when all hosts are offline and hideUnreachable', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'AllDown', hosts: [
                    mkHost('s1', { status: 'offline' }),
                    mkHost('s2', { status: 'offline' })
                ]}
            ],
            hideUnreachable: true
        }))
        expect(result).toEqual([])
    })

    // ── Discovered hosts ─────────────────────────────────────────────

    it('appends discovered hosts at the end', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'G', hosts: [mkHost('configured')] }
            ],
            discoveredHosts: [
                { host: 'found', hostname: '192.168.1.99', user: '', icon: 'network-wired', status: 'online' }
            ],
            discoverHosts: true
        }))
        const last = result[result.length - 1]
        expect(last.host).toBe('found')
        expect(last.discovered).toBe(true)
    })

    it('shows Discovered header', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [],
            discoveredHosts: [
                { host: 'found', hostname: '192.168.1.99', user: '', icon: 'network-wired', status: 'online' }
            ],
            discoverHosts: true
        }))
        expect(result[0]).toMatchObject({ isHeader: true, groupName: 'Discovered', hostCount: 1 })
    })

    it('does not show discovered hosts when discoverHosts is false', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [],
            discoveredHosts: [
                { host: 'found', hostname: '192.168.1.99', user: '', icon: 'network-wired', status: 'online' }
            ],
            discoverHosts: false
        }))
        expect(result).toEqual([])
    })

    it('filters discovered hosts by search text', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [],
            discoveredHosts: [
                { host: 'webhost', hostname: '192.168.1.1', user: '', icon: 'x', status: 'online' },
                { host: 'dbhost', hostname: '10.0.0.1', user: '', icon: 'x', status: 'online' }
            ],
            discoverHosts: true,
            searchText: 'web'
        }))
        const hosts = result.filter(i => !i.isHeader)
        expect(hosts).toHaveLength(1)
        expect(hosts[0].host).toBe('webhost')
    })

    it('collapses the Discovered section when in collapsedGroups', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [],
            discoveredHosts: [
                { host: 'found', hostname: '192.168.1.99', user: '', icon: 'network-wired', status: 'online' }
            ],
            discoverHosts: true,
            collapsedGroups: ['Discovered']
        }))
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({ isHeader: true, collapsed: true })
    })

    // ── Combined filters ─────────────────────────────────────────────

    it('combines search + favorites + recent correctly', () => {
        const NOW = 1700000000000
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'G', hosts: [
                    mkHost('fav-web', { hostname: '10.0.0.1' }),
                    mkHost('recent-web', { hostname: '10.0.0.2' }),
                    mkHost('regular-web', { hostname: '10.0.0.3' }),
                    mkHost('no-match', { hostname: '10.0.0.4' })
                ]}
            ],
            favorites: ['fav-web'],
            connectionHistory: { 'recent-web': NOW - 3600000 },
            searchText: 'web',
            now: NOW
        }))
        const hosts = result.filter(i => !i.isHeader)
        expect(hosts).toHaveLength(3)
        // fav-web should be first (favorites section)
        expect(hosts[0].host).toBe('fav-web')
    })

    // ── Grouping disabled ────────────────────────────────────────────

    it('omits group headers when grouping is disabled', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'A', hosts: [mkHost('a1')] },
                { name: 'B', hosts: [mkHost('b1')] }
            ],
            enableGrouping: false
        }))
        const headers = result.filter(i => i.isHeader)
        expect(headers).toHaveLength(0)
        expect(result).toHaveLength(2)
    })

    // ── Collapsed Recent section ─────────────────────────────────────

    it('collapses Recent section when in collapsedGroups', () => {
        const NOW = 1700000000000
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'G', hosts: [mkHost('recent-host')] }
            ],
            connectionHistory: { 'recent-host': NOW - 3600000 },
            collapsedGroups: ['Recent'],
            now: NOW
        }))
        const recentHeader = result.find(i => i.isHeader && i.groupName === 'Recent')
        expect(recentHeader).toBeDefined()
        expect(recentHeader.collapsed).toBe(true)
        // No host items should follow
        const hosts = result.filter(i => !i.isHeader)
        expect(hosts).toHaveLength(0)
    })
})

// ── Sort order ──────────────────────────────────────────────────────

describe('sortHosts', () => {
    it('sorts alphabetically by host alias', () => {
        const hosts = [mkHost('charlie'), mkHost('alpha'), mkHost('bravo')]
        sortHosts(hosts, 'alphabetical', {})
        expect(hosts.map(h => h.host)).toEqual(['alpha', 'bravo', 'charlie'])
    })

    it('sorts alphabetically case-insensitively', () => {
        const hosts = [mkHost('Zulu'), mkHost('alpha'), mkHost('Bravo')]
        sortHosts(hosts, 'alphabetical', {})
        expect(hosts.map(h => h.host)).toEqual(['alpha', 'Bravo', 'Zulu'])
    })

    it('sorts by most recently connected first', () => {
        const hosts = [mkHost('old'), mkHost('new'), mkHost('mid')]
        const history = { old: 100, new: 300, mid: 200 }
        sortHosts(hosts, 'recent', history)
        expect(hosts.map(h => h.host)).toEqual(['new', 'mid', 'old'])
    })

    it('preserves order for never-connected hosts in recent sort', () => {
        const hosts = [mkHost('a'), mkHost('b'), mkHost('c')]
        sortHosts(hosts, 'recent', {})
        expect(hosts.map(h => h.host)).toEqual(['a', 'b', 'c'])
    })

    it('does not reorder in config sort', () => {
        const hosts = [mkHost('charlie'), mkHost('alpha'), mkHost('bravo')]
        sortHosts(hosts, 'config', {})
        expect(hosts.map(h => h.host)).toEqual(['charlie', 'alpha', 'bravo'])
    })
})

describe('buildFilteredModel with sortOrder', () => {
    const NOW = 1700000000000

    it('sorts hosts alphabetically within groups when grouped', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'G', hosts: [mkHost('charlie'), mkHost('alpha'), mkHost('bravo')] }
            ],
            sortOrder: 'alphabetical',
            now: NOW
        }))
        const hosts = result.filter(i => !i.isHeader)
        expect(hosts.map(h => h.host)).toEqual(['alpha', 'bravo', 'charlie'])
    })

    it('sorts hosts by recent within groups when grouped', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'G', hosts: [mkHost('a'), mkHost('b'), mkHost('c')] }
            ],
            connectionHistory: { a: NOW - 9000000, b: NOW - 1000000, c: NOW - 5000000 },
            sortOrder: 'recent',
            now: NOW
        }))
        const hosts = result.filter(i => !i.isHeader)
        expect(hosts.map(h => h.host)).toEqual(['b', 'c', 'a'])
    })

    it('does not create Recent group when sortOrder is recent', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'G', hosts: [mkHost('a'), mkHost('b')] }
            ],
            connectionHistory: { a: NOW - 3600000 },
            sortOrder: 'recent',
            now: NOW
        }))
        const recentHeader = result.find(i => i.isHeader && i.groupName === 'Recent')
        expect(recentHeader).toBeUndefined()
    })

    it('still creates Recent group when sortOrder is config', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'G', hosts: [mkHost('a'), mkHost('b')] }
            ],
            connectionHistory: { a: NOW - 3600000 },
            sortOrder: 'config',
            now: NOW
        }))
        const recentHeader = result.find(i => i.isHeader && i.groupName === 'Recent')
        expect(recentHeader).toBeDefined()
    })

    it('no Recent group header when grouping disabled', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'G', hosts: [mkHost('a'), mkHost('b')] }
            ],
            connectionHistory: { a: NOW - 3600000 },
            enableGrouping: false,
            sortOrder: 'config',
            now: NOW
        }))
        const headers = result.filter(i => i.isHeader)
        expect(headers).toHaveLength(0)
    })

    it('sorts flat list alphabetically when ungrouped', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'G1', hosts: [mkHost('charlie'), mkHost('alpha')] },
                { name: 'G2', hosts: [mkHost('bravo')] }
            ],
            enableGrouping: false,
            sortOrder: 'alphabetical',
            now: NOW
        }))
        const hosts = result.filter(i => !i.isHeader)
        expect(hosts.map(h => h.host)).toEqual(['alpha', 'bravo', 'charlie'])
    })

    it('sorts flat list by recent when ungrouped', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'G', hosts: [mkHost('a'), mkHost('b'), mkHost('c')] }
            ],
            connectionHistory: { b: NOW - 1000, a: NOW - 5000 },
            enableGrouping: false,
            sortOrder: 'recent',
            now: NOW
        }))
        const hosts = result.filter(i => !i.isHeader)
        expect(hosts.map(h => h.host)).toEqual(['b', 'a', 'c'])
    })

    it('favorites still appear first when ungrouped with sort', () => {
        const result = buildFilteredModel(defaultOpts({
            groupedHosts: [
                { name: 'G', hosts: [mkHost('a'), mkHost('b'), mkHost('c')] }
            ],
            favorites: ['c'],
            enableGrouping: false,
            sortOrder: 'alphabetical',
            now: NOW
        }))
        const hosts = result.filter(i => !i.isHeader)
        expect(hosts[0].host).toBe('c')
        expect(hosts.slice(1).map(h => h.host)).toEqual(['a', 'b'])
    })
})
