import QtQuick
import QtQuick.Layouts
import QtQuick.Controls as QQC2
import org.kde.kirigami as Kirigami
import org.kde.plasma.plasmoid
import QtCore

QQC2.ItemDelegate {
    id: hostDelegate

    width: parent ? parent.width : implicitWidth
    height: Kirigami.Units.gridUnit * 2.5

    onClicked: root.connectToHost(itemData.host)

    contentItem: RowLayout {
        spacing: Kirigami.Units.smallSpacing

        Kirigami.Icon {
            source: {
                var icon = itemData.icon || "network-server"
                if (icon.startsWith("~/")) {
                    icon = StandardPaths.writableLocation(StandardPaths.HomeLocation) + icon.substring(1)
                }
                return icon
            }
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
