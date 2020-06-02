let consts = require("./constants.js");
let dataFormat = require("../common/dataFormat.js");

module.exports = function(devType) {
    switch (devType) {
        case "externPlugCN470":
        case "plugbase":
        case "builtinplug":
            return {
                defaultMode: consts.loraDeviceData.continuous,
                xMinsAgo: {
                    [consts.loraDeviceData.continuous]: 60,
                    [consts.loraDeviceData.scatter]:    200
                },
                aggregateField: {
                    voltage:    "none",
                    current:    "none",
                    power:      "none"
                },
            };
        case "bodysensor":
            return {
                defaultMode: consts.loraDeviceData.continuous,
                xMinsAgo: {
                    [consts.loraDeviceData.continuous]: 60,
                    [consts.loraDeviceData.scatter]:    200
                },
                aggregateField: {
                    humidity:    "avg",
                    temperature: "avg",
                    bodyCount:   "sum"
                }
            };
        case "smokedetector":
            return {
                defaultMode: consts.loraDeviceData.scatter,
                xMinsAgo: {
                    [consts.loraDeviceData.continuous]: 60,
                    [consts.loraDeviceData.scatter]:    1440
                },
                aggregateField: {
                    battLevel: "none"
                },
                dataFormat: {
                    battLevel: dataFormat.battVoltageToPercent
                }
            };
        default:
            logger.error("Error: No recent_usage function defined for '" + devType + "'");
            return null;
    }
};
