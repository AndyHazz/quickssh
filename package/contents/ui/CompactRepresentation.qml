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
