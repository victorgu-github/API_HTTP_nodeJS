let mongoose = require("mongoose");
mongoose.Promise = global.Promise;

let errorResp = require("../../common/errorResponse.js");
let logger = require("../../common/tracer.js");
let dataFormat = require("../../common/dataFormat.js");
let loraDataValidation = require("../../common/loraDataTypesValidation.js");
let consts = require("../../config/constants.js");
let defaultValues = require("../../config/loraMulticastSessionDefaultValues.js");

function getGwMulticastModel() { return require("../../models/gwMulticastSession.js")(); }
function getAppMulticastModel(appID) { return require("../../models/appMulticastSession.js")(appID); }

let obj = {};

// - GET "/lora_device/multicastgroups"
//
// The data flow for this function is as follows:
//   - Request comes in
//   - User input is validated:
//       - A request is made to the "device_info" collection so that "devType" can be validated
//       - All fields are validated, and any errors are sent back to the main function
//   - User input is formatted (i.e..: applicationID is padded with leading zeros)
//   - The query object is built
//   - Function queries the "gw_multicast_session" and "app_multicast_session" collections, the
//     latter for each application ID submitted in the request
//   - A map is created to help match app server multicast sessions with those in the gateway server
//   - Each pair is merged together, and results are displayed
obj.getMulticastSessions = function(req, res, next) {
    getMulticastGetValidation(req.query).then((getValidation) => {
        if (getValidation.length === 0) {
            let finalOutput = { multicastSessions: [] };
            let preOutput = {};
            let preppedInput = prepOneStepMulticastGetInput(req.query);

            // Build query object
            let query = {};
            if (preppedInput.appIDs.length === 1) {
                query.ApplicationID = preppedInput.appIDs[0];
            } else {
                query.ApplicationID = { $in: preppedInput.appIDs };
            }
            if (req.query.devType !== undefined) {
                query.DevType = req.query.devType;
            }

            let findPromises = [];

            // Gateway server
            let gwMulticastModel = getGwMulticastModel();
            findPromises.push(gwMulticastModel.find(query));

            // App server
            for (let i in preppedInput.appIDs) {
                preOutput[preppedInput.appIDs[i]] = [];
                let model = getAppMulticastModel(preppedInput.appIDs[i]);
                findPromises.push(model.find(query));
            }

            Promise.all(findPromises).then((allPromisesResp) => {
                let gwMulticastLookup = getGwMulticastLookupObj(allPromisesResp[0]);
                for (let i = 1; i < allPromisesResp.length; i++) {
                    for (let j = 0; j < allPromisesResp[i].length; j++) {
                        let appMulticast = allPromisesResp[i][j];
                        let lookupKey = appMulticast.ApplicationID + "," + appMulticast.MulticastAddr;
                        let gwMulticast = gwMulticastLookup[lookupKey];
                        let combinedMulticastObj = getCombinedMulticastObj(gwMulticast, appMulticast);
                            
                        if (combinedMulticastObj !== null) {
                            preOutput[appMulticast.ApplicationID].push(combinedMulticastObj);
                        }
                    }
                }
                for (let field in preOutput) {
                    let obj = {
                        applicationID: field,
                        deviceType:    (req.query.devType !== undefined) ? req.query.devType : "all",
                        data: []
                    };
                    for (let i in preOutput[field]) {
                        obj.data.push(preOutput[field][i]);
                    }
                    finalOutput.multicastSessions.push(obj);
                }
                res.send(finalOutput);
                next();
            }).catch((err) => {
                logger.error(err);
                errorResp.send(res, consts.error.serverErrorLabel, (err + ""), 500);
                next();
            });
        } else {
            errorResp.send(res, consts.error.badRequestLabel, getValidation, 400);
            next();
        }
    }).catch((err) => {
        logger.error(err);
        errorResp.send(res, consts.error.serverErrorLabel, (err + ""), 500);
        next();
    });
};

function getMulticastGetValidation(query) {
    let DeviceInfo = require("../../models/lora/deviceInfo.js")();
    return DeviceInfo.find().then((deviceInfos) => {

        let errors = [];
        errors = errors.concat(loraDataValidation.getApplicationIdValidation(query.applicationID, "applicationID", true, true));
        errors = errors.concat(loraDataValidation.getQueryStrDevTypeValidation(query.devType, deviceInfos, false));

        return errors;
    });
}

function prepOneStepMulticastGetInput(query) {
    let output = {
        appIDs: []
    };

    let appIDs = query.applicationID.split(",");
    for (let i in appIDs) {
        output.appIDs.push(dataFormat.padWithZerosToFixedLength(appIDs[i], 16));
    }

    return output;
}

function getGwMulticastLookupObj(gwMCSs) {
    let lookup = {};
    for (let i in gwMCSs) {
        lookup[gwMCSs[i].ApplicationID + "," + gwMCSs[i].MulticastAddr] = gwMCSs[i];
    }
    return lookup;
}

function getCombinedMulticastObj(gwMC, appMC) {
    // If there is no match for the app server multicast session found,
    // do not include in final output.
    if (gwMC === undefined || appMC === undefined) { return null; }
    let output = {};

    let gwMcJSON = JSON.parse(JSON.stringify(gwMC));
    let appMcJSON = JSON.parse(JSON.stringify(appMC));

    for (let field in gwMcJSON) { output[field] = gwMcJSON[field]; }
    for (let field in appMcJSON) { output[field] = appMcJSON[field]; }
    // Below: Format our only binary data as hex, and remove the UserPayloadDataLen field:
    output.UserPayloadData = Buffer.from(output.UserPayloadData).toString("hex").toUpperCase();
    delete output.UserPayloadDataLen;
    return dataFormat.getCleanMongoResponseJSON(output);
}

// - POST "/lora_device/multicastgroups"
//
// The data flow for this function is as follows:
//   - Request comes in
//   - User input is validated:
//       - A request is made to the "device_info" collection so that "devType" can be validated
//       - All fields are validated, and any errors are sent back to the main function
//   - Prep user input (e.g.: all hex input converted to uppercase, default values given, etc.)
//   - The function queries both the gateway and app server databases to see if the MulticastAddr
//     specified already exists. If it already exists, an error is returned.
//   - Function creates one new gateway server multicast session and one new app server multicast
//     session
//   - Each save response is cleaned of the standard Mongo "_id" and "__v" fields, and a response
//     is sent back to the user / frontend
obj.saveMulticastSessions = function(req, res, next) {
    getMulticastPostValidation(req.body).then((postValidation) => {
        if (postValidation.length === 0) {
            let preppedInput = prepOneStepMulticastInput(req.body, "save");
            let gwMulticastModel = getGwMulticastModel();
            let appMulticastModel = getAppMulticastModel(preppedInput.ApplicationID);
            // Check for an existing pair first
            let findPromises = [];
            findPromises.push(gwMulticastModel.find({ MulticastAddr: preppedInput.MulticastAddr }));
            findPromises.push(appMulticastModel.find({ MulticastAddr: preppedInput.MulticastAddr }));
            Promise.all(findPromises).then((cbResp) => {
                if (cbResp[0].length === 0 && cbResp[1].length === 0) {
                    let savePromises = [];
                    savePromises.push((new gwMulticastModel(preppedInput)).save());
                    savePromises.push((new appMulticastModel(preppedInput)).save());
                    Promise.all(savePromises).then((saveResps) => {
                        let cleanedAppResp = dataFormat.getCleanMongoResponseJSON(saveResps[1]);
                        // Below: Format our only binary data as hex, and remove the UserPayloadDataLen field:
                        cleanedAppResp.UserPayloadData = Buffer.from(cleanedAppResp.UserPayloadData).toString("hex").toUpperCase();
                        delete cleanedAppResp.UserPayloadDataLen;
                        res.send({
                            gwServMulticastSession:  dataFormat.getCleanMongoResponseJSON(saveResps[0]),
                            appServMulticastSession: cleanedAppResp
                        });
                        next();
                    }).catch((err) => {
                        logger.error(err);
                        errorResp.send(res, consts.error.serverErrorLabel, (err + ""), 500);
                        next();
                    });
                } else {
                    let msg = "MulticastAddr '" + preppedInput.MulticastAddr + "' already exists in ";
                    if (cbResp[0].length !== 0 && cbResp[1].length !== 0) {
                        msg += "both the gateway and app server databases";
                    } else if (cbResp[0].length !== 0) {
                        msg += "the gateway server database. Please delete this data before continuing.";
                    } else {
                        msg += "the app server database. Please delete this data before continuing.";
                    }
                    errorResp.send(res, consts.error.badRequestLabel, msg, 400);
                    next();
                }
            }).catch((err) => {
                logger.error(err);
                errorResp.send(res, consts.error.serverErrorLabel, (err + ""), 500);
                next();
            });
        } else {
            errorResp.send(res, consts.error.badRequestLabel, postValidation, 400);
            next();
        }
    }).catch((err) => {
        logger.error(err);
        errorResp.send(res, consts.error.serverErrorLabel, (err + ""), 500);
        next();
    });
};

function getMulticastPostValidation(body) {
    let DeviceInfo = require("../../models/lora/deviceInfo.js")();
    return DeviceInfo.find().then((deviceInfos) => {

        let errors = [];

        // User-defined fields:
        errors = errors.concat(loraDataValidation.getClassValidation(body.Class, true));
        errors = errors.concat(loraDataValidation.getApplicationIdValidation(body.ApplicationID, "ApplicationID", true, false));
        errors = errors.concat(loraDataValidation.getDevTypeValidation(body.DevType, deviceInfos, true));
        errors = errors.concat(loraDataValidation.getSubTypeValidation(body.DevType, body.SubType, deviceInfos, true));
        let bandIdValidation = loraDataValidation.getBandIdValidation(body.BandID, true);
        errors = errors.concat(bandIdValidation);
        if (bandIdValidation.length == 0) { // Can't validate Freq and Dr unless BandID is valid
            errors = errors.concat(loraDataValidation.getFreqValidation(body.BandID, body.Freq, true));
            errors = errors.concat(loraDataValidation.getDrValidation(body.BandID, body.Dr, true));
            errors = errors.concat(loraDataValidation.getTxPowerValidation(body.BandID, body.TxPower, false));
        }

        // User optional fields:
        errors = errors.concat(loraDataValidation.getFCntDownValidation(body.FCntDown, false));
        errors = errors.concat(loraDataValidation.getMulticastAddrValidation(body.MulticastAddr, false));
        errors = errors.concat(loraDataValidation.getNwkSKeyValidation(body.NwkSKey, false));
        errors = errors.concat(loraDataValidation.getAppSKeyValidation(body.AppSKey, false));
        errors = errors.concat(loraDataValidation.getNameValidation(body.Name, false));
        errors = errors.concat(loraDataValidation.getDescriptionValidation(body.Description, false));

        return errors;
    });
}

////////////////////////////////////////////////////////////////
//
// Update One-Step Multicast Group
//
////////////////////////////////////////////////////////////////

// - PUT "/lora_device/multicastgroups"
//
// Data flow:
// 
// - request comes in
// - check that the user-specified MulticastAddr already exists. If so, continue, otherwise error response
// - validate each field of the input, accroding the validation rules list in the interface document
// - update the multicast group in the gw server
// - update the multicast group in the app server
// - check result of update operations. If all were successful, send success response
obj.updateMulticastSessions = function(req, res, next) {
    let multicastAddr = req.body.MulticastAddr;
    let appID = dataFormat.padWithZerosToFixedLength(req.body.ApplicationID, 16);
    let multicastPutValidation = getMulticastPutQueryValidation(appID, multicastAddr);
    if (multicastPutValidation.length === 0) {
        checkIfMulticastGroupExists(multicastAddr, appID).then((multicastGroupFound) => {
            if (multicastGroupFound[0] && multicastGroupFound[1]) { // 2 because 1 gw multicast group + 1 app serv multicast group == 2
                let bandID = multicastGroupFound[0].BandID;
                let pingNbClassB = multicastGroupFound[0].PingNbClassB;
                let errors = getMulticastPutValidation(req.body, bandID, pingNbClassB);
                if (errors.length === 0) {
                    let prepMulticastGroupPutInputResult = prepOneStepMulticastInput(req.body, "update");
                    updateGwServMulticastGroupInDB(prepMulticastGroupPutInputResult).then((gwResp) => {
                        updateAppServMulticastGroupInDB(prepMulticastGroupPutInputResult).then((appResp) => {
                            let cleanedAppResp = dataFormat.getCleanMongoResponseJSON(appResp);
                            // Below: Format our only binary data as hex, and remove the UserPayloadDataLen field:
                            cleanedAppResp.UserPayloadData = Buffer.from(cleanedAppResp.UserPayloadData).toString("hex").toUpperCase();
                            delete cleanedAppResp.UserPayloadDataLen;
                            res.send({
                                gwServMulticastSession: dataFormat.getCleanMongoResponseJSON(gwResp),
                                appServMulticastSession: cleanedAppResp
                            });
                            next();
                        }).catch((err) => {
                            let msg = err + "";
                            errorResp.send(res, "Server Error", msg, 500);
                            next();
                            logger.error("Mongo Error at app updates: " + msg);
                        });
                    }).catch((err) => {
                        let msg = err + "";
                        errorResp.send(res, "Server Error", msg, 500);
                        next();
                        logger.error("Mongo Error at gateway updates: " + msg);
                    });
                }
                else {
                    logger.error("Validation errors:", errors);
                    errorResp.send(res, "Bad Request", errors, 400);
                    next();
                }
            }
            else {
                logger.error("MulticastAddr not found: " + multicastAddr);
                errorResp.send(res, "Bad Request", "MulticastAddr not found: " + multicastAddr, 400);
                next();
            }
        }).catch((mongoError) => {
            logger.error("Mongo Error at MulticastAddr check: " + mongoError.message);
            errorResp.send(res, "Mongo Error", mongoError.message, 500);
            next();
        });
    }
    else {
        logger.error("Validation errors:", multicastPutValidation);
        errorResp.send(res, "Bad Request", multicastPutValidation, 400);
        next();
    }
};

function getMulticastPutQueryValidation(applicationID, multicastAddr) {
    let errors = [];

    errors = errors.concat(loraDataValidation.getApplicationIdValidation(applicationID, "ApplicationID", true, false));
    errors = errors.concat(loraDataValidation.getMulticastAddrValidation(multicastAddr, true));

    return errors;
}

function getMulticastPutValidation(body, bandID, pingNbClassB) {
    let errors = [];


    // User optional fields:
    let bandIdValidation = loraDataValidation.getBandIdValidation(bandID, false);
    errors = errors.concat(bandIdValidation);
    if (bandIdValidation.length == 0) { // Can't validate Freq and Dr unless BandID is valid
        errors = errors.concat(loraDataValidation.getFreqValidation(bandID, body.Freq, false));
        errors = errors.concat(loraDataValidation.getDrValidation(bandID, body.Dr, false));
        errors = errors.concat(loraDataValidation.getTxPowerValidation(bandID, body.TxPower, false));
    }
    errors = errors.concat(loraDataValidation.getFCntDownValidation(body.FCntDown, false));
    errors = errors.concat(loraDataValidation.getPingNbClassBValidation(body.PingNbClassB, false));
    if (body.PingNbClassB !== undefined) {
        errors = errors.concat(loraDataValidation.getPingOffsetClassBValidation(body.PingNbClassB, body.PingOffsetClassB, false));
    }
    else {
        errors = errors.concat(loraDataValidation.getPingOffsetClassBValidation(pingNbClassB, body.PingOffsetClassB, false));
    }
    errors = errors.concat(loraDataValidation.getNameValidation(body.Name, false));
    errors = errors.concat(loraDataValidation.getDescriptionValidation(body.Description, false));
    errors = errors.concat(loraDataValidation.getConfirmedValidation(body.Confirmed, false));
    errors = errors.concat(loraDataValidation.getFPortValidation(body.FPort, false));

    errors = errors.concat(loraDataValidation.getEncryptedMacCmdsValidation(body.EncryptedMacCmds, false));
    errors = errors.concat(loraDataValidation.getUnencryptedMacCmdsValidation(body.UnencryptedMacCmds, false));
    errors = errors.concat(loraDataValidation.getUserPayloadDataValidation(body.UserPayloadData, false));

    return errors;
}

////////////////////////////////////////////////////////////////
//
// Delete One-Step Multicast Group
//
////////////////////////////////////////////////////////////////

// - DELETE "/lora_device/multicastgroups/:applicationID/:multicastAddr"
//
// Data flow:
// - request comes in
// - validate user input. If good, continue, otherwise error response
// - check that the user-specified MulticastAddr actually exists. If so, continue, otherwise error response
// - call function to delete each multicast group
// - check result of delete operations. If all were successful, send success response

obj.deleteMulticastSessions = function(req, res, next) {
    let applicationID = req.params.applicationID;
    let multicastAddr = req.params.multicastAddr.toUpperCase();
    let errors = getMulticastDeleteValidation(applicationID, multicastAddr);
    if (errors.length === 0) {
        let gwMulticastModel = getGwMulticastModel();
        let appMulticastModel = getAppMulticastModel(applicationID);
        //find if the multicast group exist in gw server
        gwMulticastModel.find({ MulticastAddr: multicastAddr }).then((gwMulticastGroups) => {
            if (gwMulticastGroups.length !== 0) {
                gwMulticastGroups = JSON.parse(JSON.stringify(gwMulticastGroups[0]));
                //find if the multicast group exist in app server
                appMulticastModel.find({ MulticastAddr: multicastAddr }).then((appMulticastGroups) => {
                    if (appMulticastGroups.length !== 0) {
                        appMulticastGroups = JSON.parse(JSON.stringify(appMulticastGroups[0]));
                        gwMulticastModel.deleteMany({ MulticastAddr: multicastAddr }).then((gwDelResp) => {
                            appMulticastModel.deleteMany({ MulticastAddr: multicastAddr }).then((appDelResp) => {
                                let respExtended = {
                                    ApplicationID: applicationID,
                                    MulticastAddr: multicastAddr,
                                    gwResult: gwDelResp.result,
                                    appResult: appDelResp.result
                                };
                                res.send(respExtended);
                                next();
                            }).catch((err) => {
                                logger.error(err);
                                let errMsg = err + "";
                                errorResp.send(res, consts.error.serverErrorLabel, errMsg, 500);
                                next();
                            });
                        }).catch((err) => {
                            logger.error(err);
                            let errMsg = err + "";
                            errorResp.send(res, consts.error.serverErrorLabel, errMsg, 500);
                            next();
                        });
                    } else {
                        let errMsg = "Cannot find this group in application server";
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
                let errMsg = "Cannot find this group in gateway server";
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
        errorResp.send(res, consts.error.badRequestLabel, errors, 400);
        next();
    }
};

////////////////////////////////////////////////////////////////
//
// Private Function
//
////////////////////////////////////////////////////////////////

function checkIfMulticastGroupExists(multicastAddr, appID) {
    let multicastGroupsPromises = [];
    let gwMulticastModel = getGwMulticastModel();
    let appMulticastModel = getAppMulticastModel(appID);
    multicastGroupsPromises.push(gwMulticastModel.find(
        {
            MulticastAddr: multicastAddr
        }
    ));
    multicastGroupsPromises.push(appMulticastModel.find(
        {
            MulticastAddr: multicastAddr
        }
    ));
    return Promise.all(multicastGroupsPromises).then((resp) => {
        let resps = [];
        for (let i in resp) {
            let item = resp[i][0];
            if (item !== undefined)
                item = JSON.parse(JSON.stringify(item));
            resps.push(item);
        }
        return resps;
    });
}

function getMulticastDeleteValidation(applicationID, multicastAddr) {
    let errors = [];

    errors = errors.concat(loraDataValidation.getApplicationIdValidation(applicationID, "applicationID", true, false));
    errors = errors.concat(loraDataValidation.getMulticastAddrValidation(multicastAddr, true));

    return errors;
}

function prepOneStepMulticastInput(body, operation) {
    let output = {};

    if (operation === "save") {
        // User-defined:
        output.Class =         body.Class;
        output.ApplicationID = dataFormat.padWithZerosToFixedLength(body.ApplicationID, 16);
        output.DevType =       body.DevType;
        output.BandID =        body.BandID;
        output.Freq =          body.Freq;
        output.Dr =            body.Dr;

        // User-optional:
        output.SubType =       (body.SubType !== undefined) ? body.SubType : defaultValues.gwServ.SubType;
        output.FCntDown =      (body.FCntDown !== undefined) ? body.FCntDown : defaultValues.gwServ.FCntDown;
        output.TxPower =       (body.TxPower !== undefined) ? body.TxPower : defaultValues.gwServ.TxPower;
        output.NwkSKey =       (body.NwkSKey !== undefined) ? body.NwkSKey.toUpperCase() : dataFormat.getRandomHex(128);
        output.AppSKey =       (body.AppSKey !== undefined) ? body.AppSKey.toUpperCase() : dataFormat.getRandomHex(128);
        output.Name =          (body.Name !== undefined) ? body.Name : defaultValues.appServ.Name;
        output.Description =   (body.Description !== undefined) ? body.Description : defaultValues.appServ.Description;
        output.MulticastAddr = (body.MulticastAddr !== undefined) ? body.MulticastAddr.toUpperCase() : dataFormat.getRandomHex(32);

        // Constants (not modifiable):
        output.AppEUI =                        defaultValues.gwServ.AppEUI;
        output.PingNbClassB =                  defaultValues.gwServ.PingNbClassB;
        output.PingOffsetClassB =              defaultValues.gwServ.PingOffsetClassB;
        output.ValidMulticastGwNum =           defaultValues.gwServ.ValidMulticastGwNum;
        output.MulticastGwMac =                defaultValues.gwServ.MulticastGwMac;
        output.BeaconTimeUtcScheduled =        defaultValues.gwServ.BeaconTimeUtcScheduled;
        output.PingSlotNumScheduled =          defaultValues.gwServ.PingSlotNumScheduled;
        output.GatewayArray =                  defaultValues.appServ.GatewayArray;
        output.ValidGatewayArrayNum =          defaultValues.appServ.ValidGatewayArrayNum;
        output.EncryptedMacCmds =              defaultValues.appServ.EncryptedMacCmds;
        output.EncryptedMacCmdsPrev =          defaultValues.appServ.EncryptedMacCmdsPrev;
        output.UnencryptedMacCmds =            defaultValues.appServ.UnencryptedMacCmds;
        output.UnencryptedMacCmdsPrev =        defaultValues.appServ.UnencryptedMacCmdsPrev;
        output.UserPayloadData =               defaultValues.appServ.UserPayloadData;
        output.UserPayloadDataLen =            defaultValues.appServ.UserPayloadDataLen;
        output.HasEncryptedMacCmdDelivered =   defaultValues.appServ.HasEncryptedMacCmdDelivered;
        output.HasUnencryptedMacCmdDelivered = defaultValues.appServ.HasUnencryptedMacCmdDelivered;
        output.HasUserPayloadDataDelivered =   defaultValues.appServ.HasUserPayloadDataDelivered;
        output.Confirmed =                     defaultValues.appServ.Confirmed;
        output.FPort =                         defaultValues.appServ.FPort;
    } else if (operation === "update") {
        // User-required:
        output.ApplicationID = dataFormat.padWithZerosToFixedLength(body.ApplicationID, 16);
        output.MulticastAddr = body.MulticastAddr.toUpperCase();

        // User-optional:
        if (body.Freq !== undefined)
            output.Freq = body.Freq;
        if (body.Dr !== undefined)
            output.Dr = body.Dr;
        if (body.FCntDown !== undefined)
            output.FCntDown = body.FCntDown;
        if (body.TxPower !== undefined)
            output.TxPower = body.TxPower;
        if (body.PingNbClassB !== undefined)
            output.PingNbClassB = body.PingNbClassB;
        if (body.PingOffsetClassB !== undefined)
            output.PingOffsetClassB = body.PingOffsetClassB;
        if (body.Name !== undefined)
            output.Name = body.Name;
        if (body.Description !== undefined)
            output.Description = body.Description;
        if (body.Confirmed !== undefined)
            output.Confirmed = body.Confirmed;
        if (body.FPort !== undefined)
            output.FPort = body.FPort;
        // 1. Update EncryptedMacCmds
        if (body.EncryptedMacCmds !== undefined)
            output.EncryptedMacCmds = body.EncryptedMacCmds;
        // 1. Update EncryptedMacCmdsPrev
        if (output.EncryptedMacCmds !== undefined && output.EncryptedMacCmds.length > 0) {
            output.EncryptedMacCmdsPrev = output.EncryptedMacCmds;
        }
        // 2. Update UnencryptedMacCmds
        if (body.UnencryptedMacCmds !== undefined)
            output.UnencryptedMacCmds = body.UnencryptedMacCmds;
        // 2. Update UnencryptedMacCmdsPrev
        if (output.UnencryptedMacCmds !== undefined && output.UnencryptedMacCmds.length > 0) {
            output.UnencryptedMacCmdsPrev = output.UnencryptedMacCmds;
        }
        // 3. Update UserPayloadData
        // Convert user-inputted hex string to buffer:
        if (body.UserPayloadData !== undefined)
            output.UserPayloadData = dataFormat.hexStringToBuffer(body.UserPayloadData);
        // 3. Update UserPayloadDataLen
        if (output.UserPayloadData !== undefined) {
            output.UserPayloadDataLen = output.UserPayloadData.length;
        }
    }

    return output;
}

function updateGwServMulticastGroupInDB(input) {
    let gwMulticastModel = getGwMulticastModel();
    let query = { MulticastAddr: input.MulticastAddr };
    return gwMulticastModel.findOneAndUpdate(query, input, { new: true }).then((updateResp) => {
        return dataFormat.getCleanMongoResponseJSON(updateResp);
    });
}

function updateAppServMulticastGroupInDB(input) {
    let appMulticastModel = getAppMulticastModel(input.ApplicationID);
    let query = { MulticastAddr: input.MulticastAddr };
    return appMulticastModel.findOneAndUpdate(query, input, { new: true }).then((updateResp) => {
        return dataFormat.getCleanMongoResponseJSON(updateResp);
    });
}

module.exports = obj;
