import { describe, it, expect } from 'vitest'
import { serializeConfig } from '../package/contents/code/sshserializer.js'
import { parseConfig } from '../package/contents/code/sshconfig.js'
import { readFileSync } from 'fs'
import { join } from 'path'

function fixture(name) {
    return readFileSync(join(__dirname, 'fixtures', name), 'utf-8')
}

describe('serializeConfig', () => {
    // ── Basic serialization ──────────────────────────────────────────

    it('serializes a single ungrouped host', () => {
        const groups = [{
            name: "",
            hosts: [{
                host: "myserver",
                hostname: "10.0.0.1",
                user: "admin",
                port: "",
                identityFile: "",
                icon: "network-server",
                mac: "",
                commands: [],
                options: []
            }]
        }]
        const result = serializeConfig(groups)
        expect(result).toContain("Host myserver")
        expect(result).toContain("    HostName 10.0.0.1")
        expect(result).toContain("    User admin")
        expect(result).not.toContain("# GroupStart")
        expect(result).not.toContain("# GroupEnd")
    })

    it('omits HostName when it matches host alias', () => {
        const groups = [{
            name: "",
            hosts: [{
                host: "myserver",
                hostname: "myserver",
                user: "",
                port: "",
                identityFile: "",
                icon: "network-server",
                mac: "",
                commands: [],
                options: []
            }]
        }]
        const result = serializeConfig(groups)
        expect(result).toContain("Host myserver")
        expect(result).not.toContain("HostName")
    })

    it('includes Port when set', () => {
        const groups = [{
            name: "",
            hosts: [{
                host: "myserver",
                hostname: "10.0.0.1",
                user: "",
                port: "2222",
                identityFile: "",
                icon: "network-server",
                mac: "",
                commands: [],
                options: []
            }]
        }]
        const result = serializeConfig(groups)
        expect(result).toContain("    Port 2222")
    })

    it('includes IdentityFile when set', () => {
        const groups = [{
            name: "",
            hosts: [{
                host: "myserver",
                hostname: "10.0.0.1",
                user: "",
                port: "",
                identityFile: "~/.ssh/id_ed25519",
                icon: "network-server",
                mac: "",
                commands: [],
                options: []
            }]
        }]
        const result = serializeConfig(groups)
        expect(result).toContain("    IdentityFile ~/.ssh/id_ed25519")
    })

    it('omits empty optional fields', () => {
        const groups = [{
            name: "",
            hosts: [{
                host: "myserver",
                hostname: "10.0.0.1",
                user: "",
                port: "",
                identityFile: "",
                icon: "network-server",
                mac: "",
                commands: [],
                options: []
            }]
        }]
        const result = serializeConfig(groups)
        expect(result).not.toContain("User")
        expect(result).not.toContain("Port")
        expect(result).not.toContain("IdentityFile")
        expect(result).not.toContain("# Icon")
        expect(result).not.toContain("# MAC")
        expect(result).not.toContain("# Command")
    })

    // ── Trailing newline ─────────────────────────────────────────────

    it('ends with a single trailing newline', () => {
        const groups = [{
            name: "",
            hosts: [{
                host: "s",
                hostname: "10.0.0.1",
                user: "",
                port: "",
                identityFile: "",
                icon: "network-server",
                mac: "",
                commands: [],
                options: []
            }]
        }]
        const result = serializeConfig(groups)
        expect(result.endsWith("\n")).toBe(true)
        expect(result.endsWith("\n\n")).toBe(false)
    })

    it('does not produce triple blank lines', () => {
        const groups = [
            { name: "A", hosts: [{ host: "a", hostname: "1.1.1.1", user: "", port: "", identityFile: "", icon: "network-server", mac: "", commands: [], options: [] }] },
            { name: "B", hosts: [{ host: "b", hostname: "2.2.2.2", user: "", port: "", identityFile: "", icon: "network-server", mac: "", commands: [], options: [] }] }
        ]
        const result = serializeConfig(groups)
        expect(result).not.toContain("\n\n\n")
    })

    // ── Group serialization ──────────────────────────────────────────

    it('wraps grouped hosts in GroupStart/GroupEnd', () => {
        const groups = [{
            name: "Production",
            hosts: [{
                host: "prod1",
                hostname: "10.0.1.1",
                user: "deploy",
                port: "",
                identityFile: "",
                icon: "network-server",
                mac: "",
                commands: [],
                options: []
            }]
        }]
        const result = serializeConfig(groups)
        expect(result).toContain("# GroupStart Production")
        expect(result).toContain("# GroupEnd")
    })

    it('does not wrap ungrouped hosts in GroupStart/GroupEnd', () => {
        const groups = [{
            name: "",
            hosts: [{
                host: "standalone",
                hostname: "10.0.0.1",
                user: "",
                port: "",
                identityFile: "",
                icon: "network-server",
                mac: "",
                commands: [],
                options: []
            }]
        }]
        const result = serializeConfig(groups)
        expect(result).not.toContain("# GroupStart")
        expect(result).not.toContain("# GroupEnd")
    })

    // ── SquiSSH directives ──────────────────────────────────────────

    it('writes Icon directive for non-default icons', () => {
        const groups = [{
            name: "",
            hosts: [{
                host: "mydb",
                hostname: "10.0.0.1",
                user: "",
                port: "",
                identityFile: "",
                icon: "server-database",
                mac: "",
                commands: [],
                options: []
            }]
        }]
        const result = serializeConfig(groups)
        expect(result).toContain("# Icon server-database")
    })

    it('omits Icon directive for default icon', () => {
        const groups = [{
            name: "",
            hosts: [{
                host: "plain",
                hostname: "10.0.0.1",
                user: "",
                port: "",
                identityFile: "",
                icon: "network-server",
                mac: "",
                commands: [],
                options: []
            }]
        }]
        const result = serializeConfig(groups)
        expect(result).not.toContain("# Icon")
    })

    it('writes MAC directive', () => {
        const groups = [{
            name: "",
            hosts: [{
                host: "wol",
                hostname: "10.0.0.1",
                user: "",
                port: "",
                identityFile: "",
                icon: "network-server",
                mac: "aa:bb:cc:dd:ee:ff",
                commands: [],
                options: []
            }]
        }]
        const result = serializeConfig(groups)
        expect(result).toContain("# MAC aa:bb:cc:dd:ee:ff")
    })

    it('writes Command directives', () => {
        const groups = [{
            name: "",
            hosts: [{
                host: "server",
                hostname: "10.0.0.1",
                user: "",
                port: "",
                identityFile: "",
                icon: "network-server",
                mac: "",
                commands: ["restart-nginx", "tail -f /var/log/syslog"],
                options: []
            }]
        }]
        const result = serializeConfig(groups)
        expect(result).toContain("# Command restart-nginx")
        expect(result).toContain("# Command tail -f /var/log/syslog")
    })

    // ── Additional SSH options ────────────────────────────────────────

    it('writes additional SSH options', () => {
        const groups = [{
            name: "",
            hosts: [{
                host: "myserver",
                hostname: "10.0.0.1",
                user: "",
                port: "",
                identityFile: "",
                icon: "network-server",
                mac: "",
                commands: [],
                options: [
                    { key: "ProxyJump", value: "bastion" },
                    { key: "ForwardAgent", value: "yes" }
                ]
            }]
        }]
        const result = serializeConfig(groups)
        expect(result).toContain("    ProxyJump bastion")
        expect(result).toContain("    ForwardAgent yes")
    })

    it('preserves option order in output', () => {
        const groups = [{
            name: "",
            hosts: [{
                host: "myserver",
                hostname: "10.0.0.1",
                user: "",
                port: "",
                identityFile: "",
                icon: "network-server",
                mac: "",
                commands: [],
                options: [
                    { key: "ServerAliveInterval", value: "60" },
                    { key: "ServerAliveCountMax", value: "3" },
                    { key: "Compression", value: "yes" }
                ]
            }]
        }]
        const result = serializeConfig(groups)
        const lines = result.split('\n')
        const optLines = lines.filter(l => l.includes('ServerAlive') || l.includes('Compression'))
        expect(optLines[0]).toContain('ServerAliveInterval')
        expect(optLines[1]).toContain('ServerAliveCountMax')
        expect(optLines[2]).toContain('Compression')
    })

    it('skips options with empty keys', () => {
        const groups = [{
            name: "",
            hosts: [{
                host: "myserver",
                hostname: "10.0.0.1",
                user: "",
                port: "",
                identityFile: "",
                icon: "network-server",
                mac: "",
                commands: [],
                options: [
                    { key: "", value: "orphan" },
                    { key: "ValidKey", value: "value" }
                ]
            }]
        }]
        const result = serializeConfig(groups)
        expect(result).not.toContain("orphan")
        expect(result).toContain("    ValidKey value")
    })

    // ── Directive ordering ───────────────────────────────────────────

    it('writes SquiSSH directives before Host line', () => {
        const groups = [{
            name: "",
            hosts: [{
                host: "myserver",
                hostname: "10.0.0.1",
                user: "admin",
                port: "",
                identityFile: "",
                icon: "server-database",
                mac: "aa:bb:cc:dd:ee:ff",
                commands: ["cmd1"],
                options: []
            }]
        }]
        const result = serializeConfig(groups)
        const lines = result.split('\n')
        const iconIdx = lines.findIndex(l => l.includes('# Icon'))
        const macIdx = lines.findIndex(l => l.includes('# MAC'))
        const cmdIdx = lines.findIndex(l => l.includes('# Command'))
        const hostIdx = lines.findIndex(l => l.startsWith('Host '))
        expect(iconIdx).toBeLessThan(hostIdx)
        expect(macIdx).toBeLessThan(hostIdx)
        expect(cmdIdx).toBeLessThan(hostIdx)
    })

    // ── Empty groups array ───────────────────────────────────────────

    it('returns empty string for empty groups', () => {
        expect(serializeConfig([])).toBe('')
    })

    // ── rawBlocks preservation ────────────────────────────────────────

    it('writes rawBlocks at the top of the file', () => {
        const groups = [{
            name: "",
            hosts: [{
                host: "myserver",
                hostname: "10.0.0.1",
                user: "",
                port: "",
                identityFile: "",
                icon: "network-server",
                mac: "",
                commands: [],
                options: []
            }]
        }]
        const rawBlocks = ["Host *\n    ServerAliveInterval 60"]
        const result = serializeConfig(groups, rawBlocks)
        const lines = result.split('\n')
        const wildcardIdx = lines.findIndex(l => l.startsWith('Host *'))
        const hostIdx = lines.findIndex(l => l.startsWith('Host myserver'))
        expect(wildcardIdx).toBeLessThan(hostIdx)
        expect(wildcardIdx).toBe(0)
    })

    it('writes multiple rawBlocks separated by blank lines', () => {
        const rawBlocks = [
            "Include ~/.ssh/config.d/*",
            "Host *\n    ServerAliveInterval 60"
        ]
        const result = serializeConfig([], rawBlocks)
        expect(result).toContain("Include ~/.ssh/config.d/*")
        expect(result).toContain("Host *")
        expect(result).toContain("ServerAliveInterval 60")
    })

    it('handles empty rawBlocks array', () => {
        const groups = [{
            name: "",
            hosts: [{
                host: "s",
                hostname: "10.0.0.1",
                user: "",
                port: "",
                identityFile: "",
                icon: "network-server",
                mac: "",
                commands: [],
                options: []
            }]
        }]
        const result = serializeConfig(groups, [])
        expect(result.startsWith("Host s")).toBe(true)
    })

    it('handles undefined rawBlocks (backward compat)', () => {
        const groups = [{
            name: "",
            hosts: [{
                host: "s",
                hostname: "10.0.0.1",
                user: "",
                port: "",
                identityFile: "",
                icon: "network-server",
                mac: "",
                commands: [],
                options: []
            }]
        }]
        const result = serializeConfig(groups)
        expect(result).toContain("Host s")
    })

    // ── Multiple groups and hosts ────────────────────────────────────

    it('serializes multiple groups with multiple hosts', () => {
        const groups = [
            {
                name: "Production",
                hosts: [
                    {
                        host: "web",
                        hostname: "10.0.1.1",
                        user: "deploy",
                        port: "",
                        identityFile: "",
                        icon: "network-server",
                        mac: "",
                        commands: [],
                        options: []
                    },
                    {
                        host: "db",
                        hostname: "10.0.1.2",
                        user: "admin",
                        port: "5432",
                        identityFile: "",
                        icon: "server-database",
                        mac: "",
                        commands: [],
                        options: []
                    }
                ]
            },
            {
                name: "",
                hosts: [{
                    host: "personal",
                    hostname: "example.com",
                    user: "me",
                    port: "",
                    identityFile: "",
                    icon: "network-server",
                    mac: "",
                    commands: [],
                    options: []
                }]
            }
        ]
        const result = serializeConfig(groups)
        expect(result).toContain("# GroupStart Production")
        expect(result).toContain("Host web")
        expect(result).toContain("# Icon server-database")
        expect(result).toContain("Host db")
        expect(result).toContain("    Port 5432")
        expect(result).toContain("# GroupEnd")
        expect(result).toContain("Host personal")
    })

    // ── Round-trip tests ─────────────────────────────────────────────

    it('round-trips a simple config through parse → serialize → parse', () => {
        const input = [
            'Host myserver',
            '    HostName 10.0.0.1',
            '    User admin',
            '    Port 2222',
            '    ProxyJump bastion',
            ''
        ].join('\n')

        const parsed1 = parseConfig(input)
        const serialized = serializeConfig(parsed1.groups, parsed1.rawBlocks)
        const parsed2 = parseConfig(serialized)

        expect(parsed2.groups).toHaveLength(1)
        const host = parsed2.groups[0].hosts[0]
        expect(host.host).toBe('myserver')
        expect(host.hostname).toBe('10.0.0.1')
        expect(host.user).toBe('admin')
        expect(host.port).toBe('2222')
        expect(host.options).toEqual([{ key: 'ProxyJump', value: 'bastion' }])
    })

    it('round-trips a grouped config with SquiSSH directives', () => {
        const input = [
            '# GroupStart Servers',
            '',
            '# Icon server-database',
            '# MAC aa:bb:cc:dd:ee:ff',
            '# Command restart-nginx',
            '# Command check-logs',
            'Host main-server',
            '    HostName 192.168.1.100',
            '    User admin',
            '',
            'Host backup-server',
            '    HostName 192.168.1.101',
            '    User backup',
            '',
            '# GroupEnd',
            ''
        ].join('\n')

        const parsed1 = parseConfig(input)
        const serialized = serializeConfig(parsed1.groups, parsed1.rawBlocks)
        const parsed2 = parseConfig(serialized)

        expect(parsed2.groups).toHaveLength(1)
        expect(parsed2.groups[0].name).toBe('Servers')
        expect(parsed2.groups[0].hosts).toHaveLength(2)

        const main = parsed2.groups[0].hosts[0]
        expect(main.host).toBe('main-server')
        expect(main.icon).toBe('server-database')
        expect(main.mac).toBe('aa:bb:cc:dd:ee:ff')
        expect(main.commands).toEqual(['restart-nginx', 'check-logs'])

        const backup = parsed2.groups[0].hosts[1]
        expect(backup.host).toBe('backup-server')
        expect(backup.icon).toBe('network-server')
        expect(backup.mac).toBe('')
    })

    it('round-trips complex fixture', () => {
        const input = fixture('complex.sshconfig')
        const parsed1 = parseConfig(input)
        const serialized = serializeConfig(parsed1.groups, parsed1.rawBlocks)
        const parsed2 = parseConfig(serialized)

        // Same group count
        expect(parsed2.groups).toHaveLength(parsed1.groups.length)

        // Same host count per group
        for (let i = 0; i < parsed1.groups.length; i++) {
            expect(parsed2.groups[i].name).toBe(parsed1.groups[i].name)
            expect(parsed2.groups[i].hosts).toHaveLength(parsed1.groups[i].hosts.length)

            for (let j = 0; j < parsed1.groups[i].hosts.length; j++) {
                const orig = parsed1.groups[i].hosts[j]
                const rt = parsed2.groups[i].hosts[j]
                expect(rt.host).toBe(orig.host)
                expect(rt.hostname).toBe(orig.hostname)
                expect(rt.user).toBe(orig.user)
                expect(rt.port).toBe(orig.port)
                expect(rt.identityFile).toBe(orig.identityFile)
                expect(rt.icon).toBe(orig.icon)
                expect(rt.mac).toBe(orig.mac)
                expect(rt.commands).toEqual(orig.commands)
                expect(rt.options).toEqual(orig.options)
            }
        }
    })

    it('round-trips config with additional SSH options', () => {
        const input = [
            'Host bastion',
            '    HostName bastion.example.com',
            '    User ops',
            '    Port 2222',
            '    IdentityFile ~/.ssh/bastion_key',
            '    ForwardAgent yes',
            '    ServerAliveInterval 60',
            '    ServerAliveCountMax 3',
            '    Compression yes',
            ''
        ].join('\n')

        const parsed1 = parseConfig(input)
        const serialized = serializeConfig(parsed1.groups, parsed1.rawBlocks)
        const parsed2 = parseConfig(serialized)

        const host = parsed2.groups[0].hosts[0]
        expect(host.host).toBe('bastion')
        expect(host.hostname).toBe('bastion.example.com')
        expect(host.user).toBe('ops')
        expect(host.port).toBe('2222')
        expect(host.identityFile).toBe('~/.ssh/bastion_key')
        expect(host.options).toEqual([
            { key: 'ForwardAgent', value: 'yes' },
            { key: 'ServerAliveInterval', value: '60' },
            { key: 'ServerAliveCountMax', value: '3' },
            { key: 'Compression', value: 'yes' }
        ])
    })

    it('round-trips config with Host * wildcard blocks', () => {
        const input = [
            'Host *',
            '    ServerAliveInterval 60',
            '    ServerAliveCountMax 3',
            '',
            'Host myserver',
            '    HostName 10.0.0.1',
            '    User admin',
            ''
        ].join('\n')

        const parsed1 = parseConfig(input)
        expect(parsed1.rawBlocks).toHaveLength(1)

        const serialized = serializeConfig(parsed1.groups, parsed1.rawBlocks)
        const parsed2 = parseConfig(serialized)

        // Host * block is preserved
        expect(parsed2.rawBlocks).toHaveLength(1)
        expect(parsed2.rawBlocks[0]).toContain('Host *')
        expect(parsed2.rawBlocks[0]).toContain('ServerAliveInterval 60')

        // Managed host is preserved
        expect(parsed2.groups).toHaveLength(1)
        expect(parsed2.groups[0].hosts[0].host).toBe('myserver')
        expect(parsed2.groups[0].hosts[0].user).toBe('admin')
    })

    it('round-trips config with Include directives', () => {
        const input = [
            'Include ~/.ssh/config.d/*',
            '',
            'Host myserver',
            '    HostName 10.0.0.1',
            ''
        ].join('\n')

        const parsed1 = parseConfig(input)
        const serialized = serializeConfig(parsed1.groups, parsed1.rawBlocks)
        const parsed2 = parseConfig(serialized)

        expect(parsed2.rawBlocks).toHaveLength(1)
        expect(parsed2.rawBlocks[0]).toContain('Include ~/.ssh/config.d/*')
        expect(parsed2.groups[0].hosts[0].host).toBe('myserver')
    })
})
