var mongoose = require("mongoose");
mongoose.Promise = global.Promise;

let config = require("../../config/config.js");
let asyncFuncs = require("./frontendAsyncFunctions.js");
let dataFormat = require("../../common/dataFormat.js");
let dataValidation = require("../../common/dataValidation.js");
let errorResp = require("../../common/errorResponse.js");
let logger = require("../../common/tracer.js");
let consts = require("../../config/constants.js");
let loraDataValidation = require("../../common/loraDataTypesValidation.js");

const APPLICATION_ID = "application_id";
const DEV_EUIS = "devEUIs";

var obj = {};
obj.devInfoLookup = {};

// ---------------------------- HELPER FUNCTIONS --------------------------------
function getDevCmdLookupObj(deviceInfo) {
    var lookupJSON = {};
    for (let cmdItr in deviceInfo.devCmds) {
        lookupJSON[deviceInfo.devCmds[cmdItr].frontendCmd] = deviceInfo.devCmds[cmdItr];
    }
    return lookupJSON;
}
// This function maps a full command to a relay number so that we can tell which relay number
// has a command waiting to be processed.
function getRelayLookupObj(deviceInfo) {
    var lookupJSON = {};
    for (let i = 0; i < deviceInfo.devCmds.length; i++) {
        let part1 = deviceInfo.devCmds[i].backendEquivalentPart1 + ";";
        let part2 = deviceInfo.devCmds[i].backendEquivalentPart2 + ";";
        let fullCmd = part1 + part2;
        lookupJSON[fullCmd] = deviceInfo.devCmds[i].frontendCmd.substring(10, 11);
    }
    return lookupJSON;
}
// This function maps the DevEUIs in a smartswitch status response object to their state
function getRelayStatusLookup(statuses) {
    let lookup = {};
    for (let i in statuses) {
        lookup[statuses[i].devEUI] = statuses[i].relayStatuses[0].status;
    }
    return lookup;
}
function getZmqDevEuiMap(zmqRecs) {
    let map = {};
    for (let i = 0; i < zmqRecs.length; i++) {
        if (zmqRecs[i][0] !== undefined) {
            map[zmqRecs[i][0].devEUI] = zmqRecs[i][0];
        }
    }
    return map;
}

// ---------------------------- DEVICE STATUS / DEVICE CONTROL --------------------------------
// As implied by the name, this function is responsible for querying:
//   - All device info records
//   - All necessary node sessions
//   - All latest ZeroMQ records, if applicable
function getNodeSessionsDevInfoAndZmqRecords(req) {
    let asyncOutput = {};
    return asyncFuncs.getDevInfo(req).then((devInfoResp) => {
        // Update our global lookup object
        for (let i = 0; i < devInfoResp.length; i++) {
            obj.devInfoLookup[devInfoResp[i].devType] = devInfoResp[i];
        }
        let appIdValidation = loraDataValidation.getApplicationIdValidation(req.params.application_id, "application_id", true, false);
        let devEuiArrValidation = dataValidation.getDevEuiArrValidation(req.query.dev_eui);
        let durValidation = dataValidation.getIntegerStringValidation(req.query.dur);
        if (devEuiArrValidation.length === 0 && durValidation.length === 0 && appIdValidation.length == 0) {
            return asyncFuncs.findNodeSessions(req, devInfoResp).then((nodeSessionsResp) => {
                asyncOutput.nodeSessions = nodeSessionsResp;
                return asyncFuncs.findZmqRecords(req, nodeSessionsResp).then((zmqRecs) => {
                    asyncOutput.zmqRecs = JSON.parse(JSON.stringify(zmqRecs));
                    // Mongoose sets this field to an empty array if it's not present in the source
                    // document, so we have to remove it again.
                    for (let i in asyncOutput.zmqRecs) {
                        for (let j in asyncOutput.zmqRecs[i]) {
                            if (asyncOutput.zmqRecs[i][j].parsedData !== undefined && asyncOutput.zmqRecs[i][j].parsedData.length === 0) {
                                delete asyncOutput.zmqRecs[i][j].parsedData;
                            }
                        }
                    }
                    return asyncOutput;
                });
            });
        } else {
            let errMsgs = devEuiArrValidation.concat(durValidation);
            asyncOutput.validationErrors = errMsgs.concat(appIdValidation);
            return asyncOutput;
        }
    });
}

// - GET "/lora/:devicetype/:application_id/currentstatus"
obj.getDeviceStatus = function(req, res, next) {
    // Add information that can be used by the usage tracking middleware
    res.locals.operationType = "read";
    res.locals.operationDetail = "currentstatus";
    res.locals.devType = req.params.devicetype;
    res.locals.devEUI = (req.query.dev_eui !== undefined) ? req.query.dev_eui.toUpperCase() : "All";
    res.locals.appID = req.params.application_id;
    // This function gets the current status for all requested DevEUIs of the specified
    // device type. The DevEUIs to find (if any) are passed in the URL query string, and
    // the device type is passed in the req.params.devicetype parameter.
    getNodeSessionsDevInfoAndZmqRecords(req).then((asyncResp) => {
        if (asyncResp.validationErrors === undefined) {
            let nodeSessions = asyncResp.nodeSessions;
            let zmqRecDevEuiMap = getZmqDevEuiMap(asyncResp.zmqRecs);
            // Smart switches are a special exception, and their statuses require additional
            // information retrieved from the "smart_switch_data" collection.
            if (nodeSessions.length > 0 && nodeSessions[0].DevType === "smartswitch") {
                let output = getMultiRelayStatuses(nodeSessions, req, zmqRecDevEuiMap);
                if (output.validationErrors.length === 0) {
                    res.send({ deviceStatuses: output.statuses });
                    next();
                } else {
                    errorResp.send(res, "Bad Request", output.validationErrors, 400);
                    next();
                }
            } else {
                var statuses = [];

                for (let i in nodeSessions) {
                    let statusObj = {
                        devEUI: nodeSessions[i].DevEUI
                    };
                    if (obj.devInfoLookup[req.params.devicetype] === undefined) {
                        statusObj.error = "No device_info records found for this node session";
                    } else {
                        statusObj.status = getSpecificDeviceStatus(nodeSessions[i], zmqRecDevEuiMap);
                    }
                    if (statusObj.status.error) {
                        statusObj.error = statusObj.status.error;
                        delete statusObj.status;
                    }
                    statuses.push(statusObj);
                }
                res.send({ deviceStatuses: statuses });
                next();
            }
        } else {
            errorResp.send(res, "Bad Request", asyncResp.validationErrors, 400);
            next();
        }
    }).catch((err) => {
        let msg = err + "";
        logger.error(err);
        errorResp.send(res, "Mongo Error", msg, 500);
        next();
    });
};

// NOTE: This function is used by the following web services (in this file):
//   - GET "/lora/:devicetype/:application_id/currentstatus"
//   - GET "/lora/:application_id/deviceStatus?devEUIs=xxx,xxx,xxx"
//   - GET "/lora/:application_id/dev_eui/:dev_eui/deviceStatus"
//   - GET "/lora/:devicetype/:application_id/:human_command"
function getSpecificDeviceStatus(nodeSession, zmqRecDevEuiMap) {
    let status;
    switch (nodeSession.DevType) {
        // For the moment, device statuses for streetlight, externPlugUS915 (a.k.a. "plugbase"),
        // and externPlugCN470 are calculated the same way, so we can reuse this function.
        // Also note that "plugbase" is used en lieu of "externPlugUS915" for backwards
        // compatibility reasons. "plugbase" and "externPlugUS915" both refer to the same device.
        case "externPlugCN470":
        case "builtinplug":
        case "plugbase":
            status = getSimpleZmqStatus(nodeSession, zmqRecDevEuiMap);
            // If we can't get the status from the latest ZeroMQ record, fall back on the old way
            // of getting the status, which is to use the app server node session. Here, if 'status'
            // is undefined then we will fall through to the "streetlight" case and it will return
            // the status as computed from the node session.
            if (status !== undefined) {
                return status;
            }
        case "streetlight":
            // Any of the above devices that get an undefined status will fall into this code block:
            return getNodeSessionStatus(nodeSession);
        case "parkingLotSensor":
            let parkingLotFunctions = require("../anyueFunctions/parkingLotFunctions.js");
            let zmqRec = zmqRecDevEuiMap[nodeSession.DevEUI];
            if (zmqRec.parsedData !== undefined) {
                return parkingLotFunctions.combineChargingLotStatuses(zmqRec.parsedData[zmqRec.parsedData.length - 1]);
            } else {
                return "unknown";
            }
        default:
            // This code will execute if we were to register a first instance of a new device type
            // and query its status before implementing the status function to go with it, or if
            // the device type is "unspecified".
            logger.error("No status function defined for this device type:", nodeSession.DevType);
            return {
                error: "No status function defined for this device type: " + nodeSession.DevType
            };
    }
}

function getSimpleZmqStatus(nodeSession, zmqRecDevEuiMap) {
    let zmqWaitPeriod = new Date();
    zmqWaitPeriod.setMilliseconds(zmqWaitPeriod.getMilliseconds() - config.zmqUpdateIntervalMilliseconds);
    if (nodeSession.UnencryptedMacCmds.length > 0 && nodeSession.HasUnencryptedMacCmdDelivered === "00") {
        return "Waiting";
    } else if (nodeSession.UnencryptedMacCmdProcTime > zmqWaitPeriod) {
        return "Waiting";
    } else {
        let zmqRecord = zmqRecDevEuiMap[nodeSession.DevEUI];
        if (zmqRecord !== undefined) {
            let parsedData = zmqRecord.parsedData;
            if (parsedData !== undefined) {
                return parsedData[parsedData.length - 1].deviceStatus;
            } else {
                return {
                    error: "No parsed data found for this device"
                };
            }
        } else {
            return {
                error: "No uplinks found for this device. Please ensure device is powered on and connected to the LoRa network."
            };
        }
    }
}

function getNodeSessionStatus(nodeSession) {
    // Loosely speaking, we determine a streetlight's current status thusly:
    //
    // What was the last command processed for this device?
    //  - No command has been processed for this device yet
    //      - Does it currently have a command that's waiting to be processed?
    //          - Yes
    //              - Status: "Waiting"
    //          - No
    //              - Status: "Off"
    //  - "Turn on"
    //      - Status: "On"
    //  - "Turn off"
    //      - Status: "Off"
    let deviceInfo = obj.devInfoLookup[nodeSession.DevType];
    
    var wasDelivered = (nodeSession.HasUnencryptedMacCmdDelivered === "01") ? true : false;
    var hasCurrCmd = (nodeSession.UnencryptedMacCmds.length > 0) ? true : false;
    var currCmds = (hasCurrCmd) ? nodeSession.UnencryptedMacCmds.split(";") : "" ;
    var lastCurrCmd = (currCmds.length > 1) ? currCmds[currCmds.length - 2] : "";
    var statusWillBe = "Unknown";
    if (lastCurrCmd == deviceInfo.devCmds[0].backendEquivalentPart2)  // On
        statusWillBe = deviceInfo.devCmds[0].statusWillBe;
    if (lastCurrCmd == deviceInfo.devCmds[1].backendEquivalentPart2)  // Off
        statusWillBe = deviceInfo.devCmds[1].statusWillBe;
    
    var hasPrevCmd = (nodeSession.UnencryptedMacCmdsPrev.length > 0) ? true : false;
    var prevCmds = (hasPrevCmd) ? nodeSession.UnencryptedMacCmdsPrev.split(";") : "";
    var lastPrevCmd = (prevCmds.length > 1) ? prevCmds[prevCmds.length - 2] : "";
    var statusIs = "Unknown";
    if (lastPrevCmd == deviceInfo.devCmds[0].backendEquivalentPart2)  // On
        statusIs = deviceInfo.devCmds[0].statusWillBe;
    if (lastPrevCmd == deviceInfo.devCmds[1].backendEquivalentPart2)  // Off
        statusIs = deviceInfo.devCmds[1].statusWillBe;

    if (wasDelivered) {
        if (hasCurrCmd) {
            return statusWillBe;
        } else {
            return (hasPrevCmd) ? statusIs : "Error";
        }
    } else { // I.e.: Delivered == "01"
        return (hasCurrCmd) ? "Waiting" : "Off";
    }
}

function getMultiRelayStatuses(nodeSessions, req, zmqRecDevEuiMap) {
    let allStatuses = [];
    let validationErrors = [];
    for (let i = 0; i < nodeSessions.length; i++) {
        let zmqRecord = zmqRecDevEuiMap[nodeSessions[i].DevEUI];
        if (zmqRecord !== undefined) {
            if (zmqRecord.parsedData !== undefined) {
                let parsedData = zmqRecord.parsedData[zmqRecord.parsedData.length - 1];
                let relayStates = {
                    "1":    parsedData.relay1State,
                    "2":    parsedData.relay2State,
                    "3":    parsedData.relay3State
                };

                // Save some information on this device for easier access by subsequent
                // parts of this function.
                var maxRelay;
                var relayConfig;
                var relayValues;
                if (parsedData.singleChannel === "On") {
                    maxRelay = 1;
                    relayConfig = "single";
                    relayValues = [ 1 ];
                }
                if (parsedData.doubleChannel === "On") {
                    maxRelay = 2;
                    relayConfig = "double";
                    relayValues = [ 1, 2 ];
                }
                if (parsedData.tripleChannel === "On") {
                    maxRelay = 3;
                    relayConfig = "triple";
                    relayValues = [ 1, 2, 3 ];
                }
                if (req.query.relayNum !== undefined) {
                    if (dataValidation.isInteger(req.query.relayNum) === false) {
                        validationErrors.push("relayNum must be a valid integer between 1 and 3");
                        break;
                    } else if (parseInt(req.query.relayNum) < 1 || parseInt(req.query.relayNum) > 3) {
                        validationErrors.push("Device " + zmqRecord.devEUI + " supports between 1 and 3 relays "
                                              + "(i.e.: 'relayNum' must be between 1 and 3, inclusive)");
                        break;
                    } else if (parseInt(req.query.relayNum) > maxRelay) {
                        validationErrors.push("Device " + zmqRecord.devEUI + " is in a " + relayConfig +
                                              " channel relayConfig (i.e.: relayNum must be one of the following: [ "
                                              + relayValues +" ])");
                        break;
                    }
                }
                let devInfoRecord = obj.devInfoLookup[nodeSessions[i].DevType];
                let relayLookup = getRelayLookupObj(devInfoRecord);
                let zmqWaitPeriod = new Date();
                zmqWaitPeriod.setMilliseconds(zmqWaitPeriod.getMilliseconds() - config.zmqUpdateIntervalMilliseconds);
                if (nodeSessions[i].UnencryptedMacCmds.length > 0 && nodeSessions[i].HasUnencryptedMacCmdDelivered === "00") {
                    switch (relayLookup[nodeSessions[i].UnencryptedMacCmds]) {
                        case "1": relayStates["1"] = "Waiting"; break;
                        case "2": relayStates["2"] = "Waiting"; break;
                        case "3": relayStates["3"] = "Waiting"; break;
                        default: break;
                    }
                } else if (nodeSessions[i].UnencryptedMacCmdProcTime > zmqWaitPeriod) {
                    switch (relayLookup[nodeSessions[i].UnencryptedMacCmdsPrev]) {
                        case "1": relayStates["1"] = "Waiting"; break;
                        case "2": relayStates["2"] = "Waiting"; break;
                        case "3": relayStates["3"] = "Waiting"; break;
                        default: break;
                    }
                }

                let statusObj = {
                    devEUI:         zmqRecord.devEUI,
                    relayStatuses:  []
                };
                if (req.query.relayNum !== undefined) {
                    statusObj.relayStatuses.push(
                        {
                            relayNum:   parseInt(req.query.relayNum),
                            status:     relayStates["" + req.query.relayNum]
                        }
                    );
                } else {
                    // Else, if the device is in an N-channel relay configuration, don't
                    // return any statuses for a relay number > N.
                    for (let k = 0; k < maxRelay; k++) {
                        statusObj.relayStatuses.push(
                            {
                                relayNum:   k + 1,
                                status:     relayStates["" + (k + 1)]
                            }
                        );
                    }
                }
                allStatuses.push(statusObj);
            } else {
                allStatuses.push({
                    devEUI:         zmqRecord.devEUI,
                    relayStatuses:  []
                });
            }
        }
    }
    // For any devices for which there are no ZeroMQ records found, we'll want to display an
    // error message.
    for (let i in nodeSessions) {
        if (zmqRecDevEuiMap[nodeSessions[i].DevEUI] === undefined) {
            allStatuses.push({
                devEUI: nodeSessions[i].DevEUI,
                error:  "No uplinks found for this device. Please ensure device is powered on and connected to the LoRa network."
            });
        }
    }
    return {
        statuses:           allStatuses,
        validationErrors:   validationErrors
    };
}

// - GET "/lora/:devicetype/:application_id/latest_usage"
obj.getLatestDeviceData = function(req, res, next) {
    // Add information that can be used by the usage tracking middleware
    res.locals.operationType = "read";
    res.locals.operationDetail = "latest_usage";
    res.locals.devType = req.params.devicetype;
    res.locals.devEUI = (req.query.dev_eui !== undefined) ? req.query.dev_eui.toUpperCase() : "All";
    res.locals.appID = req.params.application_id;
    getNodeSessionsDevInfoAndZmqRecords(req).then((asyncResp) => {
        if (asyncResp.validationErrors === undefined) {
            let nodeSessions = asyncResp.nodeSessions;
            let zmqRecDevEuiMap = getZmqDevEuiMap(asyncResp.zmqRecs);
            var dataObjs = [];

            for (let i = 0; i < nodeSessions.length; i++) {
                if (deviceHasLatestUsageAvailable(nodeSessions[i].DevType) === true) {
                    dataObjs.push(getLatestZmqObject(nodeSessions[i], zmqRecDevEuiMap));
                } else {
                    dataObjs.push({
                        devEUI: nodeSessions[i].DevEUI,
                        error:  "No latest_usage function defined for '" + nodeSessions[i].DevType + "'"
                    });
                }
            }
            res.send({ deviceInfos: dataObjs });
            next();
        } else {
            errorResp.send(res, "Bad Request", asyncResp.validationErrors, 400);
            next();
        }
    }).catch((err) => {
        let msg = err + "";
        logger.error(err);
        errorResp.send(res, "Mongo Error", msg, 500);
        next();
    });
};

function deviceHasLatestUsageAvailable(devType) {
    switch (devType) {
        case "externPlugCN470":
        case "plugbase":
        case "builtinplug":
        case "bodysensor":
        case "smokedetector":
            return true;
        default:
            logger.error("Error: No latest_usage function defined for '" + devType + "'");
            return false;
    }
}

function getLatestZmqObject(nodeSession, zmqRecDevEuiMap) {
    let zmqObj = {
        devEUI: nodeSession.DevEUI,
    };
    if (zmqRecDevEuiMap[nodeSession.DevEUI] !== undefined) {
        let zmqRec = zmqRecDevEuiMap[nodeSession.DevEUI];
        zmqObj.timestamp = zmqRec.timestamp;
        if (zmqRec.parsedData !== undefined) {
            let parsedData = getParsedDataObject(zmqRec, nodeSession.DevType);
            for (let field in parsedData) {
                zmqObj[field] = parsedData[field];
            }
        } else {
            zmqObj.error = "No parsed data found for this device";
        }
    } else {
        zmqObj.error = "No uplinks found for this device. Please ensure device is powered on and connected to the LoRa network.";
    }
    // The following line can be removed once all ZeroMQ records are up to date. For now though,
    // any old ZeroMQ records might contain the unwanted "hasParsedData" field, and thus it
    // must get removed as per the latest code.
    delete zmqObj.hasParsedData;
    return zmqObj;
}

// This function is purely to address data formatting issues on a device-specific basis
function getParsedDataObject(zmqObj, devType) {
    let outObj = JSON.parse(JSON.stringify(zmqObj.parsedData[zmqObj.parsedData.length - 1]));
    delete outObj._id;
    delete outObj.diagnosticInfo;
    switch (devType) {
        // For plug-type devices, if a given field is undefined this means that the data is
        // unusable for hardware reasons, so we'll return null.
        case "plugbase":
        case "externPlugCN470":
        case "builtinplug":
            // Note: The null checks below are to ensure program still works with old data.
            // They can be removed at some future date once all database records are up-to-
            // date.
            if (outObj.power === undefined || outObj.power === null) {
                outObj.power = null;
            } else {
                outObj.power = parseFloat(outObj.power.toFixed(2));
            }
            if (outObj.current === undefined || outObj.current === null) {
                outObj.current = null;
            } else {
                outObj.current = parseFloat(outObj.current.toFixed(2));
            }
            if (outObj.voltage === undefined || outObj.voltage === null) {
                outObj.voltage = null;
            } else {
                outObj.voltage = parseFloat(outObj.voltage.toFixed(2));
            }
            break;
        case "smokedetector":
            outObj.battLevel = dataFormat.battVoltageToPercent(outObj.battLevel);
            break;
        default:
            break;
    }
    return outObj;
}

// - GET "/lora/:devicetype/:application_id/recent_usage"
obj.getRecentDeviceData = function(req, res, next) {
    // Add information that can be used by the usage tracking middleware
    res.locals.operationType = "read";
    res.locals.operationDetail = "recent_usage";
    res.locals.devType = req.params.devicetype;
    res.locals.devEUI = (req.query.dev_eui !== undefined) ? req.query.dev_eui.toUpperCase() : undefined;
    res.locals.appID = req.params.application_id;
    // The req.query.dev_eui parameter is actually required for this function, and is non-
    // optional. Then, if the user has specified the "mode" query parameter, its value must
    // be either <consts.loraDeviceData.continuous> or <consts.loraDeviceData.scatter>.
    let devEuiReqdValidation = dataValidation.getDevEuiRequiredValidation(req.query.dev_eui);
    let modeValidation = dataValidation.getRecentUsageModeValidation(req.query.mode);
    getNodeSessionsDevInfoAndZmqRecords(req).then((asyncResp) => {
        if (devEuiReqdValidation.length === 0 && modeValidation.length === 0 && asyncResp.validationErrors === undefined) {
            let nodeSessions = asyncResp.nodeSessions;
            if (nodeSessions.length === 1) {

                getDeviceSpecificRecentZmqRecords(nodeSessions[0], req).then((resp) => {
                    if (resp !== null) {
                        res.send({ deviceInfos: resp });
                        next();
                    } else {
                        res.send({ deviceInfos: [] });
                        next();
                    }
                }).catch((err) => {
                    let msg = "" + err;
                    errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
                    next();
                });
            } else if (nodeSessions.length === 0) {
                res.send({ deviceInfos: [] });
                next();
            } else {
                let msg = "This web service currently only supports one DevEUI at a time";
                errorResp.send(res, consts.error.badRequestLabel, msg, 400);
                next();
            }
        } else {
            let errMsgs = devEuiReqdValidation.concat(modeValidation);
            if (asyncResp.validationErrors !== undefined)
                errMsgs = errMsgs.concat(asyncResp.validationErrors);
            logger.error(errMsgs);
            errorResp.send(res, consts.error.badRequestLabel, errMsgs, 400);
            next();
        }
    }).catch((err) => {
        let msg = "" + err;
        errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
        next();
    });
};

function getDeviceSpecificRecentZmqRecords(nodeSession, req) {
    let appID = req.params.application_id;
    let model = asyncFuncs.getZmqModel(nodeSession.DevType, appID);
    if (model !== null) {
        let devConfig = require("../../config/loraDeviceRecentUsageConfig.js")(nodeSession.DevType);
        if (devConfig !== null) {
            let mode = devConfig.defaultMode;
            if (req.query.mode !== undefined) {
                mode = req.query.mode;
            }
            let currentTime = new Date();
            currentTime.setMilliseconds(0);
            currentTime.setSeconds(0);
            let lowerTimestamp = new Date(currentTime);
            let xMinsAgo = (req.query.dur !== undefined) ? req.query.dur : devConfig.xMinsAgo[mode];
            lowerTimestamp.setMinutes(lowerTimestamp.getMinutes() - xMinsAgo);
            return model.find({
                devEUI:     nodeSession.DevEUI,
                timestamp:  { $gt: lowerTimestamp }
            }).sort({ _id: -1 }).then((zmqResp) => {
                // Mongoose sets this field to an empty array if it's not present in the source document, so we have
                // to remove it again. Then, this process has the side-effect of turning Date objects into strings,
                // so we have to re-cast the timestamp to Date.
                let zmqRecs = JSON.parse(JSON.stringify(zmqResp));
                for (let i in zmqRecs) {
                    if (zmqRecs[i].parsedData.length === 0) {
                        delete zmqRecs[i].parsedData;
                    }
                    zmqRecs[i].timestamp = new Date(zmqRecs[i].timestamp);
                }
                let finalZmqOutput = [];
                let zmqRecsByTimestamp = {};
                for (let i = 0; i < zmqRecs.length; i++) {
                    let temp = getAggregatedZmqObject(zmqRecs[i], devConfig);
                    zmqRecsByTimestamp[zmqRecs[i].timestamp] = temp;
                }

                for (let time = new Date(currentTime); time > lowerTimestamp; time.setMinutes(time.getMinutes() - 1)) {
                    let standardFields = {
                        devEUI:         nodeSession.DevEUI,
                        timestamp:      time
                    };
                    let deviceSpecificFields;
                    if (zmqRecsByTimestamp[time] === undefined && mode === consts.loraDeviceData.continuous) {
                        deviceSpecificFields = getAggregatedZmqObject(null, devConfig);
                        let pushedObject = JSON.parse(JSON.stringify(Object.assign(standardFields, deviceSpecificFields)));
                        finalZmqOutput.push(pushedObject);
                    } else if (zmqRecsByTimestamp[time] !== undefined) {
                        deviceSpecificFields = zmqRecsByTimestamp[time];
                        let pushedObject = JSON.parse(JSON.stringify(Object.assign(standardFields, deviceSpecificFields)));
                        finalZmqOutput.push(pushedObject);
                    }
                }
                return finalZmqOutput;
            });
        } else {
            return Promise.resolve(null);
        }
    } else {
        return Promise.resolve(null);
    }
}

function getAggregatedZmqObject(zmqRec, devConfig) {
    let outObj = {};
    let aggValue = 0;
    let aggNum = 0;
    for (let field in devConfig.aggregateField) {
        if (zmqRec !== null && zmqRec.parsedData !== undefined) {
            let parsedData = JSON.parse(JSON.stringify(zmqRec.parsedData));
            switch (devConfig.aggregateField[field]) {
                case "avg":
                    aggValue = 0;
                    aggNum = 0;
                    for (let j in parsedData) {
                        if (parsedData[j][field] !== undefined && parsedData[j][field] !== null) {
                            aggValue += parsedData[j][field];
                            aggNum++;
                        }
                    }
                    outObj[field] = (aggNum !== 0) ? parseFloat((aggValue / aggNum).toFixed(2)) : null;
                    break;
                case "sum":
                    aggValue = 0;
                    aggNum = 0;
                    for (let j in parsedData) {
                        if (parsedData[j][field] !== undefined && parsedData[j][field] !== null) {
                            aggValue += parsedData[j][field];
                            aggNum++;
                        }
                    }
                    outObj[field] = (aggNum !== 0) ? parseFloat(aggValue.toFixed(2)) : null;
                    break;
                case "none":
                    if (parsedData[parsedData.length - 1][field] !== undefined) {
                        outObj[field] = parsedData[parsedData.length - 1][field];
                    } else {
                        outObj[field] = null;
                    }
                    break;
                default:
                    break;
            }
            if (devConfig.dataFormat !== undefined && devConfig.dataFormat[field] !== undefined) {
                outObj[field] = devConfig.dataFormat[field](outObj[field]);
            }
        } else {
            outObj[field] = null;
        }
    }
    return outObj;
}

// - GET "/lora/:devicetype/:application_id/numdevices"
obj.getNumDevices = function(req, res, next) {
    // Add information that can be used by the usage tracking middleware
    res.locals.operationType = "read";
    res.locals.operationDetail = "numdevices";
    res.locals.devType = req.params.devicetype;
    res.locals.appID = req.params.application_id;
    asyncFuncs.getDevInfo(req).then((devInfoResp) => {
        // Update our global lookup object
        for (let i = 0; i < devInfoResp.length; i++) {
            obj.devInfoLookup[devInfoResp[i].devType] = devInfoResp[i];
        }
        let appIdValidation = loraDataValidation.getApplicationIdValidation(req.params.application_id, "application_id", true, false);
        if (appIdValidation.length == 0) {
            let AppServNodeSession = require("../../models/nodeSessionAppServ.js")(req.params.application_id);
            let devTypes = asyncFuncs.getParentAndSubDeviceTypes(req.params.devicetype, devInfoResp);
            let query = { InMaintenance: false };
            query.DevType = devTypes.devType;
            if (devTypes.subDevType !== undefined) {
                query.SubType = devTypes.subDevType;
            }
            AppServNodeSession.count(query).then((resp) => {
                res.send({ numDevices: resp });
                next();
            }).catch((err) => {
                logger.error(err);
                let errMsg = err + "";
                errorResp.send(res, consts.error.serverErrorLabel, errMsg, 500);
                next();
            });
        } else {
            let errMsgs = appIdValidation;
            errorResp.send(res, consts.error.badRequestLabel, errMsgs, 400);
            next();
        }
    }).catch((err) => {
        logger.error(err);
        let errMsg = err + "";
        errorResp.send(res, consts.error.serverErrorLabel, errMsg, 500);
        next();
    });
};

// - GET "/lora/:devicetype/:application_id/:human_command"
obj.ctrlDevice = function(req, res, next) {
    // Add information that can be used by the usage tracking middleware
    res.locals.operationType = "update";
    res.locals.operationDetail = req.params.human_command;
    res.locals.devType = req.params.devicetype;
    res.locals.appID = req.params.application_id;
    res.locals.devEUI = (req.query.dev_eui !== undefined) ? req.query.dev_eui.toUpperCase() : undefined;
    /*
     * For each node session, if the "devType" field in its device_info record matches the device type
     * given in req.params.devicetype, we then check the current status of the node session. If it's
     * already in the desired state, no changes are needed. If not, we proceed with updating the node
     * session.
     */

    // First, find all application server node sessions
    let AppServNodeSession = require("../../models/nodeSessionAppServ.js")(req.params.application_id);
    getNodeSessionsDevInfoAndZmqRecords(req).then((asyncResp) => {
        if (req.query.dev_eui === undefined) {
            let devEuiReqdMsg = "Must specify 'dev_eui' parameter containing a 16-character hex string" +
                ", or comma-separated list thereof";
            if (asyncResp.validationErrors) {
                asyncResp.validationErrors.push(devEuiReqdMsg);
            } else {
                asyncResp.validationErrors = [ devEuiReqdMsg ];
            }
        }
        if (asyncResp.validationErrors === undefined) {
            let nodeSessions = asyncResp.nodeSessions;
            let zmqRecDevEuiMap = getZmqDevEuiMap(asyncResp.zmqRecs);
            if (nodeSessions.length > 0) {
                switch (nodeSessions[0].DevType) {
                    case "smartswitch":
                        controlRelayOnDevice(req, res, next, nodeSessions, AppServNodeSession, zmqRecDevEuiMap);
                        break;
                    case "plugbase":
                    case "externPlugCN470":
                    case "builtinplug":
                    case "streetlight":
                        controlEntireDevice(req, res, next, nodeSessions, AppServNodeSession, zmqRecDevEuiMap);
                        break;
                    default:
                        res.send({ deviceStatuses: [] });
                        next();
                        break;
                }
            } else {
                res.send({ deviceStatuses: [] });
                next();
            }
        } else {
            errorResp.send(res, "Bad Request", asyncResp.validationErrors, 400);
            next();
        }
    }).catch((err) => {
        let msg = err + "";
        logger.error(err);
        errorResp.send(res, "Mongo Error", msg, 500);
        next();
    });
};

function controlRelayOnDevice(req, res, next, nodeSessions, AppServNodeSession, zmqRecDevEuiMap) {
    // Right now, AGTS only supports one command per DevEUI at a time, so in order to
    // turn on all 3 sub-devices connected to a single smart switch, frontend has to
    // make 3 HTTP requests to Web API, and wait for AGTS to process each one before
    // sending another. In each request, frontend must specify which relay to control
    // in the "relayNum" query parameter. E.g.: if req.query.devicetype is "ceilinglight"
    // and the "relayNum" parameter is undefined, an error response is returned.
    if (req.query.relayNum !== undefined) {
        let smartSwitchOutput = getMultiRelayStatuses(nodeSessions, req, zmqRecDevEuiMap);
        // We can use the validationErrors field of the response to check whether an invalid
        // 'relayNum' parameter was passed.
        if (smartSwitchOutput.validationErrors.length === 0) {
            let smartSwitchStatuses = smartSwitchOutput.statuses;
            // If smartSwitchStatuses[0].status === undefined that means that this particular
            // device hasn't yet sent an initial uplink to the LoRa network, and therefore
            // we can't determine its current state and thus can't control it.
            if (smartSwitchStatuses[0].relayStatuses !== undefined) {
                // For looking up a given DevEUI's status. Even though it's only possible to
                // control one relay per smart switch at a time, it's possible to control one
                // relay on many smart switches simultaneously, so we need to map DevEUIs to
                // relay status.
                let relayStatusLookup = getRelayStatusLookup(smartSwitchStatuses);
                var outputStatuses = [];
                for (let i in nodeSessions) {
                    let devInfoRecord = obj.devInfoLookup[nodeSessions[i].DevType];
                    if (devInfoRecord !== undefined) {
                        // Lookup low level device commands based on human readable commands
                        var devCmdLookup = getDevCmdLookupObj(devInfoRecord);
                        var statusObj = {
                            devEUI:         nodeSessions[i].DevEUI,
                            relayStatuses:  []
                        };
                        // Frontend controls the relay by saying "turn_*" and specifying the
                        // relay number, and this is translated to a single string to match
                        // with the device commands in the "device_info" record.
                        let whichChannel = "chan_" + req.query.relayNum + "_";
                        let humanCmd = (req.params.human_command).substring(0, 5) + whichChannel
                            + (req.params.human_command).substring(5, req.params.human_command.length);
                        var devCmds = devCmdLookup[humanCmd];
                        if (devCmds !== undefined) {
                            // If node is already in the desired state, return the status and
                            // do nothing, else proceed with updating node session document
                            // and return status "Waiting"
                            let stateWillBe;
                            if (relayStatusLookup[nodeSessions[i].DevEUI] == devCmds.statusWillBe) {
                                stateWillBe = devCmds.statusWillBe;
                            } else {
                                var query = { _id: nodeSessions[i]._id };
                                var update = {};
                                var cmdPart1 = devCmds.backendEquivalentPart1 + ";";
                                var cmdPart2 = devCmds.backendEquivalentPart2 + ";";
                                var fullCmdStr = cmdPart1 + cmdPart2;
                                update.UnencryptedMacCmds = fullCmdStr;
                                update.UnencryptedMacCmdsPrev = fullCmdStr;
                                update.HasUnencryptedMacCmdDelivered = "00"; // "00" means undelivered
                                AppServNodeSession.findOneAndUpdate(query, update, { new: true }, (err, cbRes) => {
                                    logger.debug(cbRes);
                                });
                                stateWillBe = "Waiting";
                            }
                            statusObj.relayStatuses.push(
                                {
                                    relayNum:   parseInt(req.query.relayNum),
                                    status:     stateWillBe
                                }
                            );
                        } else {
                            statusObj.relayStatuses.push(
                                {
                                    relayNum:   parseInt(req.query.relayNum),
                                    error:      "Command not recognized"
                                }
                            );
                        }
                        outputStatuses.push(statusObj);
                    } else {
                        // No device_info record for this device, ergo we can't do anything
                        // (i.e.: no commands to issue)
                    }
                }
                res.send({ deviceStatuses: outputStatuses });
                next();
            } else {
                res.send({ deviceStatuses: [
                    {
                        devEUI: req.query.dev_eui,
                        error: "Cannot control device. Please ensure device is powered on and connected to the LoRa network."
                    }
                ] });
                next();
            }
        } else {
            logger.error(smartSwitchOutput.validationErrors + "");
            errorResp.send(res, "Bad Request", smartSwitchOutput.validationErrors, 400);
            next();
        }
    } else {
        let errMsg = "Must specify a valid relay in the 'relayNum' query parameter.";
        logger.error(errMsg);
        errorResp.send(res, "Bad Request", errMsg, 400);
        next();
    }
}

function controlEntireDevice(req, res, next, nodeSessions, AppServNodeSession, zmqRecDevEuiMap) {
    var statuses = [];
    for (let i in nodeSessions) {
        let devInfoRecord = obj.devInfoLookup[nodeSessions[i].DevType];
        if (devInfoRecord !== undefined) {
            // Build another simple lookup object to aid with matching
            var devCmdLookup = getDevCmdLookupObj(devInfoRecord);
            var statusObj = {};
            statusObj.devEUI = nodeSessions[i].DevEUI;
            let humanCmd = req.params.human_command;
            var devCmds = devCmdLookup[humanCmd];
            if (devCmds) {
                // If node is already in the desired state, return the status and break out of the loop:
                if (getSpecificDeviceStatus(nodeSessions[i], zmqRecDevEuiMap) === devCmds.statusWillBe) {
                    statusObj.status = devCmds.statusWillBe;
                } else { // Proceed with updating node session document and return status "Waiting"
                    var query = { _id: nodeSessions[i]._id };
                    var update = {};
                    var cmdPart1 = devCmds.backendEquivalentPart1 + "";
                    var cmdPart2 = devCmds.backendEquivalentPart2 + "";
                    var fullCmdStr = ((cmdPart1.length > 0) ? cmdPart1 + ";" : "") + ((cmdPart2.length > 0) ? cmdPart2 + ";" : "");
                    update.UnencryptedMacCmds = fullCmdStr;
                    update.UnencryptedMacCmdsPrev = fullCmdStr;
                    update.HasUnencryptedMacCmdDelivered = "00"; // "00" means undelivered
                    AppServNodeSession.findOneAndUpdate(query, update, { new: true }, (err, cbRes) => {
                        logger.debug(cbRes);
                    });
                    statusObj.status = "Waiting";
                }
            } else {
                statusObj.error = "Command not recognized";
            }
            statuses.push(statusObj);
        } else {
            // No device_info record for this device, ergo we can't do anything (i.e.: no commands to issue)
        }
    }
    res.send({ deviceStatuses: statuses });
    next();
}

// - GET "/lora/:application_id/dev_eui/:dev_eui/deviceStatus"
obj.getTotalDevicesInfo = function(req, res, next) {
    // Add information that can be used by the usage tracking middleware
    res.locals.operationType = "read";
    res.locals.operationDetail = "deviceStatus";
    res.locals.devEUI = (req.params.dev_eui !== undefined) ? req.params.dev_eui.toUpperCase() : undefined;
    res.locals.appID = req.params.application_id;
    let deviceStatus = {};
    let applicationID = req.params.application_id;
    let devEUI = req.params.dev_eui;
    let appIdValidation = loraDataValidation.getApplicationIdValidation(req.params.application_id, "application_id", true, false);
    let validationResult = dataValidation.validMobileDevStatusParams(devEUI);
    let AppServNodeSession = require("../../models/nodeSessionAppServ.js")(applicationID);
    if (validationResult.status === "success" && appIdValidation.length === 0) {
        AppServNodeSession.find({ DevEUI: devEUI }).exec().then((findResult) => {
            if (findResult.length !== 0) {
                let devNodeSessions = JSON.parse(JSON.stringify(findResult));
                deviceStatus.devEUI = devNodeSessions[0].DevEUI;
                deviceStatus.name = devNodeSessions[0].Name;
                deviceStatus.devType = devNodeSessions[0].DevType;
                deviceStatus.subType = devNodeSessions[0].SubType;
                getDevCurrStatus(devNodeSessions, req).then((currentStatus) => {
                    deviceStatus.currentStatus = currentStatus;
                    getDevLatestUsage(devNodeSessions, req).then((latestUsage) => {
                        deviceStatus.latestUsage = latestUsage;
                        res.send(deviceStatus);
                        next();
                    }).catch((err) => {
                        errorResp.send(res, consts.error.serverErrorLabel, err + "", 500);
                        next();
                    });
                }).catch((err) => {
                    errorResp.send(res, consts.error.serverErrorLabel, err + "", 500);
                    next();
                });
            } else {
                errorResp.send(res, consts.error.badRequestLabel, "cannot find the device", 400);
                next();
            }
        }).catch((err) => {
            let msg = "" + err;
            logger.error(err);
            errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
            next();
        });
    } else {
        let errMsgs = appIdValidation;
        if (validationResult.status !== "success")
            errMsgs.push(validationResult.errorMessage);
        logger.error(validationResult);
        errorResp.send(res, consts.error.badRequestLabel, errMsgs, 400);
        next();
    }
};

function getDevCurrStatus(nodeSessions, req) {
    //Initialize obj.devInfoLookup object
    return new Promise((resolve, reject) => {
        getDeviceInfo(nodeSessions).then((devInfoResp) => {
            // Update our global lookup object
            for (let i in devInfoResp) {
                if (obj.devInfoLookup[devInfoResp[i].devType] === undefined) {
                    obj.devInfoLookup[devInfoResp[i].devType] = devInfoResp[i];
                }
            }
            // Requirement defined in the interface document:
            // If we can find the device current status, we return <currStatusJSON>. 
            // If we cannot find the device current status, we return null.
            // Invoke the previous get currentStatus function here, such as getCeilingLightStatus()
            // and getSpecificDeviceStatus()
            let result = {};
            let model = asyncFuncs.getZmqModel(nodeSessions[0].DevType, req.params.application_id);
            if (model !== null) {
                model.find({
                    devEUI: nodeSessions[0].DevEUI
                }).limit(1).sort({ _id: -1 }).then((zmqResp) => {
                    // Mongoose sets this field to an empty array if it's not present in the source
                    // document, so we have to remove it again.
                    let zmqRecs = JSON.parse(JSON.stringify(zmqResp));
                    for (let i in zmqRecs) {
                        if (zmqRecs[i].parsedData && zmqRecs[i].parsedData.length === 0) {
                            delete zmqRecs[i].parsedData;
                        }
                    }
                    let zmqRecDevEuiMap = getZmqDevEuiMap([ zmqRecs ]);
                    if (nodeSessions[0].DevType === "smartswitch") {
                        let smartSwitchStatuses = getMultiRelayStatuses(nodeSessions, req, zmqRecDevEuiMap);
                        if (smartSwitchStatuses.statuses[0].error === undefined) {
                            result = smartSwitchStatuses.statuses[0];
                        } else {
                            result = null;
                        }
                        resolve(result);
                    } else {
                        if (obj.devInfoLookup[nodeSessions[0].DevType] === undefined) {
                            result = null;
                        } else {
                            let status = getSpecificDeviceStatus(nodeSessions[0], zmqRecDevEuiMap);
                            if (status.error !== undefined) {
                                result = null;
                            } else {
                                result.devEUI = nodeSessions[0].DevEUI;
                                result.status = status;
                            }
                        }
                        resolve(result);
                    }
                }).catch((err) => {
                    logger.error(err);
                    reject(err);
                });
            } else
                // Streetlights are another special exception because they don't require
                // the program to read ZeroMQ records.
                if (nodeSessions[0].DevType == "streetlight") {
                    if (obj.devInfoLookup[nodeSessions[0].DevType] === undefined) {
                        result = null;
                    } else {
                        let status = getSpecificDeviceStatus(nodeSessions[0]);
                        if (status.error !== undefined) {
                            result = null;
                        } else {
                            result.devEUI = nodeSessions[0].DevEUI;
                            result.status = status;
                        }
                    }
                    resolve(result);
                } else {
                    resolve(null);
                }
        }).catch((err) => {
            logger.error(err);
            reject(err);
        });
    });
}

function getDevLatestUsage(nodeSessions) {
    //Initialize obj.devInfoLookup object
    return new Promise((resolve, reject) => {
        if (deviceHasLatestUsageAvailable(nodeSessions[0].DevType) === true) {
            getDeviceInfo(nodeSessions).then((devInfoResp) => {
                // Update our global lookup object
                for (let i in devInfoResp) {
                    if (obj.devInfoLookup[devInfoResp[i].devType] === undefined) {
                        obj.devInfoLookup[devInfoResp[i].devType] = devInfoResp[i];
                    }
                }
                // Requirement defined in the interface document:
                // If we can find the device latest usage, we return <deviceDataJSON>. 
                // If we cannot find the device current status, we return null.
                // Invoke the previous get currentStatus function here, such as getLatestZmqObject()
                let result = {};
                if (obj.devInfoLookup[nodeSessions[0].DevType] === undefined) {
                    result = null;
                    resolve(result);
                } else {
                    let model = asyncFuncs.getZmqModel(nodeSessions[0].DevType, nodeSessions[0].ApplicationID);
                    if (model !== null) {
                        model.find(
                            {
                                devEUI: nodeSessions[0].DevEUI
                            }
                        ).limit(1).sort({ _id: -1 }).then((zmqResp) => {
                            // Mongoose sets this field to an empty array if it's not present in the source
                            // document, so we have to remove it again.
                            let zmqRecs = JSON.parse(JSON.stringify(zmqResp));
                            for (let i in zmqRecs) {
                                if (zmqRecs[i].parsedData.length === 0) {
                                    delete zmqRecs[i].parsedData;
                                }
                            }
                            let zmqRecDevEuiMap = getZmqDevEuiMap([ zmqRecs ]);
                            let response = getLatestZmqObject(nodeSessions[0], zmqRecDevEuiMap);
                            if (response === null || response.hasOwnProperty("error")) {
                                result = null;
                            } else {
                                result = response;
                            }
                            resolve(result);
                        }).catch((err) => {
                            reject(err);
                        });
                    } else {
                        resolve(null);
                    }
                }
            }).catch((err) => {
                logger.error(err);
                reject(err);
            });
        } else {
            resolve(null);
        }
    });
}

function getDeviceInfo(nodeSessions) {
    if (obj.devInfoLookup !== undefined && obj.devInfoLookup[nodeSessions[0].DevType] !== undefined) {
        return Promise.resolve();
    } else {
        let DeviceInfo = require("../../models/lora/deviceInfo.js")();
        return DeviceInfo.find();
    }
}

// - GET "/lora/:application_id/deviceStatus?devEUIs=xxx,xxx,xxx"
obj.getTotalDevicesInfoForMultipleDevices = function(req, res, next) {
    // Add information that can be used by the usage tracking middleware
    res.locals.operationType = "read";
    res.locals.operationDetail = "deviceStatus";
    res.locals.devType = req.params.devicetype;
    res.locals.devEUI = (req.query.devEUIs !== undefined) ? req.query.devEUIs.toUpperCase() : undefined;
    res.locals.appID = req.params.application_id;
    let errors = validateUrlParamsAndQuery(req);
    if (errors.length === 0) {
        //1.Find device node sessions in application server: accroding to devEUIs
        let AppServNodeSession = require("../../models/nodeSessionAppServ.js")(req.params.application_id);
        let devEUIs = req.query.devEUIs.toUpperCase().split(",");
        AppServNodeSession.find({ DevEUI: { $in: devEUIs } }).exec().then((nodeSessions) => {
            nodeSessions = JSON.parse(JSON.stringify(nodeSessions));
            //2.Find current status and latest usage for node sessions
            getNodeSessionsCurrentStatusAndLatestUsage(nodeSessions, req).then((resps) => {
                res.send(resps);
                next();
            }).catch((err) => {
                let msg = "" + err;
                logger.error(err);
                errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
                next();
            });
        }).catch((err) => {
            let msg = "" + err;
            logger.error(err);
            errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, errors, 400);
        next();
    }
};

function validateUrlParamsAndQuery(req){
    let errors = [];
    let application_id = req.params.application_id;
    let devEUIs = req.query.devEUIs;

    errors = errors.concat(loraDataValidation.getApplicationIdValidation(application_id, APPLICATION_ID, true, false));
    errors = errors.concat(loraDataValidation.getUrlDevEuiValidation(devEUIs, DEV_EUIS, true, true));
    return errors;
}

//Get current status and latest usage for node sessions
function getNodeSessionsCurrentStatusAndLatestUsage(nodeSessions, req) {
    let promises = [];
    for (let index in nodeSessions) {
        let nodeSession = nodeSessions[index];
        let promise = getSingleNsCurrentStatusAndLatestUsage(nodeSession, req);
        promises.push(promise);
    }
    return Promise.all(promises).then((resps) => {
        return resps;
    });
}

//Get current status and latest usage for a single node session
function getSingleNsCurrentStatusAndLatestUsage(nodeSession, req) {
    let deviceStatus = {};
    deviceStatus.devEUI = nodeSession.DevEUI;
    deviceStatus.name = nodeSession.Name;
    deviceStatus.devType = nodeSession.DevType;
    deviceStatus.subType = nodeSession.SubType;
    deviceStatus.inMaintenance = nodeSession.InMaintenance;
    return new Promise((resolve, reject) => {
        getDevCurrStatus([nodeSession], req).then((currentStatus) => {
            deviceStatus.currentStatus = currentStatus;
            getDevLatestUsage([nodeSession], req).then((latestUsage) => {
                deviceStatus.latestUsage = latestUsage;
                resolve(deviceStatus);
            }).catch((err) => {
                reject(err);
            });
        }).catch((err) => {
            reject(err);
        });
    });
}

module.exports = obj;
