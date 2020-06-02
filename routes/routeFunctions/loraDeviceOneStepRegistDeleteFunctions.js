"use strict";

let mongoose = require("mongoose");
mongoose.Promise = global.Promise;

let errorResp = require("../../common/errorResponse.js");
let logger = require("../../common/tracer.js");
let deviceRegOneStepFuncs = {};
let loraDataValidation = require("../../common/loraDataTypesValidation.js");
let consts = require("../../config/constants.js");

// - "/lora_device/devices/:applicationID/:devEUI"
//
// DELETE data flow:
// - request comes in
// - validate user input. If good, continue, otherwise error response
// - check that the user-specified DevEUI actually exists. If so, continue, otherwise error response
// - call function to delete each node session
// - check result of delete operations. If all were successful, send success response, otherwise roll back transaction
deviceRegOneStepFuncs.deleteLoRaDevices = function(req, res, next) {
    let applicationID = req.params.applicationID;
    let devEUI = req.params.devEUI.toUpperCase();
    let appIdValidation = loraDataValidation.getApplicationIdValidation(req.params.applicationID, "applicationID", true, false);
    let validationResult = validateOneStepDeleteParams(devEUI);
    if (validationResult.status === "success" && appIdValidation.length === 0) {
        let GwNodeSession = require("../../models/nodeSessionGwServ.js")();
        let AppServNodeSession = require("../../models/nodeSessionAppServ.js")(applicationID);
        //find if the lora device exist in gw server
        GwNodeSession.find({ DevEUI: devEUI }).then((gwNodeSessions) => {
            if (gwNodeSessions.length !== 0) {
                gwNodeSessions = JSON.parse(JSON.stringify(gwNodeSessions[0]));
                //find if the lora device exist in app server
                AppServNodeSession.find({ DevEUI: devEUI }).then((appNodeSessions) => {
                    if (appNodeSessions.length !== 0) {
                        appNodeSessions = JSON.parse(JSON.stringify(appNodeSessions[0]));
                        GwNodeSession.deleteMany({ DevEUI: devEUI }).then((gwDelResp) => {
                            AppServNodeSession.deleteMany({ DevEUI: devEUI }).then((appDelResp) => {
                                let respExtended = {
                                    applicationID: req.params.applicationID,
                                    devEUI:        req.params.devEUI,
                                    gwDelResult:   gwDelResp.result,
                                    appDelResult:  appDelResp.result
                                };
                                res.send({ deleteResult: respExtended });
                                next();
                            }).catch((err) => {
                                logger.error(err);
                                let errMsg = err + "";
                                // If there is an error in deleting the app server node session, then roll
                                // back the transaction (i.e.: restore the gw node session).
                                new GwNodeSession(gwNodeSessions).save().then(() => {
                                    errorResp.send(res, consts.error.serverErrorLabel, errMsg, 500);
                                    next();
                                }).catch((rollbackErr) => {
                                    errorResp.send(res, consts.error.serverErrorLabel, rollbackErr + "", 500);
                                    next();
                                });
                            });
                        }).catch((err) => {
                            logger.error(err);
                            let errMsg = err + "";
                            errorResp.send(res, consts.error.serverErrorLabel, errMsg, 500);
                            next();
                        });
                    } else {
                        let errMsg = "Cannot find this device in application server";
                        errorResp.send(res, consts.error.badRequestLabel, errMsg, 400);
                        next();
                    }
                }).catch((err) => {
                    logger.error(err);
                    let errMsg = err + "";
                    errorResp.send(res, consts.error.serverErrorLabel, errMsg, 500);
                    next();
                });
            } else {
                let errMsg = "Cannot find this device in gateway server";
                errorResp.send(res, consts.error.badRequestLabel, errMsg, 400);
                next();
            }
        }).catch((err) => {
            logger.error(err);
            let errMsg = err + "";
            errorResp.send(res, consts.error.serverErrorLabel, errMsg, 500);
            next();
        });
    } else {
        let errMsgs = appIdValidation;
        if (validationResult.status !== "success")
            errMsgs.push(validationResult.errorMessage);
        errorResp.send(res, consts.error.badRequestLabel, errMsgs, 400);
        next();
    }
};

//Validate the req.params.applicationID and req.params.devEUI for one-step delete
function validateOneStepDeleteParams(devEUI) {
    let validationResult = {};
    let devEUIPattern = /^[0-9a-fA-F]{16}$/;
    if (devEUIPattern.test(devEUI)) {
        validationResult.status = "success";
        validationResult.errorMessage = "";
    } else {
        validationResult.status = "error";
        validationResult.errorMessage = "devEUI format invalid";
    }
    return validationResult;
}

module.exports = deviceRegOneStepFuncs;
