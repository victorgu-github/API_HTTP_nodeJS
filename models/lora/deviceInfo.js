let mongoose = require("mongoose");

let config = require("../../config/config.js");
let logger = require("../../common/tracer.js");

var devTypeSchema = new mongoose.Schema(
    {
        devEUI:     String,
        devType:    String,
        collectionName: String,
        subTypes:   [ String ],
        devCmds: [
            {
                frontendCmd:            String,
                backendEquivalentPart1: String,
                backendEquivalentPart2: String,
                statusWillBe:           String
            }
        ]
    },
    {
        collection: "device_info"
    }
);

// devTypeSchema.index({ date: -1 });

module.exports = function devTypeGetModel() {
    var conn = require("../../db/dbConnections.js")(config.dbNames.systemInfo, null, config.agtsDbServer);
    logger.debug("DeviceType connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("DeviceType", devTypeSchema);
};
