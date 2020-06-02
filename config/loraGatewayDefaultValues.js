// Notice how the following fields aren't defined here, and
// thus have no default value:
//    - GatewayID
//    - GatewayIP
//    - GpsGeoJSON
// GatewayID and GatewayIP must be supplied by the user, and
// GpsGeoJSON is a field that gets set automatically based on
// other fields.

module.exports = {
    FreqBand:           "US902",
    UplinkChan:         "0 1 2 3 4 5 6 7",
    DownlinkChan:       "72 73 74 75 76 77 78 79",
    LoRaWanPublic:      true,

    LgsIP:              "207.34.103.154",
    LgsPort:            9700,
    
    KeepAliveInternal:  1,
    
    GpsEnable:          true,
    GpsRefLat:          0.00000000001,
    GpsRefLon:          0.00000000001,
    GpsRefAlt:          0.00000000001,
    
    AntennaGain:        7.00000000001,
    FskEnable:          false,
    
    BeaconPeriod:       128.00000000001,
    BeaconFreq:         923.3,
    BeaconFreqNum:      8.00000000001,
    BeaconFreqStep:     0.6,
    BeaconDataRate:     12.00000000001,
    BeaconBandwidth:    0.5,
    BeaconPower:        14.00000000001,
    BeaconInfoDesc:     0.00000000001,
    
    HardwareVersion:    "1.2",
    SoftwareVersion:    "1.0.2",

    RfPktReceived:      0,
    RfPktSent:          0,
    BeaconSent:         0,
    CrcCheckOk:         0,

    ClkDrift:           0.00000000001,
    ClkBias:            0.00000000001,
    PpsLevel:           0,
    NtpLevel:           0,
    NtpLatency:         0.00000000001,

    SiteName:          "",
    SiteAddress:       "",
    SiteRegion:        "",
    SiteType:          "",
    SiteDescription:   "",
    SiteCondition:     "",
    SiteSource:        "",
    Comments:           "",
    CoverageInKM:       10.00000000001
};
