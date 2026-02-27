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

    Rectangle {
        id: badge
        visible: plasmoid.configuration.showBadge && root.hostList.length > 0
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        width: badgeLabel.implicitWidth + Kirigami.Units.smallSpacing * 2
        height: badgeLabel.implicitHeight + Kirigami.Units.smallSpacing
        radius: height / 2
        color: Kirigami.Theme.highlightColor

        Text {
            id: badgeLabel
            anchors.centerIn: parent
            text: root.hostList.length
            color: Kirigami.Theme.highlightedTextColor
            font.pixelSize: Math.round(parent.parent.height * 0.35)
            font.bold: true
        }
    }
}
