let mongoose = require("mongoose");
mongoose.Promise = global.Promise;

let errorResp = require("../../common/errorResponse.js");
let logger = require("../../common/tracer.js");
let validation = require("../../common/oneStepNodeSessionValidation.js");
let dataFormat = require("../../common/dataFormat.js");
let loraDataValidation = require("../../common/loraDataTypesValidation.js");
let consts = require("../../config/constants.js");
let defaultValues = require("../../config/nodeSessionDefaultValues.js");

let watchedGwFields = [
    "ADRInterval",
    "InstallationMargin",
    "NbTrans",
    "RelaxFCnt",
    "Rx1DROffset",
    "Rx2DR",
    "RxDelay",
    "RxWindowNumber",
    "TxPower",
    "DrClassBC",
    "FreqClassBC"
];

let obj = {};

obj.checkIfDevEuiExists = function(devEUI, appID) {
    let devEuiPromises = [];
    let GwNodeSession = require("../../models/nodeSessionGwServ.js")();
    let AppServNodeSession = require("../../models/nodeSessionAppServ.js")(appID);
    devEuiPromises.push(GwNodeSession.find(
        {
            DevEUI: devEUI
        }
    ));
    devEuiPromises.push(AppServNodeSession.find(
        {
            DevEUI: devEUI
        }
    ));
    return Promise.all(devEuiPromises).then((resp) => {
        let resps = [];
        for (let i in resp) {
            let item = resp[i][0];
            if (item !== undefined)
                resps.push(item);
        }
        return resps;
    });
};

// Because we are doing multiple database save operations, if we encounter an error
// partway through after we've already updated some data on one database, we roll back
// the entire transaction so as to prevent leaving inconsistent data in the collection.
obj.rollBack = function(devEUIsFound, appID) {
    setTimeout((() => {
        let rollbackPromises = [];
        rollbackPromises.push(updateGwServDeviceInDB(devEUIsFound[0]));
        rollbackPromises.push(updateAppServDeviceInDB([ devEUIsFound[1] ], devEUIsFound[1]));
        return Promise.all(rollbackPromises).then((resp) => {
            logger.error("Rollback result:\n", resp);
        }).catch((mongoErr) => { logger.error(mongoErr); }); // Do nothing b/c rollback is best-effort
    }).bind(devEUIsFound, appID), 1000);
};

// - PUT "/lora_device/devices"
//
// Data flow:
// 
// - request comes in
// - validate user input. If good, continue, otherwise error response
// - check that the user-specified DevEUI already exists. If so, continue, otherwise error response
// - convert all hex input to uppercase
// - separate user input into gw and app serv node session input
// - call function to update each node session
// - check result of update operations. If all were successful, send success response, otherwise roll back transaction
obj.updateLoRaDevices = function(req, res, next) {
    let queryValidationErrors = getPutQueryValidation(req.body);
    if (queryValidationErrors.length === 0) {
        let devEUI = req.body.DevEUI.toUpperCase();
        let appID = dataFormat.padWithZerosToFixedLength(req.body.ApplicationID, 16);
        obj.checkIfDevEuiExists(devEUI, appID).then((devEUIsFound) => {
            if (devEUIsFound.length === 2) { // 2 because 1 gw node session + 1 app serv node session == 2
                validation.validateLoRaDeviceInput(req.body, "update", devEUIsFound).then((validErrs) => {
                    if (validErrs === null) {
                        let preppedUserInput = prepPutRequestInput(req.body, devEUIsFound[1]);
                        updateGwServDeviceInDB(preppedUserInput).then((gwResp) => {
                            updateAppServDeviceInDB(preppedUserInput).then((appResp) => {
                                let GwServNodeSession = require("../../models/nodeSessionGwServ.js")();
                                let AppServNodeSession = require("../../models/nodeSessionAppServ.js")(preppedUserInput.ApplicationID);
                                
                                let gwRespClean = dataFormat.enforceSchemaOnDocument(GwServNodeSession, gwResp, false);
                                let appRespClean = dataFormat.enforceSchemaOnDocument(AppServNodeSession, appResp, false);
                                // Below: Format our only binary data as hex, and remove the UserPayloadDataLen field:
                                appRespClean.UserPayloadData = Buffer.from(appRespClean.UserPayloadData).toString("hex").toUpperCase();
                                delete appRespClean.UserPayloadDataLen;
                                dataFormat.removeFloatingPointErrorsFromGwResp(gwRespClean);
                                dataFormat.removeFloatingPointErrorsFromAppResp(appRespClean);

                                res.send({
                                    nodeSessions: {
                                        updatedGwNodeSession:   gwRespClean,
                                        updatedAppNodeSession:  appRespClean
                                    }
                                });
                                next();
                                // The user will never see this, so we can do it after we've finished sending
                                // the main response:
                                if (gwNodeSessionWasChanged(GwServNodeSession, preppedUserInput)) {
                                    let AppNodeSessionDynamic = require("../../models/nodeSessionAppServDynamic.js")(preppedUserInput.ApplicationID);
                                    let queryObj = { DevEUI: devEUI };
                                    let updateObj = {
                                        $set: {
                                            GwSvrDbUpdated:             1,
                                            GwSvrDbUpdateAccessTime:    new Date(0)
                                        }
                                    };
                                    AppNodeSessionDynamic.findOneAndUpdate(queryObj, updateObj, { new: true }).then((dynResp) => {
                                        if (dynResp === null) {
                                            logger.error("Gateway node session tracking update failed on device", devEUI);
                                        }
                                    });
                                }
                            }).catch((err) => {
                                let msg = err + "";
                                errorResp.send(res, consts.error.serverErrorLabel, msg + ". Rolling back transaction...", 500);
                                next();
                                logger.error("Mongo Error at app updates: " + msg + " Rolling back transaction...");
                                obj.rollBack(devEUIsFound);
                            });
                        }).catch((err) => {
                            let msg = err + "";
                            errorResp.send(res, consts.error.serverErrorLabel, msg + ". Rolling back transaction...", 500);
                            next();
                            logger.error("Mongo Error at gateway updates: " + msg + " Rolling back transaction...");
                            obj.rollBack(devEUIsFound);
                        });
                    } else {
                        logger.error("Validation errors:", validErrs.errors);
                        errorResp.send(res, consts.error.badRequestLabel, validErrs.errors, 400);
                        next();
                    }
                }).catch((err) => {
                    logger.error(err);
                    errorResp.send(res, consts.error.serverErrorLabel, "" + err, 500);
                    next();
                });
            } else {
                logger.error("DevEUI not found: " + devEUI);
                errorResp.send(res, consts.error.badRequestLabel, "DevEUI not found: " + devEUI, 400);
                next();
            }
        }).catch((mongoError) => {
            logger.error("Mongo Error at DevEUI check: " + mongoError.message);
            errorResp.send(res, consts.error.serverErrorLabel, mongoError.message, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, queryValidationErrors, 400);
        next();
    }
};

function getPutQueryValidation(body) {
    let errors = [];

    errors = errors.concat(loraDataValidation.getDevEuiValidation(body.DevEUI, true));
    errors = errors.concat(loraDataValidation.getApplicationIdValidation(body.ApplicationID, "ApplicationID", true, false));

    return errors;
}

// This function's job is to collect all of the necessary fields for updating the LoRa
// device's node sessions in the database, and format any particular fields as needed.
function prepPutRequestInput(body, existingNode) {
    let combinedNS = {
        ApplicationID:  dataFormat.padWithZerosToFixedLength(body.ApplicationID, 16),
        DevEUI:         body.DevEUI.toUpperCase()
    };

    combinedNS.DevType =            body.DevType;
    combinedNS.SubType =            body.SubType;
    combinedNS.NwkSKey =            (body.NwkSKey !== undefined) ? body.NwkSKey.toUpperCase() : undefined;
    combinedNS.RelaxFCnt =          body.RelaxFCnt;
    combinedNS.Rx1DROffset =        body.Rx1DROffset;
    combinedNS.RxDelay =            body.RxDelay;
    combinedNS.Rx2DR =              body.Rx2DR;
    combinedNS.ADRInterval =        body.ADRInterval;
    combinedNS.InstallationMargin = (body.InstallationMargin !== undefined) ? dataFormat.enforceFloat(body.InstallationMargin) : undefined;
    combinedNS.TxPower =            body.TxPower;
    combinedNS.NbTrans =            body.NbTrans;
    combinedNS.RxWindowNumber =     body.RxWindowNumber;
    combinedNS.TimeoutInterval =    (body.TimeoutInterval !== undefined) ? dataFormat.enforceFloat(body.TimeoutInterval) : undefined;
    combinedNS.PingNbClassB =       body.PingNbClassB;
    combinedNS.FreqClassBC =        (body.FreqClassBC !== undefined) ? dataFormat.enforceFloat(body.FreqClassBC) : undefined;
    combinedNS.DrClassBC =          body.DrClassBC;
    combinedNS.FCntUp =             body.FCntUp;
    combinedNS.FCntDown =           body.FCntDown;
    
    combinedNS.Name =               body.Name;
    combinedNS.Description =        body.Description;
    combinedNS.UseAppSetting =      body.UseAppSetting;
    combinedNS.AppKey =             (body.AppKey !== undefined) ? body.AppKey.toUpperCase() : undefined;
    combinedNS.AppSKey =            (body.AppSKey !== undefined) ? body.AppSKey.toUpperCase() : undefined;
    combinedNS.DownlinkConfirmed =  body.DownlinkConfirmed;
    combinedNS.FPort =              body.FPort;
    combinedNS.EncryptedMacCmds =   body.EncryptedMacCmds;
    combinedNS.UnencryptedMacCmds = body.UnencryptedMacCmds;

    // Convert user-inputted hex string to buffer:
    if (body.UserPayloadData !== undefined)
        combinedNS.UserPayloadData =    dataFormat.hexStringToBuffer(body.UserPayloadData);
    combinedNS.HasEncryptedMacCmdDelivered =    body.HasEncryptedMacCmdDelivered;
    combinedNS.HasUnencryptedMacCmdDelivered =  body.HasUnencryptedMacCmdDelivered;
    combinedNS.HasUserPayloadDataDelivered =    body.HasUserPayloadDataDelivered;

    // The whole point of the "*Prev" fields is that they are backup copies of valid MAC
    // commands so that we know what was the last command that was executed. If an update
    // clears the MAC command fields, we want to remove the "*Prev" field(s) from the
    // update so that they don't get cleared as well.
    if (combinedNS.EncryptedMacCmds !== undefined && combinedNS.EncryptedMacCmds.length > 0) {
        combinedNS.EncryptedMacCmdsPrev = combinedNS.EncryptedMacCmds;
    }
    if (combinedNS.UnencryptedMacCmds !== undefined && combinedNS.UnencryptedMacCmds.length > 0) {
        combinedNS.UnencryptedMacCmdsPrev = combinedNS.UnencryptedMacCmds;
    }
    if (combinedNS.UserPayloadData !== undefined) {
        combinedNS.UserPayloadDataLen = combinedNS.UserPayloadData.length;
    }

    // Next, remove the "MulticastAddrArray" from the update if it's not supported
    // for that particular class.
    if (existingNode.Class === 1 || existingNode.Class === 2) {
        combinedNS.MulticastAddrArray = body.MulticastAddrArray;
    }

    // DevType and SubType dependency
    if (body.DevType !== undefined && body.SubType === undefined) {
        combinedNS.SubType = defaultValues.appServ.SubType;
    }

    // This code simply converts any MulticastAddrArray data to uppercase
    if (combinedNS.MulticastAddrArray !== undefined) {
        let uppercaseMCAA = [];
        for (let i = 0; i < combinedNS.MulticastAddrArray.length; i++) {
            uppercaseMCAA.push(combinedNS.MulticastAddrArray[i].toUpperCase());
        }
        combinedNS.MulticastAddrArray    = uppercaseMCAA;
        combinedNS.ValidMulticastAddrNum = combinedNS.MulticastAddrArray.length;
    }

    combinedNS.RefAlt  = body.RefAlt;
    combinedNS.GeoJSON = dataFormat.getGeoJsonValueForPut(body.RefLat, body.RefLon); 

    for (let field in combinedNS) { if (combinedNS[field] === undefined) delete combinedNS[field]; }
    return combinedNS;
}

function updateGwServDeviceInDB(input) {
    let GwServNodeSession = require("../../models/nodeSessionGwServ.js")();
    let query = { DevEUI: input.DevEUI };
    return GwServNodeSession.findOneAndUpdate(query, input, { new: true }).then((saveResp) => {
        return dataFormat.getCleanMongoResponseJSON(saveResp);
    });
}

function updateAppServDeviceInDB(input) {
    let AppServNodeSession = require("../../models/nodeSessionAppServ.js")(input.ApplicationID);
    let query = { DevEUI: input.DevEUI };
    return AppServNodeSession.findOneAndUpdate(query, input, { new: true }).then((saveResp) => {
        return dataFormat.getCleanMongoResponseJSON(saveResp);
    });
}

function gwNodeSessionWasChanged(gwNsModel, preppedInput) {
    let gwFields = Object.keys(gwNsModel.schema.tree);
    // I.e.: if at least one field belonging to the gateway node session schema was passed
    // to the Mongo update call, we consider the gateway node session to have changed.
    for (let field in preppedInput) {
        if (gwFields.includes(field) && watchedGwFields.includes(field)) {
            return true;
        }
    }
    return false;
}

module.exports = obj;
