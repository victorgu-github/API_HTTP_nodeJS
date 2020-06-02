let mongoose = require("mongoose");

let config = reqFile("./config/config.js");
let logger = reqFile("./common/tracer.js");

let parkingLotDetectorSchema = new mongoose.Schema({
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
            fCount:         Number,
            status:         String,
            parkFlag:       String,
            battLevel:      Number
        }
    ]
}, { collection: "parkinglot_data" });

module.exports = function(appID) {
    let conn = reqFile("./db/dbConnections.js")(config.dbNames.appServer, appID, config.nodejsDbServer);
    logger.debug("ParkingLotDetector connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("ParkingLotDetector", parkingLotDetectorSchema);
};
