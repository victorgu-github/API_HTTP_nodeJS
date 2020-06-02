// This file contains route-specific validation functions that should instead live
// in their route function files, as they aren't generic enough to be reused by any
// other web services.
// For the time being, though, we will leave this file here as moving it to its
// correct location is not of high importance.

let dataValidation = require("./dataValidation.js");
let loraDataValidation = require("./loraDataTypesValidation.js");

let obj = {};
const LORA_APPLICATIONID = "loraApplicationID";
const DEVEUIS = "devEUIs";

//////////////////////////////////////////////////////////////
//
// Validate Req Query for Get And Delete Web Service
//
//////////////////////////////////////////////////////////////

//Validate the get and delete query string
obj.validateGetAndDelReqQuery = function(query) {
    let validationResult = {
        status: "success",
        errorMessage: ""
    };
    let generalUserApplicationID = query.generalUserApplicationID;
    //If get query string exist and not null, it will always be string
    if (generalUserApplicationID !== undefined && generalUserApplicationID !== null) {
        let array = generalUserApplicationID.split(",");
        for (let index in array) {
            let elem = array[index];
            if (!isNormalInteger(elem)) {
                validationResult.status = "error";
                validationResult.errorMessage = "You must provide integer for generalUserApplicationID," +
                    " integer should be separated by comma and without space";
                break;
            }
        }
    }
    else {
        validationResult.status = "error";
        validationResult.errorMessage = "Must provide generalUserApplicationID";
    }
    return validationResult;
};

//Validate the get query string
obj.validGetReqQueryByLoraAppID = function(query) {
    let validationResult = {
        status: "success",
        errorMessage: ""
    };
    let appIdErrors = loraDataValidation.getApplicationIdValidation(query.loraAppID, "loraAppID", true, true);
    if (appIdErrors.length > 0) {
        validationResult.status = "error";
        validationResult.errorMessage = appIdErrors + "";
    }
    return validationResult;
};

//////////////////////////////////////////////////////////////
//
// Validate Req Body for Post Web Service
//
//////////////////////////////////////////////////////////////

obj.validatePostReqBody = function(reqBody) {
    let validationResult = {
        status: "success",
        errorMessage: []
    };
    let validatePostRequiredFieldResult = validatePostRequiredFields(reqBody);
    if (validatePostRequiredFieldResult.status === "success") {
        let validPostSettableFieldsResult = validatePostSettableFields(reqBody);
        if (validPostSettableFieldsResult.status !== "success") {
            validationResult.status = "error";
            validationResult.errorMessage = validationResult.errorMessage.concat(validPostSettableFieldsResult.errorMessage);
        }
    }
    else {
        validationResult.status = "error";
        validationResult.errorMessage = validationResult.errorMessage.concat(validatePostRequiredFieldResult.errorMessage);
    }
    return validationResult;
};

////////////////////////////////////////////////////////////////////
//
// Validate Req Body for Put Web Service
//
////////////////////////////////////////////////////////////////////

obj.validatePutReqBody = function(reqBody) {
    let validationResult = {
        status: "success",
        errorMessage: []
    };
    let validPutRequiredFieldResult = validatePutRequiredFields(reqBody);
    if (validPutRequiredFieldResult.status === "success") {
        let validPutSettableFieldResult = validatePutSettableFields(reqBody);
        if (validPutSettableFieldResult.status !== "success") {
            validationResult.status = "error";
            validationResult.errorMessage = validationResult.errorMessage.concat(validPutSettableFieldResult.errorMessage);
        }
    }
    else {
        validationResult.status = "error";
        validationResult.errorMessage = validationResult.errorMessage.concat(validPutRequiredFieldResult.errorMessage);
    }
    return validationResult;
};

////////////////////////////////////////////////////////////////////
//
// Private Function
//
////////////////////////////////////////////////////////////////////

//1. Validate if "lora" has a valid structure
//2. lora must be an object, lora must have property "loraApplicationID", lora must have property "devEUIs"
function validateLoraStruct(lora) {
    let validStructResult = {
        status: "success",
        errorMessage: []
    };
    if (lora === null || typeof lora !== "object" || lora[LORA_APPLICATIONID] === undefined || lora[DEVEUIS] === undefined) {
        validStructResult.status = "error";
        validStructResult.errorMessage.push("Attribute 'lora' doesn't have a valid structure, " +
            "it must have property 'loraApplicationID' and 'devEUIs'");
    }
    return validStructResult;
}

//Validate lora.loraApplicationID and lora.devEUIs
//1. loraApplicationID can be undefined, null, "", otherwise, it should be a valid 16 digits hex decimal string
//2. devEUIs can be undefined, null, [], otherwise, it should be array of valid 16 digits hex decimal string
function validateLoraContent(lora) {
    let validContentResult = {
        status: "success",
        errorMessage: []
    };
    let devEUIs = lora.devEUIs;
    let appIdErrors = loraDataValidation.getApplicationIdValidation(lora.loraApplicationID, "loraApplicationID", true, false);
    if (appIdErrors.length > 0) {
        validContentResult.status = "error";
        validContentResult.errorMessage = appIdErrors + "";
    }
    if (devEUIs !== undefined) {
        if (Array.isArray(devEUIs)) {
            if (devEUIs.length === 0 || !validDevEUIArray(devEUIs)) {
                validContentResult.status = "error";
                validContentResult.errorMessage.push("Elements in devEUIs must be 16 degits hex decimal string.");
            }
        }
        else {
            validContentResult.status = "error";
            validContentResult.errorMessage.push("devEUIs must be an array");
        }
    }
    return validContentResult;
}

//Determine if an array is array of string or not
function isArrayOfString(array) {
    let result = true;
    if (Array.isArray(array)) {
        for (let index in array) {
            let elem = array[index];
            if (typeof elem !== "string") {
                result = false;
                break;
            }
        }
    }
    else {
        result = false;
    }
    return result;
}

//Validate req body for user application post function
//1. Validate if the required field exist or not: generalUserApplicationName
function validatePostRequiredFields(reqBody) {
    let validatePostRequiredFieldsResult = {
        status: "success",
        errorMessage: []
    };
    let generalUserApplicationName = reqBody.generalUserApplicationName;
    if (generalUserApplicationName === undefined) {
        validatePostRequiredFieldsResult.status = "error";
        validatePostRequiredFieldsResult.errorMessage.push("Must provide generalUserApplicationName");
    }
    return validatePostRequiredFieldsResult;
}

//Validate req body for user application put function
//1. Validate if the required field exist or not: generalUserApplicationID
function validatePutRequiredFields(reqBody) {
    let validatePutRequiredFieldsResult = {
        status: "success",
        errorMessage: []
    };
    let generalUserApplicationID = reqBody.generalUserApplicationID;
    if (generalUserApplicationID === undefined) {
        validatePutRequiredFieldsResult.status = "error";
        validatePutRequiredFieldsResult.errorMessage.push("Must provide generalUserApplicationID");
    }
    return validatePutRequiredFieldsResult;
}

//1.Validate three specific fields: generalUserApplicationName, scenarioID, lora. These three fields belong to 
//  post req body
//2.generalUserApplicationName, if it exist, it must be a valid string:
//  a. minimum 1 letter
//  b. can only have one internal separator as '.','_','-'
//3.scenarioID, if it exist, it must be a integer
//4.lora, if it exist, it must be a valid lora object:
//  a. it must have the completed lora object structure, must have property 'loraApplicationID' and 'devEUIs'
//  b. 'loraApplicationID' and 'devEUIs' must have valid value
function validatePostSettableFields(reqBody) {
    let validatePostSettableFieldsResult = {
        status: "success",
        errorMessage: []
    };
    let generalUserApplicationName = reqBody.generalUserApplicationName;
    let lora = reqBody.lora;
    let scenarioID = reqBody.scenarioID;

    //If generalUserApplicationName exist, it must be a valid string:
    if (generalUserApplicationName !== undefined) {
        if (typeof generalUserApplicationName !== "string" || generalUserApplicationName === "") {
            validatePostSettableFieldsResult.status = "error";
            validatePostSettableFieldsResult.errorMessage.push("generalUserApplicationName must be a non-empty string");
        }
    }
    //If scenarioID exist, it must be a valid integer
    if (scenarioID !== undefined) {
        logger.info(scenarioID<0);
        if (!Number.isInteger(scenarioID) || scenarioID < 0) {
            validatePostSettableFieldsResult.status = "error";
            validatePostSettableFieldsResult.errorMessage.push("scenarioID must be an integer no less than 0 (you gave " + typeof scenarioID + " " + scenarioID + ").");
        }
    }
    //If lora exist, it must be a valid lora object
    if (lora !== undefined) {
        let validStruct = validateLoraStruct(lora);
        if (validStruct.status === "success") {
            let validContent = validateLoraContent(lora);
            if (validContent.status !== "success") {
                validatePostSettableFieldsResult.status = "error";
                validatePostSettableFieldsResult.errorMessage = validatePostSettableFieldsResult.errorMessage.concat(validContent.errorMessage);
            }
        }
        else {
            validatePostSettableFieldsResult.status = "error";
            validatePostSettableFieldsResult.errorMessage = validatePostSettableFieldsResult.errorMessage.concat(validStruct.errorMessage);
        }
    }
    return validatePostSettableFieldsResult;
}

//1.Validate four specific fields: generalUserApplicationID, generalUserApplicationName, scenarioID, lora. These four fields belong to 
//  put req body
//2.generalUserApplicationID, it is required field, it will always exist and must be an integer
//3.generalUserApplicationName, if it exist, it must be a valid string:
//  a. minimum 1 letter
//  b. can only have one internal separator as '.','_','-'
//4.scenarioID, if it exist, it can be null or an integer
//5.lora, if it exist, it can be null or valid lora object:
//  a. it must have the completed lora object structure, must have property 'loraApplicationID' and 'devEUIs'
//  b. 'loraApplicationID' and 'devEUIs' must have valid value
function validatePutSettableFields(reqBody) {
    let validatePutSettableFieldsResult = {
        status: "success",
        errorMessage: []
    };
    let generalUserApplicationID = reqBody.generalUserApplicationID;
    let generalUserApplicationName = reqBody.generalUserApplicationName;
    let lora = reqBody.lora;
    let scenarioID = reqBody.scenarioID;
    //generalUserApplicationID is required, it must exist here
    //generalUserApplicationID must be an integer
    if (!Number.isInteger(generalUserApplicationID)) {
        validatePutSettableFieldsResult.status = "error";
        validatePutSettableFieldsResult.errorMessage.push("generalUserApplicationID must be integer (you gave " + typeof generalUserApplicationID + " " + generalUserApplicationID + ").");
    }
    //If generalUserApplicationName exist, it must be a valid string:
    if (generalUserApplicationName !== undefined) {
        if (typeof generalUserApplicationName !== "string" || generalUserApplicationName === "") {
            validatePutSettableFieldsResult.status = "error";
            validatePutSettableFieldsResult.errorMessage.push("generalUserApplicationName must be a non-empty string.");
        }
    }
    //If scenarioID exist, it can be:
    //1. null, means remove this field in the database;
    //2. integer, means update this field in the database;
    if (scenarioID !== undefined && scenarioID !== null) {
        if (!Number.isInteger(scenarioID)) {
            validatePutSettableFieldsResult.status = "error";
            validatePutSettableFieldsResult.errorMessage.push("scenarioID must be an integer between 1 and 9,999 (you gave " + typeof scenarioID + " " + scenarioID + ").");
        }
    }
    //If lora exist, it can be:
    //1. null, means remove this field in the database;
    //2. valid lora object, means update this field in the database;
    if (lora !== undefined && lora !== null) {
        let validStruct = validateLoraStruct(lora);
        if (validStruct.status === "success") {
            let validContent = validateLoraContent(lora);
            if (validContent.status !== "success") {
                validatePutSettableFieldsResult.status = "error";
                validatePutSettableFieldsResult.errorMessage = validatePutSettableFieldsResult.errorMessage.concat(validContent.errorMessage);
            }
        }
        else {
            validatePutSettableFieldsResult.status = "error";
            validatePutSettableFieldsResult.errorMessage = validatePutSettableFieldsResult.errorMessage.concat(validStruct.errorMessage);
        }
    }

    return validatePutSettableFieldsResult;
}

function validDevEUIArray(devEUIs) {
    let result = true;
    for (let index in devEUIs) {
        let devEUI = devEUIs[index];
        if (!dataValidation.isValidHexString(devEUI, 16)) {
            result = false;
            break;
        }
    }
    return result;
}

function isNormalInteger(str) {
    return /^\+?(0|[1-9]\d*)$/.test(str);
}

module.exports = obj;
