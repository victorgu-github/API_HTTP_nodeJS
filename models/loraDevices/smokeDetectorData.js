let mongoose = require("mongoose");

let config = require("../../config/config.js");
let logger = require("../../common/tracer.js");

var smokeDetectorDataSchema = new mongoose.Schema(
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
        ],
        parsedData: [
            {
                timeSecond:     Number,
                
                packetFlag:     String,
                battLevel:      Number
            }
        ]
    }, { collection: "smoke_detector_data" }
);

module.exports = function(appID) {
    var conn = require("../../db/dbConnections.js")(config.dbNames.appServer, appID, config.nodejsDbServer);
    logger.debug("Smoke Detector Data connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("SmokeDetectorData", smokeDetectorDataSchema);
};
