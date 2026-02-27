import QtQuick
import QtQuick.Layouts
import org.kde.plasma.plasmoid
import org.kde.plasma.core as PlasmaCore
import org.kde.plasma.plasma5support as Plasma5Support
import org.kde.kirigami as Kirigami
import org.kde.notification

import "../code/sshconfig.js" as SSHConfig

PlasmoidItem {
    id: root

    compactRepresentation: CompactRepresentation {}
    fullRepresentation: FullRepresentation {}

    switchWidth: Kirigami.Units.gridUnit * 20
    switchHeight: Kirigami.Units.gridUnit * 14

    Plasmoid.icon: "utilities-terminal"
    Plasmoid.status: PlasmaCore.Types.ActiveStatus
    Plasmoid.backgroundHints: PlasmaCore.Types.DefaultBackground | PlasmaCore.Types.ConfigurableBackground

    toolTipMainText: i18n("Quick SSH")
    toolTipSubText: {
        var count = hostList.length
        return i18np("%1 host configured", "%1 hosts configured", count)
    }

    property var hostList: []
    property var groupedHosts: []
    property string searchText: ""
    property var favorites: {
        try {
            return JSON.parse(plasmoid.configuration.favorites || "[]")
        } catch(e) {
            return []
        }
    }
    property bool configLoaded: false
    property var previousStatuses: ({})
    property var discoveredHosts: []

    property var collapsedGroups: {
        try {
            return JSON.parse(plasmoid.configuration.collapsedGroups || "[]")
        } catch(e) {
            return []
        }
    }

    Plasma5Support.DataSource {
        id: configReader
        engine: "executable"
        connectedSources: []
        onNewData: (sourceName, data) => {
            disconnectSource(sourceName)
            if (data["exit code"] === 0) {
                var result = SSHConfig.parseConfig(data["stdout"])
                root.groupedHosts = result.groups
                var flat = []
                for (var i = 0; i < result.groups.length; i++) {
                    for (var j = 0; j < result.groups[i].hosts.length; j++) {
                        flat.push(result.groups[i].hosts[j])
                    }
                }
                root.hostList = flat
                root.configLoaded = true
            }
        }
    }

    Plasma5Support.DataSource {
        id: pingRunner
        engine: "executable"
        connectedSources: []
        onNewData: (sourceName, data) => {
            disconnectSource(sourceName)
            var match = sourceName.match(/ping\s+-c\s+1\s+-W\s+\d+\s+(.+)/)
            if (match) {
                updateHostStatus(match[1], data["exit code"] === 0 ? "online" : "offline")
            }
        }
    }

    Plasma5Support.DataSource {
        id: launcher
        engine: "executable"
        connectedSources: []
        onNewData: (sourceName, data) => { disconnectSource(sourceName) }
    }

    Plasma5Support.DataSource {
        id: clipboardSource
        engine: "executable"
        connectedSources: []
        onNewData: (sourceName, data) => { disconnectSource(sourceName) }
    }

    Plasma5Support.DataSource {
        id: discoveryRunner
        engine: "executable"
        connectedSources: []
        onNewData: (sourceName, data) => {
            disconnectSource(sourceName)
            if (data["exit code"] === 0) {
                root.parseDiscoveredHosts(data["stdout"])
            }
        }
    }

    function loadConfig() {
        var path = plasmoid.configuration.sshConfigPath || "~/.ssh/config"
        configReader.connectSource("cat " + path.replace("~", "$HOME"))
    }

    function discoverNetworkHosts() {
        if (!plasmoid.configuration.discoverHosts) return
        discoveryRunner.connectSource("avahi-browse -tpr _ssh._tcp")
    }

    function parseDiscoveredHosts(output) {
        var hosts = []
        var seen = {}
        var configuredHostnames = {}
        for (var i = 0; i < hostList.length; i++) {
            configuredHostnames[hostList[i].hostname.toLowerCase()] = true
        }

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

            if (configuredHostnames[address.toLowerCase()]) continue
            if (configuredHostnames[mdnsHost.toLowerCase()]) continue
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
        root.discoveredHosts = hosts
    }

    function checkAllStatus() {
        if (!plasmoid.configuration.showStatus) return
        var timeout = plasmoid.configuration.pingTimeout || 2
        for (var i = 0; i < hostList.length; i++) {
            hostList[i].status = "checking"
            pingRunner.connectSource("ping -c 1 -W " + timeout + " " + hostList[i].hostname)
        }
        hostListChanged()
    }

    function updateHostStatus(hostname, status) {
        var changed = false
        var hostName = ""
        for (var i = 0; i < groupedHosts.length; i++) {
            for (var j = 0; j < groupedHosts[i].hosts.length; j++) {
                if (groupedHosts[i].hosts[j].hostname === hostname) {
                    groupedHosts[i].hosts[j].status = status
                    hostName = groupedHosts[i].hosts[j].host
                    changed = true
                }
            }
        }
        if (changed) {
            // Send notification on status change
            if (plasmoid.configuration.notifyOnStatusChange) {
                var prev = previousStatuses[hostname]
                if (prev && prev !== status && prev !== "checking" && status !== "checking") {
                    statusNotification.title = hostName
                    statusNotification.text = status === "online"
                        ? i18n("%1 is now online", hostName)
                        : i18n("%1 is now offline", hostName)
                    statusNotification.iconName = status === "online" ? "network-connect" : "network-disconnect"
                    statusNotification.sendEvent()
                }
            }
            previousStatuses[hostname] = status
            groupedHostsChanged()
            hostListChanged()
        }
    }

    Notification {
        id: statusNotification
        componentName: "plasma_workspace"
        eventId: "notification"
    }

    Timer {
        id: pollTimer
        interval: (plasmoid.configuration.pollInterval || 5) * 60 * 1000
        repeat: true
        running: plasmoid.configuration.notifyOnStatusChange && hostList.length > 0
        onTriggered: root.checkAllStatus()
    }

    function connectToHost(hostAlias) {
        var cmd = plasmoid.configuration.terminalCommand + " ssh " + hostAlias
        launcher.connectSource(cmd)
        root.expanded = false
    }

    function editConfig(path) {
        launcher.connectSource("xdg-open " + path.replace("~", "$HOME"))
        root.expanded = false
    }

    function setupPasswordlessLogin(hostAlias) {
        var cmd = plasmoid.configuration.terminalCommand + " ssh-copy-id " + hostAlias
        launcher.connectSource(cmd)
        root.expanded = false
    }

    function copyToClipboard(text) {
        clipboardSource.connectSource("qdbus6 org.kde.klipper /klipper setClipboardContents " + Qt.btoa(text))
    }

    function toggleGroup(groupName) {
        var groups = collapsedGroups.slice()
        var idx = groups.indexOf(groupName)
        if (idx >= 0) {
            groups.splice(idx, 1)
        } else {
            groups.push(groupName)
        }
        collapsedGroups = groups
        plasmoid.configuration.collapsedGroups = JSON.stringify(groups)
    }

    function isGroupCollapsed(groupName) {
        return collapsedGroups.indexOf(groupName) >= 0
    }

    function openSftp(host, user, hostname) {
        var url = "sftp://"
        if (user) url += user + "@"
        url += hostname
        launcher.connectSource("xdg-open " + url)
        root.expanded = false
    }

    function isFavorite(host) {
        return favorites.indexOf(host) >= 0
    }

    function toggleFavorite(host) {
        var favs = favorites.slice()
        var idx = favs.indexOf(host)
        if (idx >= 0) {
            favs.splice(idx, 1)
        } else {
            favs.push(host)
        }
        favorites = favs
        plasmoid.configuration.favorites = JSON.stringify(favs)
    }

    function connectFromSearch(text) {
        var cmd = plasmoid.configuration.terminalCommand + " ssh " + text
        launcher.connectSource(cmd)
        root.expanded = false
    }

    Plasmoid.contextualActions: [
        PlasmaCore.Action {
            text: i18n("Refresh")
            icon.name: "view-refresh"
            onTriggered: {
                root.loadConfig()
                root.checkAllStatus()
            }
        },
        PlasmaCore.Action {
            text: i18n("Edit SSH Config")
            icon.name: "document-edit"
            onTriggered: {
                var path = plasmoid.configuration.sshConfigPath || "~/.ssh/config"
                root.editConfig(path)
            }
        }
    ]

    Component.onCompleted: loadConfig()

    Connections {
        target: plasmoid.configuration
        function onSshConfigPathChanged() { root.loadConfig() }
    }
}
