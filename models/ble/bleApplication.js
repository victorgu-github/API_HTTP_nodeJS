const mongoose = require("mongoose");
const config = require("../../config/config.js");

let BleAppSchema = new mongoose.Schema({
    bleAppID:          Number,
    bleAppName:        String,
    detailDataLoc:     { type: String, default: "" },
    relatedCompanyID:  { type: Number, default: 0 },
    createdBy:         String,
    creatorAccessRole: String,
    //Cannot put createdAt in timestamp, otherwise, updatedAt will come together
    createdAt:         { type: Date, default: Date.now},
    centerLat:         { type: Number, default: null},
    centerLng:         { type: Number, default: null},
    centerAlt:         { type: Number, default: null},
    defaultZoomLevel2D:{ type: Number, default: null},
    defaultZoomLevel3D:{ type: Number, default: null},
    foreignKeys: [{
        keyName:        String,
        keyValue:       String,
        description:    String
    }]
},{ 
    collection: "agts_ble_app"
});

BleAppSchema.index({ bleAppID: -1 });

module.exports = function() {
    let conn = require("../../db/dbConnections.js")(config.dbNames.bleConfig, null, config.bleConfigDbServer);
    logger.debug("BleApplication connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port, "\n\thosts =", conn.hosts);
    return conn.model("BleApplication", BleAppSchema);
};
