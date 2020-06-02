let consts = reqFile("./config/constants.js");

let obj = {};

obj.getZmqModel = function(devType, appID, collectionName) {
    if (devType === undefined || appID === undefined || collectionName === undefined) {
        throw new Error("Must specify a 'devType', 'appID', and 'collectionName' parameter when calling " +
                        "function 'modelSelector.js:getZmqModel'");
    }
    if (consts.loraDevice.devTypesWithNoZmqModels.includes(devType)) {
        return null;
    } else {
        switch (devType) {
            case "plugbase":
                return require("../../models/loraDevices/externPlugUS915.js")(appID);
            case "externPlugCN470":
                return require("../../models/loraDevices/externPlugCN470.js")(appID);
            case "builtinplug":
                return require("../../models/loraDevices/builtInPlugData.js")(appID);
            case "ceilinglight":
            case "smartswitch":
                return require("../../models/loraDevices/smartSwitchData.js")(appID);
            case "bodysensor":
                return require("../../models/loraDevices/smartSensor.js")(appID);
            case "smokedetector":
                return require("../../models/loraDevices/smokeDetectorData.js")(appID);
            case "unspecified":
                return require("../../models/loraDevices/unspecifiedData.js")(appID);
            case "parkingLotSensor":
                return require("../../models/loraDevices/parkingLotSensor.js")(appID);
            case "chargingStation":
                return require("../../models/loraDevices/chargingStation.js")(appID);
            default:
                return reqFile("./models/loraDevices/dynamicUnparsedDevice.js")(appID, collectionName);
        }
    }
};

module.exports = obj;
