let mongoose = require("mongoose");

let config = require("../config/config.js");
let logger = require("../common/tracer.js");

var loraGatewaySchema = new mongoose.Schema({
    UplinkChan:         String,
    DownlinkChan:       String,
    LoRaWanPublic:      Boolean,
    
    GatewayMAC:         String,
    GatewaySN:          String,
    LgsIP:              String,
    LgsPort:            Number,
    
    KeepAliveInternal:  Number,
    
    GpsEnable:          Boolean,
    GpsRefLon:          Number,     // Must be type double
    GpsRefLat:          Number,     // Must be type double
    GpsRefAlt:          Number,     // Must be type double
    GpsGeoJSON: {
        type:           { type: String },
        coordinates:    [ Number ]
    },
    
    AntennaGain:        Number,     // Must be type double
    FskEnable:          Boolean,
    
    BeaconPeriod:       Number,     // Must be type double
    BeaconFreq:         Number,     // Must be type double
    BeaconFreqNum:      Number,     // Must be type double
    BeaconFreqStep:     Number,     // Must be type double
    BeaconDataRate:     Number,     // Must be type double
    BeaconBandwidth:    Number,     // Must be type double
    BeaconPower:        Number,     // Must be type double
    BeaconInfoDesc:     Number,     // Must be type double
    
    CoreBoardVersion:   String,
    SoftwareVersion:    String,

    RfPktReceived:      Number,
    RfPktSent:          Number,
    BeaconSent:         Number,
    CrcCheckOk:         Number,

    ClkDrift:           Number,     // Must be type double
    ClkBias:            Number,     // Must be type double
    PpsLevel:           Number,
    NtpLevel:           Number,
    NtpLatency:         Number,     // Must be type double

    BandID:             Number,
    MotherboardVersion: String,
    Description:        { type: String, default: "" },
    SiteID:             { type: String, default: "" },
    "4gModule":         { type: String, default: "" },
    "4gSimCardID":      { type: String, default: "" },
    ReverseTunnelPort:  { type: Number, default: 0 },
    InstallationNumber: { type: String, default: "" },
    InstallationDate:   { type: Date, default: Date.now },
    WiredNetwork:       { type: Boolean, default: false },
    WiFi:               { type: Boolean, default: false },
    "4gLTE":            { type: Boolean, default: false },
    CreatedBy:          String,
    CreatorAccessRole:  String,

    Status: {
        type: {
            ReportTime:                 String,
            Cpu:                        Number,
            Mem:                        Number,
            RFpacketReceived:           Number,
            RFpacketSent:               Number,
            PacketCollisionRejected:    Number,
            BeaconCollisionRejected:    Number,
            TimeLateRejected:           Number,
            TimeEarlyRejected:          Number,
            LgaUptime:                  String,
            LgaVersion:                 String,
            Health:                     String
        },
        default: undefined
    },
    //New optional fields
    SiteName:        { type: String, default: "" },
    SiteAddress:     { type: String, default: "" },
    SiteRegion:      { type: String, default: "" },
    SiteType:        { type: String, default: "" },
    SiteDescription: { type: String, default: "" },
    SiteCondition:   { type: String, default: "" },
    SiteSource:      { type: String, default: "" },
    Comments:         { type: String, default: "" },
    CoverageInKM:     { type: Number, default: 10 }
}, {
    collection: "lora_gw_hardware_setting",
    timestamps: {
        createdAt:  "CreatedAt",
        updatedAt:  "UpdatedAt"
    }
});

module.exports = function() {
    var conn = require("../db/dbConnections.js")(config.dbNames.systemInfo, null, config.agtsDbServer);
    logger.debug("LoRaGateway connection:");
    logger.debug("\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port, "\n\thosts =", conn.hosts);
    return conn.model("LoRaGateway", loraGatewaySchema);
};
