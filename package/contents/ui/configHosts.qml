import QtQuick
import QtQuick.Layouts
import QtQuick.Controls as QQC2
import org.kde.kirigami as Kirigami
import org.kde.kcmutils as KCMUtils
import org.kde.plasma.plasma5support as Plasma5Support

import "../code/sshconfig.js" as SSHConfig
import "../code/sshserializer.js" as SSHSerializer

KCMUtils.SimpleKCM {
    id: hostsPage

    // cfg_ property: serialized SSH config text (Apply/Cancel integration)
    property string cfg_sshConfigText
    property string cfg_sshConfigTextDefault
    // Read-only cfg_ to get the config path from General settings
    property string cfg_sshConfigPath
    property string cfg_sshConfigPathDefault
    // Passthrough: preserve programmatic config entries across Apply
    property string cfg_favorites
    property string cfg_favoritesDefault
    property string cfg_collapsedGroups
    property string cfg_collapsedGroupsDefault
    property string cfg_connectionHistory
    property string cfg_connectionHistoryDefault
    property string cfg_cachedHosts
    property string cfg_cachedHostsDefault

    // ── State ────────────────────────────────────────────────────────
    property var workingGroups: []
    property var rawBlocks: []          // Preserved unmanaged content (Host *, Match, Include)
    property int selectedGroupIndex: -1
    property int selectedHostIndex: -1
    property bool loaded: false
    property bool suppressDirty: false  // Guard against programmatic field changes

    // Move-button enabled states (derived)
    property bool canMoveUp: {
        if (selectedHostIndex >= 0) {
            return selectedHostIndex > 0
        }
        if (selectedGroupIndex >= 0 && selectedHostIndex === -1) {
            return selectedGroupIndex > 0
        }
        return false
    }
    property bool canMoveDown: {
        if (selectedHostIndex >= 0 && selectedGroupIndex >= 0 && selectedGroupIndex < workingGroups.length) {
            return selectedHostIndex < workingGroups[selectedGroupIndex].hosts.length - 1
        }
        if (selectedGroupIndex >= 0 && selectedHostIndex === -1) {
            return selectedGroupIndex < workingGroups.length - 1
        }
        return false
    }

    // Currently-selected host (derived)
    property var currentHost: {
        if (selectedGroupIndex >= 0 && selectedGroupIndex < workingGroups.length &&
            selectedHostIndex >= 0 && selectedHostIndex < workingGroups[selectedGroupIndex].hosts.length) {
            return workingGroups[selectedGroupIndex].hosts[selectedHostIndex]
        }
        return null
    }

    // ── Data Sources ─────────────────────────────────────────────────
    Plasma5Support.DataSource {
        id: configFileReader
        engine: "executable"
        connectedSources: []
        onNewData: (sourceName, data) => {
            disconnectSource(sourceName)
            if (data["exit code"] === 0) {
                var result = SSHConfig.parseConfig(data["stdout"])
                hostsPage.workingGroups = result.groups
                hostsPage.rawBlocks = result.rawBlocks || []
                hostsPage.loaded = true
                // Select first host if available
                if (result.groups.length > 0 && result.groups[0].hosts.length > 0) {
                    hostsPage.selectedGroupIndex = 0
                    hostsPage.selectedHostIndex = 0
                } else {
                    hostsPage.selectedGroupIndex = -1
                    hostsPage.selectedHostIndex = -1
                }
            } else {
                // File not found or unreadable — show empty editor
                hostsPage.workingGroups = []
                hostsPage.rawBlocks = []
                hostsPage.loaded = true
                hostsPage.selectedGroupIndex = -1
                hostsPage.selectedHostIndex = -1
            }
        }
    }

    function getConfigPath() {
        var p = cfg_sshConfigPath || "~/.ssh/config"
        return p.replace("~", "$HOME")
    }

    function loadConfigFile() {
        configFileReader.connectSource("cat \"" + getConfigPath() + "\"")
    }

    function serializeToConfig() {
        var text = SSHSerializer.serializeConfig(workingGroups, rawBlocks)
        cfg_sshConfigText = text
    }

    // Debounce timer: coalesces rapid edits into a single serialize
    Timer {
        id: serializeDebounce
        interval: 200
        onTriggered: {
            hostsPage.flushCurrentEdits()
            hostsPage.serializeToConfig()
        }
    }

    Component.onCompleted: loadConfigFile()

    // ── Helper functions ─────────────────────────────────────────────

    function selectHost(groupIdx, hostIdx) {
        // Flush current edits to working model before switching
        flushCurrentEdits()
        selectedGroupIndex = groupIdx
        selectedHostIndex = hostIdx
        serializeToConfig()
    }

    function flushCurrentEdits() {
        if (currentHost === null) return
        if (selectedGroupIndex < 0 || selectedHostIndex < 0) return

        var groups = workingGroups.slice()
        var h = groups[selectedGroupIndex].hosts[selectedHostIndex]

        h.host = hostField.text
        h.hostname = hostnameField.text || hostField.text
        h.user = userField.text
        h.port = portField.text
        h.identityFile = identityFileField.text
        h.icon = iconField.text || "network-server"
        h.mac = macField.text

        // Commands
        var cmds = []
        for (var c = 0; c < commandsModel.count; c++) {
            var val = commandsModel.get(c).value
            if (val !== "") cmds.push(val)
        }
        h.commands = cmds

        // Options
        var opts = []
        for (var o = 0; o < optionsModel.count; o++) {
            var item = optionsModel.get(o)
            if (item.optKey !== "") {
                opts.push({ key: item.optKey, value: item.optValue })
            }
        }
        h.options = opts

        // Find target group based on groupCombo
        var targetGroupName = groupCombo.editText
        var currentGroupName = groups[selectedGroupIndex].name

        if (targetGroupName !== currentGroupName) {
            // Move host to different group
            groups[selectedGroupIndex].hosts.splice(selectedHostIndex, 1)

            // Clean up empty source group
            if (groups[selectedGroupIndex].hosts.length === 0) {
                groups.splice(selectedGroupIndex, 1)
            }

            // Find or create target group
            var targetIdx = -1
            for (var g = 0; g < groups.length; g++) {
                if (groups[g].name === targetGroupName) {
                    targetIdx = g
                    break
                }
            }
            if (targetIdx === -1) {
                groups.push({ name: targetGroupName, hosts: [] })
                targetIdx = groups.length - 1
            }
            groups[targetIdx].hosts.push(h)
            selectedGroupIndex = targetIdx
            selectedHostIndex = groups[targetIdx].hosts.length - 1
        }

        workingGroups = groups
    }

    function markDirty() {
        if (suppressDirty) return
        serializeDebounce.restart()
    }

    function addHost() {
        flushCurrentEdits()
        var groups = workingGroups.slice()
        // Add to ungrouped (first ungrouped group or create one)
        var ungroupedIdx = -1
        for (var i = 0; i < groups.length; i++) {
            if (groups[i].name === "") {
                ungroupedIdx = i
                break
            }
        }
        if (ungroupedIdx === -1) {
            groups.push({ name: "", hosts: [] })
            ungroupedIdx = groups.length - 1
        }
        groups[ungroupedIdx].hosts.push({
            host: "new-host",
            hostname: "",
            user: "",
            port: "",
            identityFile: "",
            icon: "network-server",
            status: "unknown",
            mac: "",
            commands: [],
            options: []
        })
        workingGroups = groups
        selectedGroupIndex = ungroupedIdx
        selectedHostIndex = groups[ungroupedIdx].hosts.length - 1
        serializeToConfig()
    }

    function deleteHost() {
        if (selectedGroupIndex < 0 || selectedHostIndex < 0) return
        var groups = workingGroups.slice()
        groups[selectedGroupIndex].hosts.splice(selectedHostIndex, 1)
        // Remove empty groups
        if (groups[selectedGroupIndex].hosts.length === 0) {
            groups.splice(selectedGroupIndex, 1)
        }
        workingGroups = groups
        // Reset selection
        if (groups.length > 0 && groups[0].hosts.length > 0) {
            selectedGroupIndex = 0
            selectedHostIndex = 0
        } else {
            selectedGroupIndex = -1
            selectedHostIndex = -1
        }
        serializeToConfig()
    }

    // ── Move functions ──────────────────────────────────────────────
    function moveUp() {
        if (selectedHostIndex >= 0) moveHostUp()
        else if (selectedGroupIndex >= 0) moveGroupUp()
    }

    function moveDown() {
        if (selectedHostIndex >= 0) moveHostDown()
        else if (selectedGroupIndex >= 0) moveGroupDown()
    }

    function moveHostUp() {
        if (selectedGroupIndex < 0 || selectedHostIndex <= 0) return
        flushCurrentEdits()
        var groups = workingGroups.slice()
        var hosts = groups[selectedGroupIndex].hosts.slice()
        var idx = selectedHostIndex
        var tmp = hosts[idx - 1]
        hosts[idx - 1] = hosts[idx]
        hosts[idx] = tmp
        groups[selectedGroupIndex] = Object.assign({}, groups[selectedGroupIndex], { hosts: hosts })
        workingGroups = groups
        selectedHostIndex = idx - 1
        serializeToConfig()
    }

    function moveHostDown() {
        if (selectedGroupIndex < 0 || selectedHostIndex < 0) return
        var hosts = workingGroups[selectedGroupIndex].hosts
        if (selectedHostIndex >= hosts.length - 1) return
        flushCurrentEdits()
        var groups = workingGroups.slice()
        var hostsCopy = groups[selectedGroupIndex].hosts.slice()
        var idx = selectedHostIndex
        var tmp = hostsCopy[idx + 1]
        hostsCopy[idx + 1] = hostsCopy[idx]
        hostsCopy[idx] = tmp
        groups[selectedGroupIndex] = Object.assign({}, groups[selectedGroupIndex], { hosts: hostsCopy })
        workingGroups = groups
        selectedHostIndex = idx + 1
        serializeToConfig()
    }

    function moveGroupUp() {
        if (selectedGroupIndex <= 0) return
        flushCurrentEdits()
        var groups = workingGroups.slice()
        var idx = selectedGroupIndex
        var tmp = groups[idx - 1]
        groups[idx - 1] = groups[idx]
        groups[idx] = tmp
        workingGroups = groups
        selectedGroupIndex = idx - 1
        serializeToConfig()
    }

    function moveGroupDown() {
        if (selectedGroupIndex < 0 || selectedGroupIndex >= workingGroups.length - 1) return
        flushCurrentEdits()
        var groups = workingGroups.slice()
        var idx = selectedGroupIndex
        var tmp = groups[idx + 1]
        groups[idx + 1] = groups[idx]
        groups[idx] = tmp
        workingGroups = groups
        selectedGroupIndex = idx + 1
        serializeToConfig()
    }

    // ── Models for repeatable fields ─────────────────────────────────
    ListModel { id: commandsModel }
    ListModel { id: optionsModel }

    // Populate models when selection changes
    onCurrentHostChanged: {
        suppressDirty = true
        commandsModel.clear()
        optionsModel.clear()
        if (currentHost) {
            for (var c = 0; c < currentHost.commands.length; c++) {
                commandsModel.append({ value: currentHost.commands[c] })
            }
            for (var o = 0; o < currentHost.options.length; o++) {
                optionsModel.append({
                    optKey: currentHost.options[o].key,
                    optValue: currentHost.options[o].value
                })
            }
            // Sync group combo editText to current host's group
            if (selectedGroupIndex >= 0 && selectedGroupIndex < workingGroups.length) {
                groupCombo.editText = workingGroups[selectedGroupIndex].name
            }
        }
        suppressDirty = false
    }

    // ── UI Layout ────────────────────────────────────────────────────
    ColumnLayout {
        anchors.left: parent.left
        anchors.right: parent.right
        spacing: Kirigami.Units.largeSpacing

        // ── Host list with add/remove ────────────────────────────────
        RowLayout {
            Layout.fillWidth: true
            spacing: Kirigami.Units.smallSpacing

            QQC2.Label {
                text: i18n("SSH Hosts")
                font.bold: true
                font.pointSize: Kirigami.Theme.defaultFont.pointSize * 1.1
                Layout.fillWidth: true
            }
            QQC2.ToolButton {
                icon.name: "list-add"
                onClicked: addHost()
                QQC2.ToolTip.text: i18n("Add host")
                QQC2.ToolTip.visible: hovered
            }
            QQC2.ToolButton {
                icon.name: "list-remove"
                enabled: currentHost !== null
                onClicked: deleteHost()
                QQC2.ToolTip.text: i18n("Delete host")
                QQC2.ToolTip.visible: hovered
            }
            QQC2.ToolButton {
                icon.name: "arrow-up"
                enabled: canMoveUp
                onClicked: moveUp()
                QQC2.ToolTip.text: i18n("Move up")
                QQC2.ToolTip.visible: hovered
            }
            QQC2.ToolButton {
                icon.name: "arrow-down"
                enabled: canMoveDown
                onClicked: moveDown()
                QQC2.ToolTip.text: i18n("Move down")
                QQC2.ToolTip.visible: hovered
            }
        }

        Rectangle {
            Layout.fillWidth: true
            implicitHeight: Math.min(hostTreeView.contentHeight + Kirigami.Units.smallSpacing * 2, Kirigami.Units.gridUnit * 12)
            Layout.minimumHeight: Kirigami.Units.gridUnit * 6
            radius: Kirigami.Units.smallSpacing
            color: Kirigami.Theme.alternateBackgroundColor
            border.width: 1
            border.color: Kirigami.Theme.separatorColor

            QQC2.ScrollView {
                anchors.fill: parent
                anchors.margins: Kirigami.Units.smallSpacing

                ListView {
                    id: hostTreeView
                    clip: true
                    model: {
                        var items = []
                        for (var i = 0; i < workingGroups.length; i++) {
                            var g = workingGroups[i]
                            var groupLabel = g.name || i18n("Ungrouped")
                            items.push({
                                isHeader: true,
                                label: groupLabel + " (" + g.hosts.length + ")",
                                groupIdx: i,
                                hostIdx: -1
                            })
                            for (var j = 0; j < g.hosts.length; j++) {
                                items.push({
                                    isHeader: false,
                                    label: g.hosts[j].host,
                                    groupIdx: i,
                                    hostIdx: j
                                })
                            }
                        }
                        return items
                    }

                    delegate: QQC2.ItemDelegate {
                        width: hostTreeView.width
                        text: modelData.isHeader ? modelData.label : "    " + modelData.label
                        font.bold: modelData.isHeader
                        font.italic: modelData.isHeader
                        highlighted: modelData.isHeader
                            ? (selectedHostIndex === -1 && modelData.groupIdx === selectedGroupIndex)
                            : (modelData.groupIdx === selectedGroupIndex && modelData.hostIdx === selectedHostIndex)
                        onClicked: {
                            if (modelData.isHeader) {
                                flushCurrentEdits()
                                selectedGroupIndex = modelData.groupIdx
                                selectedHostIndex = -1
                            } else {
                                selectHost(modelData.groupIdx, modelData.hostIdx)
                            }
                        }
                    }
                }
            }
        }

        // ── Edit form ────────────────────────────────────────────────
        Kirigami.Separator {}

        QQC2.Label {
            visible: currentHost !== null
            text: currentHost ? i18n("Editing: %1", currentHost.host) : ""
            font.bold: true
        }

        QQC2.Label {
            visible: currentHost === null && loaded
            text: i18n("Select a host to edit, or click + to add one.")
            color: Kirigami.Theme.disabledTextColor
        }

        Kirigami.FormLayout {
            visible: currentHost !== null
            Layout.fillWidth: true

            Kirigami.Separator {
                Kirigami.FormData.isSection: true
                Kirigami.FormData.label: i18n("SSH Settings")
            }

            QQC2.TextField {
                id: hostField
                Kirigami.FormData.label: i18n("Host alias:")
                Layout.fillWidth: true
                text: currentHost ? currentHost.host : ""
                onTextEdited: markDirty()
            }

            QQC2.TextField {
                id: hostnameField
                Kirigami.FormData.label: i18n("Hostname:")
                Layout.fillWidth: true
                text: currentHost ? (currentHost.hostname !== currentHost.host ? currentHost.hostname : "") : ""
                placeholderText: i18n("IP address or domain name")
                onTextEdited: markDirty()
            }

            QQC2.TextField {
                id: userField
                Kirigami.FormData.label: i18n("User:")
                Layout.fillWidth: true
                text: currentHost ? currentHost.user : ""
                onTextEdited: markDirty()
            }

            QQC2.TextField {
                id: portField
                Kirigami.FormData.label: i18n("Port:")
                Layout.fillWidth: true
                text: currentHost ? currentHost.port : ""
                placeholderText: "22"
                onTextEdited: markDirty()
            }

            QQC2.TextField {
                id: identityFileField
                Kirigami.FormData.label: i18n("Identity file:")
                Layout.fillWidth: true
                text: currentHost ? currentHost.identityFile : ""
                placeholderText: i18n("~/.ssh/id_ed25519")
                onTextEdited: markDirty()
            }

            // ── QuickSSH Options ─────────────────────────────────────
            Kirigami.Separator {
                Kirigami.FormData.isSection: true
                Kirigami.FormData.label: i18n("QuickSSH Options")
            }

            QQC2.ComboBox {
                id: groupCombo
                Kirigami.FormData.label: i18n("Group:")
                Layout.fillWidth: true
                editable: true
                model: {
                    var names = []
                    for (var i = 0; i < workingGroups.length; i++) {
                        var n = workingGroups[i].name
                        if (n !== "" && names.indexOf(n) === -1) names.push(n)
                    }
                    names.unshift("")  // Ungrouped option
                    return names
                }
                currentIndex: {
                    if (selectedGroupIndex < 0) return 0
                    var name = workingGroups[selectedGroupIndex].name
                    var names = model
                    for (var i = 0; i < names.length; i++) {
                        if (names[i] === name) return i
                    }
                    return 0
                }
                displayText: {
                    var val = editText
                    return val === "" ? i18n("(Ungrouped)") : val
                }
                onActivated: markDirty()
                onEditTextChanged: markDirty()
            }

            QQC2.TextField {
                id: iconField
                Kirigami.FormData.label: i18n("Icon:")
                Layout.fillWidth: true
                text: currentHost ? (currentHost.icon !== "network-server" ? currentHost.icon : "") : ""
                placeholderText: "network-server"
                onTextEdited: markDirty()
            }

            QQC2.TextField {
                id: macField
                Kirigami.FormData.label: i18n("MAC address:")
                Layout.fillWidth: true
                text: currentHost ? currentHost.mac : ""
                placeholderText: "aa:bb:cc:dd:ee:ff"
                onTextEdited: markDirty()
            }

        }

        // ── Commands list (outside FormLayout to avoid child limit) ──
        ColumnLayout {
            visible: currentHost !== null
            Layout.fillWidth: true
            spacing: Kirigami.Units.smallSpacing

            RowLayout {
                Layout.fillWidth: true
                QQC2.Label {
                    text: i18n("Commands")
                    font.bold: true
                    Layout.fillWidth: true
                }
                QQC2.ToolButton {
                    icon.name: "list-add"
                    onClicked: {
                        commandsModel.append({ value: "" })
                        markDirty()
                    }
                    QQC2.ToolTip.text: i18n("Add command")
                    QQC2.ToolTip.visible: hovered
                }
            }

            QQC2.Label {
                visible: commandsModel.count === 0
                text: i18n("No commands configured. Click + to add one.")
                color: Kirigami.Theme.disabledTextColor
            }

            Repeater {
                model: commandsModel
                delegate: RowLayout {
                    Layout.fillWidth: true
                    QQC2.TextField {
                        Layout.fillWidth: true
                        text: model.value
                        onTextEdited: {
                            commandsModel.set(index, { value: text })
                            markDirty()
                        }
                    }
                    QQC2.ToolButton {
                        icon.name: "list-remove"
                        onClicked: {
                            commandsModel.remove(index)
                            markDirty()
                        }
                    }
                }
            }
        }

        Kirigami.Separator {
            visible: currentHost !== null
        }

        // ── Additional SSH Options (outside FormLayout to avoid child limit)
        ColumnLayout {
            visible: currentHost !== null
            Layout.fillWidth: true
            spacing: Kirigami.Units.smallSpacing

            RowLayout {
                Layout.fillWidth: true
                QQC2.Label {
                    text: i18n("Additional SSH Options")
                    font.bold: true
                    Layout.fillWidth: true
                }
                QQC2.ToolButton {
                    icon.name: "list-add"
                    onClicked: {
                        optionsModel.append({ optKey: "", optValue: "" })
                        markDirty()
                    }
                    QQC2.ToolTip.text: i18n("Add option")
                    QQC2.ToolTip.visible: hovered
                }
            }

            QQC2.Label {
                text: i18n("Extra SSH config directives (e.g. ProxyJump, ForwardAgent)")
                font: Kirigami.Theme.smallFont
                color: Kirigami.Theme.disabledTextColor
                Layout.fillWidth: true
                wrapMode: Text.WordWrap
            }

            Repeater {
                model: optionsModel
                delegate: RowLayout {
                    Layout.fillWidth: true
                    QQC2.TextField {
                        Layout.preferredWidth: Kirigami.Units.gridUnit * 10
                        text: model.optKey
                        placeholderText: i18n("Key")
                        onTextEdited: {
                            optionsModel.set(index, { optKey: text, optValue: model.optValue })
                            markDirty()
                        }
                    }
                    QQC2.TextField {
                        Layout.fillWidth: true
                        text: model.optValue
                        placeholderText: i18n("Value")
                        onTextEdited: {
                            optionsModel.set(index, { optKey: model.optKey, optValue: text })
                            markDirty()
                        }
                    }
                    QQC2.ToolButton {
                        icon.name: "list-remove"
                        onClicked: {
                            optionsModel.remove(index)
                            markDirty()
                        }
                    }
                }
            }
        }

        // Spacer
        Item { Layout.fillHeight: true }
    }
}
