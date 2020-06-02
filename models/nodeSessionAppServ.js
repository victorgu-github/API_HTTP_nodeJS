let mongoose = require("mongoose");

let config = require("../config/config.js");
let logger = require("../common/tracer.js");

var appServNodeSchema = new mongoose.Schema({
    Name:                   String,
    Description:            String,
    ApplicationID:          String,
    DevEUI:                 String,
    DevType:                String,
    
    UseAppSetting:          Boolean,

	AppEUI:                 String,
    AppKey:                 String,
    ABP:                    Boolean,
    IsClassC:               Boolean,
    DevAddr:                String,
    NwkSKey:                String,
    AppSKey:                String,

    RelaxFCnt:              Boolean,
    
    RxDelay:                Number,
    Rx1DROffset:            Number,
    Rx2DR:                  Number,
    ADRInterval:            Number,
	InstallationMargin:     Number,

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

    Class:                  Number,

    DownlinkConfirmed:      Boolean,
    FPort:                  Number,

    MulticastAddrArray:     [ String ],
    ValidMulticastAddrNum:  { type: Number, default: 0 },

    DevNonceUsed:           [ Number ],
    DevNonceValidLen:       Number,

    EncryptedMacCmdPending:     Number,
    UnencryptedMacCmdPending:   Number,
    UserPayloadDataPending:     Number,
    EncryptedMacCmdSentTime:    Date,
    UnencryptedMacCmdSentTime:  Date,
    UserPayloadDataSentTime:    Date,

    EncryptedMacCmdProcTime:    Date,
    UnencryptedMacCmdProcTime:  Date,
    UserPayloadDataProcTime:    Date,

    FCntDown:                   Number,
    FCntUp:                     Number,

    SubType:                    String,
    InMaintenance:              Boolean,

    GwToSend:                   [ String ],
    ValidGwToSendArrayNum:      Number,
    ModifiedTmst:               Number,

    CreatedBy:                  String,
    CreatorAccessRole:          String,
    CreatedAt:                  Date,

    RefAlt:                     Number,     // Must be type double
    //GeoJSON structure is defined in function getGeoJSONValue(RefLat, RefLon) located at loraDeviceOneStepRegistPostFunctions.js
    //GeoJSON will fixed on the structure { type: String, coordinates: [Number] } by that function
    //Here we used to schema mongoose.Schema.Types.Mixed, the reason is mongoose.Schema.Types.Mixed accept null value install in database
    GeoJSON:                    mongoose.Schema.Types.Mixed
}, { collection: "app_node_session" });

module.exports = function(app_id) {
    var conn = require("../db/dbConnections.js")(config.dbNames.appServer, app_id, config.agtsDbServer);
    logger.debug("AppServNodeSession connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port, "\n\thosts =", conn.hosts);
    return conn.model("AppServNodeSession", appServNodeSchema);
};

