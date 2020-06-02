"use strict";

let mongoose = require("mongoose");
mongoose.Promise = global.Promise;
let errorResp = require("../../common/errorResponse.js");
let logger = require("../../common/tracer.js");
let loraDataValidation = require("../../common/loraDataTypesValidation.js");
let consts = require("../../config/constants.js");

let devicePayloadDataFuncs = {};

const APPLICATION_ID = "application_id";
const DURATION = "duration";

//////////////////////////////////////////////////////////////////////
//
// Get Lora Device Payload Data
//
//////////////////////////////////////////////////////////////////////

// Get lora device payload data
// - GET "/lora_device/zmq_payload/appid/:application_id/dev_eui/:dev_eui"
//
// Data flow:
//   - request comes in
//   - validate user input. If good, continue, otherwise error response
//   - query database for lora device, if we cannot find this lora device in gateway server or application server,
//     we send back error message; 
//   - get the device type from application server, then use device type, application_id, duration to find payload data
//   - parse the payload data, timestamp should be in seconds
//   - send the result to front end
devicePayloadDataFuncs.getLoRaDevicePayloadData = function(req, res, next) {
    let application_id = req.params.application_id;
    let dev_eui = req.params.dev_eui.toUpperCase();
    let duration = req.query.duration ? req.query.duration : 12;
    let errors = validateUrlParamsAndQuery(application_id, dev_eui, duration);
    let GwNodeSession = getGwNodeSessionModel();
    let AppNodeSession = getAppNodeSessionModel(application_id);
    if (errors.length === 0) {
        //find if the lora device exist in the gw server
        GwNodeSession.find({ DevEUI: dev_eui }).then((gwNodeSessions) => {
            if (gwNodeSessions.length !== 0) {
                //find if the lora device exist in app server
                AppNodeSession.find({ DevEUI: dev_eui }).then((appNodeSessions) => {
                    if (appNodeSessions.length !== 0) {
                        let appNodeSession = JSON.parse(JSON.stringify(appNodeSessions[0]));
                        let devType = appNodeSession.DevType;
                        let deviceInfo = reqFile("./models/lora/deviceInfo.js")();
                        deviceInfo.findOne({ devType: devType }).then((resp) => {
                            let collectionName = (resp.collectionName !== undefined) ? resp.collectionName : null;
                            let searchStartTime = getSearchStartTime(duration).toISOString();
                            let query = { $and: [{ devEUI: dev_eui }, { timestamp: { $gte: new Date(searchStartTime) } }] };
                            let getZmqModel = reqFile("./models/loraDevices/modelSelector.js").getZmqModel;
                            let zmqModel = getZmqModel(devType, application_id, collectionName);
                            if (zmqModel !== null) {
                                zmqModel.find(query).sort({timestamp: -1}).then((zmqRecords) => {
                                    zmqRecords = JSON.parse(JSON.stringify(zmqRecords));
                                    let zmqRecordsResult = parseZmqRecords(application_id, dev_eui, zmqRecords);
                                    res.send(zmqRecordsResult);
                                    next();
                                }).catch((err) => {
                                    logger.error(err);
                                    sendMongodbErr(res, err, consts);
                                    next();
                                });
                            } else {
                                let msg = "Device type '" + devType + "' is not configured to save ZMQ records";
                                errorResp.send(res, consts.error.badRequestLabe, msg, 400);
                                next();
                            }
                        }).catch((err) => {
                            logger.error(err);
                            errorResp.send(res, consts.error.serverErrorLabel, "" + err, 500);
                            next();
                        });
                    }
                    else {
                        let errMsg = "Cannot find this device in application server";
                        errorResp.send(res, consts.error.badRequestLabel, errMsg, 400);
                        next();
                    }
                }).catch((err) => {
                    sendMongodbErr(res, err, consts);
                    next();
                });
            }
            else {
                let errMsg = "Cannot find this device in gateway server";
                errorResp.send(res, consts.error.badRequestLabel, errMsg, 400);
                next();
            }
        }).catch((err) => {
            sendMongodbErr(res, err, consts);
            next();
        });
    }
    else {
        errorResp.send(res, consts.error.badRequestLabel, errors, 400);
        next();
    }
};

//////////////////////////////////////////////////////////////////////
//
// Get Database Models
//
//////////////////////////////////////////////////////////////////////

function getGwNodeSessionModel() { return require("../../models/nodeSessionGwServ.js")(); }

function getAppNodeSessionModel(appID) { return require("../../models/nodeSessionAppServ.js")(appID); }

//////////////////////////////////////////////////////////////////////
//
// Private Funcs
//
//////////////////////////////////////////////////////////////////////

//Give duration hours, find the start time for searching
function getSearchStartTime(duration) {
    let currentTime = new Date();
    let durationTime = duration * 3600 * 1000;
    let startTime = new Date(currentTime - durationTime);
    return startTime;
}

//Validate the req parameters, params and query
function validateUrlParamsAndQuery(application_id, dev_eui, duration) {
    let errors = [];
    errors = errors.concat(loraDataValidation.getApplicationIdValidation(application_id, APPLICATION_ID, true, false));
    errors = errors.concat(loraDataValidation.getDevEuiValidation(dev_eui, true));
    errors = errors.concat(loraDataValidation.getUrlDurationValidation(duration, DURATION, false, false, 1, 24));
    return errors;
}

//Parse zmq records, and output records in seconds
function parseZmqRecords(application_id, dev_eui, zmqRecords) {
    let parseResult = {
        applicationID: application_id,
        devEUI: dev_eui,
        payload: []
    };
    for (let index in zmqRecords) {
        let zmqRecord = zmqRecords[index];
        let timestampInMin = new Date(zmqRecord.timestamp);
        let rawDatas = zmqRecord.rawData;
        if (rawDatas.length !== 0){
            for (let i = rawDatas.length - 1; i >= 0; i--) {
                let payloadObj = {};
                let rawData = rawDatas[i];
                payloadObj.timestamp = new Date(timestampInMin.setSeconds(rawData.timeSecond)).toISOString();
                payloadObj.payload = rawData.payload;
                parseResult.payload.push(payloadObj);
            }
        }
    }
    return parseResult;
}

function sendMongodbErr(res, err, consts) {
    logger.error(err);
    let errMsg = err + "";
    errorResp.send(res, consts.error.serverErrorLabel, errMsg, 500);
}

module.exports = devicePayloadDataFuncs;
