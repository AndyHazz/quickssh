import QtQuick
import QtQuick.Layouts
import org.kde.plasma.plasmoid
import org.kde.plasma.core as PlasmaCore
import org.kde.plasma.plasma5support as Plasma5Support
import org.kde.kirigami as Kirigami

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

    function loadConfig() {
        var path = plasmoid.configuration.sshConfigPath || "~/.ssh/config"
        configReader.connectSource("cat " + path.replace("~", "$HOME"))
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
        for (var i = 0; i < groupedHosts.length; i++) {
            for (var j = 0; j < groupedHosts[i].hosts.length; j++) {
                if (groupedHosts[i].hosts[j].hostname === hostname) {
                    groupedHosts[i].hosts[j].status = status
                    changed = true
                }
            }
        }
        if (changed) {
            groupedHostsChanged()
            hostListChanged()
        }
    }

    function connectToHost(hostAlias) {
        var cmd = plasmoid.configuration.terminalCommand + " ssh " + hostAlias
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

    Component.onCompleted: loadConfig()

    Connections {
        target: plasmoid.configuration
        function onSshConfigPathChanged() { root.loadConfig() }
    }
}
