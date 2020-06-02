var mongoose = require("mongoose");
mongoose.Promise = global.Promise;

let logger = require("../../common/tracer.js");

var obj = {};
obj.devInfoLookup = {};

// This function will return the parent device type no matter if a parent device or sub-
// device type was entered in the URL. In this way, the function is a map between device
// type and sub-device type.
obj.getParentAndSubDeviceTypes = function(inputType, dInfoRecs) {
    let devInfoRecords = JSON.parse(JSON.stringify(dInfoRecs));
    let actualDeviceMap = {};
    for (let i in devInfoRecords) {
        actualDeviceMap[devInfoRecords[i].devType] = devInfoRecords[i].devType;
        if (devInfoRecords[i].subTypes !== undefined) {
            let subTypes = devInfoRecords[i].subTypes;
            for (let j in subTypes) {
                actualDeviceMap[subTypes[j]] = devInfoRecords[i].devType;
            }
        }
    }
    let outObj = {};
    outObj.devType = actualDeviceMap[inputType];
    if (inputType !== outObj.devType) {
        outObj.subDevType = inputType;
    }
    return outObj;
};

// ---------------------------- DEVICE STATUS / DEVICE CONTROL --------------------------------
obj.findNodeSessions = function(req, deviceInfoRecords) {
    let devTypes = obj.getParentAndSubDeviceTypes(req.params.devicetype, deviceInfoRecords);
    var findTheseDevEUIs = [];
    var AppServNodeSession = require("../../models/nodeSessionAppServ.js")(req.params.application_id);
    if (AppServNodeSession !== undefined && AppServNodeSession !== null) {
        let queryObj = { InMaintenance: false };
        // Find either a) all application server node sessions, or b) a specific set of
        // node sessions, provided in the query string.
        if (req.query.dev_eui) {
            if (req.query.dev_eui.includes(",")) { // Find many
                let reqDevEUIs = req.query.dev_eui.split(",");
                for (let i in reqDevEUIs)
                    findTheseDevEUIs.push(reqDevEUIs[i].toUpperCase());
            } else { // Find one
                findTheseDevEUIs.push(req.query.dev_eui.toUpperCase());
            }
            queryObj.DevEUI = { $in: findTheseDevEUIs };
        }
        queryObj.DevType = devTypes.devType;
        if (devTypes.subDevType !== undefined) {
            queryObj.SubType = devTypes.subDevType;
        }
        return AppServNodeSession.find(queryObj);
    } else {
        logger.error("AppServNodeSession is " + AppServNodeSession);
        return Promise.resolve();
    }
};

obj.getDevInfo = function() {
    let DeviceInfo = require("../../models/lora/deviceInfo.js")();
    return DeviceInfo.find();
};

obj.getZmqModel = function(devType, appID) {
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
            return null;
    }
};

obj.findZmqRecords = function(req, nodeSessions) {
    let model = obj.getZmqModel(req.params.devicetype, req.params.application_id);
    if (model !== null) {
        let promises = [];
        for (let i in nodeSessions) {
            promises.push(model.find(
                {
                    devEUI: nodeSessions[i].DevEUI
                }
            ).limit(1).sort({ _id: -1 }));
        }
        return Promise.all(promises);
    } else {
        return Promise.resolve([]);
    }
};

//Find aggregated data zmp records
//Use sigle promise find and return all the devEUI zaq records
obj.findAggrDataZmqRecs = function(params, nodeSessions) {
    let model = obj.getZmqModel(params.deviceType, params.applicationID);
    return new Promise((resolve) => {
        if (model !== null) {
            let query = {};
            query["$or"] = [];
            query["timestamp"] = {
                $gte: params.aggEndTime,
                $lt: params.aggStartTime
            };
            nodeSessions = JSON.parse(JSON.stringify(nodeSessions));
            for (let i in nodeSessions) {
                let nodeSession = nodeSessions[i];
                let queryObj = {};
                queryObj.devEUI = nodeSession.DevEUI;
                query["$or"].push(queryObj);
            }
            resolve(model.find(query).sort({ _id: -1 }));
        } else {
            resolve([]);
        }
    });
};

module.exports = obj;
