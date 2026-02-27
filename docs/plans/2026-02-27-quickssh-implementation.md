# Quick SSH Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a KDE Plasma 6 system tray widget that parses ~/.ssh/config and provides one-click SSH connections.

**Architecture:** Pure QML + JavaScript plasmoid. Shell commands run via `Plasma5Support.DataSource` with `engine: "executable"`. SSH config parsed in JS. No build step — install with `plasmapkg2`.

**Tech Stack:** QML 6, JavaScript, KDE Frameworks 6, Plasma 5 Support compat layer

---

### Task 1: Project Scaffolding — metadata.json + config schema

**Files:**
- Create: `package/metadata.json`
- Create: `package/contents/config/main.xml`
- Create: `package/contents/config/config.qml`

**Step 1: Create metadata.json**

```json
{
  "KPlugin": {
    "Authors": [
      {
        "Name": "Andy Hazelden",
        "Email": "517731+AndyHazz@users.noreply.github.com"
      }
    ],
    "Category": "Utilities",
    "Description": "Quick SSH connections from your SSH config",
    "Icon": "network-connect",
    "Id": "com.github.andyhazz.quickssh",
    "Name": "Quick SSH",
    "EnabledByDefault": true,
    "Version": "1.0.0",
    "License": "GPL-3.0",
    "BugReportUrl": "https://github.com/AndyHazz/quickssh/issues",
    "Website": "https://github.com/AndyHazz/quickssh"
  },
  "KPackageStructure": "Plasma/Applet",
  "X-Plasma-API-Minimum-Version": "6.0",
  "X-Plasma-NotificationArea": "true",
  "X-Plasma-NotificationAreaCategory": "SystemServices"
}
```

**Step 2: Create config/main.xml**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kcfg xmlns="http://www.kde.org/standards/kcfg/1.0"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="http://www.kde.org/standards/kcfg/1.0
      http://www.kde.org/standards/kcfg/1.0/kcfg.xsd">
  <kcfgfile name=""/>
  <group name="General">
    <entry name="terminalCommand" type="String">
      <default>ghostty -e</default>
    </entry>
    <entry name="sshConfigPath" type="String">
      <default>~/.ssh/config</default>
    </entry>
    <entry name="showStatus" type="Bool">
      <default>true</default>
    </entry>
    <entry name="pingTimeout" type="Int">
      <default>2</default>
    </entry>
    <entry name="showBadge" type="Bool">
      <default>false</default>
    </entry>
    <entry name="collapsedGroups" type="String">
      <default></default>
    </entry>
  </group>
</kcfg>
```

**Step 3: Create config/config.qml**

```qml
import org.kde.plasma.configuration

ConfigModel {
    ConfigCategory {
        name: i18n("General")
        icon: "preferences-system-network"
        source: "configGeneral.qml"
    }
}
```

**Step 4: Verify structure**

Run: `find package/ -type f | sort`
Expected:
```
package/contents/config/config.qml
package/contents/config/main.xml
package/metadata.json
```

**Step 5: Commit**

```bash
git add package/
git commit -m "feat: add project scaffolding — metadata.json and config schema"
```

---

### Task 2: Shell Command Runner Component

**Files:**
- Create: `package/contents/ui/components/Shell.qml`

**Step 1: Create Shell.qml**

This is the reusable component for running shell commands. Based on the proven pattern from apdatifier.

```qml
import QtQuick
import org.kde.plasma.plasma5support as Plasma5Support

Plasma5Support.DataSource {
    id: executable
    engine: "executable"
    connectedSources: []

    onNewData: (sourceName, data) => {
        var cmd = sourceName
        var out = data["stdout"]
        var err = data["stderr"]
        var code = data["exit code"]
        disconnectSource(sourceName)
        if (callback) {
            callback(cmd, out, err, code)
        }
    }

    property var callback: null

    function exec(cmd, cb) {
        callback = cb
        connectSource(cmd)
    }
}
```

**Step 2: Commit**

```bash
git add package/contents/ui/components/Shell.qml
git commit -m "feat: add Shell.qml command runner component"
```

---

### Task 3: SSH Config Parser

**Files:**
- Create: `package/contents/code/sshconfig.js`

**Step 1: Create sshconfig.js**

```js
.pragma library

/**
 * Parse SSH config file contents into grouped host list.
 *
 * Recognizes:
 *   #GroupStart <name>  — start a named group
 *   #GroupEnd           — close current group
 *   #Icon <name>        — set icon for next Host block
 *   Host <name>         — start host entry (skip wildcards)
 *   HostName <value>    — set hostname
 *   User <value>        — set user
 *
 * Returns: { groups: [{name: string, hosts: [{host, hostname, user, icon}]}] }
 */
function parseConfig(text) {
    var lines = text.split("\n")
    var groups = []
    var currentGroupName = ""
    var currentGroup = { name: "", hosts: [] }
    var currentHost = null
    var pendingIcon = ""

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim()

        // Group directives
        if (line.match(/^#\s*GroupStart\s+(.+)/i)) {
            var match = line.match(/^#\s*GroupStart\s+(.+)/i)
            if (currentHost) {
                currentGroup.hosts.push(currentHost)
                currentHost = null
            }
            if (currentGroup.hosts.length > 0) {
                groups.push(currentGroup)
            }
            currentGroupName = match[1].trim()
            currentGroup = { name: currentGroupName, hosts: [] }
            continue
        }

        if (line.match(/^#\s*GroupEnd/i)) {
            if (currentHost) {
                currentGroup.hosts.push(currentHost)
                currentHost = null
            }
            if (currentGroup.hosts.length > 0) {
                groups.push(currentGroup)
            }
            currentGroupName = ""
            currentGroup = { name: "", hosts: [] }
            continue
        }

        // Icon directive
        if (line.match(/^#\s*Icon\s+(.+)/i)) {
            var iconMatch = line.match(/^#\s*Icon\s+(.+)/i)
            pendingIcon = iconMatch[1].trim()
            continue
        }

        // Skip other comments and blank lines
        if (line.startsWith("#") || line === "") {
            continue
        }

        // Host directive
        if (line.match(/^Host\s+(.+)/i)) {
            var hostMatch = line.match(/^Host\s+(.+)/i)
            var hostNames = hostMatch[1].trim().split(/\s+/)

            // Save previous host
            if (currentHost) {
                currentGroup.hosts.push(currentHost)
            }

            currentHost = null

            // Process each host name (skip wildcards)
            for (var h = 0; h < hostNames.length; h++) {
                var name = hostNames[h]
                if (name.indexOf("*") !== -1 || name.indexOf("?") !== -1) {
                    continue
                }
                // For multi-host lines, create separate entries
                // but they'll share the same HostName/User parsed below
                if (currentHost === null) {
                    currentHost = {
                        host: name,
                        hostname: name,
                        user: "",
                        icon: pendingIcon || "network-server",
                        status: "unknown"
                    }
                } else {
                    // Push previous and start new for multi-host
                    currentGroup.hosts.push(currentHost)
                    currentHost = {
                        host: name,
                        hostname: name,
                        user: "",
                        icon: pendingIcon || "network-server",
                        status: "unknown"
                    }
                }
            }
            pendingIcon = ""
            continue
        }

        // Host properties
        if (currentHost) {
            if (line.match(/^HostName\s+(.+)/i)) {
                currentHost.hostname = line.match(/^HostName\s+(.+)/i)[1].trim()
            } else if (line.match(/^User\s+(.+)/i)) {
                currentHost.user = line.match(/^User\s+(.+)/i)[1].trim()
            }
        }
    }

    // Don't forget the last host/group
    if (currentHost) {
        currentGroup.hosts.push(currentHost)
    }
    if (currentGroup.hosts.length > 0) {
        groups.push(currentGroup)
    }

    return { groups: groups }
}
```

**Step 2: Commit**

```bash
git add package/contents/code/sshconfig.js
git commit -m "feat: add SSH config parser with group/icon support"
```

---

### Task 4: Main QML — PlasmoidItem Root

**Files:**
- Create: `package/contents/ui/main.qml`

**Step 1: Create main.qml**

```qml
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

    Plasmoid.icon: "network-connect"
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
```

**Step 2: Install and verify basic load**

Run: `plasmapkg2 -i package/ 2>&1 || plasmapkg2 -u package/ 2>&1`
Expected: "Successfully installed" or "Successfully updated"

**Step 3: Commit**

```bash
git add package/contents/ui/main.qml
git commit -m "feat: add main.qml with config loading, ping, and launch logic"
```

---

### Task 5: Compact Representation (Tray Icon)

**Files:**
- Create: `package/contents/ui/CompactRepresentation.qml`

**Step 1: Create CompactRepresentation.qml**

```qml
import QtQuick
import QtQuick.Layouts
import org.kde.plasma.core as PlasmaCore
import org.kde.kirigami as Kirigami
import org.kde.plasma.plasmoid

MouseArea {
    id: compactRoot

    readonly property bool inTray: (plasmoid.containmentDisplayHints & PlasmaCore.Types.ContainmentDrawsPlasmoidHeading)

    Layout.minimumWidth: inTray ? Kirigami.Units.iconSizes.medium : Kirigami.Units.gridUnit
    Layout.minimumHeight: inTray ? Kirigami.Units.iconSizes.medium : Kirigami.Units.gridUnit

    hoverEnabled: true
    acceptedButtons: Qt.LeftButton

    onClicked: root.expanded = !root.expanded

    Kirigami.Icon {
        id: trayIcon
        anchors.fill: parent
        source: Plasmoid.icon
        active: compactRoot.containsMouse
    }
}
```

**Step 2: Commit**

```bash
git add package/contents/ui/CompactRepresentation.qml
git commit -m "feat: add compact tray icon representation"
```

---

### Task 6: Full Representation — Popup Layout

**Files:**
- Create: `package/contents/ui/FullRepresentation.qml`

**Step 1: Create FullRepresentation.qml**

```qml
import QtQuick
import QtQuick.Layouts
import QtQuick.Controls as QQC2
import org.kde.plasma.extras as PlasmaExtras
import org.kde.plasma.components as PlasmaComponents
import org.kde.plasma.core as PlasmaCore
import org.kde.kirigami as Kirigami
import org.kde.plasma.plasmoid

PlasmaExtras.Representation {
    id: fullRoot

    Layout.minimumWidth: Kirigami.Units.gridUnit * 20
    Layout.minimumHeight: Kirigami.Units.gridUnit * 14
    Layout.preferredWidth: Kirigami.Units.gridUnit * 22
    Layout.preferredHeight: Kirigami.Units.gridUnit * 20

    collapseMarginsHint: true

    header: PlasmaExtras.PlasmoidHeading {
        RowLayout {
            anchors.fill: parent
            spacing: Kirigami.Units.smallSpacing

            Kirigami.SearchField {
                id: searchField
                Layout.fillWidth: true
                placeholderText: i18n("Search hosts...")
                onTextChanged: root.searchText = text
                Keys.onEscapePressed: {
                    if (text !== "") {
                        text = ""
                    } else {
                        root.expanded = false
                    }
                }
            }
        }
    }

    Connections {
        target: root
        function onExpandedChanged() {
            if (root.expanded) {
                root.loadConfig()
                root.checkAllStatus()
                searchField.text = ""
                searchField.forceActiveFocus()
            }
        }
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        QQC2.ScrollView {
            Layout.fillWidth: true
            Layout.fillHeight: true

            ListView {
                id: hostListView
                clip: true
                model: buildFilteredModel()

                delegate: Loader {
                    width: hostListView.width
                    sourceComponent: modelData.isHeader ? groupHeaderComponent : hostDelegateComponent
                    property var itemData: modelData
                }

                PlasmaExtras.PlaceholderMessage {
                    anchors.centerIn: parent
                    visible: hostListView.count === 0
                    text: root.searchText !== ""
                        ? i18n("No matching hosts")
                        : i18n("No SSH hosts configured")
                    iconName: "network-disconnect"
                }
            }
        }

        PlasmaExtras.PlasmoidHeading {
            Layout.fillWidth: true
            location: PlasmaExtras.PlasmoidHeading.Location.Footer

            RowLayout {
                anchors.fill: parent

                QQC2.ToolButton {
                    icon.name: "view-refresh"
                    text: i18n("Refresh")
                    display: QQC2.AbstractButton.IconOnly
                    QQC2.ToolTip.text: i18n("Refresh hosts and status")
                    QQC2.ToolTip.visible: hovered
                    onClicked: {
                        root.loadConfig()
                        root.checkAllStatus()
                    }
                }

                Item { Layout.fillWidth: true }

                QQC2.ToolButton {
                    icon.name: "configure"
                    text: i18n("Configure...")
                    display: QQC2.AbstractButton.IconOnly
                    QQC2.ToolTip.text: i18n("Configure Quick SSH...")
                    QQC2.ToolTip.visible: hovered
                    onClicked: plasmoid.internalAction("configure").trigger()
                }
            }
        }
    }

    function buildFilteredModel() {
        var items = []
        var search = root.searchText.toLowerCase()

        for (var i = 0; i < root.groupedHosts.length; i++) {
            var group = root.groupedHosts[i]
            var filteredHosts = []

            for (var j = 0; j < group.hosts.length; j++) {
                var h = group.hosts[j]
                if (search === "" ||
                    h.host.toLowerCase().indexOf(search) >= 0 ||
                    h.hostname.toLowerCase().indexOf(search) >= 0 ||
                    h.user.toLowerCase().indexOf(search) >= 0) {
                    filteredHosts.push(h)
                }
            }

            if (filteredHosts.length > 0) {
                var groupName = group.name || i18n("Ungrouped")
                var collapsed = root.isGroupCollapsed(groupName)

                items.push({
                    isHeader: true,
                    groupName: groupName,
                    hostCount: filteredHosts.length,
                    collapsed: collapsed
                })

                if (!collapsed) {
                    for (var k = 0; k < filteredHosts.length; k++) {
                        items.push({
                            isHeader: false,
                            host: filteredHosts[k].host,
                            hostname: filteredHosts[k].hostname,
                            user: filteredHosts[k].user,
                            icon: filteredHosts[k].icon,
                            status: filteredHosts[k].status
                        })
                    }
                }
            }
        }

        return items
    }

    Component {
        id: groupHeaderComponent
        GroupHeader {}
    }

    Component {
        id: hostDelegateComponent
        HostDelegate {}
    }
}
```

**Step 2: Commit**

```bash
git add package/contents/ui/FullRepresentation.qml
git commit -m "feat: add full representation popup with search, groups, and footer"
```

---

### Task 7: Group Header Component

**Files:**
- Create: `package/contents/ui/GroupHeader.qml`

**Step 1: Create GroupHeader.qml**

```qml
import QtQuick
import QtQuick.Layouts
import QtQuick.Controls as QQC2
import org.kde.kirigami as Kirigami

QQC2.ItemDelegate {
    id: headerDelegate

    width: parent ? parent.width : implicitWidth
    height: Kirigami.Units.gridUnit * 2

    onClicked: root.toggleGroup(itemData.groupName)

    contentItem: RowLayout {
        spacing: Kirigami.Units.smallSpacing

        Kirigami.Icon {
            source: itemData.collapsed ? "arrow-right" : "arrow-down"
            Layout.preferredWidth: Kirigami.Units.iconSizes.small
            Layout.preferredHeight: Kirigami.Units.iconSizes.small
        }

        QQC2.Label {
            text: itemData.groupName
            font.bold: true
            font.pointSize: Kirigami.Theme.defaultFont.pointSize * 0.9
            color: Kirigami.Theme.disabledTextColor
            Layout.fillWidth: true
        }

        QQC2.Label {
            text: itemData.hostCount
            font.pointSize: Kirigami.Theme.defaultFont.pointSize * 0.8
            color: Kirigami.Theme.disabledTextColor
        }
    }
}
```

**Step 2: Commit**

```bash
git add package/contents/ui/GroupHeader.qml
git commit -m "feat: add collapsible group header component"
```

---

### Task 8: Host Delegate Component

**Files:**
- Create: `package/contents/ui/HostDelegate.qml`

**Step 1: Create HostDelegate.qml**

```qml
import QtQuick
import QtQuick.Layouts
import QtQuick.Controls as QQC2
import org.kde.kirigami as Kirigami
import org.kde.plasma.plasmoid

QQC2.ItemDelegate {
    id: hostDelegate

    width: parent ? parent.width : implicitWidth
    height: Kirigami.Units.gridUnit * 2.5

    onClicked: root.connectToHost(itemData.host)

    contentItem: RowLayout {
        spacing: Kirigami.Units.smallSpacing

        Kirigami.Icon {
            source: itemData.icon || "network-server"
            Layout.preferredWidth: Kirigami.Units.iconSizes.smallMedium
            Layout.preferredHeight: Kirigami.Units.iconSizes.smallMedium
            Layout.leftMargin: Kirigami.Units.gridUnit
        }

        Rectangle {
            Layout.preferredWidth: Kirigami.Units.smallSpacing * 3
            Layout.preferredHeight: Kirigami.Units.smallSpacing * 3
            radius: width / 2
            visible: plasmoid.configuration.showStatus
            color: {
                switch (itemData.status) {
                    case "online": return Kirigami.Theme.positiveTextColor
                    case "offline": return Kirigami.Theme.negativeTextColor
                    case "checking": return Kirigami.Theme.disabledTextColor
                    default: return "transparent"
                }
            }
            border.width: itemData.status === "offline" ? 1 : 0
            border.color: Kirigami.Theme.negativeTextColor

            SequentialAnimation on opacity {
                running: itemData.status === "checking"
                loops: Animation.Infinite
                NumberAnimation { to: 0.3; duration: 500 }
                NumberAnimation { to: 1.0; duration: 500 }
            }
        }

        ColumnLayout {
            Layout.fillWidth: true
            spacing: 0

            QQC2.Label {
                text: itemData.host
                Layout.fillWidth: true
                elide: Text.ElideRight
            }

            QQC2.Label {
                text: {
                    var parts = []
                    if (itemData.user) parts.push(itemData.user)
                    parts.push(itemData.hostname)
                    return parts.join("@")
                }
                Layout.fillWidth: true
                elide: Text.ElideRight
                font.pointSize: Kirigami.Theme.smallFont.pointSize
                color: Kirigami.Theme.disabledTextColor
                visible: itemData.hostname !== itemData.host || itemData.user !== ""
            }
        }
    }

    QQC2.ToolTip.text: "ssh " + (itemData.user ? itemData.user + "@" : "") + itemData.hostname
    QQC2.ToolTip.visible: hovered
    QQC2.ToolTip.delay: Kirigami.Units.toolTipDelay

    TapHandler {
        acceptedButtons: Qt.RightButton
        onTapped: contextMenu.popup()
    }

    QQC2.Menu {
        id: contextMenu

        QQC2.MenuItem {
            text: i18n("Copy SSH Command")
            icon.name: "edit-copy"
            onTriggered: root.copyToClipboard("ssh " + itemData.host)
        }

        QQC2.MenuItem {
            text: i18n("Copy Hostname")
            icon.name: "edit-copy"
            onTriggered: root.copyToClipboard(itemData.hostname)
        }
    }
}
```

**Step 2: Commit**

```bash
git add package/contents/ui/HostDelegate.qml
git commit -m "feat: add host delegate with status dots, icons, and context menu"
```

---

### Task 9: Settings Page

**Files:**
- Create: `package/contents/ui/configGeneral.qml`

**Step 1: Create configGeneral.qml**

```qml
import QtQuick
import QtQuick.Layouts
import QtQuick.Controls as QQC2
import org.kde.kirigami as Kirigami
import org.kde.kcmutils as KCMUtils

KCMUtils.SimpleKCM {
    id: configPage

    property alias cfg_terminalCommand: terminalCommandField.text
    property alias cfg_sshConfigPath: sshConfigPathField.text
    property alias cfg_showStatus: showStatusCheck.checked
    property alias cfg_pingTimeout: pingTimeoutSpin.value
    property alias cfg_showBadge: showBadgeCheck.checked

    Kirigami.FormLayout {
        anchors.left: parent.left
        anchors.right: parent.right

        Kirigami.Separator {
            Kirigami.FormData.isSection: true
            Kirigami.FormData.label: i18n("Connection")
        }

        QQC2.TextField {
            id: terminalCommandField
            Kirigami.FormData.label: i18n("Terminal command:")
            Layout.fillWidth: true
            placeholderText: "ghostty -e"
        }

        QQC2.Label {
            text: i18n("The widget runs: <terminal command> ssh <host alias>")
            font: Kirigami.Theme.smallFont
            color: Kirigami.Theme.disabledTextColor
            Layout.fillWidth: true
            wrapMode: Text.WordWrap
        }

        QQC2.TextField {
            id: sshConfigPathField
            Kirigami.FormData.label: i18n("SSH config file:")
            Layout.fillWidth: true
            placeholderText: "~/.ssh/config"
        }

        Kirigami.Separator {
            Kirigami.FormData.isSection: true
            Kirigami.FormData.label: i18n("Status")
        }

        QQC2.CheckBox {
            id: showStatusCheck
            Kirigami.FormData.label: i18n("Show connection status:")
        }

        QQC2.SpinBox {
            id: pingTimeoutSpin
            Kirigami.FormData.label: i18n("Ping timeout (seconds):")
            from: 1
            to: 10
            enabled: showStatusCheck.checked
        }

        Kirigami.Separator {
            Kirigami.FormData.isSection: true
            Kirigami.FormData.label: i18n("Appearance")
        }

        QQC2.CheckBox {
            id: showBadgeCheck
            Kirigami.FormData.label: i18n("Show host count badge on icon:")
        }
    }
}
```

**Step 2: Commit**

```bash
git add package/contents/ui/configGeneral.qml
git commit -m "feat: add settings page for terminal, config path, and status options"
```

---

### Task 10: First Install and End-to-End Test

**Step 1: Install the widget**

Run: `plasmapkg2 -u package/ 2>/dev/null || plasmapkg2 -i package/`
Expected: "Successfully installed" or "Successfully updated"

**Step 2: Add to system tray**

Right-click system tray, Configure System Tray, find Quick SSH, enable it.

**Step 3: Verify core functionality**

Test checklist:
- [ ] Widget icon appears in system tray
- [ ] Clicking icon opens popup
- [ ] Popup shows SSH hosts from ~/.ssh/config
- [ ] Hosts grouped correctly (or all under Ungrouped if no #GroupStart)
- [ ] Search field filters hosts
- [ ] Clicking a host opens Ghostty with SSH connection
- [ ] Status dots appear and update (green/red)
- [ ] Group headers collapse/expand on click
- [ ] Right-click shows context menu with copy options
- [ ] Settings page opens and saves correctly
- [ ] Clipboard copy works

**Step 4: Fix any issues found during testing**

Common issues to watch for:
- QML import errors (check `journalctl --user -b | grep -i quickssh`)
- Clipboard: `qdbus6 org.kde.klipper` may need different approach; fallback to `xclip -selection clipboard`
- Model not refreshing after group toggle (may need explicit model reassignment)
- DataSource command deduplication (same ping command won't re-run; add timestamp suffix if needed)

**Step 5: Commit fixes**

```bash
git add package/
git commit -m "fix: address issues found during end-to-end testing"
```

---

### Task 11: Package for Release

**Files:**
- Create: `.gitignore`
- Create: `install.sh`
- Create: `README.md`

**Step 1: Create .gitignore**

```
*.swp
*~
.directory
```

**Step 2: Create install.sh**

```bash
#!/bin/bash
set -e
plasmapkg2 -u package/ 2>/dev/null || plasmapkg2 -i package/
echo "Quick SSH installed successfully!"
echo "Enable it: Right-click system tray → Configure System Tray → Quick SSH"
```

Make executable: `chmod +x install.sh`

**Step 3: Create README.md**

Content should cover:
- One-line description
- Screenshot placeholder
- Installation instructions (git clone + ./install.sh)
- SSH config format documentation (#GroupStart, #GroupEnd, #Icon directives)
- Configuration options
- License (GPL-3.0)

**Step 4: Create LICENSE file**

Download GPL-3.0 text.

**Step 5: Clean install test**

Run:
```bash
plasmapkg2 -r com.github.andyhazz.quickssh 2>/dev/null
plasmapkg2 -i package/
```
Expected: Clean install succeeds, widget appears and works.

**Step 6: Commit and tag**

```bash
git add -A
git commit -m "chore: add README, install script, license for v1.0.0"
git tag v1.0.0
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Project scaffolding | metadata.json, config/main.xml, config/config.qml |
| 2 | Shell command runner | components/Shell.qml |
| 3 | SSH config parser | code/sshconfig.js |
| 4 | Main QML root | ui/main.qml |
| 5 | Tray icon | ui/CompactRepresentation.qml |
| 6 | Popup layout | ui/FullRepresentation.qml |
| 7 | Group headers | ui/GroupHeader.qml |
| 8 | Host delegate | ui/HostDelegate.qml |
| 9 | Settings page | ui/configGeneral.qml |
| 10 | First install + E2E test | Manual testing + fixes |
| 11 | Package for release | README, install.sh, LICENSE, .gitignore |
