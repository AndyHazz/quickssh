import org.kde.plasma.configuration

ConfigModel {
    ConfigCategory {
        name: i18n("General")
        icon: "configure"
        source: "configGeneral.qml"
    }
    ConfigCategory {
        name: i18n("SSH Hosts")
        icon: "view-list-tree"
        source: "configHosts.qml"
    }
    ConfigCategory {
        name: i18n("Help")
        icon: "help-contents"
        source: "configHelp.qml"
    }
}
