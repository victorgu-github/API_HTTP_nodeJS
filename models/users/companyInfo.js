const mongoose = require("mongoose");

const config = require("../../config/config.js");

let CompanyInfoSchema = new mongoose.Schema({
    companyName:        String,
    companyID:          String,
    loraApplicationID:  String,
    region:             String
}, { collection: "companyInfo" });


module.exports = function() {
    let conn = require("../../db/dbConnections.js")(config.dbNames.userAccounts, null, config.nodejsDbServer);
    logger.debug("CompanyInfo connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port, "\n\thosts =", conn.hosts);
    return conn.model("CompanyInfo", CompanyInfoSchema);
};
