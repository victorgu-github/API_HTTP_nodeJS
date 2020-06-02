// This file is meant to contain any function which merely applies formatting to any
// of the Web API's various user input (e.g.: pad number strings with zeros, convert
// integers to float strings, etc.).
// Add any generic input formatting functions inside this file.

let dataFormat = {};
let userAccDefaultValue = require("../config/userAccDefaultValues.js");

dataFormat.padWithZerosToFixedLength = function(num, finalLen) {
    let output = "" + num;
    if (output.length == finalLen) {
        return output;
    } else if (output.length > finalLen) {
        // Keep the least-significant bits (LSB)
        let exceedsBy = output.length - finalLen;
        return output.substring(exceedsBy, output.length);
    } else {
        while (output.length < finalLen) {
            output = "0" + output;
        }
        return output;
    }
};
dataFormat.getMstTimeStr = function(date) {
    var nowArr = date.toLocaleString("en-US", { hour12: false, timeZoneName: "short" }).split(" ");
    var datePortion = nowArr[0].split("/");
    let month = (datePortion[0].length < 2) ? "0" + datePortion[0] : datePortion[0];
    let day = (datePortion[1].length < 2) ? "0" + datePortion[1] : datePortion[1];
    var nowMST = datePortion[2].substring(0, 4) + "-" + month + "-" + day;
    let ms = date.getMilliseconds().toString();
    while (ms.length < 3)
        ms = "0" + ms;
    nowMST += "T" + nowArr[1] + "." + ms + nowArr[2];
    return nowMST;
};

// ---------------------------- MISCELLANEOUS ---------------------------------------
// Different values will require different-sized float error strings due to the number of
// digits in the final string.
function getFloatErrorStr(input) {
    if (input < 100)           { return ".0000000000001"; }
    else if (input < 1000)     { return ".000000000001"; }
    else if (input < 10000)    { return ".00000000001"; } // No value currently goes beyond 9999, but just in case:
    else if (input < 100000)   { return ".0000000001"; }
    else if (input < 1000000)  { return ".000000001"; }
}

dataFormat.isFloat = function(input) {
    let inputStr = input + "";
    return (inputStr.includes(".") || inputStr.includes("e-")) ? true : false;
};

// This function's sole purpose is to add float error to the end of numbers that end in ".0"
// (i.e.: numbers which are susceptible to getting cast as integers by Mongoose)
dataFormat.makeFloatString = function(input) {
    if (parseFloat(input) - parseInt(input) === 0) {
        return parseFloat(input) + getFloatErrorStr(input);
    } else { // This number already has some non-zero decimal portion, so leave it be
        return input;
    }
};

// This function checks if the input is already a float. If it is, it ensures that its decimal
// portion isn't zero. Otherwise, if it's an integer we simply add a floating point error string
// to the end to force Mongoose to save it as a double.
dataFormat.enforceFloat = function(input) {
    if (dataFormat.isFloat(input)) {
        return dataFormat.makeFloatString(input);
    } else {
        return input + getFloatErrorStr(input);
    }
};

// -------------------- USER ACCOUNT REGISTRATION DATA PREP -----------------------
let defaultUserAccountScenarios = userAccDefaultValue.defaultUserAccountScenarios;

function formatUserAccountScenarios(Scenarios){
    let countForDefault = 0;
    for (let i = 0; i < Scenarios.length; i++){
        if (Scenarios[i].default === true){
            countForDefault++;
        }
    }

    //If there is no default scenario or default scenarios are more than 1, then insert 
    //our defined default scenario
    if (countForDefault !== 1){
        for (let i = 0; i < Scenarios.length; i++){
            Scenarios[i].default = false;
        }
        Scenarios.unshift(defaultUserAccountScenarios[0]);
    } else {
        for (let i = 0; i < Scenarios.length; i++){
            if (Scenarios[i].id !== null && Scenarios[i].id !== undefined){
                Scenarios[i].id = Number(Scenarios[i].id);
            } else {
                Scenarios[i].id = defaultUserAccountScenarios[0].id;
            }
            //if Scenarios[i].bleAppID === (Number, String, Boolean), accept and change its type to string and store it
            //if Scenarios[i].bleAppID === null, accept and store it as null
            //if Scenarios[i].bleAppID === undefined, accept and store it as null
            if (Scenarios[i].bleAppID !== null && Scenarios[i].bleAppID !== undefined) {
                Scenarios[i].bleAppID = String(Scenarios[i].bleAppID);
            } else if (Scenarios[i].bleAppID === undefined) {
                Scenarios[i].bleAppID = null;
            }

            //if Scenarios[i].bleAppID === (Number, String, Boolean), accept and change its type to string and store it
            //if Scenarios[i].bleAppID === null, accept and store it as null
            //if Scenarios[i].bleAppID === undefined, accept and store it as null
            if (Scenarios[i].loraAppID !== null && Scenarios[i].loraAppID !== undefined) {
                Scenarios[i].loraAppID = String(Scenarios[i].loraAppID);
            } else if (Scenarios[i].loraAppID === undefined) {
                Scenarios[i].loraAppID = null;
            }

            if (Scenarios[i].default !== null && Scenarios[i].default !== undefined){
                Scenarios[i].default = Boolean(Scenarios[i].default);
            } else {
                Scenarios[i].default = false;
            }
        }
    }

    return Scenarios;
}

dataFormat.prepUserAccountInput = function(body) {
    let validatedInput = JSON.parse(JSON.stringify(body));
    //If the property is exist, force transform the property, otherwise, assign the default value to it
    if (validatedInput.firstName !== null && validatedInput.firstName !== undefined) {
        validatedInput.firstName = String(validatedInput.firstName);
    } else {
        validatedInput.firstName = userAccDefaultValue.userAccountDefaultValue.firstName;
    }

    if (validatedInput.lastName !== null && validatedInput.lastName !== undefined) {
        validatedInput.lastName = String(validatedInput.lastName);
    } else {
        validatedInput.lastName = userAccDefaultValue.userAccountDefaultValue.lastName;
    }

    if (validatedInput.email !== null && validatedInput.email !== undefined) {
        validatedInput.email = String(validatedInput.email);
    } else {
        validatedInput.email = userAccDefaultValue.userAccountDefaultValue.email;
    }

    if (validatedInput.scenarios !== null && validatedInput.scenarios !== undefined) {
        validatedInput.scenarios = formatUserAccountScenarios(validatedInput.scenarios);
    } else {
        validatedInput.scenarios = defaultUserAccountScenarios;
    }

    if (validatedInput.accessRole !== null && validatedInput.accessRole !== undefined) {
        validatedInput.accessRole = String(validatedInput.accessRole);
    } else {
        validatedInput.accessRole = userAccDefaultValue.userAccountDefaultValue.accessRole;
    }

    if (validatedInput.tiledLayerBaseURL !== null && validatedInput.tiledLayerBaseURL !== undefined) {
        validatedInput.tiledLayerBaseURL = String(validatedInput.tiledLayerBaseURL);
    } else {
        validatedInput.tiledLayerBaseURL = userAccDefaultValue.userAccountDefaultValue.tiledLayerBaseURL;
    }

    if (validatedInput.featureLayerBaseURL !== null && validatedInput.featureLayerBaseURL !== undefined) {
        validatedInput.featureLayerBaseURL = String(validatedInput.featureLayerBaseURL);
    } else {
        validatedInput.featureLayerBaseURL = userAccDefaultValue.userAccountDefaultValue.featureLayerBaseURL;
    }

    return validatedInput;
};

dataFormat.battVoltageToPercent = function(voltage) {
    // Note: Shanghai hardware team has advised us that we should issue a warning
    // to the customer to replace their smoke detector battery when its voltage
    // level reaches 2.60 V.
    let upperLimit = 3.0;
    let lowerLimit = 2.54;
    let newVoltage;
    if (voltage > upperLimit) {
        newVoltage = upperLimit;
    } else if (voltage < lowerLimit) {
        newVoltage = lowerLimit;
    } else {
        newVoltage = voltage;
    }

    return Number((((newVoltage - lowerLimit) / (upperLimit - lowerLimit)) * 100).toFixed(0));
};

dataFormat.getRandomHex = function(finalNumBits, nonRandomPortion) {
    if (finalNumBits % 8 !== 0) {
        throw new Error("Must specify an integer number of bits that is an integer multiple of 8 (e.g.: 8, 16, 32, 128, etc.)");
    }
    let finalBinStr;
    if (nonRandomPortion) {
        finalBinStr = nonRandomPortion + getRandomBinaryString(finalNumBits - nonRandomPortion.length);
    } else {
        finalBinStr = getRandomBinaryString(finalNumBits);
    }
    let output = "";
    for (let i = 0; i < finalBinStr.length; i += 8) {
        output += toFixedLengthHexString(parseInt(finalBinStr.substring(i, i + 8), 2).toString(16), 2);
    }
    return output.toUpperCase();
};

function getRandomBinaryString(numBits) {
    let output = "";
    let digits = "01";
    for (let i = 0; i < numBits; i++) {
        let rand = Math.random();
        // Next, while unlikely, make sure that our random number isn't a 1, which will cause
        // an out of bounds array access in the code below by trying to access digits.charAt[2]:
        while (rand === 1) { rand = Math.random(); }
        output += digits.charAt(Math.floor(Math.random() * digits.length));
    }
    return output;
}

function toFixedLengthHexString(input, finalLen) {
    let output = input;
    for (let numZerosToAdd = finalLen - input.length; numZerosToAdd !== 0; numZerosToAdd--) {
        output = "0" + output;
    }
    return output;
}

dataFormat.getCleanMongoResponseJSON = function(input) {
    let output = JSON.parse(JSON.stringify(input));
    delete output.__v;
    delete output._id;
    return output;
};

dataFormat.getValidDevTypes = function(deviceInfos) {
    deviceInfos = JSON.parse(JSON.stringify(deviceInfos));
    let validDevTypes = [];
    for (let index in deviceInfos) {
        let deviceInfo = deviceInfos[index];
        validDevTypes.push(deviceInfo.devType);
    }
    return validDevTypes;
};

dataFormat.getValidSubTypesMap = function(deviceInfos) {
    let validSubTypesMap = {};
    for (let index in deviceInfos) {
        let deviceInfo = deviceInfos[index];
        let key = deviceInfo.devType;
        if (deviceInfo.subTypes !== undefined && deviceInfo.subTypes !== null) {
            validSubTypesMap[key] = deviceInfo.subTypes;
        }
    }
    return validSubTypesMap;
};

dataFormat.intWithThousandsSeparator = (x) => {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

dataFormat.filterDocumentBySchema = function(model, document) {
    let output = {};
    let ignoredFields = [ "_id", "__v", "id" ];

    Object.keys(model.schema.tree).forEach((field) => {
        if (ignoredFields.includes(field) === false)
            output[field] = document[field];
    });

    return output;
};

// To use this function, pass it your model, a single Mongo document as received in
// your database callback function (i.e.: no need to JSON.parse(JSON.stringify(...)),
// it beforehand), and a boolean value representing whether or not you want to add
// nulls for any missing fields. This function returns a cleaned object with only the
// fields as defined in your model's schema, and if applicable, "null" values for
// missing fields.
dataFormat.enforceSchemaOnDocument = function(model, obj, insertNullsForMissingFields) {
    if (model === undefined || obj === undefined || insertNullsForMissingFields === undefined)
        throw new Error("'enforceSchemaOnDocument' function takes 3 arguments: model (object), obj (object), insertNullsForMissingFields (boolean)");
    let output = {};
    let mongoFields = [ "_id", "__v", "id", "$init" ];
    let approvedFields = Object.keys(model.schema.tree);
    approvedFields = approvedFields.filter((field) => { return mongoFields.includes(field) === false; });

    approvedFields.forEach((field) => {
        let fieldIsObject = fieldIsANonMongooseObject(model, field);
        if (approvedFields.includes(field)) {
            output[field] = obj[field];
            if (output[field] === undefined && insertNullsForMissingFields) {
                output[field] = null;
                // If missing field is supposed to be an object, insert an empty object
                // here so that we can insert all of its children fields in the section
                // below.
                if (fieldIsObject) {
                    output[field] = {};
                }
            }
        }
        // Recurse into sub-objects to control the entire object's interface, in
        // accordance with the schema:
        if (output[field] !== undefined && fieldIsObject) {
            let subModel = { schema: { tree: model.schema.tree[field] } };
            let embObjKeys = Object.keys(model.schema.tree[field]);
            // This is to handle the case where you have an embedded object with a
            // default value:
            if (embObjKeys.includes("type") && Object.keys(model.schema.tree[field].type).includes("type") === false)
                subModel = { schema: { tree: model.schema.tree[field].type } };
            output[field] = dataFormat.enforceSchemaOnDocument(subModel, output[field], insertNullsForMissingFields);
        }
    });

    return output;
};

// Need a new function, because we don't want to iterate the sub attribute and set it to null
// For example, generalUserApplication.lora = undefined, set lora to null instead of setting 
// setting loraApplicationID and devices to null
dataFormat.enforceTopLevelOfSchema = function(model, obj) {
    if (model === undefined || obj === undefined)
        throw new Error("'enforceSchemaOnArray' function takes 2 arguments: model (object), obj (object)");
    let result;
    if (Array.isArray(obj)) {
        result = enforceSchemaOnArray(model, obj);
    }
    else {
        result = enforceSchemaOnObject(model, obj);
    }
    return result;
};

function enforceSchemaOnArray(model, array) {
    if (model === undefined || array === undefined)
        throw new Error("'enforceSchemaOnArray' function takes 2 arguments: model (object), array (object)");
    let result = [];
    for (let index in array) {
        let element = array[index];
        element = enforceSchemaOnObject(model, element);
        result.push(element);
    }
    return result;
}

function enforceSchemaOnObject(model, obj) {
    if (model === undefined || obj === undefined)
        throw new Error("'enforceSchemaOnObject' function takes 2 arguments: model (object), obj (object)");
    let output = {};
    let mongoFields = ["_id", "__v", "id", "$init"];
    let approvedFields = Object.keys(model.schema.tree);
    approvedFields = approvedFields.filter((field) => { return !mongoFields.includes(field); });

    approvedFields.forEach((field) => {
        let fieldIsObject = fieldIsANonMongooseObject(model, field);
        output[field] = obj[field];
        if (output[field] === undefined) {
            output[field] = null;
        }
        // Recurse into sub-objects to control the entire object's interface, in
        // accordance with the schema:
        if (output[field] !== undefined && output[field] !== null && fieldIsObject) {
            let subModel = { schema: { tree: model.schema.tree[field] } };
            let embObjKeys = Object.keys(model.schema.tree[field]);
            // This is to handle the case where you have an embedded object with a
            // default value:
            if (embObjKeys.includes("type") && Object.keys(model.schema.tree[field].type).includes("type") === false)
                subModel = { schema: { tree: model.schema.tree[field].type } };
            output[field] = dataFormat.enforceTopLevelOfSchema(subModel, output[field]);
        }
    });

    return output;
}

function fieldIsANonMongooseObject(model, field) {
    let isObject = false;
    let fieldVal = model.schema.tree[field];
    // Start with a basic type check. We have to filter out arrays, dates, and nulls,
    // which are all technically objects in JavaScript.
    if (typeof fieldVal === "object" && Array.isArray(fieldVal) === false &&
        (fieldVal instanceof Date) === false && fieldVal !== null) {
        // Unfortunately, checking whether a particular schema field is an object isn't
        // as simple as "if (typeof fieldVal === 'object')", because
        // some fields in the schema will contain objects with fields indicating, among
        // other things, default values. So we need to check whether it's a "real object"
        // (i.e.: isn't just a Mongoose config object).

        // These are the various conditions under which we say this object is a non-
        // Mongoose object:
        //   Condition 1: schema's value for this field is an object with a "type" sub-
        //       field and where the value for "type" is an object. This handles the
        //       case where you have different Mongoose properties for that parent field
        //       (such as a "default" field, for default values).
        let cond1 = (fieldVal.type !== undefined && typeof fieldVal.type === "object" &&
                     Array.isArray(fieldVal.type) === false);
        //   Condition 2: schema's value for this field is an object with no "type" sub-
        //       field.
        let cond2 = (Object.keys(fieldVal).includes("type") === false);
        if (cond1 || cond2)
            isObject = true;
    }

    return isObject;
}

// This function will effectively round any floating point value to 8 decimal places
dataFormat.removeFloatingPointError = function(floatVal) {
    return parseFloat(parseFloat(floatVal).toFixed(8));
};

dataFormat.removeFloatingPointErrorsFromGwResp = function(doc) {
    doc.InstallationMargin =    dataFormat.removeFloatingPointError(doc.InstallationMargin);
    doc.PktLossRate =           dataFormat.removeFloatingPointError(doc.PktLossRate);
    doc.TimeoutInterval =       dataFormat.removeFloatingPointError(doc.TimeoutInterval);
    doc.FreqClassBC =           dataFormat.removeFloatingPointError(doc.FreqClassBC);
};

dataFormat.removeFloatingPointErrorsFromAppResp = function(doc) {
    doc.InstallationMargin =    dataFormat.removeFloatingPointError(doc.InstallationMargin);
    doc.ModifiedTmst =          dataFormat.removeFloatingPointError(doc.ModifiedTmst);
};

//Because RefLat and RefLon is highly related, any of them is undefined or null, we will set GeoJSON to null for post
dataFormat.getGeoJsonValueForPost = function(RefLat, RefLon) {
    let GeoJSON = {
        type: "point",
        coordinates: [
            RefLat,
            RefLon
        ]
    };
    if (RefLat === undefined || RefLat === null) {
        GeoJSON = null;
    }
    if (RefLon === undefined || RefLon === null) {
        GeoJSON = null;
    }
    return GeoJSON;
};

//For put web service:
//1.Only RefLat === null and RefLon === null, we clear the GeoJSON value in database;
//2.Otherwise, if any of RefLat and RefLon is undefined or null, we set GeoJSON to undefined, and nothing change in database
dataFormat.getGeoJsonValueForPut = function(RefLat, RefLon) {
    let GeoJSON = {
        type: "point",
        coordinates: [
            RefLat,
            RefLon
        ]
    };
    if (RefLat === null && RefLon === null) {
        GeoJSON = null;
    }
    else if (RefLat === undefined || RefLat === null) {
        GeoJSON = undefined;
    }
    else if (RefLon === undefined || RefLon === null) {
        GeoJSON = undefined;
    }
    return GeoJSON;
};

dataFormat.hexStringToBuffer = function(hexStr) {
    let paddedHex = hexStr;
    let paddedHexLen = paddedHex.length;
    if (paddedHexLen % 2 === 1) {
        paddedHex = dataFormat.padWithZerosToFixedLength(hexStr, paddedHexLen + 1);
        paddedHexLen = paddedHex.length;
    }
    let buf = Buffer.alloc(paddedHexLen / 2);
    let strItr = 0;
    for (let i = 0; i < buf.length; i++) {
        buf[i] = parseInt("0x" + paddedHex.substring(strItr, strItr + 2));
        strItr += 2;
    }
    return buf;
};

dataFormat.stringContainsOnlySpaces = function(input) {
    if (input.length === 0) {
        return false;
    } else {
        for (let i = 0; i < input.length; i++) {
            if (input[i] !== " ") {
                return false;
            }
        }
        return true;
    }
};

dataFormat.getLookupObjectFromArrayOfObjects = function(array, lookupKeyFieldName) {
    if (array === undefined || lookupKeyFieldName === undefined ||
        Array.isArray(array) === false || typeof lookupKeyFieldName !== "string") {
        throw new Error("'getLookupObjectFromArrayOfObjects' function takes two parameters: " +
                        "an array and a string");
    }
    let output = {};

    for (let i = 0; i < array.length; i++) {
        output[array[i][lookupKeyFieldName]] = array[i];
    }

    return output;
};

dataFormat.getCsvSafeHex = function(input) {
    return input + "\t";
};

dataFormat.timeRangeInMsToHumanReadable = function(inputMs) {
    let outputStr = "";
    let inputDate = new Date(inputMs);
    let ms = inputDate.getUTCMilliseconds();
    let sec = inputDate.getUTCSeconds();
    let min = inputDate.getUTCMinutes();
    let hours = inputDate.getUTCHours();
    let days = Math.floor(inputMs / (1000 * 60 * 60 * 24));
    if (days > 0)
        outputStr += days + "d";
    if (hours > 0)
        outputStr += ((outputStr.length > 0) ? " " : "") + hours + "h";
    if (min > 0)
        outputStr += ((outputStr.length > 0) ? " " : "") + min + "m";
    if (sec > 0)
        outputStr += ((outputStr.length > 0) ? " " : "") + sec + "s";
    if (ms > 0)
        outputStr += ((outputStr.length > 0) ? " " : "") + ms + "ms";
    return outputStr;
};

module.exports = dataFormat;
