let mongoose = require("mongoose");
mongoose.Promise = global.Promise;

let errorResp = require("../../common/errorResponse.js");
let logger = require("../../common/tracer.js");
let validation = require("../../common/oneStepNodeSessionValidation.js");
let dataFormat = require("../../common/dataFormat.js");
let defaultValues = require("../../config/nodeSessionDefaultValues.js");
let consts = require("../../config/constants.js");

let obj = {};

obj.checkIfDevEUIsAlreadyExist = function(input, nodeSessionModel) {
    let devEuiPromises = [];
    for (let i in input) {
        devEuiPromises.push(nodeSessionModel.find(
            {
                DevEUI: input[i].toUpperCase()
            }
        ));
    }
    return Promise.all(devEuiPromises).then((resp) => {
        let errors = [];
        for (let i in resp) {
            if (resp[i].length > 0)
                errors.push(resp[i][0].DevEUI);
        }
        return errors;
    });
};

// Because we are doing multiple database save operations, if we encounter an error
// partway through after we've already saved some data to the database, we roll back
// the entire transaction so as to prevent leaving bad data in the collection.
obj.rollBack = function(devEUIsToSave, appID) {
    setTimeout((() => {
        logger.debug("appID =", appID);
        let GwNodeSession = require("../../models/nodeSessionGwServ.js")();
        let AppServNodeSession = require("../../models/nodeSessionAppServ.js")(appID);
        let delPromises = [];
        for (let i in devEUIsToSave) {
            delPromises.push(GwNodeSession.remove({ DevEUI: devEUIsToSave[i] }).then((devEuiResp) => {
                let temp = {};
                temp.DevEUI = devEUIsToSave[i];
                temp.result = devEuiResp.result;
                return temp;
            }));
            delPromises.push(AppServNodeSession.remove({ DevEUI: devEUIsToSave[i] }).then((devEuiResp) => {
                let temp = {};
                temp.DevEUI = devEUIsToSave[i];
                temp.result = devEuiResp.result;
                return temp;
            }));
        }
        Promise.all(delPromises).then((resp) => {
            logger.error("Rollback result:\n", resp);
        });
    }).bind(devEUIsToSave, appID), 1000);
};

// - POST "/lora_device/devices"
//
// Data flow:
// - request comes in
// - validate user input. If good, continue, otherwise error response
// - check if any of the user-specified DevEUIs already exist in gateway server. If not, continue, otherwise error response
// - check if any of the user-specified DevEUIs already exist in application server. If not, continue, otherwise error response
// - convert all hex input to uppercase and give random or default values for any necessary fields
// - separate user input into gw and app serv node session input sets
// - save all app and gw server node session input sets
// - check result of save operations. If all were successful, send success response, otherwise roll back transaction
obj.saveLoRaDevices = function(req, res, next) {
    // Validate user input
    validation.validateLoRaDeviceInput(req.body, "save").then((validErrs) => {
        if (validErrs === null) {
            // Keep track of how many LoRa devices we're inserting into the database
            // in case we have to roll back the transaction.
            let devEUIsToSave = [];
            let GwServNodeSession = require("../../models/nodeSessionGwServ.js")();
            let appID = dataFormat.padWithZerosToFixedLength(req.body.ApplicationID, 16);
            let AppServNodeSession = require("../../models/nodeSessionAppServ.js")(appID);
            for (let i in req.body.uniqueValues) {
                devEUIsToSave.push(req.body.uniqueValues[i].DevEUI.toUpperCase());
            }
            // Check whether or not any of these DevEUIs already exist
            obj.checkIfDevEUIsAlreadyExist(devEUIsToSave, GwServNodeSession).then((devEUIsFoundInGw) => {
                if (devEUIsFoundInGw.length === 0) {
                    obj.checkIfDevEUIsAlreadyExist(devEUIsToSave, AppServNodeSession).then((devEUIsFoundInApp) => {
                        if (devEUIsFoundInApp.length === 0) {
                            let preppedUserInput = prepPostRequestInput(req.body, res.locals);
                            let inputSets = unwindGwAndAppInputSets(preppedUserInput);

                            // Keep track of each operation's returned promise
                            let gwSaves = [];
                            let appSaves = [];
                            devEUIsToSave.forEach((gwDevEUI) => {
                                gwSaves.push(new GwServNodeSession(inputSets.gwNsInput[gwDevEUI]).save().then((saveResp) => {
                                    return dataFormat.getCleanMongoResponseJSON(saveResp);
                                }));
                            });
                            devEUIsToSave.forEach((appDevEUI) => {
                                appSaves.push(new AppServNodeSession(inputSets.appNsInput[appDevEUI]).save().then((saveResp) => {
                                    return dataFormat.getCleanMongoResponseJSON(saveResp);
                                }));
                            });

                            Promise.all(gwSaves).then((gwResp) => {
                                Promise.all(appSaves).then((appResp) => {
                                    // Make sure that the length of the save operation responses matches
                                    // the length of our input to indicate all devices were registered
                                    // successfully.
                                    if (gwResp.length == devEUIsToSave.length &&
                                        appResp.length == devEUIsToSave.length) {
                                        let gwRespClean = [];
                                        let appRespClean = [];

                                        gwResp.forEach((gw) => {
                                            let cleaned = dataFormat.enforceSchemaOnDocument(GwServNodeSession, gw, false);
                                            dataFormat.removeFloatingPointErrorsFromGwResp(cleaned);
                                            gwRespClean.push(cleaned);
                                        });
                                        appResp.forEach((app) => {
                                            let cleaned = dataFormat.enforceSchemaOnDocument(AppServNodeSession, app, false);
                                            dataFormat.removeFloatingPointErrorsFromAppResp(cleaned);
                                            // Below: Format our only binary data as hex, and remove the
                                            // UserPayloadDataLen field:
                                            cleaned.UserPayloadData = Buffer.from(cleaned.UserPayloadData).toString("hex").toUpperCase();
                                            delete cleaned.UserPayloadDataLen;
                                            appRespClean.push(cleaned);
                                        });

                                        res.send({
                                            nodeSessions: {
                                                gwNodeSessionsSaved:  gwRespClean,
                                                appNodeSessionsSaved: appRespClean
                                            }
                                        });
                                        next();
                                    } else {
                                        logger.error("Error encountered in DB response. Rolling back transaction...");
                                        errorResp.send(res, "Mongo Error", "Error encountered in DB response. Rolling back transaction...", 500);
                                        next();
                                        obj.rollBack(devEUIsToSave, appID);
                                    }
                                }).catch((mongoError) => {
                                    logger.error("Mongo Error at app saves: " + mongoError.message + " Rolling back transaction...");
                                    errorResp.send(res, "Mongo Error", mongoError.message + ". Rolling back transaction...", 500);
                                    next();
                                    obj.rollBack(devEUIsToSave, appID);
                                });
                            }).catch((mongoError) => {
                                logger.error("Mongo Error at gateway saves: " + mongoError.message + " Rolling back transaction...");
                                errorResp.send(res, "Mongo Error", mongoError.message + ". Rolling back transaction...", 500);
                                next();
                                obj.rollBack(devEUIsToSave, appID);
                            });
                        } else {
                            logger.error("These DevEUIs already exist in application server: " + devEUIsFoundInApp);
                            errorResp.send(res, "Bad Request", "These DevEUIs already exist in application server: " + devEUIsFoundInApp, 400);
                            next();
                        }
                    }).catch((mongoError) => {
                        logger.error("Mongo Error at DevEUI check: " + mongoError.message);
                        errorResp.send(res, "Mongo Error", mongoError.message, 500);
                        next();
                    });
                } else {
                    logger.error("These DevEUIs already exist in gateway server: " + devEUIsFoundInGw);
                    errorResp.send(res, "Bad Request", "These DevEUIs already exist in gateway server: " + devEUIsFoundInGw, 400);
                    next();
                }
            }).catch((mongoError) => {
                logger.error("Mongo Error at DevEUI check: " + mongoError.message);
                errorResp.send(res, "Mongo Error", mongoError.message, 500);
                next();
            });
        } else {
            logger.error("Validation errors:", validErrs.errors);
            errorResp.send(res, "Bad Request", validErrs.errors, 400);
            next();
        }
    }).catch((mongoError) => {
        logger.error("Mongo Error at validation: " + mongoError.message);
        errorResp.send(res, "Mongo Error", mongoError.message, 500);
        next();
    });
};

// Unwind or "flatten" each gw and app server input set (i.e.: create uniqueValues.length input sets)
function unwindGwAndAppInputSets(preppedInput) {
    let outObj = {
        gwNsInput:  {},
        appNsInput: {}
    };
    for (let i in preppedInput.uniqueValues) {
        let gwInput = JSON.parse(JSON.stringify(preppedInput));
        for (let field in preppedInput.uniqueValues[i]) {
            gwInput[field] = preppedInput.uniqueValues[i][field];
        }
        delete gwInput.uniqueValues;

        outObj.gwNsInput[preppedInput.uniqueValues[i].DevEUI] = gwInput;

        let appInput = JSON.parse(JSON.stringify(preppedInput));
        for (let field in preppedInput.uniqueValues[i]) {
            appInput[field] = preppedInput.uniqueValues[i][field];
        }
        delete appInput.uniqueValues;

        outObj.appNsInput[preppedInput.uniqueValues[i].DevEUI] = appInput;
    }

    return outObj;
}

// This function's job is to collect all of the necessary fields for updating the LoRa
// device's node sessions in the database, and format any particular fields as needed.
function prepPostRequestInput(body, locals) {
    let combinedNS = {
        ApplicationID:      dataFormat.padWithZerosToFixedLength(body.ApplicationID, 16),
        DevType:            body.DevType,
        SubType:            body.SubType,
        ABP:                body.ABP,
        BandID:             body.BandID,
        Class:              body.Class,

        // Gw serv default values:
        FCntUp:             defaultValues.gwServ.FCntUp,
        FCntDown:           defaultValues.gwServ.FCntDown,
        RelaxFCnt:          defaultValues.gwServ.RelaxFCnt,
        Rx1DROffset:        defaultValues.gwServ.Rx1DROffset,
        RxDelay:            defaultValues.gwServ.RxDelay,
        Rx2DR:              defaultValues.gwServ.Rx2DR,
        ADRInterval:        defaultValues.gwServ.ADRInterval,
        InstallationMargin: defaultValues.gwServ.InstallationMargin,
        TxPower:            defaultValues.gwServ.TxPower,
        NbTrans:            defaultValues.gwServ.NbTrans,
        RxWindowNumber:     defaultValues.gwServ.RxWindowNumber,
        PktLossRate:        defaultValues.gwServ.PktLossRate,
        TimeoutInterval:    defaultValues.gwServ.TimeoutInterval,
        PingNbClassB:       defaultValues.gwServ.PingNbClassB,
        PingOffsetClassB:   defaultValues.gwServ.PingOffsetClassB,

        // App serv default values:
        UseAppSetting:                  defaultValues.appServ.UseAppSetting,
        IsClassC:                       defaultValues.appServ.IsClassC,
        EncryptedMacCmds:               defaultValues.appServ.EncryptedMacCmds,
        EncryptedMacCmdsPrev:           defaultValues.appServ.EncryptedMacCmdsPrev,
        UnencryptedMacCmds:             defaultValues.appServ.UnencryptedMacCmds,
        UnencryptedMacCmdsPrev:         defaultValues.appServ.UnencryptedMacCmdsPrev,
        UserPayloadData:                defaultValues.appServ.UserPayloadData,
        UserPayloadDataLen:             defaultValues.appServ.UserPayloadDataLen,
        HasEncryptedMacCmdDelivered:        defaultValues.appServ.HasEncryptedMacCmdDelivered,
        HasUnencryptedMacCmdDelivered:      defaultValues.appServ.HasUnencryptedMacCmdDelivered,
        HasUserPayloadDataDelivered:        defaultValues.appServ.HasUserPayloadDataDelivered,
        DownlinkConfirmed:              defaultValues.appServ.DownlinkConfirmed,
        FPort:                          defaultValues.appServ.FPort,
        DevNonceUsed:                   defaultValues.appServ.DevNonceUsed,
        DevNonceValidLen:               defaultValues.appServ.DevNonceValidLen,
        EncryptedMacCmdPending:         defaultValues.appServ.EncryptedMacCmdPending,
        UnencryptedMacCmdPending:       defaultValues.appServ.UnencryptedMacCmdPending,
        UserPayloadDataPending:         defaultValues.appServ.UserPayloadDataPending,
        EncryptedMacCmdSentTime:        defaultValues.appServ.EncryptedMacCmdSentTime,
        UnencryptedMacCmdSentTime:      defaultValues.appServ.UnencryptedMacCmdSentTime,
        UserPayloadDataSentTime:        defaultValues.appServ.UserPayloadDataSentTime,
        InMaintenance:                  defaultValues.appServ.InMaintenance,
        GwToSend:                       defaultValues.appServ.GwToSend,
        ValidGwToSendArrayNum:          defaultValues.appServ.ValidGwToSendArrayNum,
        ModifiedTmst:                   defaultValues.appServ.ModifiedTmst
    };

    if (body.SubType === undefined) {
        combinedNS.SubType = defaultValues.appServ.SubType;
    }

    combinedNS.uniqueValues = [];
    for (let i = 0; i < body.uniqueValues.length; i++) {
        combinedNS.uniqueValues.push({
            Name:           body.uniqueValues[i].Name,
            Description:    (body.uniqueValues[i].Description !== undefined) ? body.uniqueValues[i].Description : defaultValues.appServ.Description,
            DevEUI:         body.uniqueValues[i].DevEUI.toUpperCase(),
            DevAddr:        (body.uniqueValues[i].DevAddr !== undefined) ? body.uniqueValues[i].DevAddr.toUpperCase() : dataFormat.getRandomHex(32, consts.NetworkID),
            NwkSKey:        (body.uniqueValues[i].NwkSKey !== undefined) ? body.uniqueValues[i].NwkSKey.toUpperCase() : dataFormat.getRandomHex(128),
            AppSKey:        (body.uniqueValues[i].AppSKey !== undefined) ? body.uniqueValues[i].AppSKey.toUpperCase() : dataFormat.getRandomHex(128),
            AppKey:         (body.uniqueValues[i].AppKey !== undefined) ? body.uniqueValues[i].AppKey.toUpperCase()   : dataFormat.getRandomHex(128),
            AppEUI:         (body.uniqueValues[i].AppEUI !== undefined) ? body.uniqueValues[i].AppEUI.toUpperCase()   : defaultValues.gwServ.AppEUI,
            RefAlt:         (body.uniqueValues[i].RefAlt !== undefined && body.uniqueValues[i].RefAlt !== null) ? body.uniqueValues[i].RefAlt : null,
            GeoJSON:        dataFormat.getGeoJsonValueForPost(body.uniqueValues[i].RefLat, body.uniqueValues[i].RefLon)
        });
    }

    // Conditional gw serv fields:
    if (body.BandID === 0) {
        combinedNS.FreqClassBC   = defaultValues.gwServ.FreqClassBC0;
        combinedNS.DrClassBC     = defaultValues.gwServ.DrClassBC0;
    } else if (body.BandID === 1) {
        combinedNS.FreqClassBC   = defaultValues.gwServ.FreqClassBC1;
        combinedNS.DrClassBC     = defaultValues.gwServ.DrClassBC1;
    } else if (body.BandID === 2) {
        combinedNS.FreqClassBC   = defaultValues.gwServ.FreqClassBC2;
        combinedNS.DrClassBC     = defaultValues.gwServ.DrClassBC2;
    } else if (body.BandID === 3) {
        combinedNS.FreqClassBC   = defaultValues.gwServ.FreqClassBC3;
        combinedNS.DrClassBC     = defaultValues.gwServ.DrClassBC3;
    }

    // Conditional app serv fields:
    if (body.Class === 0) {
        combinedNS.MulticastAddrArray    = defaultValues.appServ.MulticastAddrArray;
    } else if (body.Class === 1 || body.Class === 2) {
        combinedNS.MulticastAddrArray    = (body.MulticastAddrArray !== undefined) ? body.MulticastAddrArray : defaultValues.appServ.MulticastAddrArray;
    }

    // Automatically populate the following fields:
    combinedNS.CreatedBy =          locals.username;
    combinedNS.CreatorAccessRole =  locals.accessRole;
    combinedNS.CreatedAt =          new Date();

    // This code simply converts any MulticastAddrArray data to uppercase
    if (combinedNS.MulticastAddrArray !== undefined) {
        let uppercaseMCAA = [];
        for (let i = 0; i < combinedNS.MulticastAddrArray.length; i++) {
            uppercaseMCAA.push(combinedNS.MulticastAddrArray[i].toUpperCase());
        }
        combinedNS.MulticastAddrArray    = uppercaseMCAA;
        combinedNS.ValidMulticastAddrNum = combinedNS.MulticastAddrArray.length;
    }

    for (let field in combinedNS) { if (combinedNS[field] === undefined) delete combinedNS[field]; }

    return combinedNS;
}

module.exports = obj;
