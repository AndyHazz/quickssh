import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseConfig } from '../package/contents/code/sshconfig.js'

function fixture(name) {
    return readFileSync(join(__dirname, 'fixtures', name), 'utf-8')
}

describe('parseConfig', () => {
    // ── Empty / trivial input ────────────────────────────────────────

    it('returns empty groups for empty string', () => {
        const result = parseConfig('')
        expect(result.groups).toEqual([])
        expect(result.rawBlocks).toEqual([])
    })

    it('returns empty groups for whitespace-only input', () => {
        expect(parseConfig('   \n\n   \n').groups).toEqual([])
    })

    it('returns empty groups for comments-only input', () => {
        expect(parseConfig('# just a comment\n# another comment').groups).toEqual([])
    })

    // ── Basic host parsing ───────────────────────────────────────────

    it('parses a single host with HostName and User', () => {
        const result = parseConfig('Host myserver\n  HostName 10.0.0.1\n  User admin')
        expect(result.groups).toHaveLength(1)
        expect(result.groups[0].name).toBe('')
        const host = result.groups[0].hosts[0]
        expect(host.host).toBe('myserver')
        expect(host.hostname).toBe('10.0.0.1')
        expect(host.user).toBe('admin')
        expect(host.port).toBe('')
        expect(host.identityFile).toBe('')
        expect(host.icon).toBe('')
        expect(host.status).toBe('unknown')
        expect(host.mac).toBe('')
        expect(host.commands).toEqual([])
        expect(host.options).toEqual([])
    })

    it('parses multiple hosts from fixture', () => {
        const result = parseConfig(fixture('basic.sshconfig'))
        expect(result.groups).toHaveLength(1)
        expect(result.groups[0].hosts).toHaveLength(2)
        expect(result.groups[0].hosts[0].host).toBe('webserver')
        expect(result.groups[0].hosts[0].hostname).toBe('192.168.1.10')
        expect(result.groups[0].hosts[0].user).toBe('admin')
        expect(result.groups[0].hosts[1].host).toBe('dbserver')
        expect(result.groups[0].hosts[1].hostname).toBe('192.168.1.20')
        expect(result.groups[0].hosts[1].user).toBe('root')
    })

    it('defaults hostname to host alias when HostName is absent', () => {
        const result = parseConfig('Host mybox\n  User me')
        const host = result.groups[0].hosts[0]
        expect(host.host).toBe('mybox')
        expect(host.hostname).toBe('mybox')
    })

    // ── Port and IdentityFile ────────────────────────────────────────

    it('parses Port as a dedicated field', () => {
        const result = parseConfig('Host myserver\n  HostName 10.0.0.1\n  Port 2222')
        const host = result.groups[0].hosts[0]
        expect(host.port).toBe('2222')
    })

    it('parses IdentityFile as a dedicated field', () => {
        const result = parseConfig('Host myserver\n  HostName 10.0.0.1\n  IdentityFile ~/.ssh/id_rsa')
        const host = result.groups[0].hosts[0]
        expect(host.identityFile).toBe('~/.ssh/id_rsa')
    })

    it('parses Port case-insensitively', () => {
        const result = parseConfig('Host myserver\n  port 3333')
        expect(result.groups[0].hosts[0].port).toBe('3333')
    })

    it('parses IdentityFile case-insensitively', () => {
        const result = parseConfig('Host myserver\n  identityfile /tmp/key')
        expect(result.groups[0].hosts[0].identityFile).toBe('/tmp/key')
    })

    // ── Additional options capture ───────────────────────────────────

    it('captures unknown SSH directives in options[]', () => {
        const input = 'Host myserver\n  HostName 10.0.0.1\n  ProxyJump bastion\n  ForwardAgent yes'
        const result = parseConfig(input)
        const host = result.groups[0].hosts[0]
        expect(host.options).toEqual([
            { key: 'ProxyJump', value: 'bastion' },
            { key: 'ForwardAgent', value: 'yes' }
        ])
    })

    it('preserves option ordering', () => {
        const input = [
            'Host myserver',
            '  ServerAliveInterval 60',
            '  ServerAliveCountMax 3',
            '  Compression yes'
        ].join('\n')
        const result = parseConfig(input)
        const opts = result.groups[0].hosts[0].options
        expect(opts[0].key).toBe('ServerAliveInterval')
        expect(opts[1].key).toBe('ServerAliveCountMax')
        expect(opts[2].key).toBe('Compression')
    })

    it('does not put known directives in options[]', () => {
        const input = 'Host myserver\n  HostName 10.0.0.1\n  User admin\n  Port 22\n  IdentityFile ~/.ssh/key'
        const result = parseConfig(input)
        expect(result.groups[0].hosts[0].options).toEqual([])
    })

    it('handles mixed known and unknown directives', () => {
        const input = [
            'Host myserver',
            '  HostName 10.0.0.1',
            '  User admin',
            '  Port 2222',
            '  ProxyJump bastion',
            '  IdentityFile ~/.ssh/id_rsa',
            '  ForwardAgent yes'
        ].join('\n')
        const result = parseConfig(input)
        const host = result.groups[0].hosts[0]
        expect(host.hostname).toBe('10.0.0.1')
        expect(host.user).toBe('admin')
        expect(host.port).toBe('2222')
        expect(host.identityFile).toBe('~/.ssh/id_rsa')
        expect(host.options).toEqual([
            { key: 'ProxyJump', value: 'bastion' },
            { key: 'ForwardAgent', value: 'yes' }
        ])
    })

    // ── Case insensitivity ───────────────────────────────────────────

    it('parses Host directive case-insensitively', () => {
        const result = parseConfig('host myserver\n  hostname 10.0.0.1\n  user admin')
        expect(result.groups[0].hosts[0].host).toBe('myserver')
        expect(result.groups[0].hosts[0].hostname).toBe('10.0.0.1')
        expect(result.groups[0].hosts[0].user).toBe('admin')
    })

    it('parses HOST directive in uppercase', () => {
        const result = parseConfig('HOST myserver\n  HOSTNAME 10.0.0.1\n  USER admin')
        expect(result.groups[0].hosts[0].host).toBe('myserver')
        expect(result.groups[0].hosts[0].hostname).toBe('10.0.0.1')
        expect(result.groups[0].hosts[0].user).toBe('admin')
    })

    // ── Whitespace tolerance ─────────────────────────────────────────

    it('handles leading/trailing whitespace and tabs', () => {
        const input = '  \t Host myserver  \n\t  HostName  10.0.0.1  \n  \tUser  admin  '
        const result = parseConfig(input)
        expect(result.groups[0].hosts[0].host).toBe('myserver')
        expect(result.groups[0].hosts[0].hostname).toBe('10.0.0.1')
        expect(result.groups[0].hosts[0].user).toBe('admin')
    })

    // ── Group directives ─────────────────────────────────────────────

    it('parses GroupStart and GroupEnd', () => {
        const result = parseConfig(fixture('grouped.sshconfig'))
        expect(result.groups).toHaveLength(2)
        expect(result.groups[0].name).toBe('Production')
        expect(result.groups[0].hosts).toHaveLength(2)
        expect(result.groups[1].name).toBe('Staging')
        expect(result.groups[1].hosts).toHaveLength(2)
    })

    it('handles nested groups (implicit close of previous group)', () => {
        const input = [
            '# GroupStart Group A',
            'Host a1',
            '  HostName 10.0.0.1',
            '# GroupStart Group B',
            'Host b1',
            '  HostName 10.0.0.2'
        ].join('\n')
        const result = parseConfig(input)
        expect(result.groups).toHaveLength(2)
        expect(result.groups[0].name).toBe('Group A')
        expect(result.groups[0].hosts).toHaveLength(1)
        expect(result.groups[1].name).toBe('Group B')
        expect(result.groups[1].hosts).toHaveLength(1)
    })

    it('handles GroupEnd without GroupStart (empty group is skipped)', () => {
        const input = 'Host standalone\n  HostName 10.0.0.1\n# GroupEnd'
        const result = parseConfig(input)
        expect(result.groups).toHaveLength(1)
        expect(result.groups[0].hosts[0].host).toBe('standalone')
    })

    it('handles hosts after GroupEnd (ungrouped)', () => {
        const input = [
            '# GroupStart Grouped',
            'Host grouped1',
            '  HostName 10.0.0.1',
            '# GroupEnd',
            'Host ungrouped1',
            '  HostName 10.0.0.2'
        ].join('\n')
        const result = parseConfig(input)
        expect(result.groups).toHaveLength(2)
        expect(result.groups[0].name).toBe('Grouped')
        expect(result.groups[1].name).toBe('')
        expect(result.groups[1].hosts[0].host).toBe('ungrouped1')
    })

    it('handles GroupStart case-insensitively', () => {
        const input = '# groupstart MyGroup\nHost s1\n  HostName 10.0.0.1\n# groupend'
        const result = parseConfig(input)
        expect(result.groups[0].name).toBe('MyGroup')
    })

    // ── Wildcard filtering ───────────────────────────────────────────

    it('skips wildcard-only hosts (Host *)', () => {
        const result = parseConfig('Host *\n  ServerAliveInterval 60\n\nHost real\n  HostName 10.0.0.1')
        expect(result.groups).toHaveLength(1)
        expect(result.groups[0].hosts).toHaveLength(1)
        expect(result.groups[0].hosts[0].host).toBe('real')
    })

    it('skips hosts with ? wildcards', () => {
        const result = parseConfig('Host web-?\n  User webadmin')
        expect(result.groups).toEqual([])
    })

    it('filters wildcards from fixture', () => {
        const result = parseConfig(fixture('wildcards.sshconfig'))
        expect(result.groups).toHaveLength(1)
        expect(result.groups[0].hosts).toHaveLength(1)
        expect(result.groups[0].hosts[0].host).toBe('production')
    })

    it('handles Host line with only wildcards — produces zero entries', () => {
        const result = parseConfig('Host * ?server\n  User root')
        expect(result.groups).toEqual([])
    })

    // ── Multi-host lines ─────────────────────────────────────────────

    it('creates separate entries for multi-host lines', () => {
        const input = 'Host foo bar baz\n  HostName shared.example.com\n  User deploy'
        const result = parseConfig(input)
        expect(result.groups[0].hosts).toHaveLength(3)
        expect(result.groups[0].hosts[0].host).toBe('foo')
        expect(result.groups[0].hosts[1].host).toBe('bar')
        expect(result.groups[0].hosts[2].host).toBe('baz')
        // HostName/User only applies to the last entry (currentHost)
        // Earlier entries keep host alias as their hostname
        expect(result.groups[0].hosts[0].hostname).toBe('foo')
        expect(result.groups[0].hosts[1].hostname).toBe('bar')
        expect(result.groups[0].hosts[2].hostname).toBe('shared.example.com')
        expect(result.groups[0].hosts[2].user).toBe('deploy')
    })

    it('filters wildcards from multi-host lines', () => {
        const input = 'Host real * alsoreal\n  HostName 10.0.0.1'
        const result = parseConfig(input)
        expect(result.groups[0].hosts).toHaveLength(2)
        expect(result.groups[0].hosts[0].host).toBe('real')
        expect(result.groups[0].hosts[1].host).toBe('alsoreal')
    })

    // ── Icon directive ───────────────────────────────────────────────

    it('applies Icon to the next Host block', () => {
        const input = '# Icon server-database\nHost mydb\n  HostName db.local'
        const result = parseConfig(input)
        expect(result.groups[0].hosts[0].icon).toBe('server-database')
    })

    it('resets Icon after the Host block (does not leak)', () => {
        const input = [
            '# Icon server-database',
            'Host first',
            '  HostName 10.0.0.1',
            'Host second',
            '  HostName 10.0.0.2'
        ].join('\n')
        const result = parseConfig(input)
        expect(result.groups[0].hosts[0].icon).toBe('server-database')
        expect(result.groups[0].hosts[1].icon).toBe('')
    })

    it('uses default icon when no Icon directive', () => {
        const result = parseConfig('Host plain\n  HostName 10.0.0.1')
        expect(result.groups[0].hosts[0].icon).toBe('')
    })

    // ── MAC directive ────────────────────────────────────────────────

    it('parses valid MAC address', () => {
        const input = '# MAC aa:bb:cc:dd:ee:ff\nHost wol-server\n  HostName 10.0.0.1'
        const result = parseConfig(input)
        expect(result.groups[0].hosts[0].mac).toBe('aa:bb:cc:dd:ee:ff')
    })

    it('ignores invalid MAC format (too short)', () => {
        const input = '# MAC aa:bb:cc\nHost server\n  HostName 10.0.0.1'
        const result = parseConfig(input)
        expect(result.groups[0].hosts[0].mac).toBe('')
    })

    it('ignores invalid MAC format (non-hex characters)', () => {
        const input = '# MAC zz:zz:zz:zz:zz:zz\nHost server\n  HostName 10.0.0.1'
        const result = parseConfig(input)
        expect(result.groups[0].hosts[0].mac).toBe('')
    })

    it('resets MAC after the Host block (does not leak)', () => {
        const input = [
            '# MAC aa:bb:cc:dd:ee:ff',
            'Host first',
            '  HostName 10.0.0.1',
            'Host second',
            '  HostName 10.0.0.2'
        ].join('\n')
        const result = parseConfig(input)
        expect(result.groups[0].hosts[0].mac).toBe('aa:bb:cc:dd:ee:ff')
        expect(result.groups[0].hosts[1].mac).toBe('')
    })

    it('accepts uppercase MAC addresses', () => {
        const input = '# MAC AA:BB:CC:DD:EE:FF\nHost server\n  HostName 10.0.0.1'
        const result = parseConfig(input)
        expect(result.groups[0].hosts[0].mac).toBe('AA:BB:CC:DD:EE:FF')
    })

    // ── Command directive ────────────────────────────────────────────

    it('parses a single Command directive', () => {
        const input = '# Command restart-nginx\nHost server\n  HostName 10.0.0.1'
        const result = parseConfig(input)
        expect(result.groups[0].hosts[0].commands).toEqual([{ name: '', cmd: 'restart-nginx' }])
    })

    it('accumulates multiple Command directives', () => {
        const input = [
            '# Command restart-nginx',
            '# Command check-logs',
            '# Command deploy',
            'Host server',
            '  HostName 10.0.0.1'
        ].join('\n')
        const result = parseConfig(input)
        expect(result.groups[0].hosts[0].commands).toEqual([{ name: '', cmd: 'restart-nginx' }, { name: '', cmd: 'check-logs' }, { name: '', cmd: 'deploy' }])
    })

    it('resets Commands after the Host block (does not leak)', () => {
        const input = [
            '# Command special-cmd',
            'Host first',
            '  HostName 10.0.0.1',
            'Host second',
            '  HostName 10.0.0.2'
        ].join('\n')
        const result = parseConfig(input)
        expect(result.groups[0].hosts[0].commands).toEqual([{ name: '', cmd: 'special-cmd' }])
        expect(result.groups[0].hosts[1].commands).toEqual([])
    })

    it('parses a named command with [brackets]', () => {
        const input = '# Command [Deploy App] deploy.sh --prod\nHost server\n  HostName 10.0.0.1'
        const result = parseConfig(input)
        expect(result.groups[0].hosts[0].commands).toEqual([
            { name: 'Deploy App', cmd: 'deploy.sh --prod' }
        ])
    })

    it('parses an unnamed command as {name: "", cmd: "..."}', () => {
        const input = '# Command restart-nginx\nHost server\n  HostName 10.0.0.1'
        const result = parseConfig(input)
        expect(result.groups[0].hosts[0].commands).toEqual([
            { name: '', cmd: 'restart-nginx' }
        ])
    })

    it('parses mixed named and unnamed commands', () => {
        const input = [
            '# Command [Deploy] deploy.sh --prod',
            '# Command check-logs',
            '# Command [Restart] systemctl restart nginx',
            'Host server',
            '  HostName 10.0.0.1'
        ].join('\n')
        const result = parseConfig(input)
        expect(result.groups[0].hosts[0].commands).toEqual([
            { name: 'Deploy', cmd: 'deploy.sh --prod' },
            { name: '', cmd: 'check-logs' },
            { name: 'Restart', cmd: 'systemctl restart nginx' }
        ])
    })

    it('handles bracket name with special characters in command', () => {
        const input = '# Command [View Logs] tail -f /var/log/*.log | grep error\nHost server\n  HostName 10.0.0.1'
        const result = parseConfig(input)
        expect(result.groups[0].hosts[0].commands).toEqual([
            { name: 'View Logs', cmd: 'tail -f /var/log/*.log | grep error' }
        ])
    })

    // ── Pending state reset ──────────────────────────────────────────

    it('resets all pending metadata (icon + mac + commands) after Host', () => {
        const input = [
            '# Icon custom-icon',
            '# MAC 11:22:33:44:55:66',
            '# Command do-thing',
            'Host first',
            '  HostName 10.0.0.1',
            'Host second',
            '  HostName 10.0.0.2'
        ].join('\n')
        const result = parseConfig(input)
        const first = result.groups[0].hosts[0]
        const second = result.groups[0].hosts[1]
        expect(first.icon).toBe('custom-icon')
        expect(first.mac).toBe('11:22:33:44:55:66')
        expect(first.commands).toEqual([{ name: '', cmd: 'do-thing' }])
        expect(second.icon).toBe('')
        expect(second.mac).toBe('')
        expect(second.commands).toEqual([])
    })

    // ── Final host/group flush ───────────────────────────────────────

    it('does not drop the last host at end of file', () => {
        const input = 'Host lasthost\n  HostName last.local'
        const result = parseConfig(input)
        expect(result.groups[0].hosts).toHaveLength(1)
        expect(result.groups[0].hosts[0].host).toBe('lasthost')
    })

    it('does not drop the last group at end of file', () => {
        const input = '# GroupStart Final\nHost final\n  HostName 10.0.0.1'
        const result = parseConfig(input)
        expect(result.groups).toHaveLength(1)
        expect(result.groups[0].name).toBe('Final')
        expect(result.groups[0].hosts).toHaveLength(1)
    })

    it('handles file with no trailing newline', () => {
        const input = 'Host notrail\n  HostName 10.0.0.1\n  User admin'
        const result = parseConfig(input)
        expect(result.groups[0].hosts[0].host).toBe('notrail')
        expect(result.groups[0].hosts[0].user).toBe('admin')
    })

    // ── Comments and blank lines ─────────────────────────────────────

    it('ignores regular comments and blank lines', () => {
        const input = [
            '# This is a comment',
            '',
            '# Another comment',
            'Host server',
            '  # Inline comment area',
            '  HostName 10.0.0.1',
            '',
            '  User admin'
        ].join('\n')
        const result = parseConfig(input)
        expect(result.groups[0].hosts).toHaveLength(1)
        expect(result.groups[0].hosts[0].host).toBe('server')
        expect(result.groups[0].hosts[0].user).toBe('admin')
    })

    // ── Directives before any Host ───────────────────────────────────

    it('silently ignores HostName before any Host block', () => {
        const input = 'HostName orphan.local\nHost real\n  HostName 10.0.0.1'
        const result = parseConfig(input)
        expect(result.groups[0].hosts).toHaveLength(1)
        expect(result.groups[0].hosts[0].hostname).toBe('10.0.0.1')
    })

    it('silently ignores User before any Host block', () => {
        const input = 'User orphan\nHost real\n  HostName 10.0.0.1\n  User admin'
        const result = parseConfig(input)
        expect(result.groups[0].hosts[0].user).toBe('admin')
    })

    // ── Complex fixture ──────────────────────────────────────────────

    it('parses complex fixture with all directives combined', () => {
        const result = parseConfig(fixture('complex.sshconfig'))
        expect(result.groups).toHaveLength(3)

        // Group: Servers
        expect(result.groups[0].name).toBe('Servers')
        expect(result.groups[0].hosts).toHaveLength(2)

        const mainServer = result.groups[0].hosts[0]
        expect(mainServer.host).toBe('main-server')
        expect(mainServer.hostname).toBe('192.168.1.100')
        expect(mainServer.user).toBe('admin')
        expect(mainServer.icon).toBe('server-database')
        expect(mainServer.mac).toBe('aa:bb:cc:dd:ee:ff')
        expect(mainServer.commands).toEqual([{ name: '', cmd: 'restart-nginx' }, { name: '', cmd: 'check-logs' }])

        const backupServer = result.groups[0].hosts[1]
        expect(backupServer.host).toBe('backup-server')
        expect(backupServer.icon).toBe('')
        expect(backupServer.mac).toBe('')
        expect(backupServer.commands).toEqual([])

        // Group: Development
        expect(result.groups[1].name).toBe('Development')
        expect(result.groups[1].hosts).toHaveLength(1)

        // Ungrouped
        expect(result.groups[2].name).toBe('')
        expect(result.groups[2].hosts[0].host).toBe('standalone')
    })

    // ── Edge cases fixture ───────────────────────────────────────────

    it('handles effectively empty fixture', () => {
        const result = parseConfig(fixture('edgecases.sshconfig'))
        expect(result.groups).toEqual([])
    })

    // ── Performance ──────────────────────────────────────────────────

    it('handles large config files (500+ hosts) without issues', () => {
        let config = ''
        for (let i = 0; i < 500; i++) {
            config += `Host server-${i}\n  HostName 10.0.${Math.floor(i / 256)}.${i % 256}\n  User user${i}\n\n`
        }
        const result = parseConfig(config)
        const totalHosts = result.groups.reduce((sum, g) => sum + g.hosts.length, 0)
        expect(totalHosts).toBe(500)
    })

    // ── Multi-host with mixed wildcards ──────────────────────────────

    it('handles multi-host line where all entries are wildcards', () => {
        const result = parseConfig('Host * ?\n  User root')
        expect(result.groups).toEqual([])
    })

    // ── Icon applies to all entries in multi-host line ────────────────

    it('applies pending Icon to all hosts in a multi-host line', () => {
        const input = '# Icon custom\nHost foo bar\n  HostName shared.local'
        const result = parseConfig(input)
        expect(result.groups[0].hosts).toHaveLength(2)
        expect(result.groups[0].hosts[0].icon).toBe('custom')
        expect(result.groups[0].hosts[1].icon).toBe('custom')
    })

    // ── MAC applies to all entries in multi-host line ─────────────────

    it('applies pending MAC to all hosts in a multi-host line', () => {
        const input = '# MAC 11:22:33:44:55:66\nHost foo bar\n  HostName shared.local'
        const result = parseConfig(input)
        expect(result.groups[0].hosts[0].mac).toBe('11:22:33:44:55:66')
        expect(result.groups[0].hosts[1].mac).toBe('11:22:33:44:55:66')
    })

    // ── GroupStart with extra spacing ─────────────────────────────────

    it('handles GroupStart with extra spacing between # and keyword', () => {
        const input = '#  GroupStart  Spaced Group  \nHost s\n  HostName 1.2.3.4\n#  GroupEnd'
        const result = parseConfig(input)
        expect(result.groups[0].name).toBe('Spaced Group')
    })

    // ── rawBlocks: wildcard host preservation ─────────────────────────

    it('preserves Host * blocks in rawBlocks', () => {
        const input = [
            'Host *',
            '    ServerAliveInterval 60',
            '    ServerAliveCountMax 3',
            '',
            'Host myserver',
            '    HostName 10.0.0.1'
        ].join('\n')
        const result = parseConfig(input)
        expect(result.groups).toHaveLength(1)
        expect(result.groups[0].hosts[0].host).toBe('myserver')
        expect(result.rawBlocks).toHaveLength(1)
        expect(result.rawBlocks[0]).toContain('Host *')
        expect(result.rawBlocks[0]).toContain('ServerAliveInterval 60')
        expect(result.rawBlocks[0]).toContain('ServerAliveCountMax 3')
    })

    it('preserves Host * block at end of file', () => {
        const input = [
            'Host myserver',
            '    HostName 10.0.0.1',
            '',
            'Host *',
            '    ForwardAgent no'
        ].join('\n')
        const result = parseConfig(input)
        expect(result.groups).toHaveLength(1)
        expect(result.rawBlocks).toHaveLength(1)
        expect(result.rawBlocks[0]).toContain('Host *')
        expect(result.rawBlocks[0]).toContain('ForwardAgent no')
    })

    it('preserves Host ? pattern blocks in rawBlocks', () => {
        const input = 'Host web-?\n  User webadmin\n  Port 2222\n\nHost real\n  HostName 10.0.0.1'
        const result = parseConfig(input)
        expect(result.groups).toHaveLength(1)
        expect(result.groups[0].hosts[0].host).toBe('real')
        expect(result.rawBlocks).toHaveLength(1)
        expect(result.rawBlocks[0]).toContain('Host web-?')
        expect(result.rawBlocks[0]).toContain('User webadmin')
    })

    it('preserves multiple wildcard blocks', () => {
        const input = [
            'Host *',
            '    ServerAliveInterval 60',
            '',
            'Host myserver',
            '    HostName 10.0.0.1',
            '',
            'Host *.internal',
            '    ProxyJump bastion'
        ].join('\n')
        const result = parseConfig(input)
        expect(result.rawBlocks).toHaveLength(2)
    })

    // ── rawBlocks: Include directive preservation ─────────────────────

    it('preserves Include directives in rawBlocks', () => {
        const input = [
            'Include ~/.ssh/config.d/*',
            '',
            'Host myserver',
            '    HostName 10.0.0.1'
        ].join('\n')
        const result = parseConfig(input)
        expect(result.groups).toHaveLength(1)
        expect(result.rawBlocks).toHaveLength(1)
        expect(result.rawBlocks[0]).toContain('Include ~/.ssh/config.d/*')
    })

    // ── rawBlocks: Match block preservation ───────────────────────────

    it('preserves Match blocks in rawBlocks', () => {
        const input = [
            'Match host bastion',
            '    ForwardAgent yes',
            '    IdentityFile ~/.ssh/bastion_key',
            '',
            'Host myserver',
            '    HostName 10.0.0.1'
        ].join('\n')
        const result = parseConfig(input)
        expect(result.groups).toHaveLength(1)
        expect(result.rawBlocks).toHaveLength(1)
        expect(result.rawBlocks[0]).toContain('Match host bastion')
        expect(result.rawBlocks[0]).toContain('ForwardAgent yes')
    })

    it('resets pending directives when hitting a wildcard host', () => {
        const input = [
            '# Icon custom-icon',
            '# MAC aa:bb:cc:dd:ee:ff',
            '# Command do-thing',
            'Host *',
            '    ServerAliveInterval 60',
            '',
            'Host myserver',
            '    HostName 10.0.0.1'
        ].join('\n')
        const result = parseConfig(input)
        const host = result.groups[0].hosts[0]
        // Pending directives were reset, not applied to myserver
        expect(host.icon).toBe('')
        expect(host.mac).toBe('')
        expect(host.commands).toEqual([])
    })
})
