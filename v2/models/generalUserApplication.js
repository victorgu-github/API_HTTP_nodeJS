let mongoose = require("mongoose");

let config = require("../../config/config.js");
let logger = require("../../common/tracer.js");

var generalUserApplicationSchema = new mongoose.Schema(
    {
        generalUserApplicationID:   Number,
        generalUserApplicationName: String,
        lora: {
            loraApplicationID:      String,
            devEUIs:               {type: [String], default: undefined},
        },
        ble: {
            type: [{
                bleAppID: String,
                //Here device is a Mixed type, we allow user to store [String] and "all"
                //1.[String]: store all the device mac
                //2."all" is for some specific useage required by Victor
                devices: { type: mongoose.Schema.Types.Mixed, default: undefined }
            }], 
            default: undefined
        },
        scenarioID:                 Number,
        createdBy:                  String,
        creatorAccessRole:          String
    },
    {
        collection: "generalUserApplications",
        timestamps: {
            createdAt:  "createdTime",
            updatedAt:  "modifiedTime"
        }
    }
);

generalUserApplicationSchema.index({ generalUserApplicationID: -1 });

module.exports = function() {
    var conn = require("../../db/dbConnections.js")(config.dbNames.userAccounts, null, config.nodejsDbServer);
    logger.debug("generalUserApplication connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("generalUserApplicationV2", generalUserApplicationSchema);
};
