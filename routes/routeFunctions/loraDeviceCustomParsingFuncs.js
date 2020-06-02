let consts = reqFile("./config/constants.js");
let dataFormat = reqFile("./common/dataFormat.js");
let dataValidation = reqFile("./common/dataValidation.js");
let errorResp = reqFile("./common/errorResponse.js");

let obj = {};

// - GET "/api/lora_device/payload/customparsing?devType=..."
obj.getCustomPayloadParsingFunction = function(req, res, next) {
    let deviceInfo = reqFile("./models/lora/deviceInfo.js")();
    deviceInfo.distinct("devType", {}).then((devTypes) => {
        let validation = getValidationForGET(req, devTypes);
        if (validation.length === 0) {
            let customParsingFunction = reqFile("./models/lora/customParsingFunction.js")();
            let queryObj = {};
            if (req.query.devType !== undefined) {
                queryObj.devType = req.query.devType;
            }
            customParsingFunction.find(queryObj).then((resp) => {
                let finalResp = [];
                resp.forEach((parsingFunc) => {
                    finalResp.push({
                        devType:            parsingFunc.devType,
                        parsingFunction:    parsingFunc.parsingFunction
                    });
                });
                res.send(finalResp);
                next();
            }).catch((err) => {
                logger.error(err);
                errorResp.send(res, consts.error.serverErrorLabel, (err + ""), 500);
                next();
            });
        } else {
            errorResp.send(res, consts.error.badRequestLabel, validation, 400);
        }
    }).catch((err) => {
        logger.error(err);
        errorResp.send(res, consts.error.serverErrorLabel, (err + ""), 500);
        next();
    });
};

function getValidationForGET(req, devTypes) {
    let errors = [];

    // devType:
    if (req.query.devType !== undefined) {
        let devTypesStr = ("" + devTypes).replace(/,/g, ", ");
        if (typeof req.query.devType !== "string" || devTypes.includes(req.query.devType) === false) {
            errors.push("'devType' parameter must be one of the following strings: " + devTypesStr +
                        " (you gave " + typeof req.query.devType + " " + req.query.devType + ")");
        }
    }

    return errors;
}

// - POST "/api/lora_device/payload/customparsing"
obj.createCustomPayloadParsingFunction = function(req, res, next) {
    let deviceInfo = reqFile("./models/lora/deviceInfo.js")();
    deviceInfo.distinct("devType", {}).then((devTypes) => {
        let validation = getValidationForParsingFuncPOST(req, devTypes);
        if (validation.length === 0) {
            let loc = req.body.parsingCode.split("\n");
            let query = {
                devType:    req.body.devType
            };
            let update = {
                $set: {
                    parsingFunction:    loc,
                    createdBy:          res.locals.username,
                    creatorAccessRole:  res.locals.accessRole,
                }
            };
            let customParsingFunction = reqFile("./models/lora/customParsingFunction.js")();
            customParsingFunction.findOneAndUpdate(query, update, { upsert: true, new: true }).then((resp) => {
                // Below: Annoyingly, the Mongo response for an upsert operation contains only 'null'
                // if there was no pre-existing document, so in those cases we have to go find the
                // new document ourselves and show it to the user:
                let recUpserted;
                if (resp === null) {
                    customParsingFunction.findOne(query).then((parsingFunc) => {
                        recUpserted = dataFormat.enforceSchemaOnDocument(customParsingFunction, parsingFunc, false);
                    });
                } else {
                    recUpserted = dataFormat.enforceSchemaOnDocument(customParsingFunction, resp, false);
                }
                res.send({
                    recordInserted: recUpserted,
                    parsedResult:   runUserCode(req)
                });
                next();
            }).catch((err) => {
                logger.error(err);
                errorResp.send(res, consts.error.serverErrorLabel, (err + ""), 500);
                next();
            });
        } else {
            errorResp.send(res, consts.error.badRequestLabel, validation, 400);
        }
    }).catch((err) => {
        logger.error(err);
        errorResp.send(res, consts.error.serverErrorLabel, (err + ""), 500);
        next();
    });
};

function getValidationForParsingFuncPOST(req, devTypes) {
    let errors = [];

    // devType:
    let devTypesStr = ("" + devTypes).replace(/,/g, ", ");
    if (req.body.devType !== undefined) {
        if (typeof req.body.devType !== "string" || devTypes.includes(req.body.devType) === false) {
            errors.push("'devType' parameter must be one of the following strings: " + devTypesStr +
                        " (you gave " + typeof req.body.devType + " " + req.body.devType + ")");
        }
    } else {
        errors.push("Must specify 'devType' parameter containing one of the following strings: " + devTypesStr);
    }
    // samplePayload:
    if (req.body.samplePayload === undefined) {
        errors.push("Must specify 'samplePayload' field containing a hex string of non-zero length");
    }
    // parsingCode:
    if (req.body.parsingCode === undefined) {
        errors.push("Must specify 'parsingCode' field in request body containing JavaScript code");
    }
    // Since the above two inputs must be given together and are highly coupled, we validate them at the
    // same time below:
    if (req.body.samplePayload !== undefined && req.body.parsingCode !== undefined) {
        // samplePayload:
        if (typeof req.body.samplePayload === "string" && req.body.samplePayload.length !== 0 &&
            dataValidation.isValidHexString(req.body.samplePayload, req.body.samplePayload.length)) {
            // parsingCode:
            if (typeof req.body.parsingCode === "string") {
                try {
                    let parsedData = runUserCode(req);
                    if (!(typeof parsedData === "object" && Array.isArray(parsedData) === false &&
                          parsedData instanceof Date === false && parsedData !== null)) {
                        errors.push("'parsingCode' must return a JavaScript object. Ensure that 'parsedData;' is " +
                                    "the last statement in your code (without the single quotes). See documentation " +
                                    "for more details.");
                    }
                } catch (err) {
                    errors.push("'parsingCode' contains errors: " + err);
                }
            } else {
                errors.push("'parsingCode' must be a string containing JavaScript code with 'parsedData;' as its last statement");
            }
        } else {
            errors.push("'samplePayload' must be a hex string of non-zero length (you gave " + typeof req.body.samplePayload +
                        " " + req.body.samplePayload + ")");
        }
    }

    return errors;
}

function runUserCode(req) {
    // Below: User-uploaded custom payload parsing functions will be run inside our ZMQ Server
    // inside a 'vm2' sandbox with all of the same configurations as below. That is, we try to
    // run the user's code against a sample payload.
    const { VM } = require("vm2");
    const vm = new VM({
        timeout: 1000,
        sandbox: {
            payload:    req.body.samplePayload,
            parsedData: {}
        }
    });
    return vm.run(req.body.parsingCode);
}

// - DELETE "/api/lora_device/payload/customparsing?devType=..."
obj.deleteCustomPayloadParsingFunction = function(req, res, next) {
    let deviceInfo = reqFile("./models/lora/deviceInfo.js")();
    deviceInfo.distinct("devType", {}).then((devTypes) => {
        let validation = getValidationForDELETE(req, devTypes);
        if (validation.length === 0) {
            let customParsingFunction = reqFile("./models/lora/customParsingFunction.js")();
            let queryObj = {
                devType: req.query.devType
            };
            customParsingFunction.remove(queryObj).then((resp) => {
                res.send({
                    deleted: (resp.result.n !== 0) ? true : false
                });
                next();
            }).catch((err) => {
                logger.error(err);
                errorResp.send(res, consts.error.serverErrorLabel, (err + ""), 500);
                next();
            });
        } else {
            errorResp.send(res, consts.error.badRequestLabel, validation, 400);
        }
    }).catch((err) => {
        logger.error(err);
        errorResp.send(res, consts.error.serverErrorLabel, (err + ""), 500);
        next();
    });
};

function getValidationForDELETE(req, devTypes) {
    let errors = [];

    // devType:
    let devTypesStr = ("" + devTypes).replace(/,/g, ", ");
    if (req.query.devType !== undefined) {
        if (typeof req.query.devType !== "string" || devTypes.includes(req.query.devType) === false) {
            errors.push("'devType' parameter must be one of the following strings: " + devTypesStr +
                        " (you gave " + typeof req.query.devType + " " + req.query.devType + ")");
        }
    } else {
        errors.push("Must specify 'devType' parameter containing one of the following strings: " + devTypesStr);
    }

    return errors;
}

module.exports = obj;
