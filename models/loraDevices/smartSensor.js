let mongoose = require("mongoose");

let config = require("../../config/config.js");
let logger = require("../../common/tracer.js");

let bodySensorConsumptionSchema = new mongoose.Schema(
    {
        applicationID:  String,
        devEUI:         String,
        timestamp:      Date,
        parsedData: [
            {
                timeSecond:     Number,
                humidity:       Number,
                temperature:    Number,
                bodyCount:      Number
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
    }, { collection: "body_sensor" }
);


module.exports = function bodySensorConsumptionGetModel(applicationID) {
    var conn = require("../../db/dbConnections.js")(config.dbNames.appServer, applicationID, config.nodejsDbServer);
    logger.debug("Body Sensor Consumption connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("BodySensorConsumption", bodySensorConsumptionSchema);
};
