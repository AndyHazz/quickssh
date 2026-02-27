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
    property alias cfg_hideUnreachable: hideUnreachableCheck.checked
    property alias cfg_enableGrouping: enableGroupingCheck.checked
    property alias cfg_enableSearch: enableSearchCheck.checked
    property alias cfg_notifyOnStatusChange: notifyOnStatusChangeCheck.checked
    property alias cfg_pollInterval: pollIntervalSpin.value
    property alias cfg_discoverHosts: discoverHostsCheck.checked
    property alias cfg_showIcons: showIconsCheck.checked

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

        QQC2.CheckBox {
            id: discoverHostsCheck
            Kirigami.FormData.label: i18n("Discover network hosts:")
        }

        QQC2.Label {
            text: i18n("Uses Avahi/mDNS to find SSH servers on the local network")
            font: Kirigami.Theme.smallFont
            color: Kirigami.Theme.disabledTextColor
            Layout.fillWidth: true
            wrapMode: Text.WordWrap
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

        QQC2.CheckBox {
            id: hideUnreachableCheck
            Kirigami.FormData.label: i18n("Hide unreachable hosts:")
            enabled: showStatusCheck.checked
        }

        QQC2.CheckBox {
            id: notifyOnStatusChangeCheck
            Kirigami.FormData.label: i18n("Notify on status change:")
            enabled: showStatusCheck.checked
        }

        QQC2.SpinBox {
            id: pollIntervalSpin
            Kirigami.FormData.label: i18n("Poll interval (minutes):")
            from: 1
            to: 60
            enabled: notifyOnStatusChangeCheck.checked && showStatusCheck.checked
        }

        Kirigami.Separator {
            Kirigami.FormData.isSection: true
            Kirigami.FormData.label: i18n("Appearance")
        }

        QQC2.CheckBox {
            id: enableSearchCheck
            Kirigami.FormData.label: i18n("Show search bar:")
        }

        QQC2.CheckBox {
            id: enableGroupingCheck
            Kirigami.FormData.label: i18n("Group hosts:")
        }

        QQC2.CheckBox {
            id: showIconsCheck
            Kirigami.FormData.label: i18n("Show host icons:")
        }

        QQC2.CheckBox {
            id: showBadgeCheck
            Kirigami.FormData.label: i18n("Show host count badge on icon:")
        }
    }
}
