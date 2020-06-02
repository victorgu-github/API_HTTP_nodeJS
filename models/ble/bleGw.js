const mongoose = require("mongoose");

const config = require("../../config/config.js");

let BleGwSchema = new mongoose.Schema({
    macAddress:     String,
    latitude:       Number,
    longitude:      Number,
    status:         String,
    hdwVersion:     String,
    fmwVersion:     String,
    altitude:       Number,
    refLocationName:    String,
    bleAppID:           {type: Number, index: true},
    createdBy:          String,
    createdAt:          Date,
    creatorAccessRole:  String
}, { collection: "agts_ble_gw" });


module.exports = function() {
    let conn = require("../../db/dbConnections.js")(config.dbNames.bleConfig, null, config.bleConfigDbServer);
    logger.debug("BleGateway connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port, "\n\thosts =", conn.hosts);
    return conn.model("BleGateway", BleGwSchema);
};
