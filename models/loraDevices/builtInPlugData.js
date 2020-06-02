let mongoose = require("mongoose");

let config = require("../../config/config.js");
let logger = require("../../common/tracer.js");

var BuiltInPlugDataSchema = new mongoose.Schema(
    {
        applicationID:  String,
        devEUI:         String,
        timestamp:      Date,
        parsedData: [
            {
                timeSecond:     Number,
                deviceStatus:   String,

                voltage:        Number,
                current:        Number,
                power:          Number
            }
        ],
        rawData: [
            {
                timeSecond:     Number,
                payload:        String,
                parsePayload:   Boolean,
                fCntUp:         Number
            }
        ]
    }, { collection: "built_in_plug_data" }
);

module.exports = function(appID) {
    var conn = require("../../db/dbConnections.js")(config.dbNames.appServer, appID, config.nodejsDbServer);
    logger.debug("BuiltInPlugData connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("BuiltInPlugData", BuiltInPlugDataSchema);
};
