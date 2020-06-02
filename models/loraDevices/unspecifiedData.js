let mongoose = require("mongoose");

let config = require("../../config/config.js");
let logger = require("../../common/tracer.js");

var UnspecifiedDataSchema = new mongoose.Schema(
    {
        applicationID:  String,
        devEUI:         String,
        timestamp:      Date,
        rawData: [
            {
                timeSecond:     Number,
                payload:        String,
                parsePayload:   Boolean,
                fCntUp:         Number
            }
        ]
    }, { collection: "unspecified_device_data" }
);

module.exports = function(appID) {
    var conn = require("../../db/dbConnections.js")(config.dbNames.appServer, appID, config.nodejsDbServer);
    logger.debug("UnspecifiedData connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("UnspecifiedData", UnspecifiedDataSchema);
};
