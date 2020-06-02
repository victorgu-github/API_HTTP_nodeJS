module.exports = {
    loraDeviceData: {
        continuous: "continuous",
        scatter: "scatter"
    },
    loraDeviceAggregatedDataType: {
        sum: "sum",
    },
    validDurationUnit: {
        lasthour: "lasthour",
        lastday: "lastday"
    },
    userLogin: {
        tokenLifeMinutes:   1440, // 1440 minutes == 24 hours
        tokenLowerThresh:   5,
        tokenUpperThresh:   20160, // 20160 minutes == 14 days
        generalRoleName:    "general",
        adminRoleName:      "admin"
    },
    error: {
        badRequestLabel:  "Bad Request",
        serverErrorLabel: "Server Error"
    },
    esriAuth: {
        "services7.arcgis.com": {
            formData: {
                username: "test_dev",
                password: "test",
            },
            url:           "https://www.arcgis.com/sharing/generateToken",
            selfSignedSSL: false
        }
    },
    howLongWaitForEsriAuthMs:   10000,
    howLongWaitForEsriPolygons: 10000,
    NetworkID:        "0000111",
    loraDevice: {
        maxMCAddrArrayLen: 5,
        freqClassBC: {
            discrete: { // continuous == false
                "0": true,
                "1": false,
                "2": true,
                "3": false
            },
            discreteIncrement: {
                "0": 0.6,
                "1": null,
                "2": 0.2,
                "3": null
            },
            lowerLimit: {
                "0": 923.3,
                "1": 863,
                "2": 500.3,
                "3": 433.05
            },
            upperLimit: {
                "0": 927.5,
                "1": 870,
                "2": 509.7,
                "3": 434.79
            }
        },
        drClassBC: {
            lowerLimit: {
                "0": 8,
                "1": 0,
                "2": 0,
                "3": 0
            },
            upperLimit: {
                "0": 13,
                "1": 7,
                "2": 5,
                "3": 7
            }
        },
        txPower: {
            lowerLimit: {
                "0": 0,
                "1": 0,
                "2": 0,
                "3": 0
            },
            upperLimit: {
                "0": 10,
                "1": 5,
                "2": 7,
                "3": 5
            }
        },
        pingNbClassB: [
            1, 2, 4, 8, 16, 32, 64, 128
        ],
        maxUserPayloadDataLenInChars:   484,
        devTypesWithNoZmqModels: [
            "streetlight"
        ]
    },
    maxNumBleGwForLocationCalculation: 6,
    maxBleNodeForeignKeys: 50,
    esriAllFieldsGeoJsonQuerySuffix: "&outFields=*&f=geojson",
    maxMengyangSheepPictureFileSizeBytes: 15728640,
    minimumNormalDailySheepTravelDistanceKm: 5,
    parkingLotSensor: {
        errorCodes: [ "5", "F" ]
    }
};
