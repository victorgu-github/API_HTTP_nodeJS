let mongoose = require("mongoose");

let config = require("../../config/config.js");
let logger = require("../../common/tracer.js");

let ChargingStationDataSchema = new mongoose.Schema(
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
    }, { collection: "charging_station_data" }
);

module.exports = function(appID) {
    let conn = require("../../db/dbConnections.js")(config.dbNames.appServer, appID, config.nodejsDbServer);
    logger.debug("ChargingStationDataSchema connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("ChargingStationDataSchema", ChargingStationDataSchema);
};
