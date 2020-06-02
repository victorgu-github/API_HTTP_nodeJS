// This file contains route-specific validation functions that should instead live
// in their route function files, as they aren't generic enough to be reused by any
// other web services.
// For the time being, though, we will leave this file here as moving it to its
// correct location is not of high importance.

let dataValidation = require("./dataValidation.js");
let consts = require("../config/constants.js");
let loraDataValidation = require("./loraDataTypesValidation.js");
let dataFormat = reqFile("./common/dataFormat.js");

let obj = {};

// ---------------------------- GATEWAY SERVER NODE SESSIONS ------------------------------------

// LoRa device validation is broken up into 3 cascading stages:
//   1) Are all required fields defined?
//   2) Are all defined fields valid?
//   3) Are there any duplicate DevEUIs?
obj.validateLoRaDeviceInput = function(body, operationType, nodesFound) {
    let DeviceInfo = require("../models/lora/deviceInfo.js")();
    // This call is used to get an array of valid device types for later
    return DeviceInfo.find().then((deviceInfos) => {
        deviceInfos = JSON.parse(JSON.stringify(deviceInfos));
        let validDevTypes = [];
        let validSubTypesMap = {};
        validDevTypes = dataFormat.getValidDevTypes(deviceInfos);
        validSubTypesMap = dataFormat.getValidSubTypesMap(deviceInfos);
        // Check that every required field is defined
        let undefinedErrors = checkThatRequiredFieldsAreDefined(body, operationType);
        if (Object.keys(undefinedErrors).length !== 0) {
            return {
                type:   "undefinedErrors",
                errors: undefinedErrors
            };
        } else {
            // Check that all defined fields are valid (data type, value range, etc.)
            let invalidErrors = checkThatDefinedFieldsAreValid(body, operationType, validDevTypes, validSubTypesMap, nodesFound);
            if (Object.keys(invalidErrors).length !== 0) {
                return {
                    type:   "invalidErrors",
                    errors: invalidErrors
                };
            } else {
                // Lastly, check for duplicate DevEUIs
                let duplicateErrors = [];
                let inputDevEUIs = [];
                for (let i in body.uniqueValues) {
                    if (inputDevEUIs.includes(body.uniqueValues[i].DevEUI)) {
                        duplicateErrors.push("Duplicate DevEUI found (" + body.uniqueValues[i].DevEUI
                                             + "). Please ensure all DevEUI values are unique");
                    }
                    inputDevEUIs.push(body.uniqueValues[i].DevEUI);
                }
                if (Object.keys(duplicateErrors).length !== 0) {
                    return {
                        type:   "duplicateErrors",
                        errors: duplicateErrors
                    };
                } else {
                    return null;
                }
            }
        }
    });
};

function checkThatRequiredFieldsAreDefined(body, operationType) {
    let errors = [];

    // This is the only required field that is common to both "save" and "update"
    // operations.
    errors = errors.concat(loraDataValidation.getApplicationIdValidation(body.ApplicationID, "ApplicationID", true, false));

    if (operationType === "save") {
        if (body.uniqueValues === undefined ||
            (body.uniqueValues !== undefined && body.uniqueValues.length === 0) ||
            (body.uniqueValues !== undefined && body.uniqueValues.length > 500)) {
            errors.push("The 'uniqueValues' field must contain an array of length between 1 and 500. " +
                        "See documentation for more info.");
        } else {
            // Given that the request could contain up to 500 elements in the "uniqueValues" array,
            // we only want to display an error message once for a given field in every element
            // (otherwise you would get N duplicate error messages for N devices, etc.).
            let appKeyMsgDisplayed = false;
            let appEuiMsgDisplayed = false;
            let devAddrMsgDisplayed = false;
            let nwkSKeyMsgDisplayed = false;
            let appSKeyMsgDisplayed = false;
            let nameMsgDisplayed = false;

            for (let i in body.uniqueValues) {
                let elem = body.uniqueValues[i];
                if (elem.DevEUI === undefined)
                    errors.push("A valid DevEUI is required");
                // devAddr is only required in ABP mode
                if (body.ABP !== undefined && body.ABP === true) { // ------------------ I.e.: ABP mode:
                    if (elem.DevAddr === undefined && devAddrMsgDisplayed === false) {
                        errors.push("A valid DevAddr is required for ABP mode");
                        devAddrMsgDisplayed = true;
                    }
                    // The following fields aren't allowed to be set in ABP mode:
                    //   - AppKey
                    //   - AppEUI
                    if (elem.AppKey !== undefined && appKeyMsgDisplayed === false) {
                        errors.push("Cannot set AppKey field in ABP mode");
                        appKeyMsgDisplayed = true;
                    }
                    if (elem.AppEUI !== undefined && appEuiMsgDisplayed === false) {
                        errors.push("Cannot set AppEUI field in ABP mode");
                        appEuiMsgDisplayed = true;
                    }
                } else if (body.ABP !== undefined && body.ABP === false) { // ---------- I.e.: OTAA mode:
                    // The following fields aren't allowed to be set in OTAA mode:
                    //   - DevAddr
                    //   - NwkSKey
                    //   - AppSKey
                    if (elem.DevAddr !== undefined && devAddrMsgDisplayed === false) {
                        errors.push("Cannot set DevAddr field in OTAA mode");
                        devAddrMsgDisplayed = true;
                    }
                    if (elem.NwkSKey !== undefined && nwkSKeyMsgDisplayed === false) {
                        errors.push("Cannot set NwkSKey field in OTAA mode");
                        nwkSKeyMsgDisplayed = true;
                    }
                    if (elem.AppSKey !== undefined && appSKeyMsgDisplayed === false) {
                        errors.push("Cannot set AppSKey field in OTAA mode");
                        appSKeyMsgDisplayed = true;
                    }
                }
                if (elem.Name === undefined && nameMsgDisplayed === false) {
                    errors.push("A valid 'Name' is required for every element in the 'uniqueValues' array");
                    nameMsgDisplayed = true;
                }
                    
            }
        }
        
        if (body.DevType === undefined) errors.push("A valid DevType is required");
        if (body.BandID === undefined)  errors.push("A valid BandID is required");
        if (body.Class === undefined)   errors.push("A valid Class is required");
        if (body.ABP === undefined)     errors.push("A valid ABP is required");
    } else if (operationType === "update") {
        if (body.DevEUI === undefined)
            errors.push("A valid DevEUI is required");
    }

    return errors;
}

// This function checks each field for validity and fails the test if the data does meet
// the validation criteria.
function checkThatDefinedFieldsAreValid(body, operationType, validDevTypes, validSubTypesMap, nodesFound) {
    let errors = [];

    if (operationType === "save") {
        for (let i in body.uniqueValues) {
            let elem = body.uniqueValues[i];
            if (dataValidation.isValidHexString(elem.DevEUI, 16) === false)
                errors.push("DevEUI must be a valid 16-character hex string (you gave " + elem.DevEUI + ")");
            // DevAddr is only required in ABP mode
            if (body.ABP === true)
                if (dataValidation.isValidHexString(elem.DevAddr, 8) === false) {
                    errors.push("DevAddr must be a valid 8-character hex string (you gave " + elem.DevAddr + ")");
                }
            // Next, because name and description are optional, we need to first check if
            // they are defined before validating their type.
            if (elem.Name !== undefined)
                if (typeof elem.Name !== "string")
                    errors.push("Name must be of type string (you gave " + elem.Name + ")");
            if (elem.Description !== undefined)
                if (typeof elem.Description !== "string")
                    errors.push("Description must be of type string (you gave " + elem.Description + ")");

            if (elem.NwkSKey !== undefined)
                if (dataValidation.isValidHexString(elem.NwkSKey, 32) === false)
                    errors.push("NwkSKey must be a valid 32-character hex string (you gave " + elem.NwkSKey +")");
            if (elem.AppSKey !== undefined)
                if (dataValidation.isValidHexString(elem.AppSKey, 32) === false)
                    errors.push("AppSKey must be a valid 32-character hex string (you gave " + elem.AppSKey +")");
            if (elem.AppKey !== undefined)
                if (dataValidation.isValidHexString(elem.AppKey, 32) === false)
                    errors.push("AppKey must be a valid 32-character hex string (you gave " + elem.AppKey +")");
            if (elem.AppEUI !== undefined)
                if (dataValidation.isValidHexString(elem.AppEUI, 16) === false)
                    errors.push("AppEUI must be a valid 16-character hex string (you gave " + elem.AppEUI +")");

            //Validate elem.RefAlt, elem.RefLat and elem.RefLon
            //1.elem.RefAlt could be: undefined, null, number
            //2.elem.RefLat could be: undefined, null, valid number(between -90 ~ 90)
            //3.elem.RefLon could be: undefined, null, valid number(between -180 ~ 180)
            if (elem.RefAlt !== undefined) {
                if (elem.RefAlt !== null && typeof elem.RefAlt !== "number") {
                    errors.push("elem.RefAlt must be a number or null (you gave " + elem.RefAlt + ")");
                }
            }
            if (elem.RefLat !== undefined) {
                if (elem.RefLat !== null && typeof elem.RefLat !== "number" || elem.RefLat !== null && !dataValidation.validLatitude(elem.RefLat)) {
                    errors.push("elem.RefLat must be a valid number between -90 ~ 90 or null (you gave " + elem.RefLat + ")");
                }
            }
            if (elem.RefLon !== undefined) {
                if (elem.RefLon !== null && typeof elem.RefLon !== "number" || elem.RefLon !== null && !dataValidation.validLongitude(elem.RefLon)) {
                    errors.push("elem.RefLon must be a valid number between -180 ~ 180 or null (you gave " + elem.RefLon + ")");
                }
            }
        }
        
        if (body.ABP !== true && body.ABP !== false)
            errors.push("ABP must be true or false");
        
        if (body.MulticastAddrArray !== undefined && (body.Class === 1 || body.Class === 2)) {
            if (Array.isArray(body.MulticastAddrArray) === true) {
                if (body.MulticastAddrArray.length > 5) {
                    errors.push("MulticastAddrArray cannot contain more than 5 multicast addresses");
                } else {
                    for (let i in body.MulticastAddrArray) {
                        let elem = body.MulticastAddrArray[i];
                        if (dataValidation.isValidHexString(elem, 8) === false) {
                            errors.push("Each element in MulticastAddrArray must be a valid 8-character " +
                                        "hex string (you gave " + elem + ")");
                        }
                    }
                }
            } else {
                errors.push("MulticastAddrArray must be an array of 8-character hex strings");
            }
        }

        if (body.BandID !== undefined) {
            if (Number.isInteger(body.BandID) === false || body.BandID < 0 || body.BandID > 3 ||
                body.BandID === null)
                errors.push("BandID must be a valid integer between 0 and 3, inclusive");
        }
        if (body.Class !== undefined) {
            if (Number.isInteger(body.Class) === false || body.Class < 0 || body.Class > 2) {
                errors.push("Class must be a valid integer between 0 and 2, inclusive");
            }
        }
    }

    // Else, if any of the following fields are present in the request body, they will be
    // validated:
    if (body.DevType !== undefined) {
        if (validDevTypes.includes(body.DevType) === false ||
            body.DevType === null) {
            let msg = "DevType must be one of the following strings: [ ";
            for (let i in validDevTypes) {
                msg += validDevTypes[i] + ((i < (validDevTypes.length - 1)) ? ", " : "");
            }
            errors.push(msg + " ]");
        }
    }
    // Condition 1: body.SubType exist, body.SubType === undefined will pass this validation
    if (body.SubType !== undefined) {
        // Condition 2: body.DevType exist, if you want to change device sub type, must provide device type at first
        if (body.DevType !== undefined) {
            // Condition 3: body.DevType valid, invalid body.DevType will throw error message
            if (validSubTypesMap[body.DevType] !== undefined) {
                // Condition 4: body.DevType has valid sub type according to device info
                if (validSubTypesMap[body.DevType] !== null && validSubTypesMap[body.DevType].length !== 0) {
                    // Condition 5: body.DevType doesn't include body.SubType and body.SubType !== "",
                    // Note: empty string "" is an exception here, it can be assign to any valid device type
                    if (!validSubTypesMap[body.DevType].includes(body.SubType) && body.SubType !== "") {
                        let msg = "SubType must be one of the following strings: [ ";
                        for (let index in validSubTypesMap[body.DevType]) {
                            let validSubType = validSubTypesMap[body.DevType][index];
                            // Error message is made up by device info
                            // If validSubType is not the last one, add ", " after it
                            // If validSubType is the last one, add "" after it
                            msg += validSubType + ((index < (validSubTypesMap[body.DevType].length - 1)) ? ", " : "");
                        }
                        errors.push(msg + " ]");
                    }
                } else if (body.SubType !== "") {
                    errors.push("This device type doesn't have any sub type, empty string is only accepted");
                }
            } else {
                errors.push("This device type is invalid, you cannot assign any sub type");
            }
        } else {
            errors.push("Please provide device type before you change the sub type");
        }
    }

    if (operationType === "update") {
        if (dataValidation.isValidHexString(body.DevEUI, 16) === false)
            errors.push("DevEUI must be a valid 16-character hex string (you gave " + body.DevEUI + ")");
        if (body.Name !== undefined)
            if (typeof body.Name !== "string")
                errors.push("Name must be of type string (you gave " + body.Name + ")");
        if (body.Description !== undefined)
            if (typeof body.Description !== "string")
                errors.push("Description must be of type string (you gave " + body.Description + ")");
        if (body.MulticastAddrArray !== undefined && (nodesFound[0].Class === 1 || nodesFound[0].Class === 2)) {
            if (Array.isArray(body.MulticastAddrArray) === true) {
                if (body.MulticastAddrArray.length > consts.loraDevice.maxMCAddrArrayLen) {
                    errors.push("MulticastAddrArray cannot contain more than " + consts.loraDevice.maxMCAddrArrayLen +
                                " multicast addresses");
                } else {
                    for (let i in body.MulticastAddrArray) {
                        let elem = body.MulticastAddrArray[i];
                        if (dataValidation.isValidHexString(elem, 8) === false) {
                            errors.push("Each element in MulticastAddrArray must be a valid 8-character hex string" +
                                        "(you gave " + elem + ")");
                        }
                    }
                }
            } else {
                errors.push("MulticastAddrArray must be an array of 8-character hex strings");
            }
        }
        // Conditionally validate FreqClassBC and DrClassBC based on the node's BandID value:
        let bandID = nodesFound[0].BandID;
        let freq = body.FreqClassBC;
        if (freq !== undefined) {
            let freqLowerLimit = consts.loraDevice.freqClassBC.lowerLimit[bandID + ""];
            let freqUpperLimit = consts.loraDevice.freqClassBC.upperLimit[bandID + ""];
            if (isNaN(freq) === true || typeof freq !== "number" || freq < freqLowerLimit || freq > freqUpperLimit ||
                (consts.loraDevice.freqClassBC.discrete[bandID + ""] && isValidDiscreteFreq(freq, bandID, freqLowerLimit, freqUpperLimit) === false)) {
                let msg = "'FreqClassBC' field must contain a valid number between " + freqLowerLimit + " and " +
                    freqUpperLimit + ", inclusive";
                msg = addToFreqMessage(msg, bandID, freqLowerLimit);
                msg += " (you entered " + freq + ")";
                errors.push(msg);
            }
        }
        let dr = body.DrClassBC;
        if (dr !== undefined) {
            let drClassBcLowerLimit = consts.loraDevice.drClassBC.lowerLimit[bandID + ""];
            let drClassBcUpperLimit = consts.loraDevice.drClassBC.upperLimit[bandID + ""];
            if (Number.isInteger(dr) === false || dr < drClassBcLowerLimit || dr > drClassBcUpperLimit)
                errors.push("DrClassBC must be a valid integer between " + drClassBcLowerLimit + " and "
                            + drClassBcUpperLimit + " (inclusive) for a BandID value of " + bandID);
        }
        if (body.NwkSKey !== undefined)
            if (dataValidation.isValidHexString(body.NwkSKey, 32) === false)
                errors.push("NwkSKey must be a valid 32-character hex string (you gave " + body.NwkSKey +")");
        if (body.AppKey !== undefined)
            if (dataValidation.isValidHexString(body.AppKey, 32) === false)
                errors.push("AppKey must be a valid 32-character hex string (you gave " + body.AppKey +")");
        if (body.AppSKey !== undefined)
            if (dataValidation.isValidHexString(body.AppSKey, 32) === false)
                errors.push("AppSKey must be a valid 32-character hex string (you gave " + body.AppSKey +")");
        if (body.RelaxFCnt !== undefined)
            if (Number.isInteger(body.RelaxFCnt) === false ||
                body.RelaxFCnt < 0 || body.RelaxFCnt > 1)
                errors.push("RelaxFCnt must be either a 0 or 1");
        if (body.Rx1DROffset !== undefined)
            if (Number.isInteger(body.Rx1DROffset) === false ||
                body.Rx1DROffset < 0 || body.Rx1DROffset > 255)
                errors.push("Rx1DROffset must be a valid integer between 0 and 255, inclusive");
        if (body.RxDelay !== undefined)
            if (Number.isInteger(body.RxDelay) === false ||
                body.RxDelay < 0 || body.RxDelay > 1000)
                errors.push("RxDelay must be a valid integer between 0 and 1,000, inclusive");
        if (body.Rx2DR !== undefined)
            if (Number.isInteger(body.Rx2DR) === false ||
                body.Rx2DR < 0 || body.Rx2DR > 255)
                errors.push("Rx2DR must be a valid integer between 0 and 255, inclusive");
        if (body.FPort !== undefined)
            if (Number.isInteger(body.FPort) === false ||
                body.FPort < 1 || body.FPort > 223)
                errors.push("FPort must be a valid integer between 1 and 223, inclusive");
        if (body.ADRInterval !== undefined)
            if (Number.isInteger(body.ADRInterval) === false ||
                body.ADRInterval < 0 || body.ADRInterval > 4294967295)
                errors.push("ADRInterval must be a valid integer between 0 and 4,294,967,295, inclusive");
        if (body.InstallationMargin !== undefined)
            if (typeof body.InstallationMargin !== "number" ||
                body.InstallationMargin < 0 || body.InstallationMargin > 99)
                errors.push("InstallationMargin must be a valid integer between 0 and 99, inclusive");
        if (body.TxPower !== undefined)
            if (Number.isInteger(body.TxPower) === false ||
                body.TxPower < 0 || body.TxPower > 255)
                errors.push("TxPower must be a valid integer between 0 and 255, inclusive");
        if (body.NbTrans !== undefined)
            if (Number.isInteger(body.NbTrans) === false ||
                body.NbTrans < 0 || body.NbTrans > 255)
                errors.push("NbTrans must be a valid integer between 0 and 255, inclusive");
        if (body.PingNbClassB !== undefined)
            if (Number.isInteger(body.PingNbClassB) === false ||
                body.PingNbClassB < 2 || body.PingNbClassB > 128)
                errors.push("PingNbClassB must be a valid integer between 2 and 128, inclusive");
        if (body.RxWindowNumber !== undefined)
            if (Number.isInteger(body.RxWindowNumber) === false ||
                body.RxWindowNumber < 0 || body.RxWindowNumber > 255)
                errors.push("RxWindowNumber must be a valid integer between 0 and 255, inclusive");
        if (body.TimeoutInterval !== undefined)
            if (typeof body.TimeoutInterval !== "number" ||
                body.TimeoutInterval < 0 || body.TimeoutInterval > 999999)
                errors.push("TimeoutInterval must be a valid integer between 0 and 999,999, inclusive");
        if (body.UseAppSetting !== undefined)
            if (body.UseAppSetting !== true && body.UseAppSetting !== false)
                errors.push("UseAppSetting must be either true or false");
        if (body.DownlinkConfirmed !== undefined)
            if (body.DownlinkConfirmed !== true && body.DownlinkConfirmed !== false)
                errors.push("DownlinkConfirmed must be either true or false");

        if (body.FCntUp !== undefined)
            if (typeof body.FCntUp !== "number" || Number.isInteger(body.FCntUp) === false ||
                body.FCntUp < 0 || body.FCntUp > 4294967295)
                errors.push("FCntUp must be a valid integer between 0 and 4,294,967,295, inclusive");
        if (body.FCntDown !== undefined)
            if (typeof body.FCntDown !== "number" || Number.isInteger(body.FCntDown) === false ||
                body.FCntDown < 0 || body.FCntDown > 4294967295)
                errors.push("FCntDown must be a valid integer between 0 and 4,294,967,295, inclusive");
        if (body.EncryptedMacCmds !== undefined)
            if (typeof body.EncryptedMacCmds !== "string")
                errors.push("EncryptedMacCmds must be a valid string");
        if (body.UnencryptedMacCmds !== undefined)
            if (typeof body.UnencryptedMacCmds !== "string")
                errors.push("UnencryptedMacCmds must be a valid string");
        let payload = body.UserPayloadData;
        if (payload !== undefined) {
            let payloadLen = payload.length;
            if (dataValidation.isValidHexString(payload, payloadLen) === false || payloadLen % 2 === 1 ||
                payloadLen > consts.loraDevice.maxUserPayloadDataLenInChars) {
                let msg = "UserPayloadData must be a hex string of even length, shorter than 484 digits (you gave " +
                    (typeof payload) + " " + payload;
                if (payloadLen !== undefined)
                    msg += ", length " + payloadLen + ")";
                else
                    msg += ")";
                errors.push(msg);
            }
        }
        if (body.HasEncryptedMacCmdDelivered !== undefined)
            if (typeof body.HasEncryptedMacCmdDelivered !== "string" ||
                (body.HasEncryptedMacCmdDelivered !== "00" && body.HasEncryptedMacCmdDelivered !== "01"))
                errors.push("HasEncryptedMacCmdDelivered string must be either '00' or '01'");
        if (body.HasUnencryptedMacCmdDelivered !== undefined)
            if (typeof body.HasUnencryptedMacCmdDelivered !== "string" ||
                (body.HasUnencryptedMacCmdDelivered !== "00" && body.HasUnencryptedMacCmdDelivered !== "01"))
                errors.push("HasUnencryptedMacCmdDelivered string must be either '00' or '01'");
        if (body.HasUserPayloadDataDelivered !== undefined)
            if (typeof body.HasUserPayloadDataDelivered !== "string" ||
                (body.HasUserPayloadDataDelivered !== "00" && body.HasUserPayloadDataDelivered !== "01"))
                errors.push("HasUserPayloadDataDelivered string must be either '00' or '01'");
        
        //Validate body.RefAlt, body.RefLat and body.RefLon
        //1.body.RefAlt could be: undefined, null, number
        //2.body.RefLat could be: undefined, null, valid number(between -90 ~ 90)
        //3.body.RefLon could be: undefined, null, valid number(between -180 ~ 180)
        if (body.RefAlt !== undefined) {
            if (body.RefAlt !== null && typeof body.RefAlt !== "number") {
                errors.push("body.RefAlt must be a number or null (you gave " + body.RefAlt + ")");
            }
        }
        if (body.RefLat !== undefined) {
            if (body.RefLat !== null && typeof body.RefLat !== "number" || body.RefLat !== null && !dataValidation.validLatitude(body.RefLat)) {
                errors.push("body.RefLat must be a valid number between -90 ~ 90 or null (you gave " + body.RefLat + ")");
            }
        }
        if (body.RefLon !== undefined) {
            if (body.RefLon !== null && typeof body.RefLon !== "number" || body.RefLon !== null && !dataValidation.validLongitude(body.RefLon)) {
                errors.push("body.RefLon must be a valid number between -180 ~ 180 or null (you gave " + body.RefLon + ")");
            }
        }
    }

    return errors;
}

// Note: These below two functions are duplicaates, but they will get removed once we refactor
// LoRa device registration to use the new shared functions.
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

module.exports = obj;
