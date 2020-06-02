// This file is meant to contain any "general" data validation (e.g.: integer,
// hex string, etc.) that doesn't fit in any other specific categories such as
// LoRa data types validation, user application validation, etc.
// Add any generic input data validation inside this file.

let consts = require("../config/constants.js");

let obj = {};

obj.isValidIpAddress = function(inputStr) {
    return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(inputStr);
};

// This function only checks the logical value of the input, whether or not it's an
// integer. Use this function whenever data type is not a requirement (i.e.: when
// input can be number or a string).
obj.isInteger = function(input) {
    return /^\d+$/.test(input);
};

// This funciton checks that the input has an integer value, and that the input data
// type is a string. Use this function whenever data type is a requirement (i.e.:
// when we only accept a string integer).
obj.isIntegerString = function(inputStr) {
    return /^\d+$/.test(inputStr) && typeof inputStr === "string";
};

obj.getIntegerStringValidation = function(inputStr) {
    if (inputStr === undefined) {
        return [];
    } else if (obj.isInteger(inputStr) === true) {
        return [];
    } else {
        return [ "'dur' parameter must be a valid positive integer (e.g.: 60)" ];
    }
};

obj.isValidHexString = function(input, len) {
    return (typeof input === "string" && new RegExp("^[0-9a-fA-F]{" + len + "}$").test(input));
};

obj.getDevEuiArrValidation = function(devEuiParam) {
    let errMsgs = [];
    let arrayErrMsg = "Multiple DevEUIs must be declared in comma-separated notation (e.g.: 'AAAAAAAAAAAAAAAA,BBBBBBBBBBBBBBBB')";
    let devEuiErrMsg = "DevEUIs must be 16 character hex strings (you entered ";
    let duplicateErrMsg = "You have entered a duplicated DevEUI ";
    if (devEuiParam !== undefined) {
        if (Array.isArray(devEuiParam) === true) {
            errMsgs.push(arrayErrMsg);
        } else if (devEuiParam.includes(",")) {
            let reqDevEUIs = devEuiParam.split(",");
            let previousDevEUIs = [];
            for (let i in reqDevEUIs) {
                if (obj.isValidHexString(reqDevEUIs[i], 16) === false) {
                    errMsgs.push(devEuiErrMsg + reqDevEUIs[i] + ")");
                } else if (previousDevEUIs.includes(reqDevEUIs[i])) {
                    let index = parseInt(i) + 1;
                    errMsgs.push(duplicateErrMsg + reqDevEUIs[i] + " at query position " + index + ".");
                } else {
                    previousDevEUIs.push(reqDevEUIs[i]);
                }
            }
        } else if (obj.isValidHexString(devEuiParam, 16) === false) {
            errMsgs.push(devEuiErrMsg + devEuiParam + ")");
        }
    }
    return (errMsgs.length > 0) ? errMsgs : [];
};

// This function checks the following criteria:
//   1) The "type" field has a value of "Polygon"
//   2) The "coordinates" array has a length of 1 (i.e.: only one polygon)
//   3) The "coordinates" array contains an array (the "polygon array")
//   4) The polygon array length is greater than or equal to 3
//   5) Each element inside the polygon array is an array (a "coordinate array")
//   6) Each coordinate array has a length of 2
//   7) The first value in each coordinate array (longitude) must be a valid floating
//      point decimal between -180 and 180, inclusive
//   8) The second value in each coordinate array (latitude) must be a valid floating
//      point decimal between -90 and 90, inclusive
obj.parseGeoJSON = function(geometry) {
    // Error messages:
    let onlyPolygonMsg = "Function only supports geometry type 'Polygon'";
    let onlyOnePolygonMsg = "Function only supports one polygon per request";
    let polygonFormatMsg = "A valid polygon has the following format: [[x1,y1],[x2,y2],[x3,y3],...]";
    let minThreeSidesMsg = "The polygon array must contain 3 or more point coordinates";
    let twoDimensionsOnlyMsg = "Each element of the polygon array must be a two-dimensional point coordinate array (e.g.: [-114.133591951259,51.0804815799142])";
    let longitudeMsg = "Element 0 of each point coordinate array (longitude) must be a number between -180 and 180, inclusive";
    let latitudeMsg = "Element 1 of each point coordinate array (latitude) must be a number between -90 and 90, inclusive";

    let errMsgs = [];

    // Perform all validation
    try {
        var geomJSON = JSON.parse(geometry);
        // logger.info("geomJSON =", util.inspect(geomJSON, false, null));

        // Criteria 1:
        if (geomJSON.type === "Polygon") {
            // Criteria 2:
            if (Array.isArray(geomJSON.coordinates) && geomJSON.coordinates.length === 1) {
                // Criteria 3 & 4:
                let polyArr = geomJSON.coordinates[0];
                if (Array.isArray(polyArr) && polyArr.length >= 3) {
                    for (let i in polyArr) {
                        // Criteria 5 & 6:
                        let coordArr = polyArr[i];
                        if (Array.isArray(coordArr) === true && coordArr.length === 2) {
                            let x = coordArr[0];
                            let y = coordArr[1];
                            // Criteria 7 & 8:
                            if ((typeof x === "number" && x >= -180 && x <= 180) === false) {
                                logger.error(longitudeMsg);
                                errMsgs.push(longitudeMsg);
                            }
                            if ((typeof y === "number" && y >= -90 && y <= 90) === false) {
                                logger.error(latitudeMsg);
                                errMsgs.push(latitudeMsg);
                            }
                        } else {
                            logger.error(twoDimensionsOnlyMsg);
                            errMsgs.push(twoDimensionsOnlyMsg);
                            break;
                        }
                    }
                } else {
                    logger.error(minThreeSidesMsg);
                    errMsgs.push(minThreeSidesMsg);
                }
            } else {
                logger.error(onlyOnePolygonMsg);
                errMsgs.push(onlyOnePolygonMsg);
            }
        } else {
            logger.error(onlyPolygonMsg);
            errMsgs.push(onlyPolygonMsg);
        }
    } catch (jsonParsingErr) {
        logger.error(jsonParsingErr);
        errMsgs.push(polygonFormatMsg);
        return errMsgs;
    }

    // Done all validation
    if (errMsgs.length === 0) {
        return geomJSON;
    } else {
        return errMsgs;
    }
};

obj.validMobileDevStatusParams = function(devEUI) {
    let validationResult = {};
    if (obj.isValidHexString(devEUI, 16)) {
        validationResult.status = "success";
        validationResult.errorMessage = "";
    } else {
        validationResult.status = "error";
        validationResult.errorMessage = "cannot find the device";
    }
    return validationResult;
};

obj.getRecentUsageModeValidation = function(mode) {
    if (mode !== undefined &&
        mode !== consts.loraDeviceData.continuous && mode !== consts.loraDeviceData.scatter) {
        return [ "'mode' parameter must be either '" + consts.loraDeviceData.continuous +
                 "' or '" + consts.loraDeviceData.scatter + "'" ];
    }
    return [];
};

// This function is solely used by the frontendDeviceFunctions.js:getRecentDeviceData function.
// Because that function allows multiple devEUIs, we will add an additional restraint to disallow
// the users to enter multiple identical devEUIs.
obj.getDevEuiRequiredValidation = function(devEUI) {
    if (devEUI === undefined) {
        return [ "Must specify a valid DevEUI in the 'dev_eui' query parameter." ];
    }
    return [];
    
};

///////////////////////////////////////////////////////
//
// LORA DEVICE AGGREGATE DATA VALIDATION
//
///////////////////////////////////////////////////////

//Check if all the request params are valid
obj.validLoraDevAggrAttr = function(req, devInfoResp) {
    //Initialize validationResult
    let validationResult = {
        status: "success",
        error: []
    };
    let deviceType = req.params.devicetype;
    let devEUI = req.query.deveui;
    let mode = req.query.mode;
    //Don't need to check if the devicetype and application_id provide or not
    //If user don't provide devicetype and application_id, system will return 404 error
    //If all the required fields are defined, then check if all the fields are valid
    let invalidResult = checkDefinedFieldsValid(deviceType, devEUI, mode, devInfoResp);
    if (invalidResult.status !== "success") {
        validationResult = invalidResult;
    }
    return validationResult;
};

//Check if the map have the element
obj.mapIncludesElem = function(map, element) {
    let result = false;
    for (let key in map) {
        if (element === map[key]) {
            result = true;
        }
    }
    return result;
};

//Check if defined fiels are valid
function checkDefinedFieldsValid(deviceType, devEUI, mode, devInfoResp) {
    let validDevTypeArr = getValidAggrDevType(devInfoResp);
    let VALID_DURATION_MAP = consts.validDurationUnit;
    let invalidResult = {
        status: "success",
        error: []
    };
    if (!validDevTypeArr.includes(deviceType)) {
        invalidResult.status = "error";
        invalidResult.error.push("Device type " + deviceType + " doesn't have aggregated data");
    }
    //If devEUI is not undefined and not null, we need to validate it
    if (devEUI !== undefined && devEUI !== null) {
        let devEuiArrValidation = obj.getDevEuiArrValidation(devEUI);
        if (devEuiArrValidation.length !== 0) {
            invalidResult.status = "error";
            invalidResult.error = devEuiArrValidation;
        }
    }
    //If mode is not undefined and not null, we need to validate it
    if (mode !== undefined && mode !== null && !obj.mapIncludesElem(VALID_DURATION_MAP, mode)) {
        invalidResult.status = "error";
        invalidResult.error.push("Mode should be 'lasthour' or 'lastday'");
    }
    return invalidResult;
}

//Get valid device type array which support lora device aggregated data
//1. device type has property "aggregateData";
//2. devicetype.aggregateData is not an empty array;
//3. devicetype.aggregateData.type should be defined in the consts.loraDeviceAggregatedDataType
function getValidAggrDevType(devInfoResp) {
    let array = [];
    let deviceInfos = JSON.parse(JSON.stringify(devInfoResp));
    let LORA_DEV_AGGR_DATA_TYPE = consts.loraDeviceAggregatedDataType;
    for (let i in deviceInfos) {
        let deviceInfo = deviceInfos[i];
        if (deviceInfo.hasOwnProperty("aggregatedData") && deviceInfo.aggregatedData.length !== 0) {
            for (let j in deviceInfo.aggregatedData) {
                let aggregatedDataAttr = deviceInfo.aggregatedData[j].type;
                if (obj.mapIncludesElem(LORA_DEV_AGGR_DATA_TYPE, aggregatedDataAttr)) {
                    array.push(deviceInfo.devType);
                }
            }
        }
    }
    return array;
}

////////////////////////////////////////////////////
//
// General User Registry Validation
//
////////////////////////////////////////////////////

//Validate the user name for 6 digits
//1.Contain only ASCII letters and digits, 
//2.With hyphens, underscores, and dot as internal separators, 
//3.And cannot be more than 1 separator between letters and digits
//4.String length must be at least 6 letters
obj.validateUserNameFor6Digits = function(string) {
    let validationResult = {
        status: "success",
        errorMessage: []
    };
    let regex = /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/;
    if (!regex.test(string) || string.length < 6) {
        validationResult.status = "error";
        validationResult.errorMessage.push("userName must be a valid string: " +
            "a.Minimum 6 characters. " +
            "b.Only support 3 special characters: '.', '_', '-' in the middle of the string " +
            "c.Special characters can not be used continuously.");
    }
    return validationResult;
};

obj.validateUserNameFor1Digits = function(string) {
    let validationResult = {
        status: "success",
        errorMessage: []
    };
    let regex = /^[A-Za-z0-9]+(?:[ ._-][A-Za-z0-9]+)*$/;
    if (!regex.test(string) || string.length < 1) {
        validationResult.status = "error";
        validationResult.errorMessage.push("userName must be a valid string: " +
            "a.Minimum 1 character. " +
            "b.Only support 4 special characters: '.', '_', '-', ' ' in the middle of the string " +
            "c.Special characters can not be used continuously.");
    }
    return validationResult;
};

obj.validatePassword = function(password) {
    let pattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\W]{8,}$/;
    return pattern.test(password);
};

obj.validateEmail = function(email) {
    let pattern = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return pattern.test(email.toLowerCase());
};

obj.isValidUtcIsoDateString = function(dateStr) {
    return (typeof dateStr === "string" && isNaN(Date.parse(dateStr)) === false && dateStr[dateStr.length - 1] === "Z");
};

// DEPRECATED: Use the function immediately below instead (i.e.: 'getRequiredUtcIsoDateValidation')
obj.getUtcIsoDateValidation = function(dateStr, paramName) {
    let errors = [];

    if (isNaN(Date.parse(dateStr))) {
        errors.push("'" + paramName + "' parameter must be valid UTC ISO date strings in the format 'yyyy-mm-ddThh:mm:ssZ'" +
                    " (you entered " + dateStr + ")");
    }

    return errors;
};

obj.getRequiredUtcIsoDateValidation = function(dateStr, paramName, isRequired) {
    let errors = [];

    if (dateStr !== undefined) {
        if (obj.isValidUtcIsoDateString(dateStr) === false) {
            errors.push("'" + paramName + "' parameter must be valid UTC ISO date strings in the format " +
                        "'yyyy-mm-ddThh:mm:ssZ' (you entered " + typeof dateStr + " " + dateStr + ")");
        }
    } else {
        if (isRequired) {
            errors.push("Must specify '" + paramName + "' parameter containing a valid UTC ISO date string " +
                        "in the format 'yyyy-mm-ddThh:mm:ssZ'");
        }
    }

    return errors;
};

obj.getTimeRangeValidation = function(start, end) {
    let errors = [];

    if (new Date(start).getTime() > new Date(end).getTime()) {
        errors.push("Start time should be older than end time for a valid time range");
    }

    return errors;
};

//Check if a latitude is valid or not
obj.validLatitude = function(latitude) {
    let result = true;
    if (latitude < -90 || latitude > 90) {
        result = false;
    }
    return result;
};

//Check if a longitude is valid or not
obj.validLongitude = function(longitude) {
    let result = true;
    if (longitude < -180 || longitude > 180) {
        result = false;
    }
    return result;
};

obj.isUndefinedOrNull = function(elem) {
    let result = true;
    if (elem !== undefined && elem !== null) {
        result = false;
    }
    return result;
};

obj.isValidLatitudeNumber = function(lat) {
    let result = true;
    if (typeof lat !== "number" || !obj.validLatitude(lat)) {
        result = false;
    }
    return result;
};

obj.isValidLongitudeNumber = function(lng) {
    let result = true;
    if (typeof lng !== "number" || !obj.validLongitude(lng)) {
        result = false;
    }
    return result;
};

// This general function is for those cases when we require that
// two parameters be given together, or not at all.
obj.oneOfTwoParametersIsUndefined = function(param1, param2) {
    return ((param1 === undefined && param2 !== undefined) ||
            (param1 !== undefined && param2 === undefined));
};

// This general function is for validating if a string is empty or only contains space.
// Both empty string or strings that only contain space will be considered an error input.
obj.getNonEmptyStringValidation = function(param, paramName, isRequired) {
    // This validation function returns error for empty string or strings that only contain space
    let errors = [];
    if (param !== undefined) {
        if (typeof param !== "string") {
            errors.push("The " + paramName + " parameter must be a non-empty string. You gave " + typeof param + " " + param + ".");
        } else if (param.length === 0 || param.replace(/\s/g, "").length === 0) {
            errors.push("Cannot provide an empty string or a string that only contains space as the " + paramName + " parameter.");
        }
    } else if (isRequired) {
        errors.push("Must specify a " + paramName + " parameter.");
    }

    return errors;
};

obj.getStringValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (typeof param !== "string") {
            errors.push("The " + paramName + " parameter must be a string (you gave " + typeof param + " " + param + ").");
        }
    } else if (isRequired) {
        errors.push("Must specify a " + paramName + "parameter.");
    }

    return errors;
};

obj.getLatitudeValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (obj.isValidLatitudeNumber(param) === false) {
            errors.push("The " + paramName + " field should be a valid number between -90 and 90, inclusive (you gave " + typeof param + " " + param + ").");
        }
    } else if (isRequired) {
        errors.push("Must specify a " + paramName + " field.");
    }
    return errors;
};

obj.getLongitudeValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (obj.isValidLongitudeNumber(param) === false) {
            errors.push("The " + paramName + " field should be a valid number between -180 and 180, inclusive (you gave " + typeof param + " " + param + ").");
        }
    } else if (isRequired) {
        errors.push("Must specify a " + paramName + " field.");
    }
    return errors;
};

obj.getAltitudeValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (typeof param !== "number" || param < 0) {
            errors.push("The " + paramName + " parameter must be a number no less than 0 (you gave " + typeof param + " " + param + ").");
        }
    } else if (isRequired) {
        errors.push("Must specify a " + paramName + " parameter.");
    }
    return errors;
};



module.exports = obj;
