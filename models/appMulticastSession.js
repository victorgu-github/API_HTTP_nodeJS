let mongoose = require("mongoose");

let config = require("../config/config.js");
let logger = require("../common/tracer.js");

let appMulticastSessionSchema = new mongoose.Schema({
    // User-defined:
    ApplicationID:      String,
    AppEUI:             String,
    Class:              Number,
    DevType:            String,

    // User optional:
    SubType:            String,
    FCntDown:           Number,
    MulticastAddr:      String,
    NwkSKey:            String,
    AppSKey:            String,
    Name:               String,
    Description:        String,

    // Constants (not modifiable):
    GatewayArray:           [ String ],
    ValidGatewayArrayNum:   Number,
    EncryptedMacCmds:       String,
    EncryptedMacCmdsPrev:   String,
    UnencryptedMacCmds:     String,
    UnencryptedMacCmdsPrev: String,
    UserPayloadData:        Buffer,
    // Note: The field below is used and modified by the Web API, but never
    // shown to the user.
    UserPayloadDataLen:     Number,
    HasEncryptedMacCmdDelivered:    String,
    HasUnencryptedMacCmdDelivered:  String,
    HasUserPayloadDataDelivered:    String,
    Confirmed:              Number,
    FPort:                  Number
}, { collection: "app_multicast_session" });

module.exports = function(app_id) {
    let conn = require("../db/dbConnections.js")(config.dbNames.appServer, app_id, config.agtsDbServer);
    logger.debug("AppMulticastSession connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port, "\n\thosts =", conn.hosts);
    return conn.model("AppMulticastSession", appMulticastSessionSchema);
};

