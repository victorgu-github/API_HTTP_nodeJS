let mongoose = require("mongoose");

let config = require("../config/config.js");

let appServRssiHistSchema = new mongoose.Schema({
    DevEUI:     String,
    GwMAC:      String,
    Timestamp:  Date,
    RSSI:       Number,
    SNR:        Number,
    FCntUp:     Number
}, { collection: "app_rssi_history" });

module.exports = function(appID) {
    let conn = require("../db/dbConnections.js")(config.dbNames.appServer, appID, config.agtsDbServer);
    logger.debug("AppServRSSI connection:");
    logger.debug("\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port, "\n\thosts =", conn.hosts);
    return conn.model("AppServRSSI", appServRssiHistSchema);
};
