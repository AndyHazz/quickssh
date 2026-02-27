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
