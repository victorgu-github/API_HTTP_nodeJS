let fs = require("fs");
let csvStream = require("csv-write-stream");
let csvWriter = csvStream();

let consts = require("../../config/constants.js");
let errorResp = require("../../common/errorResponse.js");
let dataValidation = require("../../common/dataValidation.js");
let dataFormat = require("../../common/dataFormat.js");
let defaultValues = require("../../config/nodeSessionDefaultValues.js");
let loraDataValidation = require("../../common/loraDataTypesValidation.js");

let obj = {};

// - GET "/util/manufacturing/lora/device"
obj.downloadManufacturerSettingsCSV = function(req, res, next) {
    let validationResult = getDeviceManufacturingSettingsValidation(req);
    if (validationResult.length === 0) {
        let num = parseInt(req.query.numDevices);
        csvWriter = csvStream();
        let filePath = "./content/";
        let filename = "manufacturerSettings.csv";
        let ws = new fs.createWriteStream(filePath + filename);
        csvWriter.pipe(ws);
        let nameItr = Number.parseInt(req.query.startNum);
        for (let i = 0; i < num; i++) {
            let row = {
                Name:       req.query.namePrefix + dataFormat.padWithZerosToFixedLength(nameItr, 4),
                DevEUI:     dataFormat.getCsvSafeHex(dataFormat.getRandomHex(64)),
                DevAddr:    dataFormat.getCsvSafeHex(dataFormat.getRandomHex(32, consts.NetworkID)),
                NwkSKey:    dataFormat.getCsvSafeHex(dataFormat.getRandomHex(128)),
                AppSKey:    dataFormat.getCsvSafeHex(dataFormat.getRandomHex(128)),
                AppKey:     dataFormat.getCsvSafeHex(dataFormat.getRandomHex(128)),
                AppEUI:     dataFormat.getCsvSafeHex(defaultValues.gwServ.AppEUI),
                ABP:        (req.query.deviceMode === "ABP") ? true : false
            };
            csvWriter.write(row);
            nameItr++;
        }
        csvWriter.end();
        csvWriter.on("end", () => { // Wait until writing is finished
            ws.on("close", () => {  // Wait until the file is closed
                res.set("Content-Type", "text/csv");
                res.download(filePath + filename, (err) => {
                    if (err) {
                        logger.error("Something went wrong while downloading file");
                    } else {
                        fs.unlink(filePath + filename, () => {});
                    }
                });
                next();
            });
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validationResult, 400);
        next();
    }
};

function getDeviceManufacturingSettingsValidation(req) {
    let errors = [];

    errors = errors.concat(loraDataValidation.getNamePrefixValidation(req.query.namePrefix, "namePrefix", true));
    errors = errors.concat(loraDataValidation.getStartNumValidation(req.query.startNum, "startNum", req.query.numDevices, true));
    if (req.query.numDevices === undefined) {
        errors.push("Must specify a valid 'numDevices' parameter in the query string");
    } else if (dataValidation.isInteger(req.query.numDevices) === false ||
               parseInt(req.query.numDevices) < 1 || parseInt(req.query.numDevices > 10000)) {
        errors.push("'numDevices' parameter must be an integer between 1 and 10,000");
    }
    if (req.query.deviceMode === undefined) {
        errors.push("Must specify a valid 'deviceMode' parameter in the query string");
    } else if (req.query.deviceMode !== "OTAA" && req.query.deviceMode !== "ABP") {
        errors.push("'deviceMode' parameter value must be either 'OTAA' or 'ABP'");
    }

    return errors;
}

// - GET "/util/manufacturing/lora/device/multicast"
obj.downloadMulticastSettingsCSV = function(req, res, next) {
    let validationErrors = getMulticastSettingsValidation(req);
    if (validationErrors.length === 0) {
        let preppedUserInput = prepMulticastCsvInput(req);
        let appID = preppedUserInput.appID;

        // Query for the specified multicast session:
        let findPromises = [];
        let query = { MulticastAddr: preppedUserInput.multicastAddr };
        let gwMulticastModel = require("../../models/gwMulticastSession.js")();
        findPromises.push(gwMulticastModel.find(query));
        let appMulticastModel = require("../../models/appMulticastSession.js")(appID);
        findPromises.push(appMulticastModel.find(query));

        Promise.all(findPromises).then((allPromisesResp) => {
            if (allPromisesResp[0].length !== 0 && allPromisesResp[1].length !== 0) {
                csvWriter = csvStream();
                let filePath = "./content/";
                let filename = "multicastManufacturerSettings.csv";
                let ws = new fs.createWriteStream(filePath + filename);
                csvWriter.pipe(ws);

                let mcAddr = preppedUserInput.multicastAddr;
                let nameItr = Number.parseInt(req.query.startNum);
                for (let j = 0; j < req.query.numDevices; j++) {
                    let row = {
                        Name:               req.query.namePrefix + dataFormat.padWithZerosToFixedLength(nameItr, 4),
                        MulticastAddr:      dataFormat.getCsvSafeHex(mcAddr),
                        MulticastNwkSKey:   dataFormat.getCsvSafeHex(allPromisesResp[1][0].NwkSKey),
                        MulticastAppSKey:   dataFormat.getCsvSafeHex(allPromisesResp[1][0].AppSKey),
                        DevEUI:             dataFormat.getCsvSafeHex(dataFormat.getRandomHex(64)),
                        DevAddr:            dataFormat.getCsvSafeHex(dataFormat.getRandomHex(32, consts.NetworkID)),
                        NwkSKey:            dataFormat.getCsvSafeHex(dataFormat.getRandomHex(128)),
                        AppSKey:            dataFormat.getCsvSafeHex(dataFormat.getRandomHex(128)),
                        AppKey:             dataFormat.getCsvSafeHex(dataFormat.getRandomHex(128)),
                        AppEUI:             dataFormat.getCsvSafeHex(defaultValues.gwServ.AppEUI),
                        ABP:                preppedUserInput.abp
                    };
                    csvWriter.write(row);
                    nameItr++;
                }

                csvWriter.end();
                csvWriter.on("end", () => { // Wait until writing is finished
                    ws.on("close", () => {  // Wait until the file is closed
                        res.set("Content-Type", "text/csv");
                        res.download(filePath + filename, (err) => {
                            if (err) {
                                logger.error("Something went wrong while downloading file");
                            } else {
                                fs.unlink(filePath + filename, () => {});
                            }
                        });
                        next();
                    });
                });
            } else {
                let errMsg = "Couldn't find a valid multicast session with address '" +
                    req.query.multicastAddr + "'. Please ensure that a multicast session" +
                    " with that address exists and that you typed the address correctly.";
                errorResp.send(res, consts.error.badRequestLabel, errMsg, 400);
                next();
            }
        }).catch((err) => {
            logger.error(err);
            errorResp.send(res, consts.error.serverErrorLabel, (err + ""), 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validationErrors, 400);
        next();
    }
};

function getMulticastSettingsValidation(req) {
    let errors = [];

    errors = errors.concat(loraDataValidation.getNamePrefixValidation(req.query.namePrefix, "namePrefix", true));
    errors = errors.concat(loraDataValidation.getStartNumValidation(req.query.startNum, "startNum", req.query.numDevices, true));
    errors = errors.concat(loraDataValidation.getUrlAbpOtaaModeValidation(req.query.deviceMode, "deviceMode", true));
    errors = errors.concat(loraDataValidation.getUrlMulticastAddrValidation(req.query.multicastAddr, "multicastAddr", true));
    errors = errors.concat(loraDataValidation.getApplicationIdValidation(req.query.applicationID, "applicationID", true, false));
    errors = errors.concat(loraDataValidation.getUrlNumDevicesValidation(req.query.numDevices, "numDevices", true));

    return errors;
}

// This function's sole purpose is to format and transform the user's input to the format
// accepted by the database and web service, i.e.: leading zero padding for integer
// application IDs, uppercase conversion for all hex strings, and a 'true' or 'false'
// value for 'ABP'.
function prepMulticastCsvInput(req) {
    return {
        appID:          dataFormat.padWithZerosToFixedLength(req.query.applicationID, 16),
        multicastAddr:  req.query.multicastAddr.toUpperCase(),
        abp:            (req.query.deviceMode.toUpperCase() === "ABP") ? true : false
    };
}

module.exports = obj;
