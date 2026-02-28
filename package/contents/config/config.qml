import org.kde.plasma.configuration

ConfigModel {
    ConfigCategory {
        name: i18n("General")
        icon: "preferences-system-network"
        source: "configGeneral.qml"
    }
    ConfigCategory {
        name: i18n("SSH Hosts")
        icon: "network-server"
        source: "configHosts.qml"
    }
    ConfigCategory {
        name: i18n("SSH Config Help")
        icon: "help-contents"
        source: "configHelp.qml"
    }
}
