// This file contains route-specific validation functions that should instead live
// in their route function files, as they aren't generic enough to be reused by any
// other web services.
// For the time being, though, we will leave this file here as moving it to its
// correct location is not of high importance.

let dataValidation = require("./dataValidation.js");
let consts = require("../config/constants.js");

let obj = {};

obj.firstLevelValidField = [
    "firstName",
    "lastName",
    "username",
    "password",
    "email",
    "scenarios",
    "accessRole",
    "tiledLayerBaseURL",
    "featureLayerBaseURL",
    "appIDs"
];

obj.secondLevelValidField = [
    "id",
    "bleAppID",
    "loraAppID",
    "default",
];

/////////////////////////////////////////////////////
//
// User Login Validation
//
/////////////////////////////////////////////////////

obj.validateLoginInput = function(body) {
    let errors = [];
    // 1.Condition 1: Check if all the required fields are exist, otherwise return error
    let undefinedErrors = checkLoginRequiredFieldDefined(body);
    if (undefinedErrors.length !== 0) {
        errors = undefinedErrors;
    } else {
        // 2.Condition 2: Check if the data format of req.body are valid, otherwise return error;
        let invalidFormatErrors = checkLoginFormatValid(body);
        if (invalidFormatErrors.length !== 0) {
            errors = invalidFormatErrors;
        }
    }
    return errors;
};

function checkLoginRequiredFieldDefined(body) {
    let errors = [];

    if (body.username === undefined || body.password === undefined) {
        errors.push("Must provide 'username' and 'password' fields together in request body.");
    }

    return errors;
}

function checkLoginFormatValid(body) {
    let errors = [];

    if (typeof body.username !== "string" || typeof body.password !== "string") {
        errors.push("Username or password is not correct");
    }

    if (body.tokenLifeMinutes !== undefined) {
        if (typeof body.tokenLifeMinutes !== "number" || dataValidation.isInteger(body.tokenLifeMinutes) === false || body.tokenLifeMinutes < consts.userLogin.tokenLowerThresh || body.tokenLifeMinutes > consts.userLogin.tokenUpperThresh) {
            errors.push("'tokenLifeMinutes' field must contain a valid integer between " + consts.userLogin.tokenLowerThresh + " and " + consts.userLogin.tokenUpperThresh + " (inclusive)");
        }
    }

    return errors;
}

/////////////////////////////////////////////////////
//
// User Register Validation
//
/////////////////////////////////////////////////////

obj.validateRegisterInput = function(body) {
    let errors = [];
    // 1.Condition 1: Check if all the required fields are exist, otherwise return error;
    let undefinedErrors = checkRegisterRequiredFieldsDefined(body);
    if (undefinedErrors.length !== 0) {
        errors = undefinedErrors;
    } else {
        //2.Condition 2: Check if the data format of req.body are valid, otherwise return error;
        //  Example: Only empty array or array of 16 digits hex string are valid format for appIDs,
        //           in other case we will report a invalid error
        let invalidFormatErrors = checkRegisterFormatValid(body);
        if (invalidFormatErrors.length !== 0) {
            errors = invalidFormatErrors;
        } else {
            // 3.Condition 3: Check if the data structure of req.body are valid, otherwise return error;
            let invalidStructErrors = checkRegisterStructureValid(body);
            if (invalidStructErrors.length !== 0) {
                errors = invalidStructErrors;
            }
        }
    }
    return errors;
};

function checkRegisterRequiredFieldsDefined(body) {
    let errors = [];

    if (body.username === undefined) {
        errors.push("username is required!");
    }


    if (body.password === undefined) {
        errors.push("password is required!");
    }

    if (body.appIDs === undefined) {
        errors.push("appIDs is required");
    }

    return errors;
}

//Note: Not all of the fields are required, but once the field exist in req.body, 
//      we will verify its type
function checkRegisterFormatValid(body) {
    let errors = [];
    if (body.firstName !== undefined) {
        if (typeof body.firstName !== "string") {
            errors.push("format invalid, firstName must be a string");
        }
    }

    if (body.lastName !== undefined) {
        if (typeof body.lastName !== "string") {
            errors.push("format invalid, lastName must be a string");
        }
    }

    //Username is required, will be validate at the first step 
    if (typeof body.username !== "string") {
        errors.push("format invalid, username must be a string");
    }

    //Password is required, will be validate at the first step
    if (typeof body.password !== "string") {
        errors.push("format invalid, password must be a string");
    }


    if (body.email !== undefined) {
        if (typeof body.email !== "string") {
            errors.push("format invalid, email must be a string");
        }
    }

    if (body.scenarios !== undefined) {
        if (Array.isArray(body.scenarios)) {
            for (let index in body.scenarios) {
                let scenario = body.scenarios[index];
                if (scenario.id !== undefined) {
                    if (typeof scenario.id !== "number") {
                        errors.push("format invalid, type of scenarios[" + index + "].id must be a number");
                    }
                }

                if (scenario.bleAppID !== undefined) {
                    if (typeof scenario.bleAppID !== "string") {
                        errors.push("format invalid, type of scenarios[" + index + "].bleAppID must be a string");
                    }
                }

                if (scenario.loraAppID !== undefined) {
                    if (typeof scenario.loraAppID !== "string") {
                        errors.push("format invalid, type of scenarios[" + index + "].loraAppID must be a string");
                    }
                }

                if (scenario.default !== undefined) {
                    if (typeof scenario.default !== "boolean") {
                        errors.push("format invalid, type of scenarios[" + index + "].default must be a boolean");
                    }
                }
            }

        } else {
            errors.push("format invalid, scenarios must be an array");
        }
    }

    if (body.accessRole !== undefined) {
        if (typeof body.accessRole !== "string") {
            errors.push("format invalid, accessRole must be a string");
        }
    }

    if (body.tiledLayerBaseURL !== undefined) {
        if (typeof body.tiledLayerBaseURL !== "string") {
            errors.push("format invalid, tiledLayerBaseURL must be a string");
        }
    }

    if (body.featureLayerBaseURL !== undefined) {
        if (typeof body.featureLayerBaseURL !== "string") {
            errors.push("format invalid, featureLayerBaseURL must be a string");
        }
    }

    //AppIDs is required, will be validate at the first step
    if (!validAppIDs(body.appIDs)) {
        errors.push("'appIDs' must be an empty array or an array of integer strings between 0 and" +
                    " 9,007,199,254,740,991, inclusive (you gave " + (typeof body.appIDs) + " " + body.appIDs + ")");
    }
    return errors;
}

// This function has to be a one-off validation function for now as the field's data format
// (array) is different than the rest of the Web API (string or comma-separated string).
function validAppIDs(appIDs) {
    //1.Condition 1: type of appIDs is not array, throw error
    if (Array.isArray(appIDs)) {
        for (let index in appIDs) {
            let appID = appIDs[index];
            //2.Condition 2: element in appIDs array is not 16 digits hex string, throw error
            if (/^[0-9]+$/.test(appID) === false || typeof appID !== "string" ||
                appID < 0 || appID > 9007199254740991) {
                return false;
            }
        }
    } else {
        return false;
    }
    return true;
}

function checkRegisterStructureValid(body) {
    let errors = [];
    let firstLevelErrors = checkFirstLevelStructure(body);
    let secondLevelErrors = checkSecondLevelStructure(body);
    errors = firstLevelErrors.concat(secondLevelErrors);
    return errors;
}

//Determine if the first level contains the wrong key values
function checkFirstLevelStructure(body) {
    let errors = [];
    for (let key in body) {
        if (obj.firstLevelValidField.indexOf(key) === -1) {
            errors.push("The input has an error key: " + key);
        }
    }
    return errors;
}

function checkSecondLevelStructure(body) {
    let errors = [];
    let scenarioIDArray = [];
    let countScenarioDefault = 0;
    if (body.hasOwnProperty("scenarios")) {
        for (let i = 0; i < body.scenarios.length; i++) {
            //1. Condition1: If scenarios[i] doesn't include necessary field, return error
            for (let j = 0; j < obj.secondLevelValidField.length; j++) {
                if (!body.scenarios[i].hasOwnProperty(obj.secondLevelValidField[j])) {
                    errors.push("The Object scenario[" + i + "] doesn't have the necessary property: " + obj.secondLevelValidField[j]);
                    return errors;
                }
            }

            //2.Condition2: If scenarios contain duplicate ids, return error
            if (!scenarioIDArray.includes(body.scenarios[i].id)) {
                scenarioIDArray.push(body.scenarios[i].id);
            } else {
                errors.push("The Object scenarios have duplicated id field");
                return errors;
            }

            if (body.scenarios[i].default === true) {
                countScenarioDefault++;
            }
        }

        //3.Condition3: If default scenario is 0 or default scenario is more than 1, return error
        if (countScenarioDefault !== 1) {
            if (countScenarioDefault === 0) {
                errors.push("The Object scenarios don't have default scenario");
                return errors;
            } else if (countScenarioDefault > 1) {
                errors.push("You cannot specify more than one default scenario!");
                return errors;
            }
        }
    }
    return errors;
}

/////////////////////////////////////////////////////
//
// Wechat Login Validation
//
/////////////////////////////////////////////////////

obj.validateWechatInput = function(body) {
    let validationResult = {};
    //1. Condition 1: wechatopenid must be exist, otherwise throw error
    if (body.wechatopenid !== undefined && body.wechatopenid !== null) {
        //2.Condition 2: type of wechatopenid must be string, otherwise throw error
        if (typeof body.wechatopenid === "string") {
            validationResult.status = "success";
            validationResult.errorMessage = "";
        } else {
            validationResult.status = "error";
            validationResult.errorMessage = "type of wechatopenid must be string";
        }
    } else {
        validationResult.status = "error";
        validationResult.errorMessage = "wechatopenid is required";
    }
    return validationResult;
};

module.exports = obj;
