import QtQuick
import QtQuick.Layouts
import QtQuick.Controls as QQC2
import org.kde.kirigami as Kirigami
import org.kde.plasma.plasmoid
import QtCore

QQC2.ItemDelegate {
    id: hostDelegate

    width: parent ? parent.width : implicitWidth
    topPadding: Kirigami.Units.smallSpacing
    bottomPadding: Kirigami.Units.smallSpacing

    onClicked: root.connectToHost(itemData.discovered ? itemData.hostname : itemData.host)

    contentItem: RowLayout {
        spacing: Kirigami.Units.mediumSpacing

        Rectangle {
            Layout.preferredWidth: Kirigami.Units.smallSpacing * 2.5
            Layout.preferredHeight: Kirigami.Units.smallSpacing * 2.5
            Layout.leftMargin: Kirigami.Units.smallSpacing
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

        Item {
            visible: plasmoid.configuration.showIcons
            Layout.preferredWidth: Kirigami.Units.iconSizes.medium
            Layout.preferredHeight: Kirigami.Units.iconSizes.medium
            Layout.rightMargin: Kirigami.Units.smallSpacing

            Kirigami.Icon {
                anchors.centerIn: parent
                width: Math.min(parent.width, parent.height)
                height: width
                source: {
                    var icon = itemData.icon || "network-server"
                    if (icon.startsWith("~/")) {
                        icon = StandardPaths.writableLocation(StandardPaths.HomeLocation) + icon.substring(1)
                    }
                    return icon
                }
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

            QQC2.Label {
                text: itemData.lastConnected > 0 ? root.formatTimeAgo(itemData.lastConnected) : ""
                Layout.fillWidth: true
                elide: Text.ElideRight
                font.pointSize: Kirigami.Theme.smallFont.pointSize
                color: Kirigami.Theme.disabledTextColor
                opacity: 0.7
                visible: itemData.lastConnected > 0
            }
        }

        QQC2.ToolButton {
            visible: hostDelegate.hovered
            Layout.preferredWidth: Kirigami.Units.iconSizes.medium
            Layout.preferredHeight: Kirigami.Units.iconSizes.medium
            QQC2.ToolTip.text: i18n("Open in File Manager")
            QQC2.ToolTip.visible: hovered
            QQC2.ToolTip.delay: Kirigami.Units.toolTipDelay
            onClicked: root.openSftp(itemData.host, itemData.user, itemData.hostname)
            contentItem: Kirigami.Icon {
                source: "folder"
                isMask: true
                implicitWidth: Kirigami.Units.iconSizes.small
                implicitHeight: Kirigami.Units.iconSizes.small
            }
        }
    }

    QQC2.ToolTip.text: "ssh " + (itemData.user ? itemData.user + "@" : "") + itemData.hostname
    QQC2.ToolTip.visible: hovered
    QQC2.ToolTip.delay: Kirigami.Units.toolTipDelay

    TapHandler {
        acceptedButtons: Qt.RightButton
        onTapped: {
            contextMenuLoader.active = true
            contextMenuLoader.item.popup()
        }
    }

    Loader {
        id: contextMenuLoader
        active: false
        sourceComponent: QQC2.Menu {
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

            QQC2.MenuItem {
                text: i18n("Open in File Manager")
                icon.name: "folder"
                onTriggered: root.openSftp(itemData.host, itemData.user, itemData.hostname)
            }

            QQC2.MenuSeparator {}

            QQC2.MenuItem {
                icon.name: root.isFavorite(itemData.host) ? "bookmark-remove" : "bookmark-new"
                text: root.isFavorite(itemData.host) ? i18n("Unpin from Top") : i18n("Pin to Top")
                onTriggered: root.toggleFavorite(itemData.host)
            }

            QQC2.MenuItem {
                text: i18n("Setup Passwordless Login...")
                icon.name: "dialog-password"
                onTriggered: root.setupPasswordlessLogin(itemData.host)
            }

            QQC2.MenuSeparator {
                visible: itemData.mac !== "" || (itemData.commands && itemData.commands.length > 0)
            }

            QQC2.MenuItem {
                text: i18n("Wake on LAN")
                icon.name: "network-connect"
                visible: itemData.mac !== "" && itemData.status === "offline"
                onTriggered: root.wakeHost(itemData.mac)
            }

            QQC2.Menu {
                id: commandsSubMenu
                title: i18n("Run Command")
                icon.name: "run-build"
                visible: itemData.commands && itemData.commands.length > 0

                Instantiator {
                    model: itemData.commands || []
                    delegate: QQC2.MenuItem {
                        text: modelData
                        onTriggered: root.runHostCommand(itemData.host, modelData)
                    }
                    onObjectAdded: (index, object) => commandsSubMenu.insertItem(index, object)
                    onObjectRemoved: (index, object) => commandsSubMenu.removeItem(object)
                }
            }
        }
    }
}
