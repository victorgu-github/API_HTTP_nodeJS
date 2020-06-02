let dataValidation = require("./dataValidation.js");
let bleDataValidation = require("./bleDataValidation.js");

let obj = {};

//Validate the get and delete query string
obj.validateGetAndDelReqQuery = function(query) {
    let validationResult = {
        status: "success",
        errorMessage: []
    };
    //If get query string exist and not null, it will always be string
    if (query.bleAppID !== undefined && query.bleAppID !== null) {
        let array = query.bleAppID.split(",");
        for (let index in array) {
            let elem = array[index];
            if (!isNormalInteger(elem)) {
                validationResult.status = "error";
                validationResult.errorMessage.push("You must provide a series of integers for bleAppID separated by comma and without space, you gave " + elem + ".");
            } else if (parseInt(elem) < 1 || parseInt(elem) > 9999) {
                validationResult.status = "error";
                validationResult.errorMessage.push("The integers you provided must be between 1 and 9999, and they need to be separated by comma and without space. You gave " + elem + ".");
            }
        }
    }
    else {
        validationResult.status = "error";
        validationResult.errorMessage = "Must provide bleAppID";
    }
    return validationResult;
};

function isNormalInteger(str) {
    return /^\+?(0|[1-9]\d*)$/.test(str);
}

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

    // foreignKeys:
    let foreignKeysValidation = bleDataValidation.getForeignKeysValidation(reqBody.foreignKeys, "foreignKeys", false);
    if (foreignKeysValidation.length !== 0) {
        validationResult.status = "error";
        validationResult.errorMessage = validationResult.errorMessage.concat(foreignKeysValidation);
    }

    return validationResult;
};

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

    // foreignKeys:
    let foreignKeysValidation = bleDataValidation.getForeignKeysValidation(reqBody.foreignKeys, "foreignKeys", false);
    if (foreignKeysValidation.length !== 0) {
        validationResult.status = "error";
        validationResult.errorMessage = validationResult.errorMessage.concat(foreignKeysValidation);
    }

    return validationResult;
};

//Validate req body for ble application post function
//1. Validate if the required field exist or not: bleAppName
function validatePostRequiredFields(reqBody) {
    let validatePostRequiredFieldsResult = {
        status: "success",
        errorMessage: []
    };
    let bleAppName = reqBody.bleAppName;
    if (bleAppName === undefined) {
        validatePostRequiredFieldsResult.status = "error";
        validatePostRequiredFieldsResult.errorMessage.push("Must provide bleAppName");
    }
    return validatePostRequiredFieldsResult;
}

//Validate req body for ble application put function
//1. Validate if the required field exist or not: bleAppID
function validatePutRequiredFields(reqBody) {
    let validatePutRequiredFieldsResult = {
        status: "success",
        errorMessage: []
    };
    let bleAppID = reqBody.bleAppID;
    if (bleAppID === undefined) {
        validatePutRequiredFieldsResult.status = "error";
        validatePutRequiredFieldsResult.errorMessage.push("Must provide bleAppID");
    }
    return validatePutRequiredFieldsResult;
}

function validatePostSettableFields(reqBody) {
    let validatePostSettableFieldsResult = {
        status: "success",
        errorMessage: []
    };
    let bleAppName = reqBody.bleAppName;
    //If bleAppName exist, it must be a valid string:
    if (bleAppName === undefined || typeof bleAppName !== "string" || bleAppName === "") {
        validatePostSettableFieldsResult.status = "error";
        validatePostSettableFieldsResult.errorMessage.push("bleAppName must be a non-empty string");
    }
    let validateSettableFieldsForPostAndPutResult = validatePutSettableFieldsForPostAndPut(reqBody);
    if (validateSettableFieldsForPostAndPutResult.length !== 0) {
        validatePostSettableFieldsResult.status = "error";
        validatePostSettableFieldsResult.errorMessage = validatePostSettableFieldsResult.errorMessage.concat(validateSettableFieldsForPostAndPutResult);
    }

    return validatePostSettableFieldsResult;
}

function validatePutSettableFields(reqBody) {
    let validatePutSettableFieldsResult = {
        status: "success",
        errorMessage: []
    };
    let bleAppID = reqBody.bleAppID;
    let bleAppName = reqBody.bleAppName;
    //bleAppID must be an integer
    if (!Number.isInteger(bleAppID)) {
        validatePutSettableFieldsResult.status = "error";
        validatePutSettableFieldsResult.errorMessage.push("bleAppID must be integer");
    }
    //If bleAppName exist, it must be a valid string:
    if (bleAppName !== undefined) {
        if (typeof bleAppName !== "string" || bleAppName === "") {
            validatePutSettableFieldsResult.status = "error";
            validatePutSettableFieldsResult.errorMessage.push("bleAppName must be a non-empty string");
        }
    }
    let validateSettableFieldsForPostAndPutResult = validatePutSettableFieldsForPostAndPut(reqBody);
    if (validateSettableFieldsForPostAndPutResult.length !== 0) {
        validatePutSettableFieldsResult.status = "error";
        validatePutSettableFieldsResult.errorMessage = validatePutSettableFieldsResult.errorMessage.concat(validateSettableFieldsForPostAndPutResult);
    }

    return validatePutSettableFieldsResult;
}

function validatePutSettableFieldsForPostAndPut(reqBody) {
    let validateSettableFieldsForPostAndPutResult = [];
    let detailDataLoc = reqBody.detailDataLoc;
    let relatedCompanyID = reqBody.relatedCompanyID;
    let centerLat = reqBody.centerLat;
    let centerLng = reqBody.centerLng;
    let centerAlt = reqBody.centerAlt;
    let defaultZoomLevel2D = reqBody.defaultZoomLevel2D;
    let defaultZoomLevel3D = reqBody.defaultZoomLevel3D;
    //If detailDataLoc exist, it must be a string
    if (detailDataLoc !== undefined) {
        if (typeof detailDataLoc !== "string") {
            validateSettableFieldsForPostAndPutResult.push("detailDataLoc must be a string");
        }
    }
    //If relatedCompanyID exist, it must be a integer
    if (relatedCompanyID !== undefined) {
        if (!Number.isInteger(relatedCompanyID)) {
            validateSettableFieldsForPostAndPutResult.push("relatedCompanyID must be a integer");
        }
    }
    //1. First level validation, validate if centerLat and centerLng are or aren't undefined or null at them same time
    //If one of centerLat and centerLng is undefined or null, another is not, will throw error
    // -if centerLat = undefined or null and centerLng != undefined or null, throw error
    // -if centerLat != undefined or null and centerLng = undefined or null, throw error
    // -if centerLat = undefined or null and centerLng = undefined or null, pass, assign default value
    // -if centerLat != undefined or null and centerLng != undefined or null, go to next validation:
    //2. Validate if both centerLat and centerLng are valid number:
    // -valid latitude: number between -90 and 90, inclusive
    // -valid longitude: number between -180 and 180, inclusive
    if (dataValidation.isUndefinedOrNull(centerLat) && !dataValidation.isUndefinedOrNull(centerLng)) {
        validateSettableFieldsForPostAndPutResult.push("centerLat and centerLng wrok together, if you provide one of them, another cannot be undefined or null");
    }
    else if (!dataValidation.isUndefinedOrNull(centerLat) && dataValidation.isUndefinedOrNull(centerLng)) {
        validateSettableFieldsForPostAndPutResult.push("centerLat and centerLng wrok together, if you provide one of them, another cannot be undefined or null");
    }
    else if (!dataValidation.isUndefinedOrNull(centerLat) && !dataValidation.isUndefinedOrNull(centerLng)) {
        if (!dataValidation.isValidLatitudeNumber(centerLat) || !dataValidation.isValidLongitudeNumber(centerLng)) {
            validateSettableFieldsForPostAndPutResult.push("centerLat and centerLng should be valid number, centerLat should be number between -90 and 90 inclusive, " +
                "centerLng should be number between -180 and 180 inclusvie");
        }
    }
    //If centerAlt exist, it must be null or a number
    if (centerAlt !== undefined) {
        if (centerAlt !== null && typeof centerAlt !== "number") {
            validateSettableFieldsForPostAndPutResult.push("centerAlt must be null or a number");
        }
    }
    //If defaultZoomLevel2D exist, it must be null or a number
    if (defaultZoomLevel2D !== undefined) {
        if (defaultZoomLevel2D !== null && typeof defaultZoomLevel2D !== "number") {
            validateSettableFieldsForPostAndPutResult.push("defaultZoomLevel2D must be null or a number");
        }
    }
    //If defaultZoomLevel3D exist, it must be null or a number
    if (defaultZoomLevel3D !== undefined) {
        if (defaultZoomLevel3D !== null && typeof defaultZoomLevel3D !== "number") {
            validateSettableFieldsForPostAndPutResult.push("defaultZoomLevel3D must be null or a number");
        }
    }

    return validateSettableFieldsForPostAndPutResult;
}

module.exports = obj;
