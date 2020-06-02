let mongoose = require("mongoose");

let config = require("../../config/config.js");
let logger = require("../../common/tracer.js");

// Note: "ExternPlugUS915" is the official name for the device formerly known simply
// as "plugbase". The collection name "electricity_consumption" is kept for backwards
// compatibility purposes for the time being.
let ExternPlugUS915Schema = new mongoose.Schema(
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
    }, { collection: "electricity_consumption" }
);


module.exports = function electricityConsumptionGetModel(applicationID) {
    var conn = require("../../db/dbConnections.js")(config.dbNames.appServer, applicationID, config.nodejsDbServer);
    logger.debug("DeviceConsumption connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("ExternPlugUS915Data", ExternPlugUS915Schema);
};
