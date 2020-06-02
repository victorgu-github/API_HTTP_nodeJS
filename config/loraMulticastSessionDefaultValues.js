var obj = {};

obj.gwServ = {
    AppEUI:                 "D1BA703ADC296DD9",
    SubType:                "",
    FCntDown:               0,
    TxPower:                0,
    PingNbClassB:           16,
    PingOffsetClassB:       0,
    ValidMulticastGwNum:    0,
    MulticastGwMac:         [],
    BeaconTimeUtcScheduled: [],
    PingSlotNumScheduled:   []
};

obj.appServ = {
    AppEUI:                 "D1BA703ADC296DD9",
    Name:                   "",
    Description:            "",
    GatewayArray:           [],
    ValidGatewayArrayNum:   0,
    EncryptedMacCmds:       "",
    EncryptedMacCmdsPrev:   "",
    UnencryptedMacCmds:     "",
    UnencryptedMacCmdsPrev: "",
    UserPayloadData:        "", // This will get cast to Buffer when used
    UserPayloadDataLen:     0,
    HasEncryptedMacCmdDelivered:    "00",
    HasUnencryptedMacCmdDelivered:  "00",
    HasUserPayloadDataDelivered:    "00",
    Confirmed:              0,
    FPort:                  2
};

module.exports = obj;
