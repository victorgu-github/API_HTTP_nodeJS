"use strict";

let mongoose = require("mongoose");
let errorResp = require("../../common/errorResponse.js");
let logger = require("../../common/tracer.js");
let dataFormat = require("../../common/dataFormat.js");
let pt = require("promise-timeout");
let loraDataValidation = require("../../common/loraDataTypesValidation.js");
let consts = require("../../config/constants.js");

const GW_SERV_TIMEOUT = 5000;
const APP_SERV_TIMEOUT = 5000; //set APP_SERV_TIMEOUT to 500 ms, shanghai database will timeout, local db is success

mongoose.Promise = global.Promise;

let obj = {};

// Get lora device number from gateway server and application server
// - GET "/lora_device/devices/num"
//
// Data flow:
//   - request comes in
//   - validate user input. If good, continue, otherwise error response
//   - query gw serv node sessions, match to app serv node sessions
//   - count matched node sessions, send response
obj.getLoRaDevicesNum = function(req, res, next) {
    getDeviceTypes().then((deviceTypes) => {
        let validationResult = validateOneStepQueryStringInput(req.query, deviceTypes);
        let appIdValidation = loraDataValidation.getApplicationIdValidation(req.query.applicationID, "applicationID", true, true);
        if (validationResult.status === "success" && appIdValidation.length === 0) {
            pt.timeout(getGwServDevicesArray(req), GW_SERV_TIMEOUT).then((gwNodeSessions) => {
                getAppServDevicesArray(req).then((appNodeSessions) => {
                    let gwNodeSessionsMap = obj.transGwNodeSessionsArrayToMap(gwNodeSessions);
                    let gwAppDeviceNumber = getGwAppDeviceNumber(gwNodeSessionsMap, appNodeSessions);
                    res.send({ nodeSessionsNumber: gwAppDeviceNumber });
                    next();
                });
            }).catch((err) => {
                if (err instanceof pt.TimeoutError) {
                    errorResp.send(res, "Timeout Error", err, 500);
                    next();
                } else {
                    errorResp.send(res, "Mongoose Error", err.message, 500);
                    next();
                }
            });
        } else {
            let errMsgs = appIdValidation;
            if (validationResult.status !== "success")
                errMsgs = errMsgs.concat(validationResult.errorMessage);
            logger.error("Validation errors:", errMsgs);
            errorResp.send(res, consts.error.badRequestLabel, errMsgs, 400);
            next();
        }
    }).catch((mongooseErr) => {
        errorResp.send(res, "Mongoose Error", mongooseErr + "", 500);
        next();
    });
};

// Get lora device info from gateway server and application server
// - GET "/lora_device/devices"
//
// Data flow:
//   - request comes in
//   - validate user input. If good, continue, otherwise error response
//   - query database for all relevant node sessions
//   - format any necessary values (e.g.: rounding decimal places, etc.)
//   - generate response "header", combine node sessions into one, send in response
obj.getLoRaDevices = function(req, res, next) {
    getDeviceTypes().then((deviceTypes) => {
        let validationResult = validateOneStepQueryStringInput(req.query, deviceTypes);
        let appIdValidation = loraDataValidation.getApplicationIdValidation(req.query.applicationID, "applicationID", true, true);
        if (validationResult.status === "success" && appIdValidation.length === 0) {
            pt.timeout(getGwServDevicesArray(req), GW_SERV_TIMEOUT).then((gwNodeSessions) => {
                getAppServDevicesArray(req).then((appNodeSessions) => {
                    let gwNodeSessionsMap = obj.transGwNodeSessionsArrayToMap(gwNodeSessions);
                    let combinedNodeSessions = getCombinedNodeSessions(gwNodeSessionsMap, appNodeSessions);
                    res.send({ nodeSessions: combinedNodeSessions });
                    next();
                });
            }).catch((err) => {
                if (err instanceof pt.TimeoutError) {
                    errorResp.send(res, "Timeout Error", err, 500);
                    next();
                } else {
                    errorResp.send(res, "Mongoose Error", err.message, 500);
                    next();
                }
            });
        } else {
            let errMsgs = appIdValidation;
            if (validationResult.status !== "success")
                errMsgs = errMsgs.concat(validationResult.errorMessage);
            logger.error("Validation errors:", errMsgs);
            errorResp.send(res, consts.error.badRequestLabel, errMsgs, 400);
            next();
        }
    }).catch((mongooseErr) => {
        errorResp.send(res, "Mongoose Error", mongooseErr + "", 500);
        next();
    });
};

///////////////////////////////////////////////////////////////////
//
// Private Functions
//
///////////////////////////////////////////////////////////////////

//Validate the query string, for applicationID and deviceType
function validateOneStepQueryStringInput(query, deviceTypes) {
    let validationResult = {};
    let deviceType = query.deviceType;
    if (deviceType === undefined || deviceTypes.includes(deviceType)) {
        validationResult.status = "success";
        validationResult.errorMessage = "";
    } else {
        validationResult.status = "error";
        validationResult.errorMessage = "No such device type as '" + deviceType + "'";
    }
    return validationResult;
}

function prepAppIDs(applicationIDs) {
    let array = [];
    let appIDs = applicationIDs.split(",");

    for (let i in appIDs) {
        array.push(dataFormat.padWithZerosToFixedLength(appIDs[i], 16));
    }

    return array;
}

//Get deviceType candidate values
function getDeviceTypes() {
    let DeviceType = require("../../models/lora/deviceInfo.js")();
    let DeviceTypePromise = DeviceType.distinct("devType").exec();
    return DeviceTypePromise.then((response) => {
        return response;
    });
}

//Get lora device info from gateway server
function getGwServDevicesArray(req) {
    let GwServNodeSession = require("../../models/nodeSessionGwServ.js")();
    let appIDs = prepAppIDs(req.query.applicationID);
    let query = req.query.deviceType ? { ApplicationID: { $in: appIDs }, DevType: req.query.deviceType } : { ApplicationID: { $in: appIDs } };
    return GwServNodeSession.find(query).then((response) => {
        let niceResult = [];
        response.forEach((respElem) => {
            niceResult.push(dataFormat.enforceSchemaOnDocument(GwServNodeSession, respElem, false));
        });
        return niceResult;
    });
}

//Get lora device info array from application server
function getAppServDevicesArray(req) {
    let applicationIDs = req.query.applicationID.split(",");
    let deviceType = req.query.deviceType;
    //Only req.query.deviceType === undefined and req.query.deviceType === valid deviceType can pass validation
    //If req.query.deviceType === undefined, we need use query = {} to find all the devices
    let query = deviceType !== undefined ? { DevType: deviceType } : {};
    let promises = [];
    for (let i = 0; i < applicationIDs.length; i++) {
        let appServNodeSessionPromise = getAppServDevices(applicationIDs[i], deviceType, query);
        promises.push(appServNodeSessionPromise);
    }
    return Promise.all(promises).then((response) => {
        let finalResult = [];
        for (let i = 0; i < response.length; i++) {
            finalResult.push(response[i]);
        }
        return finalResult;
    });
}

//Get lora device info from each of application server, we can add promise timeout here
function getAppServDevices(applicationID, deviceType, query) {
    let AppServNodeSession = require("../../models/nodeSessionAppServ.js")(applicationID);
    let AppServNodeSessionPromise = AppServNodeSession.find(query);
    let appNodeSessionsByAppID = {
        applicationID: applicationID,
        deviceType: deviceType,
        status: "",
        data: []
    };
    return pt.timeout(AppServNodeSessionPromise, APP_SERV_TIMEOUT).then((response) => {
        appNodeSessionsByAppID.status = "success";
        response.forEach((respElem) => {
            appNodeSessionsByAppID.data.push(dataFormat.enforceSchemaOnDocument(AppServNodeSession, respElem, false));
        });
        return appNodeSessionsByAppID;
    }).catch(() => {
        appNodeSessionsByAppID.status = "error";
        return appNodeSessionsByAppID;
    });
}

//Transfer the lora device array to lora device map, it is easy for finding a unique lora device
//existing in both gateway server and application server
obj.transGwNodeSessionsArrayToMap = function(gwNodeSessions) {
    let gwNodeSessionsMap = {};
    for (let i = 0; i < gwNodeSessions.length; i++) {
        let devEUI = gwNodeSessions[i].DevEUI;
        let applicationID = gwNodeSessions[i].ApplicationID;
        let index = devEUI + "_" + applicationID;
        gwNodeSessionsMap[index] = gwNodeSessions[i];
    }
    return gwNodeSessionsMap;
};

//Get unique lora device existing in both gateway server and application server
function getCombinedNodeSessions(gwNodeSessionsMap, appNodeSessions) {
    let result = [];
    for (let i = 0; i < appNodeSessions.length; i++) {
        let appNodeSession = appNodeSessions[i];
        let nodes = appNodeSession.data;
        let resultSingleObject = {
            applicationID:  appNodeSession.applicationID,
            deviceType:     (appNodeSession.deviceType !== undefined) ? appNodeSession.deviceType : "all",
            status:         appNodeSession.status,
            data:           []
        };
        for (let j = 0; j < nodes.length; j++) {
            let devEUI = nodes[j].DevEUI;
            let applicationID = nodes[j].ApplicationID;
            let index = devEUI + "_" + applicationID;
            if (gwNodeSessionsMap[index]) {
                let combinedObj = obj.addFieldsFromGwNodeSessionToAppNodeSession(gwNodeSessionsMap[index], nodes[j]);
                // Below: Format our only binary data as hex, and remove the UserPayloadDataLen field:
                combinedObj.UserPayloadData = combinedObj.UserPayloadData.toString("hex").toUpperCase();
                delete combinedObj.UserPayloadDataLen;
                resultSingleObject.data.push(combinedObj);
            }
        }
        result.push(resultSingleObject);
    }
    return result;
}

// When merging the two node sessions together, duplicates are removed with appNodeSession always taking priority
obj.addFieldsFromGwNodeSessionToAppNodeSession = function(gwNodeSession, appNodeSession) {
    for (let key in gwNodeSession) {
        if (appNodeSession[key] === undefined) {
            appNodeSession[key] = gwNodeSession[key];
        }
    }
    delete appNodeSession._id;
    return appNodeSession;
};

//Get number of unique lora device, which existing in both gateway server and application server
function getGwAppDeviceNumber(gwNodeSessionsMap, appNodeSessions) {
    let result = [];
    for (let i = 0; i < appNodeSessions.length; i++) {
        let appNodeSession = appNodeSessions[i];
        let nodes = appNodeSession.data;
        let resultSingleObject = {
            applicationID:  appNodeSession.applicationID,
            deviceType:     appNodeSession.deviceType !== undefined ? appNodeSession.deviceType : "all",
            status:         appNodeSession.status,
            numberOfDevice: 0
        };
        for (let j = 0; j < nodes.length; j++) {
            let devEUI = nodes[j].DevEUI;
            let applicationID = nodes[j].ApplicationID;
            let index = devEUI + "_" + applicationID;
            if (gwNodeSessionsMap[index]) {
                resultSingleObject.numberOfDevice++;
            }
        }
        result.push(resultSingleObject);
    }
    return result;
}

module.exports = obj;
