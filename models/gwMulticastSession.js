let mongoose = require("mongoose");

let config = require("../config/config.js");
let logger = require("../common/tracer.js");

let gwMulticastSessionSchema = new mongoose.Schema({
    // User-defined:
    Class:          Number,
    AppEUI:         String,
    ApplicationID:  String,
    DevType:        String,
    BandID:         Number,
    Freq:           Number,
    Dr:             Number,

    // User optional:
    SubType:        String,
    FCntDown:       Number,
    TxPower:        Number,
    MulticastAddr:  String,
    NwkSKey:        String,

    // Constants (not modifiable):
    PingNbClassB:           Number,
    PingOffsetClassB:       Number,
    ValidMulticastGwNum:    Number,
    MulticastGwMac:         [ String ],
    BeaconTimeUtcScheduled: [ String ],
    PingSlotNumScheduled:   [ String ]
}, { collection: "gw_multicast_session"});

module.exports = function() {
    let conn = require("../db/dbConnections.js")(config.dbNames.gwServer, null, config.agtsDbServer);
    logger.debug("GwMulticastSession connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("GwMulticastSession", gwMulticastSessionSchema);
};
