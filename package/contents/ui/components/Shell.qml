import QtQuick
import org.kde.plasma.plasma5support as Plasma5Support

Plasma5Support.DataSource {
    id: executable
    engine: "executable"
    connectedSources: []

    onNewData: (sourceName, data) => {
        var cmd = sourceName
        var out = data["stdout"]
        var err = data["stderr"]
        var code = data["exit code"]
        disconnectSource(sourceName)
        if (callback) {
            callback(cmd, out, err, code)
        }
    }

    property var callback: null

    function exec(cmd, cb) {
        callback = cb
        connectSource(cmd)
    }
}
