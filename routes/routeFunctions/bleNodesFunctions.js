let reqFile = require.main.require;

let errorResp = reqFile("./common/errorResponse.js");
let dataFormat = reqFile("./common/dataFormat.js");
let bleDataValidation = reqFile("./common/bleDataValidation.js");
let consts = reqFile("./config/constants.js");

let obj = {};

// - GET "/ble/applications/:bleAppID/nodes?macAddress=..."
obj.getAllNodes = function(req, res, next) {
    let validation = getValidationForGetRequest(req);
    if (validation.length === 0) {
        let BleNode = reqFile("./models/ble/bleNode.js")(req.params.bleAppID);
        let queryObj = {};
        if (req.query.macAddress) {
            queryObj.macAddress = { $in: req.query.macAddress.toUpperCase().split(",") };
        }
        BleNode.find(queryObj).then((resp) => {
            let finalOutput = [];
            resp.forEach((bleNode) => {
                finalOutput.push(dataFormat.enforceSchemaOnDocument(BleNode, bleNode, false));
                // Arrays are unfortunately too complex to be handled by the above
                // function, so they must be filtered manually. We will do this by
                // sending a mini "model" of the objects inside this array:
                for (let i = 0; i < bleNode.foreignKeys.length; i++) {
                    bleNode.foreignKeys[i] = dataFormat.enforceSchemaOnDocument({
                        schema: {
                            tree: {
                                keyName:        null,
                                keyValue:       null,
                                description:    null
                            }
                        }
                    }, bleNode.foreignKeys[i], false);
                }
            });
            res.send(finalOutput);
            next();
        }).catch((err) => {
            logger.error(err);
            let msg = err + "";
            errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validation, 400);
        next();
    }
};

function getValidationForGetRequest(req) {
    let errors = [];

    errors = errors.concat(bleDataValidation.getBleAppIdValidation(req.params.bleAppID, "bleAppID", true));
    errors = errors.concat(bleDataValidation.getMacAddrQueryValidation(req.query.macAddress, "macAddress", false));

    return errors;
}

// - POST "/ble/applications/:bleAppID/nodes"
obj.registerNewNode = function(req, res, next) {
    let validation = getValidationForPostRequest(req);
    if (validation.length === 0) {
        let BleNode = reqFile("./models/ble/bleNode.js")(req.params.bleAppID);
        BleNode.find({
            macAddress: req.body.macAddress.toUpperCase()
        }).then((resp) => {
            if (resp.length === 0) { // I.e.: This MAC address is available
                let objToSave = {
                    macAddress:         req.body.macAddress,
                    name:               req.body.name,
                    deviceType:         req.body.deviceType,
                    foreignKeys:        req.body.foreignKeys,

                    createdBy:          res.locals.username,
                    creatorAccessRole:  res.locals.accessRole
                };
                if (objToSave.foreignKeys) {
                    objToSave.foreignKeys.forEach((elem) => {
                        elem.description = (elem.description) ? elem.description : "";
                    });
                }
                (new BleNode(objToSave)).save().then((resp) => {
                    let finalOutput = dataFormat.enforceSchemaOnDocument(BleNode, resp, false);
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
                }).catch((err) => {
                    logger.error(err);
                    let msg = err + "";
                    errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
                    next();
                });
            } else {
                let msg = "BLE node with MAC address " + req.body.macAddress + " already exists in database";
                errorResp.send(res, consts.error.badRequestLabel, msg, 400);
                next();
            }
        }).catch((err) => {
            logger.error(err);
            let msg = err + "";
            errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validation, 400);
        next();
    }
};

function getValidationForPostRequest(req) {
    let errors = [];

    errors = errors.concat(bleDataValidation.getBleAppIdValidation(req.params.bleAppID, "bleAppID", true));
    errors = errors.concat(bleDataValidation.getMacAddrValidation(req.body.macAddress, "macAddress", true));
    errors = errors.concat(bleDataValidation.getNameValidation(req.body.name, "name", false));
    errors = errors.concat(bleDataValidation.getDeviceTypeValidation(req.body.deviceType, "deviceType", false));
    errors = errors.concat(bleDataValidation.getForeignKeysValidation(req.body.foreignKeys, "foreignKeys", false));

    return errors;
}

// - PUT "/ble/applications/:bleAppID/nodes"
obj.updateExistingNode = function(req, res, next) {
    let validation = getValidationForPutRequest(req);
    if (validation.length === 0) {
        let BleNode = reqFile("./models/ble/bleNode.js")(req.params.bleAppID);
        BleNode.find({
            macAddress: req.body.macAddress.toUpperCase()
        }).then((resp) => {
            if (resp.length !== 0) { // I.e.: A node with this MAC address exists
                let queryObj = {
                    macAddress: req.body.macAddress  
                };
                let updateObj = {
                    name:               req.body.name,
                    deviceType:         req.body.deviceType,
                    foreignKeys:        req.body.foreignKeys,

                    createdBy:          res.locals.username,
                    creatorAccessRole:  res.locals.accessRole
                };
                for (let field in updateObj) {
                    if (updateObj[field] === undefined) {
                        delete updateObj[field];
                    } else {
                        if (field === "foreignKeys") {
                            updateObj.foreignKeys.forEach((elem) => {
                                elem.description = (elem.description) ? elem.description : "";
                            });
                        }
                    }
                }
                BleNode.findOneAndUpdate(queryObj, updateObj, { new: true }).then((resp) => {
                    let finalOutput = dataFormat.enforceSchemaOnDocument(BleNode, resp, false);
                    // Arrays are unfortunately too complex to be handled by the above
                    // function, so they must be filtered manually. We will do this by
                    // sending a mini "model" of the objects inside this array:
                    if (finalOutput.foreignKeys) {
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
                    }
                    res.send(finalOutput);
                    next();
                }).catch((err) => {
                    logger.error(err);
                    let msg = err + "";
                    errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
                    next();
                });
            } else {
                let msg = "No BLE node with MAC address " + req.body.macAddress + " found in database";
                errorResp.send(res, consts.error.badRequestLabel, msg, 400);
                next();
            }
        }).catch((err) => {
            logger.error(err);
            let msg = err + "";
            errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validation, 400);
        next();
    }
};

function getValidationForPutRequest(req) {
    let errors = [];

    errors = errors.concat(bleDataValidation.getBleAppIdValidation(req.params.bleAppID, "bleAppID", true));
    errors = errors.concat(bleDataValidation.getMacAddrValidation(req.body.macAddress, "macAddress", true));
    errors = errors.concat(bleDataValidation.getNameValidation(req.body.name, "name", false));
    errors = errors.concat(bleDataValidation.getDeviceTypeValidation(req.body.deviceType, "deviceType", false));
    errors = errors.concat(bleDataValidation.getForeignKeysValidation(req.body.foreignKeys, "foreignKeys", false));

    return errors;
}

// - Delete "/ble/applications/:bleAppID/nodes?macAddress=..."
obj.deleteExistingNodes = function(req, res, next) {
    let validation = getValidationForDelRequest(req);
    if (validation.length === 0) {
        let BleNode = reqFile("./models/ble/bleNode.js")(req.params.bleAppID);
        let queryObj = {};
        if (req.query.macAddress) {
            queryObj.macAddress = { $in: req.query.macAddress.toUpperCase().split(",") };
        }
        BleNode.find(queryObj).then((resp) => {
            if (resp.length > 0) {
                let query = getDelObj(resp);
                BleNode.deleteMany(query).then((delResp) => {
                    let finalOutput = {
                        result: (delResp.result.n > 0) ? "success" : "failure",
                        idDeleted: getExistBleNodesInfoFromFindResp(JSON.parse(JSON.stringify(resp)))
                    };
                    res.send(finalOutput);
                    next();
                }).catch((err) => {
                    logger.error(err);
                    let msg = err + "";
                    errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
                    next();
                });
            } else {
                let finalOutput = {
                    result: "success",
                    idDeleted: "deleted 0 nodes"
                };
                res.send(finalOutput);
                next();
            }
        }).catch((err) => {
            logger.error(err);
            let msg = err + "";
            errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validation, 400);
        next();
    }
};

//Validate delete request
function getValidationForDelRequest(req) {
    let errors = [];

    errors = errors.concat(bleDataValidation.getBleAppIdValidation(req.params.bleAppID, "bleAppID", true));
    errors = errors.concat(bleDataValidation.getMacAddrQueryValidation(req.query.macAddress, "macAddress", true));

    return errors;
}

//Get delete object from find response
function getDelObj(findResp) {
    let macAddrArr = [];
    findResp = JSON.parse(JSON.stringify(findResp));
    findResp.forEach((element) => {
        macAddrArr.push(element.macAddress);
    });
    let query = {
        macAddress: {
            $in: macAddrArr
        }
    };
    return query;
}

//Set final result
function getExistBleNodesInfoFromFindResp(findResp) {
    let result = [];
    findResp.forEach((element) => {
        result.push(element.macAddress);
    });
    return result.join();
}


// - Delete "/ble/applications/:bleAppID/nodes/all"
obj.deleteAllExistingNodes = function(req, res, next) {
    let validation = getValidationForDelAllRequest(req);
    if (validation.length === 0) {
        let BleNode = reqFile("./models/ble/bleNode.js")(req.params.bleAppID);
        let queryObj = {};
        BleNode.find(queryObj).then((resp) => {
            if (resp.length > 0) {
                let query = getDelObj(resp);
                BleNode.deleteMany(query).then((delResp) => {
                    let finalOutput = {
                        result: (delResp.result.n > 0) ? "success" : "failure",
                        idDeleted: getExistBleNodesInfoFromFindResp(JSON.parse(JSON.stringify(resp)))
                    };
                    res.send(finalOutput);
                    next();
                }).catch((err) => {
                    logger.error(err);
                    let msg = err + "";
                    errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
                    next();
                });
            } else {
                let finalOutput = {
                    result: "success",
                    idDeleted: "deleted 0 nodes"
                };
                res.send(finalOutput);
                next();
            }
        }).catch((err) => {
            logger.error(err);
            let msg = err + "";
            errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validation, 400);
        next();
    }
};

//Validate delete all request
function getValidationForDelAllRequest(req) {
    let errors = [];

    errors = errors.concat(bleDataValidation.getBleAppIdValidation(req.params.bleAppID, "bleAppID", true));

    return errors;
}

module.exports = obj;
