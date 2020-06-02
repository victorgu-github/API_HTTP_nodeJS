let mongoose = require("mongoose");

let config = require("../../config/config.js");
let logger = require("../../common/tracer.js");

var generalUserApplicationSchema = new mongoose.Schema(
    {
        generalUserApplicationID:   Number,
        createdTime:                Date,
        modifiedTime:               Date,
        generalUserApplicationName: String,
        lora: {
            loraApplicationID:      String,
            devEUIs:               {type: [String], default: undefined},
        },
        scenarioID:                 Number,
        createdBy:                  String,
        creatorAccessRole:          String
    },
    {
        collection: "generalUserApplications"
    }
);

generalUserApplicationSchema.index({ generalUserApplicationID: -1 });

module.exports = function() {
    var conn = require("../../db/dbConnections.js")(config.dbNames.userAccounts, null, config.nodejsDbServer);
    logger.debug("generalUserApplication connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("generalUserApplication", generalUserApplicationSchema);
};
