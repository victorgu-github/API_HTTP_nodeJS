let mongoose = require("mongoose");

let config = require("../config/config.js");
let logger = require("../common/tracer.js");

var rssiAggDataSchema = new mongoose.Schema(
    {
        aggStartTime:       Date,
        aggDur: {
            type:   String,
            enum:   [
                "oneHour",
                "oneDay",
                "oneWeek",
                "oneMonth",
                "oneYear"
            ]
        },
        highestAvgRssiAndSnrByDevEUI: [{
            devEUI:         String,
            highestAvgSnr: {
                avgSNR:     Number,
                gwMAC:      String
            },
            highestAvgRssi: {
                avgRSSI:    Number,
                gwMAC:      String
            }
        }],
        totalRssiEntries:   Number,
        totalNumGateways:   Number,
        totalNumDevices:    Number,
        aggregationByDevType: [{
            devType:        String,
            numRssiEntries: Number,
            devEUIs:    [ String ]
        }],
        aggregationByGateway: [{
            gatewayMAC:     String,
            numRssiEntries: Number
        }],
        aggregationByDevEUI: [{
            devEUI:         String,
            numRssiEntries: Number
        }]
    }, { collection: "lora_dyn_agg_info" }
);

module.exports = function() {
    let conn = require("../db/dbConnections.js")(config.dbNames.systemInfo, null, config.nodejsDbServer);
    logger.debug("SystemInfo connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("SystemInfo", rssiAggDataSchema);
};
