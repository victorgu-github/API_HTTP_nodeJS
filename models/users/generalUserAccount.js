let mongoose = require("mongoose");

let config = require("../../config/config.js");
let logger = require("../../common/tracer.js");

var generalUserAccountSchema = new mongoose.Schema(
    {
        firstName:      String,
        lastName:       String,
        userName:       String,
        password:       String,
        email:          String,
        wechatOpenID:   String,
        generalAppIDs:  { type: [Number], default: undefined },
        companyID:      String
    },
    {
        collection: "generalUserAccounts"
    }
);

generalUserAccountSchema.index({ userName: -1 });

module.exports = function() {
    var conn = require("../../db/dbConnections.js")(config.dbNames.userAccounts, null, config.nodejsDbServer);
    logger.debug("generalUserAccount connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("generalUserAccount", generalUserAccountSchema);
};
