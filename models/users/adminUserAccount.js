let mongoose = require("mongoose");

let config = require("../../config/config.js");
let logger = require("../../common/tracer.js");

var adminUserAcctSchema = new mongoose.Schema(
    {
        firstName:      String,
        lastName:       String,
        username:       String,
        password:       String,
        email:          String,
        scenarios:      [
            {
                id:          Number,
                bleAppID:    String,
                loraAppID:   String,
                default:     Boolean,
            }
        ],
        accessRole:          String,
        tiledLayerBaseURL:   String,
        featureLayerBaseURL: String,
        appIDs:          [String]
    },
    {
        collection:       "adminUserAccounts"
    }
);

adminUserAcctSchema.index({ UserID: -1 });

module.exports = function() {
    var conn = require("../../db/dbConnections.js")(config.dbNames.userAccounts, null, config.nodejsDbServer);
    logger.debug("AdminAccount connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("AdminUserAccount", adminUserAcctSchema);
};
