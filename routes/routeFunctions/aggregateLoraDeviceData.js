let mongoose = require("mongoose");
    mongoose.Promise = global.Promise;

let logger = require("../../common/tracer.js");
let errorResp = require("../../common/errorResponse.js");
let asyncFuncs = require("./frontendAsyncFunctions.js");
let consts = require("../../config/constants.js");
let dataValidation = require("../../common/dataValidation.js");
let loraDataValidation = require("../../common/loraDataTypesValidation.js");

let obj = {};

// - GET "/lora/devicetype/:devicetype/application_id/:application_id/aggregated_data"
obj.getLoraDevAggrData = function(req, res, next) {
    let params = {};
    asyncFuncs.getDevInfo(req).then((devInfoResp) => {
        let appIdValidation = loraDataValidation.getApplicationIdValidation(req.params.application_id, "application_id", true, false);
        let validationResult = dataValidation.validLoraDevAggrAttr(req, devInfoResp);
        //If validation is success, then we use corrent params to query
        //aggregated data
        if (validationResult.status === "success" && appIdValidation.length === 0) {
            //The parameter has passed the validation, but still needs to 
            //be converted to a usable form
            params = getValidParams(req, devInfoResp);
            //Query device in application node session
            findAggrDataNodeSessions(req, devInfoResp).then((nodeSessionsResp) => {
                //If we cannot find devices in the application server, we return 
                //result with empty aggregatedData
                if (nodeSessionsResp.length !== 0) {
                    asyncFuncs.findAggrDataZmqRecs(params, nodeSessionsResp).then((zmqRecs) => {
                        zmqRecs = JSON.parse(JSON.stringify(zmqRecs));
                        if (zmqRecs.length !== 0) {
                            let result = getAggrDataResult(params, zmqRecs);
                            res.send(result);
                            next();
                        }
                        //zmqRecs.length === 0, cannot find zmq records for the nodeSessions, 
                        //send no data result
                        else {
                            let result = setNoDataResult(params, null);
                            res.send(result);
                            next();
                        }
                    }).catch((err) => {
                        let msg = err + "";
                        logger.error(err);
                        errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
                        next();
                    });
                }
                //nodeSessions.length === 0, cannot find nodeSession in the application server, 
                //send empty array
                else {
                    let result = setNoDataResult(params, []);
                    res.send(result);
                    next();
                }
            }).catch((err) => {
                let msg = err + "";
                logger.error(err);
                errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
                next();
            });
        } else {
            let errMsgs = appIdValidation;
            if (validationResult.status !== "success")
                errMsgs = errMsgs.concat(validationResult.error);
            logger.error("Validation errors:", errMsgs);
            errorResp.send(res, consts.error.badRequestLabel, errMsgs, 400);
            next();
        }
    }).catch((err) => {
        let msg = err + "";
        logger.error(err);
        errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
        next();
    });
};

//Notice: cannot reused the findNodeSessions, because the attribute deveui is different from dev_eui
function findAggrDataNodeSessions(req, deviceInfoRecords) {
    return new Promise((resolve) => {
        let devTypes = asyncFuncs.getParentAndSubDeviceTypes(req.params.devicetype, deviceInfoRecords);
        var findTheseDevEUIs = [];
        var AppServNodeSession = require("../../models/nodeSessionAppServ.js")(req.params.application_id);
        if (AppServNodeSession !== undefined && AppServNodeSession !== null) {
            let queryObj = { InMaintenance: false };
            // Find either a) all application server node sessions, or b) a specific set of
            // node sessions, provided in the query string.
            if (req.query.deveui) {
                if (req.query.deveui.includes(",")) { // Find many
                    let reqDevEUIs = req.query.deveui.split(",");
                    for (let i in reqDevEUIs)
                        findTheseDevEUIs.push(reqDevEUIs[i].toUpperCase());
                } else { // Find one
                    findTheseDevEUIs.push(req.query.deveui.toUpperCase());
                }
                queryObj.DevEUI = { $in: findTheseDevEUIs };
            }
            queryObj.DevType = devTypes.devType;
            if (devTypes.subDevType !== undefined) {
                queryObj.SubType = devTypes.subDevType;
            }
            resolve(AppServNodeSession.find(queryObj));
        } else {
            logger.error("AppServNodeSession is " + AppServNodeSession);
            resolve();
        }
    });
}

//1.Convert the origin params to useable format, for example, lasthour 
//  need to convert start time + time duration
//2.After validation, device type and application id should be ok to use
//  What we need to do is convert devEUI string and mode string to usable
//  format
function getValidParams(req, devInfoResp) {
    let params = {};
    let VALID_DURATION_MAP = consts.validDurationUnit;
    let deviceInfos = JSON.parse(JSON.stringify(devInfoResp));
    let LORA_DEVICE_AGGR_DATA_TYPE = consts.loraDeviceAggregatedDataType;
    params.deviceType = req.params.devicetype;
    params.applicationID = req.params.application_id;
    params.devEUIs = req.query.deveui ? req.query.deveui.split(",") : [];
    params.mode = req.query.mode;
    params.attributes = [];
    //if params.mode === undefined or params.mode === null || params.mode === "lasthour"
    //we assume params.mode equals to lasthour
    if (!params.mode || (params.mode && params.mode === VALID_DURATION_MAP.lasthour)) {
        params.aggStartTime = new Date();
        params.aggDur = VALID_DURATION_MAP.lasthour;
        params.duration = 1 * 3600 * 1000;
        params.aggEndTime = new Date(params.aggStartTime - params.duration);
    }
    else if (params.mode && params.mode === VALID_DURATION_MAP.lastday) {
        params.aggStartTime = new Date();
        params.aggDur = VALID_DURATION_MAP.lastday;
        params.duration = 24 * 3600 * 1000;
        params.aggEndTime = new Date(params.aggStartTime - params.duration);
    }
    //Get valid device type aggregated data attribute
    for (let i in deviceInfos) {
        let deviceInfo = deviceInfos[i];
        if (deviceInfo.devType === params.deviceType && deviceInfo.hasOwnProperty("aggregatedData") && deviceInfo.aggregatedData.length !== 0) {
            for (let j in deviceInfo.aggregatedData) {
                let aggregatedDataType = deviceInfo.aggregatedData[j].type;
                let aggregatedDataAttr = deviceInfo.aggregatedData[j].attribute;
                if (dataValidation.mapIncludesElem(LORA_DEVICE_AGGR_DATA_TYPE, aggregatedDataType) && aggregatedDataAttr) {
                    let object = {};
                    object.aggregatedDataType = aggregatedDataType;
                    object.aggregatedDataAttr = aggregatedDataAttr;
                    params.attributes.push(object);
                }
            }
        }
    }
    return params;
}


//If we cannot find the device in application server,  we set object.aggregatedData to empty array
//If we cannot find the device zmq records,  we set object.aggregatedData to null
function setNoDataResult(params, type) {
    let object = {};
    object.aggStartTime = params.aggStartTime;
    object.aggDur = params.aggDur;
    object.deviceType = params.deviceType;
    object.applicationID = params.applicationID;
    object.aggregatedData = type;
    return object;
}

//1. zmqRecs =  total zmq records for different device
//2. deviceZmqRecsInMin = array includes all the zmq record in minute
//3. deviceZmqRecInSec = array includes all the zmq record in second
function getAggrDataResult(params, zmqRecs) {
    let object = {};
    let attributes = params.attributes;
    let aggregatedDataMap = {};
    object.aggStartTime = params.aggStartTime;
    object.aggDur = params.aggDur;
    object.deviceType = params.deviceType;
    object.applicationID = params.applicationID;
    object.aggregatedData = [];
    for (let i in zmqRecs) {
        let deviceZmqRecsInMin = zmqRecs[i];
        let devEUI = deviceZmqRecsInMin.devEUI;
        //Initialize aggregatedDataMap's element, if aggregatedDataMap[devEUI] doesn't exist, create a new one
        aggregatedDataMap[devEUI] = aggregatedDataMap.hasOwnProperty(devEUI) ? aggregatedDataMap[devEUI] : { devEUI: devEUI };
        for (let j in deviceZmqRecsInMin.parsedData) {
            let deviceZmqRecInSec = deviceZmqRecsInMin.parsedData[j];
            for (let l in attributes) {
                let attribute = attributes[l];
                let aggregatedDataType = attribute.aggregatedDataType;
                let aggregatedDataAttr = attribute.aggregatedDataAttr;
                if (aggregatedDataType === "sum") {
                    //If deviceZmqRecInSec[aggregatedDataAttr], we enter into the process and deal with the data
                    //If aggregatedDataMap[devEUI][aggregatedDataAttr] is undefined, we need set a initial value for it Otherwise, we keep its value 
                    //For the operation "sum", we set the initial value as 0
                    if (deviceZmqRecInSec.hasOwnProperty(aggregatedDataAttr)) {
                        aggregatedDataMap[devEUI][aggregatedDataAttr] = aggregatedDataMap[devEUI][aggregatedDataAttr] ===
                            undefined ? 0 : aggregatedDataMap[devEUI][aggregatedDataAttr];
                        aggregatedDataMap[devEUI][aggregatedDataAttr] += deviceZmqRecInSec[aggregatedDataAttr];
                    }
                }
            }
        }
    }
    object.aggregatedData = changeMapToArray(attributes, aggregatedDataMap);
    return object;
}

function changeMapToArray(attributes, map) {
    let array = [];
    for (let key in map) {
        let elem = map[key];
        for (let i in attributes) {
            let attribute = attributes[i].aggregatedDataAttr;
            if (!elem.hasOwnProperty(attribute)) {
                elem[attribute] = null;
            }
        }
        array.push(elem);
    }
    return array;
}

module.exports = obj;
