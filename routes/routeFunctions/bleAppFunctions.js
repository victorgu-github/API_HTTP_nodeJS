let reqFile = require.main.require;

let mongoose = require("mongoose");
mongoose.Promise = global.Promise;

let logger = require("../../common/tracer.js");
let errorResp = require("../../common/errorResponse.js");
let consts = require("../../config/constants.js");
let dataFormat = require("../../common/dataFormat.js");
let dataValidation = reqFile("./common/dataValidation.js");
let bleDataValidation = reqFile("./common/bleDataValidation.js");
let bleAppValidation = require("../../common/bleAppValidation.js");

const nodeDistanceTravelledThresholdHours = 24;

let obj = {};

// - GET "/ble/applications?bleAppID=..."
obj.getBleApplications = function(req, res, next) {
    let bleApplication = require("../../models/ble/bleApplication.js")();
    let validationResult = bleAppValidation.validateGetAndDelReqQuery(req.query);
    if (validationResult.status === "success") {
        getBleApplications(req.query.bleAppID).then((resp) => {
            resp = JSON.parse(JSON.stringify(resp));
            resp = dataFormat.enforceTopLevelOfSchema(bleApplication, resp);
            let finalOutput = [];
            resp.forEach((bleApp) => {
                finalOutput.push(dataFormat.enforceSchemaOnDocument(bleApplication, bleApp, false));
                // Arrays are unfortunately too complex to be handled by the above
                // function, so they must be filtered manually. We will do this by
                // sending a mini "model" of the objects inside this array:
                for (let i = 0; i < bleApp.foreignKeys.length; i++) {
                    bleApp.foreignKeys[i] = dataFormat.enforceSchemaOnDocument({
                        schema: {
                            tree: {
                                keyName:        null,
                                keyValue:       null,
                                description:    null
                            }
                        }
                    }, bleApp.foreignKeys[i], false);
                }
            });
            res.send(finalOutput);
            next();
        }).catch((err) => {
            let msg = err + "";
            logger.error(err);
            errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validationResult.errorMessage, 400);
        next();
    }
};

// - GET "/ble/applications/createdby?username=...&accessRole=..."
obj.getBleApplicationsByCreatedBy = function(req, res, next) {
    let bleApplication = require("../../models/ble/bleApplication.js")();
    let validationErrors = getInputValidationForGetCreatedBy(req.query);
    if (validationErrors.length === 0) {
        let query = {};
        if (req.query.username !== undefined) {
            query.createdBy = req.query.username;
            query.creatorAccessRole = req.query.accessRole;
        } else {
            query.createdBy = res.locals.username;
            query.creatorAccessRole = res.locals.accessRole;
        }
        bleApplication.find(query).sort({bleAppID: -1}).then((resp) => {
            resp = JSON.parse(JSON.stringify(resp));
            resp = dataFormat.enforceTopLevelOfSchema(bleApplication, resp);
            let finalOutput = [];
            resp.forEach((bleApp) => {
                finalOutput.push(dataFormat.enforceSchemaOnDocument(bleApplication, bleApp, false));
                // Arrays are unfortunately too complex to be handled by the above
                // function, so they must be filtered manually. We will do this by
                // sending a mini "model" of the objects inside this array:
                for (let i = 0; i < bleApp.foreignKeys.length; i++) {
                    bleApp.foreignKeys[i] = dataFormat.enforceSchemaOnDocument({
                        schema: {
                            tree: {
                                keyName:        null,
                                keyValue:       null,
                                description:    null
                            }
                        }
                    }, bleApp.foreignKeys[i], false);
                }
            });
            res.send(finalOutput);
            next();
        }).catch((err) => {
            logger.error(err);
            let errMsg = err + "";
            errorResp.send(res, consts.error.serverErrorLabel, errMsg, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validationErrors, 400);
        next();
    }
};

// - GET "/ble/applications/count/createdby?username=...&accessRole=..."
obj.getNumDevicesInBleAppsCreatedBy = function(req, res, next) {
    let bleApplication = reqFile("./models/ble/bleApplication.js")();
    let validationErrors = getInputValidationForCountCreatedBy(req.query);
    if (validationErrors.length === 0) {
        let queryObj = getQueryForBleAppsCreatedBy(req.query, res);
        // First, get all BLE applications created by the specified user:
        bleApplication.find(queryObj, {
            _id:            0,
            bleAppID:       1,
            bleAppName:     1,
            foreignKeys:    1
        }).sort({ bleAppID: 1 }).then((bleApps) => {
            for (let i = 0; i < bleApps.length; i++) {
                // Arrays must be filtered manually. We will do this by
                // sending a mini "model" of the objects inside this array:
                for (let j = 0; j < bleApps[i].foreignKeys.length; j++) {
                    bleApps[i].foreignKeys[j] = dataFormat.enforceSchemaOnDocument({
                        schema: {
                            tree: {
                                keyName:        null,
                                keyValue:       null,
                                description:    null
                            }
                        }
                    }, bleApps[i].foreignKeys[j], false);
                }
            }
            let finalResp = [];
            let bleAppIDs = [];
            bleApps.forEach((bleAppID) => {
                finalResp.push({
                    bleAppID:       bleAppID.bleAppID,
                    bleAppName:     bleAppID.bleAppName,
                    numBleTag:      0,
                    numBleGw:       0,
                    foreignKeys:    bleAppID.foreignKeys
                });
                bleAppIDs.push(bleAppID.bleAppID);
            });
            // Now that we have an array of N bleAppIDs, we have to make N + 1 queries
            // (i.e.: one to the BLE gateway collection, and one to each BLE application
            // database to get the nodes)
            let queryProms = [];
            // Query the gateways:
            let bleGw = reqFile("./models/ble/bleGw.js")();
            // Because the agts_ble_gw collection contains multiple gateways from
            // different BLE app IDs, and because we want the number of gateways in each
            // BLE application, the way to get this number is to use an aggregation
            // operation. Below, the approach is essentially:
            //   1) Find all unique MAC addresses that have the BLE app IDs we want
            //   2) Group them by bleAppID
            //   3) Count the number in each group (later on in the code below)
            queryProms.push(bleGw.aggregate([
                { $match: { bleAppID: { $in: bleAppIDs } } },
                { $group: {
                    _id:            { bleAppID: "$bleAppID" },
                    macAddresses:   { $addToSet: "$macAddress" }
                } },
                { $sort: { _id: 1 } }
            ]));
            // Next, count the number of BLE nodes found in each BLE app database:
            bleAppIDs.forEach((bleAppID) => {
                let bleNode = reqFile("./models/ble/bleNode.js")(bleAppID);
                queryProms.push(bleNode.distinct("macAddress", {}).then((distResp) => {
                    return (distResp !== undefined) ? distResp : [];
                }));
            });
            // We need to wait for these queries to complete first so that we can proceed
            // to get the total number of abnormals for each BLE app's devices.
            Promise.all(queryProms).then((allResps) => {
                let aggGwResp = allResps[0];
                let nodeResps = allResps.slice(1, allResps.length);
                let abnormalProms = [];
                // Iterate through our BLE apps and match each up with its number of BLE
                // gateways and nodes:
                for (let i = 0; i < bleApps.length; i++) {
                    let bleGws = aggGwResp.filter(each => each._id.bleAppID === bleApps[i].bleAppID)[0];
                    finalResp[i].numBleGw = (bleGws !== undefined) ? bleGws.macAddresses.length : 0;
                    finalResp[i].numBleTag = nodeResps[i].length;
                    finalResp[i].numberOfAbnormalTravelledDistances = 0;
                    if (nodeResps[i].length !== 0) {
                        let nodeDistanceTravelled = reqFile("./models/ble/bleNodeDistanceTravelled.js")(bleApps[i].bleAppID);
                        let distQueryObj = getQueryObjForDistancesTravelled(nodeResps[i]);
                        abnormalProms.push(nodeDistanceTravelled.aggregate(
                            { $match: distQueryObj },
                            {
                                $group: {
                                    _id: { macAddress: "$macAddress" },
                                    distanceTravelled: { $sum: "$distanceTravelledInKm" }
                                }
                            }
                        ));
                    } else {
                        abnormalProms.push(Promise.resolve(null));
                    }
                }
                // Now we finally have all of the information we need, so package it
                // together and send the final response.
                Promise.all(abnormalProms).then((abnormalResps) => {
                    for (let i = 0; i < abnormalResps.length; i++) {
                        if (abnormalResps[i] !== null) {
                            for (let j = 0; j < abnormalResps[i].length; j++) {
                                if (abnormalResps[i][j].distanceTravelled < consts.minimumNormalDailySheepTravelDistanceKm)
                                    finalResp[i].numberOfAbnormalTravelledDistances++;
                            }
                        } // Else it's already 0
                    }
                    res.send(finalResp);
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
        }).catch((err) => {
            logger.error(err);
            let errMsg = err + "";
            errorResp.send(res, consts.error.serverErrorLabel, errMsg, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validationErrors, 400);
        next();
    }
};

function getInputValidationForCountCreatedBy(query) {
    let errors = [];

    if (dataValidation.oneOfTwoParametersIsUndefined(query.username, query.accessRole)) {
        errors.push("Must specify 'accessRole' parameter when defining 'username', and vice-versa");
    } else {
        if (query.username !== undefined && query.username.length === 0) {
            errors.push("'username' parameter cannot be an empty string");
        } else if (query.username !== undefined && dataFormat.stringContainsOnlySpaces(query.username)) {
            errors.push("'username' parameter cannot contain only spaces");
        }
        if (query.accessRole !== undefined && query.accessRole.length === 0) {
            errors.push("'accessRole' parameter cannot be an empty string");
        } else if (query.accessRole !== undefined && dataFormat.stringContainsOnlySpaces(query.accessRole)) {
            errors.push("'accessRole' parameter cannot contain only spaces");
        }
    }

    return errors;
}

function getQueryForBleAppsCreatedBy(query, res) {
    let output = {};
    if (query.username !== undefined) {
        output.createdBy = query.username;
        output.creatorAccessRole = query.accessRole;
    } else {
        output.createdBy = res.locals.username;
        output.creatorAccessRole = res.locals.accessRole;
    }
    return output;
}

function getQueryObjForDistancesTravelled(macAddrs) {
    let distQueryObj = {
        macAddress: { $in: macAddrs }
    };

    let last24Hours = new Date();
    last24Hours.setUTCHours(last24Hours.getUTCHours() - nodeDistanceTravelledThresholdHours);
    distQueryObj.timestamp = { $gte: last24Hours };

    return distQueryObj;
}

// - GET "/ble/applications/count?bleAppID=..."
obj.getNumDevicesInBleApps = function(req, res, next) {
    let bleApplication = reqFile("./models/ble/bleApplication.js")();
    let validationErrors = getInputValidationForCount(req.query);
    if (validationErrors.length === 0) {
        let queryObj = {};
        if (req.query.bleAppID !== undefined) {
            queryObj.bleAppID = {
                $in: req.query.bleAppID.split(",")
            };
        }
        // First, our BLE applications:
        bleApplication.find(queryObj, {
            _id:            0,
            bleAppID:       1,
            bleAppName:     1,
            foreignKeys:    1
        }).sort({ bleAppID: 1 }).then((bleApps) => {
            for (let i = 0; i < bleApps.length; i++) {
                // Arrays must be filtered manually. We will do this by
                // sending a mini "model" of the objects inside this array:
                for (let j = 0; j < bleApps[i].foreignKeys.length; j++) {
                    bleApps[i].foreignKeys[j] = dataFormat.enforceSchemaOnDocument({
                        schema: {
                            tree: {
                                keyName:        null,
                                keyValue:       null,
                                description:    null
                            }
                        }
                    }, bleApps[i].foreignKeys[j], false);
                }
            }
            let finalResp = [];
            let bleAppIDs = [];
            bleApps.forEach((bleAppID) => {
                finalResp.push({
                    bleAppID:       bleAppID.bleAppID,
                    bleAppName:     bleAppID.bleAppName,
                    numBleTag:      0,
                    numBleGw:       0,
                    foreignKeys:    bleAppID.foreignKeys
                });
                bleAppIDs.push(bleAppID.bleAppID);
            });
            // Now that we have an array of N bleAppIDs, we have to make N + 1 queries
            // (i.e.: one to the BLE gateway collection, and one to each BLE application
            // database to get the nodes)
            let queryProms = [];
            // Query the gateways:
            let bleGw = reqFile("./models/ble/bleGw.js")();
            // Because the agts_ble_gw collection contains multiple gateways from
            // different BLE app IDs, and because we want the number of gateways in each
            // BLE application, the way to get this number is to use an aggregation
            // operation. Below, the approach is essentially:
            //   1) Find all unique MAC addresses that have the BLE app IDs we want
            //   2) Group them by bleAppID
            //   3) Count the number in each group (later on in the code below)
            queryProms.push(bleGw.aggregate([
                { $match: { bleAppID: { $in: bleAppIDs } } },
                { $group: {
                    _id:            { bleAppID: "$bleAppID" },
                    macAddresses:   { $addToSet: "$macAddress" }
                } },
                { $sort: { _id: 1 } }
            ]));
            // Next, count the number of BLE nodes found in each BLE app database:
            bleAppIDs.forEach((bleAppID) => {
                let bleNode = reqFile("./models/ble/bleNode.js")(bleAppID);
                queryProms.push(bleNode.distinct("macAddress", {}).then((distResp) => {
                    return (distResp !== undefined) ? distResp : [];
                }));
            });
            // We need to wait for these queries to complete first so that we can proceed
            // to get the total number of abnormals for each BLE app's devices.
            Promise.all(queryProms).then((allResps) => {
                let aggGwResp = allResps[0];
                let nodeResps = allResps.slice(1, allResps.length);
                let abnormalProms = [];
                // Iterate through our BLE apps and match each up with its number of BLE
                // gateways and nodes:
                for (let i = 0; i < bleApps.length; i++) {
                    let bleGws = aggGwResp.filter(each => each._id.bleAppID === bleApps[i].bleAppID)[0];
                    finalResp[i].numBleGw = (bleGws !== undefined) ? bleGws.macAddresses.length : 0;
                    finalResp[i].numBleTag = nodeResps[i].length;
                    finalResp[i].numberOfAbnormalTravelledDistances = 0;
                    if (nodeResps[i].length !== 0) {
                        let nodeDistanceTravelled = reqFile("./models/ble/bleNodeDistanceTravelled.js")(bleApps[i].bleAppID);
                        let distQueryObj = getQueryObjForDistancesTravelled(nodeResps[i]);
                        abnormalProms.push(nodeDistanceTravelled.aggregate(
                            { $match: distQueryObj },
                            {
                                $group: {
                                    _id: { macAddress: "$macAddress" },
                                    distanceTravelled: { $sum: "$distanceTravelledInKm" }
                                }
                            }
                        ));
                    } else {
                        abnormalProms.push(Promise.resolve(null));
                    }
                }
                // Now we finally have all of the information we need, so package it
                // together and send the final response.
                Promise.all(abnormalProms).then((abnormalResps) => {
                    for (let i = 0; i < abnormalResps.length; i++) {
                        if (abnormalResps[i] !== null) {
                            for (let j = 0; j < abnormalResps[i].length; j++) {
                                if (abnormalResps[i][j].distanceTravelled < consts.minimumNormalDailySheepTravelDistanceKm)
                                    finalResp[i].numberOfAbnormalTravelledDistances++;
                            }
                        } // Else it's already 0
                    }
                    res.send(finalResp);
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
        }).catch((err) => {
            logger.error(err);
            let errMsg = err + "";
            errorResp.send(res, consts.error.serverErrorLabel, errMsg, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validationErrors, 400);
        next();
    }
};

function getInputValidationForCount(query) {
    let errors = [];

    errors = errors.concat(bleDataValidation.getMultipleBleAppIdValidation(query.bleAppID, "bleAppID", false));

    return errors;
}

// - POST "/ble/applications"
obj.saveBleApplication = function(req, res, next) {
    let validationResult = bleAppValidation.validatePostReqBody(req.body);
    //1. If req.body valid, then continue
    //2. If req.body invalid, then send error message to frontend
    if (validationResult.status === "success") {
        //1. If we can find the max ble application id, then continue
        //2. If we face mongo error during find the mas ble application id, then send system error message to frontend
        getMaximumBleAppID().then((resp) => {
            resp = JSON.parse(JSON.stringify(resp));
            //1. resp.length === 0 means it may be there is no data in the database or the
            //   test env and nodejs database have different data records
            //2. because we use find({}).sort({bleAppID: -1}).limit(1), the
            //   resp only includes one element, and resp[0] can be used.
            let maxBleAppID = (resp.length === 0) ? 0 : resp[0].bleAppID;
            // Add a separate validation for the maximum bleAppID.

            if (maxBleAppID === 9999) {
                let errMsg = "Unfortunately you have reached the maximum bleAppID 9999.";
                errorResp.send(res, consts.error.badRequestLabel, errMsg , 400);
                next();

            } else {
                let currBleAppID = maxBleAppID + 1;
                let bleApplication = require("../../models/ble/bleApplication.js")();
                let objToSave = {
                    bleAppName: req.body.bleAppName,
                    detailDataLoc: req.body.detailDataLoc,
                    relatedCompanyID: req.body.relatedCompanyID,
                    centerLat: req.body.centerLat,
                    centerLng: req.body.centerLng,
                    centerAlt: req.body.centerAlt,
                    defaultZoomLevel2D: req.body.defaultZoomLevel2D,
                    defaultZoomLevel3D: req.body.defaultZoomLevel3D,
                    bleAppID: currBleAppID,
                    foreignKeys: req.body.foreignKeys,
                    createdBy: res.locals.username,
                    creatorAccessRole: res.locals.accessRole
                };
                if (objToSave.foreignKeys) {
                    objToSave.foreignKeys.forEach((elem) => {
                        elem.description = (elem.description) ? elem.description : "";
                    });
                }
                (new bleApplication(objToSave)).save().then((saveResponse) => {
                    let finalOutput = dataFormat.enforceSchemaOnDocument(bleApplication, saveResponse, false);
                    // Arrays are unfortunately too complex to be handled by the above
                    // function, so they must be filtered manually. We will do this by
                    // sending a mini "model" of the objects inside this array:
                    for (let i = 0; i < finalOutput.foreignKeys.length; i++) {
                        finalOutput.foreignKeys[i] = dataFormat.enforceSchemaOnDocument({
                            schema: {
                                tree: {
                                    keyName: null,
                                    keyValue: null,
                                    description: null
                                }
                            }
                        }, finalOutput.foreignKeys[i], false);
                    }
                    res.send(finalOutput);
                    next();
                }).catch((err) => {
                    let msg = err + "";
                    logger.error(err);
                    errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
                    next();
                });
            }
        }).catch((err) => {
            let msg = err + "";
            logger.error(err);
            errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validationResult.errorMessage, 400);
        next();
    }
};

// - PUT "/ble/applications"
obj.updateBleApplication = function(req, res, next) {
    let bleApplication = require("../../models/ble/bleApplication.js")();
    let validationResult = bleAppValidation.validatePutReqBody(req.body);
    if (validationResult.status === "success") {
        let updateBody = getUpdateBody(req.body);
        if (updateBody.foreignKeys) {
            updateBody.foreignKeys.forEach((elem) => {
                elem.description = (elem.description) ? elem.description : "";
            });
        }
        updateUserApplicationInfo(updateBody).then((updateResponse) => {
            updateResponse = JSON.parse(JSON.stringify(updateResponse));
            //In the async function, we use findOneAndUpdate function. 
            //When we use mongoose findOneAndUpdate function, we should notice:
            //1.If we cannot find the ble application in the system, findOneAndUpdate function will return null to us
            //2.If we can find the ble application in the system, findOneAndUpdate function will return the updated result
            if (updateResponse) {
                let finalOutput = dataFormat.enforceSchemaOnDocument(bleApplication, updateResponse, false);
                // Arrays are unfortunately too complex to be handled by the above
                // function, so they must be filtered manually. We will do this by
                // sending a mini "model" of the objects inside this array:
                for (let i = 0; i < finalOutput.foreignKeys.length; i++) {
                    finalOutput.foreignKeys[i] = dataFormat.enforceSchemaOnDocument({
                        schema: {
                            tree: {
                                keyName:        null,
                                keyValue:       null,
                                description:    null
                            }
                        }
                    }, finalOutput.foreignKeys[i], false);
                }
                res.send(finalOutput);
                next();
            } else {
                errorResp.send(res, consts.error.badRequestLabel, "Cannot find this device", 400);
                next();
            }
        }).catch((err) => {
            let msg = err + "";
            logger.error(err);
            errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validationResult.errorMessage, 400);
        next();
    }
};

//Get final valid update body
function getUpdateBody(body) {
    let updateBody = {
        bleAppID: body.bleAppID
    };
    if (body.bleAppName !== undefined) {
        updateBody.bleAppName = body.bleAppName;
    }
    if (body.detailDataLoc !== undefined) {
        updateBody.detailDataLoc = body.detailDataLoc;
    }
    if (body.relatedCompanyID !== undefined) {
        updateBody.relatedCompanyID = body.relatedCompanyID;
    }
    //both centerLat and centerLng are null, set them to null
    //both centerLat and centerLng are valid number, set them to valid number
    if (body.centerLat === null && body.centerLng === null) {
        updateBody.centerLat = null;
        updateBody.centerLng = null;
    }
    if (typeof body.centerLat === "number" && typeof body.centerLng === "number") {
        updateBody.centerLat = body.centerLat;
        updateBody.centerLng = body.centerLng;
    }
    if (body.centerAlt !== undefined) {
        updateBody.centerAlt = body.centerAlt;
    }
    if (body.defaultZoomLevel2D !== undefined) {
        updateBody.defaultZoomLevel2D = body.defaultZoomLevel2D;
    }
    if (body.defaultZoomLevel3D !== undefined) {
        updateBody.defaultZoomLevel3D = body.defaultZoomLevel3D;
    }

    if (body.foreignKeys !== undefined) {
        updateBody.foreignKeys = body.foreignKeys;
    }

    return updateBody;
}

// - DELETE "/ble/applications"
//1. Validate req body attribute
//2. Find if all the input ble application exist in the system, if there is any ble application
//   doesn't exist in the syste, throw an error message
//3. If all the input ble application exist in the syste, then delete all of them
//4. summarize the delete result info and send back to frontend user
obj.deleteBleApplication = function(req, res, next) {
    let query = req.query;
    let validationResult = bleAppValidation.validateGetAndDelReqQuery(query);
    if (validationResult.status === "success") {
        getBleApplications(query.bleAppID).then((findResp) => {
            findResp = JSON.parse(JSON.stringify(findResp));
            let countForFindResult = findResp.length;
            let countForInputApp = query.bleAppID.split(",").length;
            if (countForFindResult === countForInputApp) {
                delBleApplications(query.bleAppID).then((delResp) => {
                    let delResult = {};
                    delResult.number = delResp.length;
                    delResult.bleAppIDs = delResp;
                    res.send(delResult);
                    next();
                }).catch((err) => {
                    let msg = err + "";
                    logger.error(err);
                    errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
                    next();
                });
            } else {
                let notExistApp = findNotExistApp(findResp, query.bleAppID);
                let errorMessage = "We cannot find these device in the system: " + notExistApp;
                logger.error("Cannot find ble application:", errorMessage);
                errorResp.send(res, consts.error.badRequestLabel, errorMessage, 400);
                next();
            }
        }).catch((err) => {
            let msg = err + "";
            logger.error(err);
            errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validationResult.errorMessage, 400);
        next();
    }
};

//Async function to get ble application information
function getBleApplications(queryStr) {
    let array = [];
    let queryArr = queryStr.split(",");
    let bleApplication = require("../../models/ble/bleApplication.js")();
    //Right now, the element in query is integer string, we need change it to integer number
    for (let i in queryArr) {
        array.push(parseInt(queryArr[i]));
    }
    return new Promise((resolve) => {
        if (bleApplication) {
            let query = {};
            query["$or"] = [];
            for (let i in array) {
                let elem = array[i];
                let queryObj = {};
                queryObj.bleAppID = elem;
                query["$or"].push(queryObj);
            }
            resolve(bleApplication.find(query));
        } else {
            resolve([]);
        }
    });
}

//Async function to get the maximum ble app id
function getMaximumBleAppID() {
    let bleApplication = require("../../models/ble/bleApplication.js")();
    return new Promise((resolve) => {
        bleApplication.find({}).sort({ bleAppID: -1 }).limit(1).then((resp) => {
            resolve(resp);
        });
    });
}

//Async function to update the ble application
function updateUserApplicationInfo(updateBody) {
    let bleApplication = require("../../models/ble/bleApplication.js")();
    let query = { bleAppID: updateBody.bleAppID };
    return bleApplication.findOneAndUpdate(query, updateBody, { new: true }).then((updateResp) => {
        return updateResp;
    });
}

//Async function to delete the ble application
//There are two methods to delete records in database: 
//1. .remove({bleAppID: {$in:[1,2,3]}}), but these method only return the count of deleted records
//2. .findOneAndRemove({bleAppID:1}) + Promise.all(), findOneAndRemove will return the exact record 
//   content instead of the count of records
//Thus, we choose findOneAndRemove + Promise.all() here. After deleting, we can show the deleted records info to 
//frontend user
function delBleApplications(queryStr) {
    let promises = [];
    let queryArr = queryStr.split(",");
    let bleApplication = require("../../models/ble/bleApplication.js")();
    for (let i in queryArr) {
        let promise = bleApplication.findOneAndRemove({ bleAppID: parseInt(queryArr[i]) });
        promises.push(promise);
    }
    return Promise.all(promises).then((resp) => {
        let userApplicationIDs = [];
        resp = JSON.parse(JSON.stringify(resp));
        for (let index in resp) {
            let elem = resp[index];
            userApplicationIDs.push(elem.bleAppID);
        }
        return userApplicationIDs;
    });
}

function getInputValidationForGetCreatedBy(query) {
    let errors = [];

    if ((query.username === undefined && query.accessRole !== undefined) ||
        (query.username !== undefined && query.accessRole === undefined))
        errors.push("Must specify 'accessRole' parameter when defining 'username', and vice-versa");
    let acceptedParams = ["username", "accessRole"];
    let unknownFields = Object.keys(query).filter((field) => { return acceptedParams.includes(field) === false; });
    if (unknownFields.length > 0)
        errors.push("Unknown query parameter(s): " + (unknownFields + "").replace(/,/g, ", ") +
                    ". Accepted query parameters are: " + (acceptedParams + "").replace(/,/g, ", "));

    return errors;
}

//Compare and find the ble application doesn't exist in the req body
function findNotExistApp(findResp, userAppIDs) {
    let notExistApp = userAppIDs.split(",");
    for (let index in findResp) {
        let elem = findResp[index];
        let appID = elem.bleAppID.toString();
        if (notExistApp.includes(appID)) {
            notExistApp = notExistApp.filter((item) => item !== appID);
        }
    }
    return notExistApp;
}

module.exports = obj;
