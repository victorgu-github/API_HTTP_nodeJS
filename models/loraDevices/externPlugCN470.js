let mongoose = require("mongoose");

let config = require("../../config/config.js");
let logger = require("../../common/tracer.js");

let ExternPlugCN470Schema = new mongoose.Schema(
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
    }, { collection: "externPlugCN470Data" }
);


module.exports = function electricityConsumptionGetModel(applicationID) {
    var conn = require("../../db/dbConnections.js")(config.dbNames.appServer, applicationID, config.nodejsDbServer);
    logger.debug("DeviceConsumption connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("ExternPlugCN470Data", ExternPlugCN470Schema);
};
