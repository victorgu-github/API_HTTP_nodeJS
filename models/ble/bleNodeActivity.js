const mongoose = require("mongoose");

const config = require("../../config/config.js");

let BleNodeActivitySchema = new mongoose.Schema({
    gwMAC:          String,
    timestamp:      Date,
    nodeMAC:        String,
    rssi:           Number
}, { collection: "agts_ble_node_activity" });


module.exports = function(bleAppID) {
    let conn = require("../../db/dbConnections.js")(config.dbNames.bleData, bleAppID, config.bleDataDbServer);
    logger.debug("BleNodeActivity connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port, "\n\thosts =", conn.hosts);
    return conn.model("BleNodeActivity", BleNodeActivitySchema);
};
