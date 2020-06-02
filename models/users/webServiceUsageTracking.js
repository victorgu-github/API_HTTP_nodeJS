const mongoose = require("mongoose");

const config = require("../../config/config.js");

let WebServiceUsageSchema = new mongoose.Schema({
    username:           String,
    accessRole:         String,
    url:                String,
    respCode:           Number,
    operationType:      String,
    operationDetail:    String,
    deviceType:         String,
    deviceEUI:          String,
    loraAppID:          String,
    date:               { type: Date, default: Date.now }
}, { collection: "operationHistory" });


module.exports = function() {
    let conn = require("../../db/dbConnections.js")(config.dbNames.userAccounts, null, config.nodejsDbServer);
    logger.debug("CompanyInfo connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port, "\n\thosts =", conn.hosts);
    return conn.model("WebServiceUsage", WebServiceUsageSchema);
};
