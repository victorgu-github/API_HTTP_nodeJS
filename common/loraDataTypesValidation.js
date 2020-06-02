// This file contains individual LoRa data type validation functions which are called
// (and should be called) by various other web services that need various LoRa data
// type validation.
// Put any LoRaWAN protocol-related data type validation in this file.

let consts = require("../config/constants.js");
let dataValidation = require("./dataValidation.js");
let dataFormat = require("./dataFormat.js");

let obj = {};

// ----------------------------------------------------------------------------------------------------------------
// -------------------------------------------- LoRa Data Types ---------------------------------------------------
// ----------------------------------------------------------------------------------------------------------------

// 'class' is a reserved keyword in JavaScript, so we use 'classField' here instead
obj.getClassValidation = function(classField, isRequired) {
    let errors = [];
    if (classField === undefined) {
        if (isRequired) { errors.push("Must provide 'Class' field containing a valid integer between 1 and 2, inclusive"); }
    } else {
        if (Number.isInteger(classField) === false || classField < 1 || classField > 2)
            errors.push("'Class' field must contain a valid integer between 1 and 2, inclusive (you gave " +
                classField + ")");
    }
    return errors;
};

obj.getAppEuiValidation = function(appEUI, isRequired) {
    let errors = [];
    if (appEUI === undefined) {
        if (isRequired) { errors.push("Must provide 'AppEUI' field containing a valid 16-character hex string"); }
    } else {
        if (dataValidation.isValidHexString(appEUI, 16) === false)
            errors.push("'AppEUI' field must contain a valid 16-character hex string (you gave " + appEUI + ")");
    }
    return errors;
};

obj.getDevEuiValidation = function(DevEUI, isRequired) {
    let errors = [];
    if (DevEUI === undefined) {
        if (isRequired) { errors.push("Must provide 'DevEUI' field containing a valid 16-character hex string"); }
    } else {
        if (dataValidation.isValidHexString(DevEUI, 16) === false)
            errors.push("'DevEUI' field must contain a valid 16-character hex string (you gave " + DevEUI +")");
    }
    return errors;
};

// This function takes as arguments:
//   1) the parameter being tested (e.g.: req.query.applicationID)
//   2) the exact name of the parameter (e.g.: "applicationID")
//   3) a boolean specifying whether the parameter is required or optional
//   4) a boolean specifying whether multiple such parameters can be passed in a comma-separated
//      string (e.g.: applicationID=1,8,9)
obj.getApplicationIdValidation = function(appID, paramName, isRequired, multipleAllowed) {
    if (paramName === undefined || isRequired === undefined || multipleAllowed === undefined)
        throw new Error("'getApplicationIdValidation' function requires the following 4 parameters: " +
                        "[ appID (string), paramName (string), isRequired (boolean), multipleAllowed (boolean) ]");
    let errors = [];
    let criteriaMsg = "an integer string between 0 and 9,007,199,254,740,991, inclusive";
    let multipleMsg = multipleAllowed ? ", or a comma-separated list thereof" : "";

    if (appID === undefined) {
        if (isRequired === true) {
            errors.push("Must provide '" + paramName + "' parameter containing " + criteriaMsg + multipleMsg);
        }
    } else {
        if (multipleAllowed) {
            let appIDs = appID.split(",");
            for (let i in appIDs) {
                if (/^[0-9]+$/.test(appIDs[i]) === false || typeof appID !== "string" ||
                    appIDs[i] < 0 || appIDs[i] > 9007199254740991) {
                    errors.push("'" + paramName + "' parameter must contain " + criteriaMsg + multipleMsg +
                                " (you gave " + (typeof appIDs[i]) + " " + appIDs[i] + ")");
                }
            }
        } else {
            if (/^[0-9]+$/.test(appID) === false || typeof appID !== "string" ||
                appID < 0 || appID > 9007199254740991) {
                errors.push("'" + paramName + "' parameter must contain " + criteriaMsg + multipleMsg +
                            " (you gave " + (typeof appID) + " " + appID + ")");
            }
        }
    }

    return errors;
};

obj.getUrlDevEuiValidation = function(devEUIs, paramName, isRequired, multipleAllowed) {
    // Note: This function's logic is flawed, but it hasn't been a problem so far
    // because we've always allowed multiple DevEUIs when using this function. But
    // come the day that we want to restrict it to only allowing a single DevEUI,
    // we'll need to insert an if statement below to check the 'multipleAllowed'
    // argument, and validate the input accordingly.
    let errors = [];
    let criteriaMsg = "a 16 digit hexadecimal string";
    let multipleMsg = multipleAllowed ? ", or a comma-separated list thereof" : "";

    if (devEUIs === undefined) {
        if (isRequired === true) {
            errors.push("Must provide '" + paramName + "' parameter containing " + criteriaMsg + multipleMsg);
        }
    } else {
        errors = dataValidation.getDevEuiArrValidation(devEUIs);
    }

    return errors;
};

obj.getUrlDurationValidation = function(duration, paramName, isRequired, multipleAllowed, lowThreshold, highThreshold) {
    let errors = [];
    let criteriaMsg = "an integer between " + lowThreshold + " and " + highThreshold + ", inclusive";
    let multipleMsg = multipleAllowed ? ", or a comma-separated list thereof" : "";

    if (duration === undefined) {
        if (isRequired === true) {
            errors.push("Must provide '" + paramName + "' parameter containing " + criteriaMsg + multipleMsg);
        }
    } else {
        if (multipleAllowed) {
            let durations = duration.split(",");
            for (let i in durations) {
                if (/^\d+$/.test(durations[i]) === false || durations[i] < lowThreshold || durations[i] > highThreshold) {
                    errors.push("'" + paramName + "' parameter must contain " + criteriaMsg + multipleMsg +
                                " (you gave " + durations[i] + ")");
                }
            }
        } else {
            if (/^\d+$/.test(duration) === false || duration < lowThreshold || duration > highThreshold) {
                errors.push("'" + paramName + "' parameter must contain " + criteriaMsg + multipleMsg +
                            " (you gave " + duration + ")");
            }
        }
    }

    return errors;
};

// This function requires to be passed all of the records inside the "device_info" collection
obj.getDevTypeValidation = function(devType, deviceInfos, isRequired) {
    let errors = [];
    let validTypes = dataFormat.getValidDevTypes(deviceInfos);
    if (devType === undefined) {
        if (isRequired) {
            let msg = "Must provide 'DevType' field containing one of the following strings: [ ";
            for (let i in validTypes) {
                msg += validTypes[i] + ((i < (validTypes.length - 1)) ? ", " : "");
            }
            errors.push(msg + " ]");
        }
    } else {
        if (validTypes.includes(devType) === false) {
            let msg = "'DevType' field must contain one of the following strings: [ ";
            for (let i in validTypes) {
                msg += validTypes[i] + ((i < (validTypes.length - 1)) ? ", " : "");
            }
            errors.push(msg + " ] (you gave " + devType + ")");
        }
    }
    return errors;
};

obj.getQueryStrDevTypeValidation = function(devType, deviceInfos, isRequired) {
    let errors = [];
    let validDevTypes = dataFormat.getValidDevTypes(deviceInfos);

    if (devType === undefined) {
        if (isRequired === true) {
            let msg = "Must provide 'devType' query parameter containing one of the following strings: [ ";
            for (let i in validDevTypes) {
                msg += validDevTypes[i] + ((i < (validDevTypes.length - 1)) ? ", " : "");
            }
            errors.push(msg + " ]");
        }
    } else {
        if (validDevTypes.includes(devType) === false) {
            let msg = "The 'devType' query parameter must contain one of the following strings: [ ";
            for (let i in validDevTypes) {
                msg += validDevTypes[i] + ((i < (validDevTypes.length - 1)) ? ", " : "");
            }
            errors.push(msg + " ] (you gave " + devType + ")");
        }
    }

    return errors;
};

obj.getSubTypeValidation = function(devType, subType, deviceInfos) {
    let errors = [];
    let validSubTypesMap = dataFormat.getValidSubTypesMap(deviceInfos);
    if (subType !== undefined) {
        // Condition 2: devType exist, if you want to change device sub type, must provide device type at first
        if (devType !== undefined) {
            // Condition 3: devType valid, invalid devType will throw error message
            if (validSubTypesMap[devType] !== undefined) {
                // Condition 4: devType has valid sub type according to device info
                if (validSubTypesMap[devType] !== null && validSubTypesMap[devType].length !== 0) {
                    // Condition 5: devType doesn't include subType and subType !== "",
                    // Note: empty string "" is an exception here, it can be assign to any valid device type
                    if (!validSubTypesMap[devType].includes(subType) && subType !== "") {
                        let msg = "'SubType' field must contain one of the following strings: [ ";
                        for (let i in validSubTypesMap[devType]) {
                            msg += validSubTypesMap[devType][i] + ((i < (validSubTypesMap[devType].length - 1)) ? ", " : " ]");
                        }
                        errors.push(msg);
                    }
                } else if (subType !== "") {
                    errors.push("This device type doesn't support a 'SubType'; only acceptable input is empty string");
                }
            } else {
                errors.push("This device type is invalid; you cannot assign it a 'SubType'");
            }
        } else {
            errors.push("Must provide 'DevType' field when changing 'SubType'");
        }
    }
    return errors;
};

obj.getBandIdValidation = function(bandID, isRequired) {
    let errors = [];
    if (bandID === undefined) {
        if (isRequired)
            errors.push("Must provide a valid 'BandID' field containing a valid integer between 0 and 3, inclusive");
    } else {
        if (Number.isInteger(bandID) === false || bandID < 0 || bandID > 3)
            errors.push("'BandID' field must contain a valid integer between 0 and 3, inclusive (you gave " + bandID + ")");
    }
    return errors;
};

// This function can be used by any function that needs LoRa BandID validation. It
// requires an array of valid bandIDs to be passed to the function in the "validBandIDs"
// argument. This means you will have to query the database first, then call this
// function in the callback of your DB operation.
obj.getDynamicBandIdValidation = function(paramName, bandID, validBandIDs) {
    if (validBandIDs === undefined || Array.isArray(validBandIDs) === false)
        throw new Error("getDynamicBandIdValidation function requires 3 arguments: paramName (string), bandID (number), validBandIDs (array of numbers)");
    let errors = [];
    if (typeof bandID !== "number" || dataValidation.isInteger(bandID) === false ||
        validBandIDs.includes(bandID) === false)
        errors.push("'" + paramName + "' parameter must contain one of the following integers: " +
                    (validBandIDs + "").replace(/,/g, ", ") + " (you gave " +
                    (typeof bandID) + " " + bandID + ")");
    return errors;
};

obj.getFreqValidation = function(bandID, freq, isRequired) {
    let errors = [];
    let freqLowerLimit = consts.loraDevice.freqClassBC.lowerLimit[bandID + ""];
    let freqUpperLimit = consts.loraDevice.freqClassBC.upperLimit[bandID + ""];
    if (freq === undefined) {
        if (isRequired) {
            let msg = "Must provide 'Freq' field containing a valid number between " +
                freqLowerLimit + " and " + freqUpperLimit + ", inclusive";
            msg = addToFreqMessage(msg, bandID, freqLowerLimit);
            errors.push(msg);
        }
    } else {
        if (isNaN(freq) === true || typeof freq !== "number" ||
            freq < freqLowerLimit || freq > freqUpperLimit ||
            (consts.loraDevice.freqClassBC.discrete[bandID + ""] && isValidDiscreteFreq(freq, bandID, freqLowerLimit, freqUpperLimit) === false)) {
            let msg = "'Freq' field must contain a valid number between " + freqLowerLimit + " and " +
                freqUpperLimit + ", inclusive";
            msg = addToFreqMessage(msg, bandID, freqLowerLimit);
            msg += " (you entered " + freq + ")";
            errors.push(msg);
        }
    }
    return errors;
};

function addToFreqMessage(msg, bandID, freqLowerLimit) {
    let addInfo = "";
    if (consts.loraDevice.freqClassBC.discrete[bandID + ""]) {
        let increment = consts.loraDevice.freqClassBC.discreteIncrement[bandID + ""];
        addInfo = ", in " + increment + " increments (e.g.: " + freqLowerLimit + ")";
    }
    return msg + addInfo;
}

function isValidDiscreteFreq(inputFreq, bandID, freqLowerLimit, freqUpperLimit) {
    let increment = consts.loraDevice.freqClassBC.discreteIncrement[bandID + ""];
    let isValid = false;
    for (let freqItr = freqLowerLimit; freqItr <= freqUpperLimit; freqItr = parseFloat((freqItr + increment).toFixed(1))) {
        if (inputFreq === freqItr) {
            isValid = true;
        }
    }
    return isValid;
}

obj.getDrValidation = function(bandID, dr, isRequired) {
    let errors = [];
    let drClassBcLowerLimit = consts.loraDevice.drClassBC.lowerLimit[bandID + ""];
    let drClassBcUpperLimit = consts.loraDevice.drClassBC.upperLimit[bandID + ""];
    if (dr === undefined) {
        if (isRequired) {
            errors.push("Must provide 'Dr' field containing a valid integer between " + drClassBcLowerLimit + " and "
                + drClassBcUpperLimit + " (inclusive) for a BandID value of " + bandID);
        }
    } else {
        if (Number.isInteger(dr) === false || dr < drClassBcLowerLimit || dr > drClassBcUpperLimit) {
            errors.push("'Dr' field must contain a valid integer between " + drClassBcLowerLimit + " and "
                + drClassBcUpperLimit + " (inclusive) for a BandID value of " + bandID + " (you entered " +
                dr + ")");
        }
    }
    return errors;
};

obj.getFCntDownValidation = function(fCntDown, isRequired) {
    let errors = [];
    if (fCntDown === undefined) {
        if (isRequired)
            errors.push("Must provide a valid 'FCntDown' field containing a valid integer between 0 and 3, inclusive");
    } else {
        if (typeof fCntDown !== "number" || Number.isInteger(fCntDown) === false || fCntDown < 0 || fCntDown > 4294967295)
            errors.push("'FCntDown' field must contain a valid integer between 0 and 4,294,967,295, inclusive (you gave " +
                fCntDown + ")");
    }
    return errors;
};

obj.getTxPowerValidation = function(bandID, txPower, isRequired) {
    let errors = [];
    let txPowerLowerLimit = consts.loraDevice.txPower.lowerLimit[bandID + ""];
    let txPowerUpperLimit = consts.loraDevice.txPower.upperLimit[bandID + ""];
    if (txPower === undefined) {
        if (isRequired) {
            errors.push("Must provide 'txPower' field containing a valid integer between " + txPowerLowerLimit + " and "
                + txPowerUpperLimit + " (inclusive) for a BandID value of " + bandID);
        }
    } else {
        if (Number.isInteger(txPower) === false || txPower < txPowerLowerLimit || txPower > txPowerUpperLimit) {
            errors.push("'txPower' field must contain a valid integer between " + txPowerLowerLimit + " and "
                + txPowerUpperLimit + " (inclusive) for a BandID value of " + bandID + " (you entered " +
                txPower + ")");
        }
    }
    return errors;
};

obj.getMulticastAddrValidation = function(multicastAddr, isRequired) {
    let errors = [];
    if (multicastAddr === undefined) {
        if (isRequired)
            errors.push("Must provide a valid 'MulticastAddr' field containing a valid 8-character hex string");
    } else {
        if (dataValidation.isValidHexString(multicastAddr, 8) === false)
            errors.push("'MulticastAddr' field must contain a valid 8-character hex string (you gave " +
                multicastAddr + ")");
    }
    return errors;
};

obj.getNwkSKeyValidation = function(nwkSKey, isRequired) {
    let errors = [];
    if (nwkSKey === undefined) {
        if (isRequired)
            errors.push("Must provide a valid 'NwkSKey' field containing a valid 32-character hex string");
    } else {
        if (dataValidation.isValidHexString(nwkSKey, 32) === false)
            errors.push("'NwkSKey' field must contain a valid 32-character hex string (you gave " + nwkSKey + ")");
    }
    return errors;
};

obj.getAppSKeyValidation = function(appSKey, isRequired) {
    let errors = [];
    if (appSKey === undefined) {
        if (isRequired)
            errors.push("Must provide a valid 'AppSKey' field containing a valid 32-character hex string");
    } else {
        if (dataValidation.isValidHexString(appSKey, 32) === false)
            errors.push("'AppSKey' field must contain a valid 32-character hex string (you gave " + appSKey + ")");
    }
    return errors;
};

obj.getNameValidation = function(name, isRequired) {
    let errors = [];
    if (name === undefined) {
        if (isRequired)
            errors.push("Must provide a valid 'Name' field containing a valid string");
    } else {
        if (typeof name !== "string")
            errors.push("'Name' field must contain string (you gave " + name + ")");
    }
    return errors;
};

obj.getDescriptionValidation = function(description, isRequired) {
    let errors = [];
    if (description === undefined) {
        if (isRequired)
            errors.push("Must provide a valid 'Description' field containing a valid string");
    } else {
        if (typeof description !== "string")
            errors.push("'Description' field must contain string (you gave " + description + ")");
    }
    return errors;
};

obj.getPingNbClassBValidation = function(pingNbClassB, isRequired) {
    let errors = [];
    let pingNbClassBRange = consts.loraDevice.pingNbClassB;
    if (pingNbClassB === undefined) {
        if (isRequired)
            errors.push("Must provide a valid 'PingNbClassB' field containing a valid integer");
    } else {
        if (typeof pingNbClassB !== "number" || !pingNbClassBRange.includes(pingNbClassB))
            errors.push("PingNbClassB must be a valid integer, included in the range  [1,2,4,8,16,32,64,128]");
    }
    return errors;
};

obj.getPingOffsetClassBValidation = function(pingNbClassB, pingOffsetClassB, isRequired) {
    let errors = [];
    if (pingOffsetClassB === undefined) {
        if (isRequired)
            errors.push("Must provide a valid 'PingOffsetClassB' field containing a valid integer");
    } else {
        if (typeof pingOffsetClassB !== "number" || (pingOffsetClassB < 0 || pingOffsetClassB > 4096 / pingNbClassB - 1))
            errors.push("PingOffsetClassB must be a valid integer, in the range 0 ~ (4096 / PingNbClassB - 1), inclusive, current PingNbClassB is: " + pingNbClassB);
    }
    return errors;
};

obj.getConfirmedValidation = function(confirmed, isRequired) {
    let errors = [];
    if (confirmed === undefined) {
        if (isRequired)
            errors.push("Must provide a valid 'Confirmed' field containing a valid number, 0 or 1");
    } else {
        if (typeof confirmed !== "number" || (confirmed !== 0 && confirmed !== 1))
            errors.push("Confirmed must be a valid number, 0 or 1");
    }
    return errors;
};

obj.getFPortValidation = function(fport, isRequired) {
    let errors = [];
    if (fport === undefined) {
        if (isRequired)
            errors.push("Must provide a valid 'FPort' field containing a valid integer");
    } else {
        if (typeof fport !== "number" || fport < 1 || fport > 223)
            errors.push("fport must be a valid integer, value between 1 - 223, inclusive");
    }
    return errors;
};

obj.getEncryptedMacCmdsValidation = function(encryptedMacCmds, isRequired) {
    let errors = [];
    if (encryptedMacCmds === undefined) {
        if (isRequired)
            errors.push("Must provide a valid 'EncryptedMacCmds' field containing a valid string");
    } else {
        if (typeof encryptedMacCmds !== "string")
            errors.push("EncryptedMacCmds must be a valid string");
    }
    return errors;
};

obj.getUnencryptedMacCmdsValidation = function(unEncryptedMacCmds, isRequired) {
    let errors = [];
    if (unEncryptedMacCmds === undefined) {
        if (isRequired)
            errors.push("Must provide a valid 'UnencryptedMacCmds' field containing a valid string");
    } else {
        if (typeof unEncryptedMacCmds !== "string")
            errors.push("UnencryptedMacCmds must be a valid string");
    }
    return errors;
};

obj.getUserPayloadDataValidation = function(userPayload, isRequired) {
    let errors = [];
    if (userPayload === undefined) {
        if (isRequired)
            errors.push("Must provide a valid 'UserPayload' field containing a valid string");
    } else {
        let payloadLen = userPayload.length;
        if (dataValidation.isValidHexString(userPayload, payloadLen) === false || payloadLen % 2 === 1 ||
            payloadLen > consts.loraDevice.maxUserPayloadDataLenInChars) {
            let msg = "UserPayloadData must be a hex string of even length, shorter than 484 digits (you gave " +
                (typeof userPayload) + " " + userPayload;
            if (payloadLen !== undefined)
                msg += ", length " + payloadLen + ")";
            else
                msg += ")";
            errors.push(msg);
        }
    }
    return errors;
};

obj.getUrlAbpOtaaModeValidation = function(mode, paramName, isRequired) {
    let errors = [];
    let criteriaMsg = "either 'ABP' or 'OTAA' (case insensitive)";

    if (mode === undefined) {
        if (isRequired === true) {
            errors.push("Must provide '" + paramName + "' parameter containing " + criteriaMsg);
        }
    } else {
        if (mode.toUpperCase() !== "ABP" && mode.toUpperCase() !== "OTAA") {
            errors.push("'" + paramName + "' parameter must contain " + criteriaMsg + " (you gave " + mode + ")");
        }
    }

    return errors;
};

obj.getUrlMulticastAddrValidation = function(multicastAddr, paramName, isRequired) {
    let errors = [];
    let criteriaMsg = "a valid 8-character hex string";

    if (multicastAddr === undefined) {
        if (isRequired === true) {
            errors.push("Must provide '" + paramName + "' parameter containing " + criteriaMsg);
        }
    } else {
        if (dataValidation.isValidHexString(multicastAddr, 8) === false) {
            errors.push("'" + paramName + "' parameter must contain " + criteriaMsg + " (you gave " + multicastAddr + ")");
        }
    }

    return errors;
};

// ----------------------------- MANUFACTURING SETTINGS VALIDATION ---------------------------------
obj.getUrlNumDevicesValidation = function(numDevices, paramName, isRequired) {
    let errors = [];
    let criteriaMsg = "an integer between 1 and 10,000, inclusive";

    if (numDevices === undefined) {
        if (isRequired === true) {
            errors.push("Must provide '" + paramName + "' parameter containing " + criteriaMsg);
        }
    } else {
        if (/^\d+$/.test(numDevices) === false || numDevices < 1 || numDevices > 10000) {
            errors.push("'" + paramName + "' parameter must contain " + criteriaMsg + " (you gave " + numDevices + ")");
        }
    }

    return errors;
};

obj.getNamePrefixValidation = function(namePrefix, paramName, isRequired) {
    let errors = [];
    let criteriaMsg = "a valid string";

    if (namePrefix === undefined) {
        if (isRequired === true) {
            errors.push("Must provide '" + paramName + "' parameter containing " + criteriaMsg);
        }
    } // No other validation b/c query string parameters will always be strings, and that's our
      // only other criteria

    return errors;
};

obj.getStartNumValidation = function(startNum, paramName, numDevices, isRequired) {
    let errors = [];
    let criteriaMsg = "an integer between 0 and 9,999, inclusive";

    if (startNum === undefined) {
        if (isRequired === true) {
            errors.push("Must provide '" + paramName + "' parameter containing " + criteriaMsg);
        }
    } else {
        if (/^\d+$/.test(startNum) === false || startNum < 0 || startNum > 9999) {
            errors.push("'" + paramName + "' parameter must contain " + criteriaMsg + " (you gave " +
                        dataFormat.intWithThousandsSeparator(startNum) + ")");
        }
        let sum = (Number.parseInt(startNum) + Number.parseInt(numDevices));
        if (numDevices !== undefined && sum > 10000) {
            errors.push("startNum and numDevices must add up to a number less than or equal to 10,000 " +
                        "(yours add up to " + dataFormat.intWithThousandsSeparator(sum) + ")");
        }
    }

    return errors;
};

module.exports = obj;
