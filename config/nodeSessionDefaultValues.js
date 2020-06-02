var defaultValues = {};

defaultValues.gwServ = {
    ApplicationID:  "0000000000000005",
    DevEUI:         "0004A30B001A4677",
    DevType:        "streetlight",
    AppEUI:         "D1BA703ADC296DD9",
                    
    DevAddr:        "001A4677",
    NwkSKey:        "2B7E151628AED2A6ABF7158809CF4F3C",
                    
    FCntUp:         0,
    FCntDown:       0,
    RelaxFCnt:      1,
                    
    Rx1DROffset:    0,
    RxDelay:        2,
    Rx2DR:          0,
                    
    ADRInterval:    0,
	InstallationMargin:  "5.00000000000001",

    TxPower:        2,
    NbTrans:        0,
    
    RxWindowNumber: 0,
    PktLossRate:    "0.00000000000001",

    BandID:         "0: US 902 -928MHz",
    TimeoutInterval:  "11.0000000000001",

    Class:            0,
    PingNbClassB:     2,
    PingOffsetClassB: 0,
    FreqClassBC0:     923.3,
    FreqClassBC1:     868.1,
    FreqClassBC2:     500.3,
    FreqClassBC3:     433.05,
    DrClassBC0:       8,
    DrClassBC1:       0,
    DrClassBC2:       0,
    DrClassBC3:       0,
};

defaultValues.appServ = {
    Name:                   "",
    Description:            "",
    ApplicationID:          "0000000000000005",
    DevEUI:                 "0004A30B001A4677",
    DevType:                "streetlight",
    
    UseAppSetting:          true,
    
    AppEUI:                 "D1BA703ADC296DD9",
    AppKey:                 "00000000000000001234432156788765",
    ABP:                    true,
    IsClassC:               true,
    DevAddr:                "001A4677",
    NwkSKey:                "2B7E151628AED2A6ABF7158809CF4F3C",
    AppSKey:                "2B7E151628AED2A6ABF7158809CF4F3C",

    RelaxFCnt:              true,
    RxDelay:                2,
    Rx1DROffset:            0,
    Rx2DR:                  0,
    
    ADRInterval:            0,
	InstallationMargin:     "5.00000000000001",
    
    EncryptedMacCmds:       "",
    EncryptedMacCmdsPrev:   "",
    UnencryptedMacCmds:     "",
    UnencryptedMacCmdsPrev: "",
    UserPayloadData:        "", // This will get cast to Buffer when used
    UserPayloadDataLen:     0,

    HasEncryptedMacCmdDelivered:    "00",
    HasUnencryptedMacCmdDelivered:  "00",
    HasUserPayloadDataDelivered:    "00",

    DownlinkConfirmed:      false,
    FPort:                  1,

    MulticastAddrArray:     [],
    ValidMulticastAddrNum:  0,

    DevNonceUsed:           [],
    DevNonceValidLen:       0,

    EncryptedMacCmdPending:     0,
    UnencryptedMacCmdPending:   0,
    UserPayloadDataPending:     0,
    EncryptedMacCmdSentTime:    new Date("1970-01-01T00:00:00.000Z"),
    UnencryptedMacCmdSentTime:  new Date("1970-01-01T00:00:00.000Z"),
    UserPayloadDataSentTime:    new Date("1970-01-01T00:00:00.000Z"),
    FCntDown:                   0,
    FCntUp:                     0,

    SubType:                "",
    InMaintenance:          false,

    GwToSend:               [],
    ValidGwToSendArrayNum:  0,
    ModifiedTmst:           "0.00000000000001"
};

module.exports = defaultValues;
