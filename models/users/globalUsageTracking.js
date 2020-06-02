const mongoose = require("mongoose");

const config = require("../../config/config.js");

let GlobalLoggedInUsersUsageTracking = new mongoose.Schema({
    username:   String,
    accessRole: String,
    url:        String,
    respCode:   Number,
    timestamp:  Date,
    comments:   String
}, { collection: "logged_in_user_usage" });


module.exports = function() {
    let conn = require("../../db/dbConnections.js")(config.dbNames.userAccounts, null, config.nodejsDbServer);
    logger.debug("CompanyInfo connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port, "\n\thosts =", conn.hosts);
    return conn.model("LoggedInUserUsage", GlobalLoggedInUsersUsageTracking);
};
