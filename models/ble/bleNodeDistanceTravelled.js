const mongoose = require("mongoose");

const config = reqFile("./config/config.js");

let BleNodeDistancesSchema = new mongoose.Schema({
    macAddress:             String,
    timestamp:              Date,
    distanceTravelledInKm:  Number
}, { collection: "agts_ble_node_moving_distance" });

BleNodeDistancesSchema.index({ timestamp: -1 });

module.exports = function(bleAppID) {
    let conn = reqFile("./db/dbConnections.js")(config.dbNames.bleData, bleAppID, config.bleDataDbServer);
    logger.debug("BleNodeDistances connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port, "\n\thosts =", conn.hosts);
    return conn.model("BleNodeDistances", BleNodeDistancesSchema);
};
