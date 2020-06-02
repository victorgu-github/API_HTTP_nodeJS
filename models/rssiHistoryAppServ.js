let mongoose = require("mongoose");

let config = require("../config/config.js");

let rssiHistoryAppServSchema = new mongoose.Schema({
    DevEUI:     String,
    GwMAC:      String,
    Timestamp:  Date,
    RSSI:       Number,
    SNR:        Number
}, { collection: "app_rssi_history" }
);

module.exports = function(appID) {
    let conn = require("../db/dbConnections.js")(config.dbNames.appServer, appID, config.agtsDbServer);
    logger.debug("RssiHistoryAppServ connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("RssiHistoryAppServ", rssiHistoryAppServSchema);
};
