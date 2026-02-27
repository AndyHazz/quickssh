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
