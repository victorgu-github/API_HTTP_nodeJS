let mongoose = require("mongoose");

let config = require("../config/config.js");
let logger = require("../common/tracer.js");

var gwServNodeSessionSchema = new mongoose.Schema({
    ApplicationID:          String,
    DevEUI:                 String,
    DevType:                String,
	AppEUI:                 String,
    
    DevAddr:                String,
    NwkSKey:                String,

    FCntUp:                 Number,
    FCntDown:               Number,
    RelaxFCnt:              Number,
    Rx1DROffset:            Number,
    RxDelay:                Number,
    Rx2DR:                  Number,
    
    ADRInterval:            Number,
	InstallationMargin:     Number,

    TxPower:                Number,
    NbTrans:                Number,
	
	RxWindowNumber:         Number,
    PktLossRate:            Number,

    BandID:                 Number,
    TimeoutInterval:        Number,

    Class:                  Number,
    PingNbClassB:           Number,
    PingOffsetClassB:       Number,
    FreqClassBC:            Number,
    DrClassBC:              Number
}, { collection: "gw_node_session"});

module.exports = function() {
    var conn = require("../db/dbConnections.js")(config.dbNames.gwServer, null, config.agtsDbServer);
    logger.debug("GwServNodeSession connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("GwServNodeSession", gwServNodeSessionSchema);
};
