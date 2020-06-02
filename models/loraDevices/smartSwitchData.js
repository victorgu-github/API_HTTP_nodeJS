let mongoose = require("mongoose");

let config = require("../../config/config.js");
let logger = require("../../common/tracer.js");

var SmartSwitchDataSchema = new mongoose.Schema(
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

                relay1State:    String,
                led1State:      String,
                led1_1State:    String,
                
                relay2State:    String,
                led2State:      String,
                led2_1State:    String,
                
                relay3State:    String,
                led3State:      String,
                led3_1State:    String,
                
                singleChannel:  String,
                doubleChannel:  String,
                tripleChannel:  String
            }
        ]
    }, { collection: "smart_switch_data" }
);

module.exports = function(appID) {
    var conn = require("../../db/dbConnections.js")(config.dbNames.appServer, appID, config.nodejsDbServer);
    logger.debug("SmartSwitchData connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("SmartSwitchData", SmartSwitchDataSchema);
};
