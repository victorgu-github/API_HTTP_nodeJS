// This file contains individual BLE data type validation functions which are called
// (and should be called) by various other web services that need various BLE data
// type validation.
// Put any BLE protocol-related data type validation in this file.

let dataValidation = require("./dataValidation.js");

let obj = {};

// ----------------------------------------------------------------------------------------------------------------
// -------------------------------------------- BLE Data Types ----------------------------------------------------
// ----------------------------------------------------------------------------------------------------------------

obj.getMultipleBleAppIdValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        let bleAppIDs = param.split(",");
        bleAppIDs.forEach((bleAppID) => {
            if (dataValidation.isInteger(bleAppID) === false || bleAppID < 1 || bleAppID > 9999) {
                errors.push("'" + paramName + "' parameter must be a valid integer between 1 and 9999, or comma-separated " +
                            "list thereof (you gave " + bleAppID + ")");
            }
        });
    } else if (isRequired) {
        errors.push("Must specify '" + paramName + "' parameter containing a valid integer between 1 and 9999, or " +
                    "comma-separated list thereof");
    }
    return errors;
};

obj.getBleAppIdValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (dataValidation.isInteger(param) === false || param < 1 || param > 9999) {
            errors.push("'" + paramName + "' parameter must be a valid integer between 1 and 9999 " +
                        "(you gave " + typeof param + " " + param + ")");
        }
    } else if (isRequired) {
        errors.push("Must specify '" + paramName + "' parameter containing a valid integer between 1 and 9999.");
    }
    return errors;
};

// This function is for checking a single bleAppID with a type restriction. If you do not 
// want a type check on your input, fill in the last parameter with false.
obj.getTypedBleAppIdValidation = function(param, paramName, isRequired,typeToBeChecked) {
    if (paramName === undefined || isRequired === undefined || typeToBeChecked === undefined) {
        throw new Error("Must specify a 'paramName', 'isRequired' and 'typeToBeChecked' parameter when" +
                        "using function 'bleDataValidation.js:getTypedBleAppIdValidation'.");
    }
    let errors = [];
    if (param !== undefined) {
        let pattern = /^(?:[1-9]\d*|0)$/;
        let typeCondition = typeToBeChecked ? typeof param !== typeToBeChecked : typeToBeChecked;
        if (dataValidation.isInteger(param) === false || param < 1 || param > 9999 || pattern.test(param) === false || typeCondition) {
            errors.push("'" + paramName + "' parameter must be a valid integer string between 1 and 9999" +
                        "(you gave " + typeof param + " " + param + ")");
        } 
    } else if (isRequired) {
        errors.push("Must specify '" + paramName + "' parameter containing a valid integer string between 1 and 9999.");
    }
    return errors;
};

obj.getMacAddrQueryValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        let macs = param.split(",");
        let valid = true;
        for (let i = 0; i < macs.length; i++) {
            if (dataValidation.isValidHexString(macs[i], 12) === false) {
                valid = false;
                break;
            }
        }
        if (valid === false) {
            errors.push("'" + paramName + "' parameter must be a valid 12-character hex string, or " +
                        "comma-separated list thereof (you gave " + param + ")");
        }
    } else if (isRequired) {
        errors.push("Must provide '" + paramName + "' parameter containing a valid 12-character hex string");
    }
    return errors;
};

obj.getMacAddrValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (dataValidation.isValidHexString(param, 12) === false) {
            errors.push("'" + paramName + "' parameter must be a valid 12-character hex string " +
                        "(you gave " + (typeof param) + " " + param + ")");
        }
    } else if (isRequired) {
        errors.push("Must provide '" + paramName + "' parameter containing a valid 12-character hex string");
    }
    return errors;
};

obj.getNameValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (typeof param !== "string") {
            errors.push("'" + paramName + "' parameter must be a string (you gave " +
                        (typeof param) + " " + param + ")");
        }
    } else if (isRequired) {
        errors.push("Must provide '" + paramName + "' parameter containing a string");
    }
    return errors;
};

obj.getDeviceTypeValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (typeof param !== "string") {
            errors.push("'" + paramName + "' parameter must be a string (you gave " +
                        (typeof param) + " " + param + ")");
        }
    } else if (isRequired) {
        errors.push("Must provide '" + paramName + "' parameter containing a string");
    }
    return errors;
};

obj.getForeignKeysValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        // Data format check
        if (Array.isArray(param)) {
            if (param.length > 0) {
                for (let i = 0; i < param.length; i++) {
                    let obj = param[i];
                    if (typeof obj === "object" && Array.isArray(obj) === false && obj !== null) {
                        let objKeys = Object.keys(obj);

                        let keyName = objKeys.filter((name) => { return (name === "keyName"); })[0];
                        let keyValue = objKeys.filter((name) => { return (name === "keyValue"); })[0];
                        let description = objKeys.filter((name) => { return (name === "description"); })[0];

                        // keyName:
                        if (keyName !== undefined) {
                            if (typeof obj[keyName] !== "string" || obj[keyName].length === 0) {
                                errors.push("'keyName' field must contain a string of non-zero length (you gave " +
                                            (typeof obj[keyName]) + " " + obj[keyName] + ")");
                            }
                        } else {
                            errors.push("Each object in the foreignKeys array must contain a 'keyName' field " +
                                        "(problem in element " + i + ")");
                        }
                        // keyValue:
                        if (keyValue !== undefined) {
                            if (typeof obj[keyValue] !== "string" || obj[keyValue].length === 0) {
                                errors.push("'keyValue' field must contain a string of non-zero length (you gave " +
                                            (typeof obj[keyValue]) + " " + obj[keyValue] + ")");
                            }
                        } else {
                            errors.push("Each object in the foreignKeys array must contain a 'keyValue' field " +
                                        "(problem in element " + i + ")");
                        }
                        // description:
                        if (description !== undefined) {
                            if (typeof obj[description] !== "string") {
                                errors.push("'description' field must contain a string (you gave " +
                                            (typeof obj[description]) + " " + obj[description] + ")");
                            }
                        }
                    } else {
                        errors.push("Each object in the foreignKeys array must be an object " +
                                    "(problem in element " + i + ")");
                    }
                }
            }
        } else {
            errors.push("'" + paramName + "' parameter must be an array (you gave " +
                        (typeof param) + " " + param + ")");
        }
    } else if (isRequired) {
        errors.push("Must specify '" + paramName + "' parameter containing an array of objects. " +
                    "See interface documentation.");
    }
    return errors;
};

module.exports = obj;
