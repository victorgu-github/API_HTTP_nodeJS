let mongoose = require("mongoose");

let config = require("../../config/config.js");
let logger = require("../../common/tracer.js");

var userInfoSchema = new mongoose.Schema(
    {
        firstName :       String,
        lastName  :       String,
        username  :       String,
        password  :       String,
        email     :       String,
        wechatopenid :    String,
        accountRole  :    String
    }, 
    { 
        collection:       "userinfo"
    }
);

userInfoSchema.index({ wechatopenid: -1 });

module.exports = function() {
    var conn = require("../../db/dbConnections.js")(config.dbNames.userAccounts, null, config.nodejsDbServer);
    logger.debug("AdminAccount connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("UserInfo", userInfoSchema);
};
