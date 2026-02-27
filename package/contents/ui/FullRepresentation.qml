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
        visible: plasmoid.configuration.enableSearch

        RowLayout {
            anchors.fill: parent

            Kirigami.SearchField {
                id: searchField
                Layout.fillWidth: true
                placeholderText: i18n("Search or connect to host...")
                onTextChanged: root.searchText = text
                Keys.onEscapePressed: {
                    if (text !== "") {
                        text = ""
                    } else {
                        root.expanded = false
                    }
                }
                Keys.onReturnPressed: {
                    if (text !== "" && hostListView.count === 0) {
                        root.connectFromSearch(text)
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
                if (plasmoid.configuration.enableSearch) {
                    searchField.forceActiveFocus()
                }
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
                topMargin: Kirigami.Units.mediumSpacing
                bottomMargin: Kirigami.Units.mediumSpacing
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
                        ? i18n("No matching hosts — press Enter to connect to \"%1\"", root.searchText)
                        : i18n("No SSH hosts configured")
                    iconName: root.searchText !== "" ? "go-next" : "network-disconnect"
                }
            }
        }

}

    function buildFilteredModel() {
        var items = []
        var search = root.searchText.toLowerCase()
        var hideOffline = plasmoid.configuration.hideUnreachable
        var grouping = plasmoid.configuration.enableGrouping
        var favSet = {}
        for (var f = 0; f < root.favorites.length; f++) {
            favSet[root.favorites[f]] = true
        }

        // Collect favorites from all groups
        var favoriteHosts = []

        for (var i = 0; i < root.groupedHosts.length; i++) {
            var group = root.groupedHosts[i]
            var filteredHosts = []

            for (var j = 0; j < group.hosts.length; j++) {
                var h = group.hosts[j]
                if (hideOffline && h.status !== "online") continue
                if (search !== "" &&
                    h.host.toLowerCase().indexOf(search) < 0 &&
                    h.hostname.toLowerCase().indexOf(search) < 0 &&
                    h.user.toLowerCase().indexOf(search) < 0) continue

                if (favSet[h.host]) {
                    favoriteHosts.push(h)
                } else {
                    filteredHosts.push(h)
                }
            }

            if (filteredHosts.length > 0) {
                if (grouping) {
                    var groupName = group.name || i18n("Ungrouped")
                    var collapsed = root.isGroupCollapsed(groupName)

                    items.push({
                        isHeader: true,
                        groupName: groupName,
                        hostCount: filteredHosts.length,
                        collapsed: collapsed
                    })

                    if (collapsed) continue
                }

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

        // Prepend favorites section
        if (favoriteHosts.length > 0) {
            if (grouping) {
                items.unshift({
                    isHeader: true,
                    groupName: i18n("Favorites"),
                    hostCount: favoriteHosts.length,
                    collapsed: false
                })
            }
            for (var m = favoriteHosts.length - 1; m >= 0; m--) {
                items.splice(grouping ? 1 : 0, 0, {
                    isHeader: false,
                    host: favoriteHosts[m].host,
                    hostname: favoriteHosts[m].hostname,
                    user: favoriteHosts[m].user,
                    icon: favoriteHosts[m].icon,
                    status: favoriteHosts[m].status
                })
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
