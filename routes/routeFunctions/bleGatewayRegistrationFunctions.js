let errorResp = reqFile("./common/errorResponse.js");
let bleDataValidation = reqFile("./common/bleDataValidation.js");
let consts = reqFile("./config/constants.js");
let dataValidation = reqFile("./common/dataValidation.js");
let dataFormat = reqFile("./common/dataFormat.js");

let obj = {};

// - GET "/ble/gateways?macAddress=xx,xx"
obj.getBleGatewayInfo = function(req, res, next) {
    let validation = getValidationForGetRequest(req);
    if (validation.length === 0) {
        let bleGw = reqFile("./models/ble/bleGw.js")();
        let queryObj = {};
        if (req.query.macAddress) {
            let macs = req.query.macAddress.toUpperCase().split(",");
            queryObj.macAddress = { $in: macs };
        }

        bleGw.find(queryObj).then((resp) => {
            let finalOutput = [];
            if (resp.length !== 0) {
                for (let i in resp) {
                    finalOutput.push(dataFormat.enforceSchemaOnDocument(bleGw, resp[i], true)); 
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
        errorResp.send(res, consts.error.badRequestLabel, validation, 400);
        next();
    }
};

function getValidationForGetRequest(req) {
    let errors = [];
    let macs = [];
    if (req.query.macAddress) {
        macs = req.query.macAddress.split(",");
    }
    for (let i in macs) {
        errors = errors.concat(bleDataValidation.getMacAddrQueryValidation(macs[i], "macAddress", false));
    }
    
    return errors;
}

// POST "/ble/gateways"
obj.saveBleGatewayInfo = function(req, res, next) {
    let validation = getValidationForPostRequest(req);
    let bleGw = reqFile("./models/ble/bleGw.js")();

    if (validation.length === 0) {
        bleGw.find({
            macAddress: req.body.macAddress.toUpperCase()
        }).then((resp) => {
            if (resp.length === 0) {
                let objToSave = {
                    macAddress:          req.body.macAddress.toUpperCase(),
                    latitude:            req.body.latitude,
                    longitude:           req.body.longitude,
                    altitude:            req.body.altitude === undefined ? 0 : req.body.altitude,
                    status:              req.body.status === undefined ? "" : req.body.status,
                    hdwVersion:          req.body.hdwVersion === undefined ? "" : req.body.hdwVersion,
                    fmwVersion:          req.body.fmwVersion === undefined ? "" : req.body.fmwVersion,
                    refLocationName:     req.body.refLocationName === undefined ? "" : req.body.refLocationName,
                    bleAppID:            req.body.bleAppID,
                    createdBy:           res.locals.username,
                    createdAt:           new Date(),
                    creatorAccessRole:   res.locals.accessRole
                };
        
                (new bleGw(objToSave)).save().then((resp) => {
                    let finalOutput = dataFormat.enforceSchemaOnDocument(bleGw, resp, false);
                    res.send(finalOutput);
                    next();
                });
            } else {
                let msg = "The macAddress " + req.body.macAddress.toUpperCase() + " already exists in the database.";
                errorResp.send(res, consts.error.badRequestLabel, msg, 400);
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
    errors = errors.concat(bleDataValidation.getMacAddrQueryValidation(req.body.macAddress, "macAddress", true));
    errors = errors.concat(dataValidation.getLatitudeValidation(req.body.latitude, "latitude", true));
    errors = errors.concat(dataValidation.getLongitudeValidation(req.body.longitude, "longitude", true));
    errors = errors.concat(dataValidation.getAltitudeValidation(req.body.altitude, "altitude", false));
    errors = errors.concat(dataValidation.getStringValidation(req.body.hdwVersion, "hdwVersion", false));
    errors = errors.concat(dataValidation.getStringValidation(req.body.fmwVersion, "fmwVersion", false));
    errors = errors.concat(dataValidation.getStringValidation(req.body.status, "status", false));
    errors = errors.concat(dataValidation.getStringValidation(req.body.refLocationName, "refLocationName", false));
    errors = errors.concat(bleDataValidation.getTypedBleAppIdValidation(req.body.bleAppID, "bleAppID", true, "number"));


    return errors;
}

// PUT "ble/gateways"
obj.updateBleGatewayInfo = function(req, res, next) {
    let validation = getValidationForPutRequest(req);
    if (validation.length === 0) {
        let bleGw = reqFile("./models/ble/bleGw.js")();
        bleGw.find({
            macAddress: req.body.macAddress.toUpperCase()
        }).then((resp) => {
            if (resp.length !== 0) {
                let queryObj = {
                    macAddress: req.body.macAddress.toUpperCase()
                };
                let updateObj = {
                    latitude:        req.body.latitude,
                    longitude:       req.body.longitude,
                    altitude:        req.body.altitude,
                    status:          req.body.status,
                    hdwVersion:      req.body.hdwVersion,
                    fmwVersion:      req.body.fmwVersion,
                    refLocationName: req.body.refLocationName,
                    bleAppID:        req.body.bleAppID
                };
                for (let field in updateObj) {
                    if (updateObj[field] === undefined) {
                        delete updateObj[field];
                    }
                }

                bleGw.findOneAndUpdate(queryObj, updateObj, { new: true }).then((resp) => {
                    let finalOutput = dataFormat.enforceSchemaOnDocument(bleGw, resp, false);
                    res.send(finalOutput);
                    next();
                }).catch((err) => {
                    logger.error(err);
                    let msg = err + "";
                    errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
                    next();
                });


            } else {
                let msg = "Cannot find the ble gateway " + req.body.macAddress + " in the database.";
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
    errors = errors.concat(dataValidation.getLatitudeValidation(req.body.latitude, "latitude", false));
    errors = errors.concat(dataValidation.getLongitudeValidation(req.body.longitude, "longitude", false));
    errors = errors.concat(dataValidation.getAltitudeValidation(req.body.altitude, "altitude", false));
    errors = errors.concat(bleDataValidation.getMacAddrQueryValidation(req.body.macAddress, "macAddress", true));
    errors = errors.concat(dataValidation.getStringValidation(req.body.hdwVersion, "hdwVersion", false));
    errors = errors.concat(dataValidation.getStringValidation(req.body.fmwVersion, "fmwVersion", false));
    errors = errors.concat(dataValidation.getStringValidation(req.body.status, "status", false));
    errors = errors.concat(dataValidation.getStringValidation(req.body.refLocationName, "refLocationName", false));
    errors = errors.concat(bleDataValidation.getTypedBleAppIdValidation(req.body.bleAppID, "bleAppID", false, "number"));
 
    return errors;
}

// DELETE "/ble/gateways"
obj.deleteBleGatewayInfo = function(req, res, next) {
    let validation = getValidationForDeleteRequest(req);
    if (validation.length === 0) {
        let queryObj = {};
        let bleGw = reqFile("./models/ble/bleGw.js")();
        queryObj.macAddress = { $in: req.query.macAddress.toUpperCase().split(",")};
        bleGw.find(queryObj).then((resp) => {
            let deleteQuery = {};
            let macAddresses = [];
            for (let i in resp) {
                macAddresses.push(resp[i].macAddress);
            }
            deleteQuery = {
                macAddress: {
                    $in: macAddresses
                }
            };

            bleGw.deleteMany(deleteQuery).then(() => {
                let finalOutput = {};
                finalOutput.number = resp.length;
                finalOutput.macAddresses = macAddresses;
                res.send(finalOutput);
                next();
            }).catch((err) => {
                logger.error(err);
                let msg = err + "";
                errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
                next();            
            });

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

function getValidationForDeleteRequest(req) {
    let errors = [];
    if (req.query.macAddress === undefined) {
        errors.push("Must specify at least one valid macAddress.");
    } else {
        let macs = req.query.macAddress.split(",");
        for (let i in macs) {
            errors = errors.concat(bleDataValidation.getMacAddrQueryValidation(macs[i], "macAddress", true));
        }
    }
    return errors;
}

module.exports = obj;
