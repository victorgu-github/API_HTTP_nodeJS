let reqFile = require.main.require;

let consts = reqFile("./config/constants.js");
let errorResp = reqFile("./common/errorResponse.js");
let dataFormat = require("../../common/dataFormat.js"); // Note: This is v2 dataFormat
let dataValidation = reqFile("./common/dataValidation.js");
let generalUserAppValidation = reqFile("./v2/common/generalUserAppValidation.js");

let obj = {};

// - GET "/generaluser/applications/existingdevices"
// Get general user application for exist lora device
//   1) Validate if the generalUserApplicationID is valid integer
//   2) If general user application has "lora" field, we use loraApplicationID and devEUIs to find devices.
// Otherwise, we return lora = null
// --------- New in v2: ---------
//   1) New "statistics" array in each generalUserApplication object
//   2) New "networks" array in each generalUserApplication object
//   3) "lora" field has been moved to new object inside "networks" array,
//      with a new data format.
obj.getUserAppForExistingDev = function(req, res, next) {
    let validation = getInputValidation(req.query);
    if (validation.length === 0) {
        let GenUserApplication = reqFile("./models/users/generalUserApplication.js")();
        let queryObj = {};
        if (req.query.generalUserApplicationID !== undefined) {
            queryObj.generalUserApplicationID = { $in: req.query.generalUserApplicationID.split(",") };
        }
        GenUserApplication.find(queryObj).then((resp) => {
            // We need this here because right now we can't change the model without
            // impacting v1 of this web service, and we need to filter out undefined
            // Mongo objects.
            resp = JSON.parse(JSON.stringify(resp));
            // Next, we need to get additional information for any BLE applications:
            let allBleAppIDs = getAllBleAppIDsFromResp(resp);
            let BleApp = reqFile("./models/ble/bleApplication.js")();
            BleApp.find({
                bleAppID: { $in: allBleAppIDs }
            }).then((bleApps) => {
                let newResp = transformRespToNewFormat(resp, bleApps);
                // There are 3 categories of BLE applications:
                //   1. No devices are granted to the user
                //   2. All devices are granted to the user
                //   3. Some devices are granted to the user
                // For bullet #3, because there's no system to keep one collection in
                // sync with another, we need to manually query that BLE app database
                // and filter any specified devices by what's found therein. To do this,
                // we must first determine which BLE apps have specified devices, then
                // save those BLE app IDs and query their registered nodes.
                let bleAppsWithQueryDevices = resp.filter((eachGenApp) => {
                    return eachGenApp.ble !== undefined &&
                        eachGenApp.ble.filter((eachBleApp) => {
                            return eachBleApp.devices.length !== 0;
                        });
                });

                let bleAppIDsWithSpecifiedDevices = [];
                bleAppsWithQueryDevices.forEach((eachGenApp) => {
                    eachGenApp.ble.forEach((eachBleApp) => {
                        if (Array.isArray(eachBleApp.devices) && eachBleApp.devices.length !== 0 || eachBleApp.devices === "all")
                            bleAppIDsWithSpecifiedDevices = bleAppIDsWithSpecifiedDevices.concat(eachBleApp.bleAppID);
                    });
                });
                // This array will contain our query promises for LoRa device types and
                // also BLE registered nodes:
                let addnlInfoProms = [];
                addnlInfoProms.push(queryDeviceTypes(newResp));
                if (bleAppIDsWithSpecifiedDevices.length > 0) {
                    addnlInfoProms.push(queryAllBleDevicesInSpecifiedBleApps(bleAppIDsWithSpecifiedDevices));
                } else {
                    addnlInfoProms.push(Promise.resolve([]));
                }
                Promise.all(addnlInfoProms).then((addnlResp) => {
                    // The "genAppsWithDevTypes" variable below contains all of our apps,
                    // each with its new "networks" > "devices" array (containing the devEUIs
                    // with their matching device types) for LoRa Networks.
                    let genAppsWithDevTypes = addnlResp[0];

                    // Below: Drill down to the BLE apps containing both specified devices
                    // and query all devices, and filter their displayed devices based on the
                    // results of the "addnlDeviceInfo" response array:
                    let addnlDeviceInfo = addnlResp[1];
                    let addnlDeviceInfoLookup = {};
                    addnlDeviceInfo.forEach((each) => {
                        addnlDeviceInfoLookup[each.bleAppID] = each.devices;
                    });
                    for (let i = 0; i < genAppsWithDevTypes.length; i++) {
                        let networks = genAppsWithDevTypes[i].networks;
                        for (let j = 0; j < networks.length; j++) {
                            if (networks[j].type === "ble") {
                                let bleApps = networks[j].bleApps;
                                for (let k = 0; k < bleApps.length; k++) {
                                    if (addnlDeviceInfoLookup[bleApps[k].bleAppID] !== undefined) {
                                        let specifiedDevices = bleApps[k].devices;
                                        let actualDevices = addnlDeviceInfoLookup[bleApps[k].bleAppID];
                                        let finalDevices = [];
                                        if (Array.isArray(specifiedDevices)) {
                                            specifiedDevices.forEach((specifiedDevice) => {
                                                if (actualDevices.includes(specifiedDevice)) {
                                                    finalDevices.push(specifiedDevice);
                                                } 
                                            });
                                        }

                                        bleApps[k].devices = Array.isArray(specifiedDevices) ? finalDevices : "all";
                                        bleApps[k].numOfDevices = Array.isArray(specifiedDevices) ? finalDevices.length : actualDevices.length;

                                    }
                                }
                            }
                        }
                    }

                    // Now we need to calculate the "statistics" objects for each general
                    // user application. We do this by iterating through each application
                    // and summing up all of the RSSI records found for all of the app's
                    // various devices for each of the past 24 hours.
                    let aggProms = [];
                    let LoRaAggData = reqFile("./models/rssiAggData.js")();
                    let devEUIsLookup = [];
                    // Iterate through all applications
                    for (let i = 0; i < genAppsWithDevTypes.length; i++) {
                        // Because the "networks" array can contain multiple types of
                        // objects, we need to filter for the one we want - "lora".
                        let loraObj = genAppsWithDevTypes[i].networks.filter((each) => { return each.type === "lora"; })[0];
                        // If this general user application doesn't have a lora object,
                        // we skip it.
                        if (loraObj !== undefined) {
                            // Get a simple array of devEUIs for querying the aggregated
                            // RSSI records.
                            let devEUIsInApp = [];
                            loraObj.devices.forEach((device) => {
                                devEUIsInApp.push(device.devEUI);
                            });
                            // If there are no devices in this application, skip it.
                            if (devEUIsInApp.length > 0) {
                                let queryObj = getQueryObjForAggregation(devEUIsInApp);
                                aggProms.push(LoRaAggData.find(queryObj, {
                                    _id:                    0,
                                    aggStartTime:           1,
                                    aggregationByDevEUI:    1
                                }));
                                devEUIsLookup.push(devEUIsInApp);
                            } else {
                                aggProms.push(Promise.resolve(null));
                                devEUIsLookup.push(null);
                            }
                        } else {
                            devEUIsLookup.push(null);
                            aggProms.push(Promise.resolve(null));
                        }
                    }
                    // Now that we have the relevant 24 hours of data we need for each
                    // application, we have to go through and sum up the number of RSSI
                    // entries found for only those devices in each application, and
                    // store this hourly sum in the statistics > data array.
                    Promise.all(aggProms).then((allAppsAggInfo) => {
                        // Each general user application's aggregated records
                        for (let i = 0; i < allAppsAggInfo.length; i++) {
                            // I.e.: This application has at least one registered device:
                            if (allAppsAggInfo[i] !== null) {
                                let statsObj = {
                                    type:   "numLoRaRssiInPast24Hours",
                                    data:   []
                                };
                                let recsInLast24Hours = allAppsAggInfo[i];
                                // Iterate through each of the last 24 hours' time slots.
                                // If there is no data available for a given hour, we
                                // give an object indicating 0 records found.
                                let stopTime = new Date();
                                stopTime.setMilliseconds(0);
                                stopTime.setSeconds(0);
                                stopTime.setMinutes(0);
                                let timeItr = new Date(stopTime);
                                timeItr.setDate(timeItr.getDate() - 1);

                                while (timeItr.getTime() !== stopTime.getTime()) {
                                    let oneHourStatsObj = {
                                        timestamp:  new Date(timeItr),
                                        num:        0
                                    };
                                    // Because the array is sorted, we need only check the
                                    // first element, because we will shift the array each
                                    // time.
                                    if (recsInLast24Hours[0] &&
                                        recsInLast24Hours[0].aggStartTime.getTime() === timeItr.getTime()) {
                                        let oneHourRec = recsInLast24Hours[0];
                                        // Each device's hourly sum:
                                        for (let j = 0; j < oneHourRec.aggregationByDevEUI.length; j++) {
                                            let devEuiRssi = oneHourRec.aggregationByDevEUI[j];
                                            if (devEUIsLookup[i].includes(devEuiRssi.devEUI)) {
                                                oneHourStatsObj.num += devEuiRssi.numRssiEntries;
                                            }
                                        }
                                        statsObj.data.push(oneHourStatsObj);
                                        timeItr.setHours(timeItr.getHours() + 1);
                                        recsInLast24Hours.shift();
                                    } else {
                                        statsObj.data.push(oneHourStatsObj);
                                        timeItr.setHours(timeItr.getHours() + 1);
                                    }
                                }
                                genAppsWithDevTypes[i].statistics.push(statsObj);
                            }
                        }
                        // Done, so send final response:
                        res.send(genAppsWithDevTypes);
                        next();
                    }).catch((err) => {
                        logger.error(err);
                        errorResp.send(res, consts.error.serverErrorLabel, "" + err, 500);
                        next();
                    });
                }).catch((err) => {
                    logger.error(err);
                    errorResp.send(res, consts.error.serverErrorLabel, "" + err, 500);
                    next();
                });
            }).catch((err) => {
                logger.error(err);
                errorResp.send(res, consts.error.serverErrorLabel, "" + err, 500);
                next();
            });
        }).catch((err) => {
            let msg = err + "";
            logger.error(err);
            errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validation, 400);
        next();
    }
};

function getInputValidation(query) {
    let errors = [];

    if (query.generalUserApplicationID !== undefined) {
        let appIDsArr = query.generalUserApplicationID.split(",");
        appIDsArr.forEach((genAppID) => {
            if (dataValidation.isInteger(genAppID) === false) {
                errors.push("generalUserApplicationID must contain a positive integer, or comma-" +
                            "separated list thereof (you gave " + genAppID + ")");
            }
        });
    } else {
        errors.push("Must provide 'generalUserApplicationID' parameter containing a positive integer" +
                    ", or comma-separated list thereof");
    }

    return errors;
}

function transformRespToNewFormat(genUserApps, bleApps) {
    let output = [];

    for (let i in genUserApps) {
        let app = genUserApps[i];
        let obj = {
            generalUserApplicationID:   app.generalUserApplicationID,
            createdTime:                app.createdTime,
            modifiedTime:               app.modifiedTime,
            generalUserApplicationName: (app.generalUserApplicationName !== undefined) ? app.generalUserApplicationName : null,
            scenarioID:                 (app.scenarioID !== undefined) ? app.scenarioID : null,
            statistics:                 app.statistics,
            networks:                   app.networks
        };
        // Next, support old data formats:
        if (obj.statistics === undefined) {
            obj.statistics = [];
        }
        if (obj.networks === undefined) {
            obj.networks = [];
            if (app.lora !== undefined) {
                obj.networks.push({
                    type:           "lora",
                    applicationID:  app.lora.loraApplicationID,
                    devices:        app.lora.devEUIs
                });
            }
            if (app.ble !== undefined && bleApps !== null) {
                let bleNwkObj = {
                    type:       "ble",
                    bleApps:    []
                };
                app.ble.forEach((bleElem) => {
                    // The variable below will contain the "full" BLE application containing
                    // all of the additional info we need such as latitude, longitude, etc.
                    let fullBleApp = bleApps.filter((each) => { return each.bleAppID == bleElem.bleAppID; })[0];
                    bleNwkObj.bleApps.push({
                        bleAppID:           bleElem.bleAppID,
                        devices:            (bleElem.devices) ? bleElem.devices : [],
                        numOfDevices:       (bleElem.devices) ? bleElem.devices.length : 0,
                        spatialInfo: {
                            lat:            (fullBleApp) ? fullBleApp.centerLat : null,
                            lon:            (fullBleApp) ? fullBleApp.centerLng : null,
                            alt:            (fullBleApp) ? fullBleApp.centerAlt : null,
                            zoomLevel2D:    (fullBleApp) ? fullBleApp.defaultZoomLevel2D : null,
                            zoomLevel3D:    (fullBleApp) ? fullBleApp.defaultZoomLevel3D : null
                        }
                    });
                });
                obj.networks.push(bleNwkObj);
            }
        }
        output.push(obj);
    }

    return output;
}

// Each general user application object will have an array of devices by DevEUI only. We
// need to query the app node session collection to get their device types.
function queryDeviceTypes(genUserApps) {
    let findProms = [];
    genUserApps.forEach((genUserApp) => {
        let loraObj = genUserApp.networks.filter((elem) => { return elem.type === "lora"; })[0];
        if (loraObj !== undefined) {
            let AppNodeSession = reqFile("./models/nodeSessionAppServ.js")(loraObj.applicationID);
            findProms.push(AppNodeSession.find({
                DevEUI: { $in: loraObj.devices }
            }, {
                _id:        0,
                DevEUI:     1,
                DevType:    1
            }));
        } else {
            findProms.push(null);
        }
    });
    return Promise.all(findProms).then((devTypes) => {
        for (let i in devTypes) {
            let genUserApp = genUserApps[i];
            for (let j in genUserApp.networks) {
                if (genUserApp.networks[j].type === "lora") {
                    let AppNodeSession = reqFile("./models/nodeSessionAppServ.js")(genUserApp.networks[j].applicationID);
                    for (let k = 0; k < devTypes[i].length; k++) {
                        devTypes[i][k] = dataFormat.enforceSchemaOnDocument(AppNodeSession, devTypes[i][k], null);
                    }
                    genUserApp.networks[j].devices = devTypes[i];
                }
            }
        }
        return genUserApps;
    });
}

// This function will return all of the devices found in any of the BLE app IDs
// which are passed to the function.
function queryAllBleDevicesInSpecifiedBleApps(bleAppIDsWithDevs) {
    let proms = [];
    bleAppIDsWithDevs.forEach((bleAppID) => {
        let BleNode = reqFile("./models/ble/bleNode.js")(bleAppID);
        proms.push(BleNode.find({}, {
            _id:        0,
            macAddress: 1
        }).then((resp) => {
            let output = {
                bleAppID:   bleAppID,
                devices:    []
            };
            resp.forEach((device) => { output.devices.push(device.macAddress); });
            return output;
        }));
    });
    return Promise.all(proms);
}

function getQueryObjForAggregation(devEUIs) {
    let queryObj = {};

    queryObj.aggregationByDevEUI = { $elemMatch: { devEUI: { $in: devEUIs } } };
    let endTime = new Date();
    endTime.setMilliseconds(0);
    endTime.setSeconds(0);
    endTime.setMinutes(0);
    let startTime = new Date(endTime);
    startTime.setDate(startTime.getDate() - 1);
    // startTime.setHours(startTime.getHours() - 1);
    queryObj.aggStartTime = {
        $gte:   startTime,
        $lt:    endTime
    };

    return queryObj;
}

// - GET "/generaluser/applications/datausage?genAppID=...&startTime=...&endTime=..."
obj.getDataUsage = function(req, res, next) {
    let validation = getValidationForDataUsage(req.query);
    if (validation.length === 0) {
        // First, find our general user application:
        let GenUserApplication = reqFile("./models/users/generalUserApplication.js")();
        GenUserApplication.find({
            generalUserApplicationID: req.query.genAppID
        }).limit(1).then((resp) => {
            // If we don't find it, send an error response
            if (resp.length > 0) {
                // The following 2 lines are unnecessary. Originally, they were here to
                // convert the data to the "new format". But the database format will
                // remain unchanged, so there's no need for this web service. We can
                // refactor this out at some later date.
                resp = JSON.parse(JSON.stringify(resp));
                resp = transformRespToNewFormat(resp, null)[0];
                // Because the "networks" array can contain multiple types of
                // objects, we need to filter for the one we want - "lora".
                let loraObj = resp.networks.filter((each) => { return each.type === "lora"; })[0];
                // If this general user application doesn't have a lora object, we send
                // an error response.
                let finalRespObj = {
                    generalAppID:           req.query.genAppID,
                    timeInterval:           req.query.startTime + " - " + req.query.endTime,
                    numberOfLoRaPackets:    0
                };
                let prom = Promise.resolve(null);
                if (loraObj !== undefined && loraObj.devices.length > 0) {
                    // Get all aggregated RSSI data for the devices in this application:
                    let LoRaAggData = reqFile("./models/rssiAggData.js")();
                    let devEUIs = loraObj.devices;
                    let queryObj = getQueryObjForAggregationBetweenTimes(devEUIs, req.query.startTime, req.query.endTime);
                    prom = LoRaAggData.find(queryObj, {
                        _id:                    0,
                        aggStartTime:           1,
                        aggregationByDevEUI:    1
                    }).then((aggInfo) => {
                        // Iterate through each hour of the found records:
                        for (let i = 0; i < aggInfo.length; i++) {
                            let oneHourRec = aggInfo[i];
                            // Iterate through all devices, and add up the ones in our
                            // application:
                            for (let j = 0; j < oneHourRec.aggregationByDevEUI.length; j++) {
                                let devEuiRssi = oneHourRec.aggregationByDevEUI[j];
                                if (devEUIs.includes(devEuiRssi.devEUI)) {
                                    finalRespObj.numberOfLoRaPackets += devEuiRssi.numRssiEntries;
                                }
                            }
                        }
                    });
                } // Else no devices, so just send "0" total LoRa packets
                prom.then(() => {
                    res.send(finalRespObj);
                    next();
                });
            } else {
                let msg = "No general user application found with ID " + req.query.genAppID + "." +
                    " Please check database.";
                errorResp.send(res, consts.error.badRequestLabel, msg, 400);
                next();
            }
        }).catch((err) => {
            let msg = err + "";
            logger.error(err);
            errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validation, 400);
        next();
    }
};

function getValidationForDataUsage(query) {
    let errors = [];

    // genAppID:
    if (query.genAppID !== undefined) {
        if (dataValidation.isInteger(query.genAppID) === false) {
            errors.push("generalUserApplicationID must contain a positive integer" +
                        " (you gave " + query.genAppID + ")");
        }
    } else {
        errors.push("Must specify valid 'genAppID' parameter containing a positive integer");
    }
    // startTime:
    if (query.startTime !== undefined) {
        if (dataValidation.isValidUtcIsoDateString(query.startTime) === false) {
            errors.push("'startTime' parameter must contain a valid UTC ISO date string" +
                        " in the format 'yyyy-mm-ddThh-mm-ssZ' (you gave " + query.startTime + ")");
        } else { // Additional business logic:
            let startDate = new Date(query.startTime);
            if (startDate.getMinutes() !== 0 || startDate.getSeconds() !== 0 || startDate.getMilliseconds() !== 0) {
                errors.push("'startTime' parameter must fall on the boundary between two UTC hours" +
                            ", e.g.: '2018-04-10T00:00:00Z' (you gave " + query.startTime + ")");
            }
        }
    } else {
        errors.push("Must specify valid 'startTime' parameter containing a valid UTC ISO" +
                    "date string in the format 'yyyy-mm-ddThh-mm-ssZ'");
    }
    // endTime:
    if (query.endTime !== undefined) {
        if (dataValidation.isValidUtcIsoDateString(query.endTime) === false) {
            errors.push("'endTime' parameter must contain a valid UTC ISO date string" +
                        " in the format 'yyyy-mm-ddThh-mm-ssZ' (you gave " + query.endTime + ")");
        } else { // Additional business logic:
            let endDate = new Date(query.endTime);
            if (endDate.getMinutes() !== 0 || endDate.getSeconds() !== 0 || endDate.getMilliseconds() !== 0) {
                errors.push("'endTime' parameter must fall on the boundary between two UTC hours" +
                            ", e.g.: '2018-04-10T00:00:00Z' (you gave " + query.endTime + ")");
            }
        }
    } else {
        errors.push("Must specify valid 'endTime' parameter containing a valid UTC ISO" +
                    "date string in the format 'yyyy-mm-ddThh-mm-ssZ'");
    }
    // Additional business logic:
    if (query.startTime !== undefined && query.endTime !== undefined) {
        errors = errors.concat(dataValidation.getTimeRangeValidation(query.startTime, query.endTime));
    }

    return errors;
}

function getQueryObjForAggregationBetweenTimes(devEUIs, start, end) {
    let queryObj = {};

    queryObj.aggregationByDevEUI = { $elemMatch: { devEUI: { $in: devEUIs } } };
    let endTime = new Date(end);
    let startTime = new Date(start);
    queryObj.aggStartTime = {
        $gte:   startTime,
        $lt:    endTime
    };

    return queryObj;
}

/////////////////////////////////////////////////////
//
// Get User Application Func
//
/////////////////////////////////////////////////////

// - GET "/generaluserapplication/createdBy"
obj.getUserAppByCreatedBy = function(req, res, next) {
    let generalUserApplication = require("../../models/generalUserApplication.js")();
    let validationErrors = getInputValidationForGetCreatedBy(req.query);
    if (validationErrors.length === 0) {
        let query = {};
        if (req.query.username !== undefined) {
            query.createdBy = req.query.username;
            query.creatorAccessRole = req.query.accessRole;
        } else {
            query.createdBy = res.locals.username;
            query.creatorAccessRole = res.locals.accessRole;
        }
        generalUserApplication.find(query).then((resp) => {
            resp = JSON.parse(JSON.stringify(resp));
            resp = dataFormat.enforceTopLevelOfSchema(generalUserApplication, resp);
            res.send(resp);
            next();
        }).catch((err) => {
            logger.error(err);
            let errMsg = err + "";
            errorResp.send(res, consts.error.serverErrorLabel, errMsg, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validationErrors, 400);
        next();
    }
};

// - GET "/generaluserapplication"
obj.getUserApplication = function(req, res, next) {
    let query = req.query;
    let generalUserApplication = require("../../models/generalUserApplication.js")();
    let validationResult = generalUserAppValidation.validateGetAndDelReqQuery(query);
    if (validationResult.status === "success") {
        getUserApplicationInfo(query.generalUserApplicationID).then((resp) => {
            resp = JSON.parse(JSON.stringify(resp));
            resp = dataFormat.enforceTopLevelOfSchema(generalUserApplication, resp);
            res.send(resp);
            next();
        }).catch((err) => {
            let msg = err + "";
            logger.error(err);
            errorResp.send(res, "Mongo Error", msg, 500);
            next();
        });
    } else {
        logger.error("Validation errors:", validationResult.errorMessage);
        errorResp.send(res, "Bad Request", validationResult.errorMessage, 400);
        next();
    }
};

//Validate query params:
//1. username
//2. accessRole
function getInputValidationForGetCreatedBy(query) {
    let errors = [];

    if ((query.username === undefined && query.accessRole !== undefined) ||
        (query.username !== undefined && query.accessRole === undefined))
        errors.push("Must specify 'accessRole' parameter when defining 'username', and vice-versa");
    let acceptedParams = ["username", "accessRole"];
    let unknownFields = Object.keys(query).filter((field) => { return acceptedParams.includes(field) === false; });
    if (unknownFields.length > 0)
        errors.push("Unknown query parameter(s): " + (unknownFields + "").replace(/,/g, ", ") +
            ". Accepted query parameters are: " + (acceptedParams + "").replace(/,/g, ", "));

    return errors;
}

/////////////////////////////////////////////////////
//
// Post User Application Func
//
/////////////////////////////////////////////////////

// - POST "/generaluserapplication"
obj.saveUserApplication = function(req, res, next) {
    let reqBody = req.body;
    let generalUserApplication = require("../../models/generalUserApplication.js")();
    let validationResult = generalUserAppValidation.validatePostReqBody(reqBody);
    //1. If req.body valid, then continue
    //2. If req.body invalid, then send error message to frontend
    if (validationResult.status === "success") {
        //1. If we can find the max user application id, then continue
        //2. If we face mongo error during find the mas user application id, then send system error message to frontend
        getMaximumUserAppID().then((resp) => {
            resp = JSON.parse(JSON.stringify(resp));
            //1. resp.length === 0 means it may be there is no data in the database or the
            //   test env and nodejs database have different data records
            //2. because we use find({}).sort({generalUserApplicationID: -1}).limit(1), the
            //   resp only includes one element, and resp[0] can be used.
            let maxUserAppID = (resp.length === 0) ? 0 : resp[0].generalUserApplicationID;
            let currUserAppID = maxUserAppID + 1;
            let saveBody = getSaveBody(res, currUserAppID, reqBody);

            saveUserApplicationInfo(saveBody).then((saveResponse, error) => {
                saveResponse = JSON.parse(JSON.stringify(saveResponse));
                if (error === undefined || error === null) {
                    let registResult = dataFormat.enforceTopLevelOfSchema(generalUserApplication, saveResponse);
                    res.send(registResult);
                    next();
                } else {
                    errorResp.send(res, consts.error.serverErrorLabel, error, 500);
                    next();
                }
            }).catch((err) => {
                let msg = err + "";
                logger.error(err);
                errorResp.send(res, "Mongo Error", msg, 500);
                next();
            });
        }).catch((err) => {
            let msg = err + "";
            logger.error(err);
            errorResp.send(res, "Mongo Error", msg, 500);
            next();
        });
    } else {
        logger.error("Validation errors:", validationResult.errorMessage);
        errorResp.send(res, "Bad Request", validationResult.errorMessage, 400);
        next();
    }
};

//Async function to get the maximum user app id
function getMaximumUserAppID() {
    let generalUserApplication = require("../../models/generalUserApplication.js")();
    return new Promise((resolve) => {
        generalUserApplication.find({}).sort({ generalUserApplicationID: -1 }).limit(1).then((resp) => {
            resolve(resp);
        });
    });
}

//Get final valid save body
//1.generalUserApplicationID, createdTime, modifiedTime is generated by system
//  specially, createdTime and modifiedTime is defined in the mongoose schema
//  thus, they will be generated automatically, don't need to consider them here
//2.If a field is undefined in reqBody, we sould not include this field in saveBody
function getSaveBody(res, currUserAppID, reqBody) {
    let saveBody = {};
    saveBody.generalUserApplicationID = currUserAppID;
    saveBody.createdBy = res.locals.username;
    saveBody.creatorAccessRole = res.locals.accessRole;
    if (reqBody.generalUserApplicationName !== undefined) {
        saveBody.generalUserApplicationName = reqBody.generalUserApplicationName;
    }
    if (reqBody.lora !== undefined) {
        //Change reqBody.lora's loraApplicationID and devEUIs to upper case
        reqBody.lora.loraApplicationID = reqBody.lora.loraApplicationID.toUpperCase();
        for (let index in reqBody.lora.devEUIs) {
            reqBody.lora.devEUIs[index] = reqBody.lora.devEUIs[index].toUpperCase();
        }
        saveBody.lora = reqBody.lora;
    }
    if (reqBody.scenarioID !== undefined) {
        saveBody.scenarioID = reqBody.scenarioID;
    }
    if (reqBody.ble !== undefined) {
        saveBody.ble = reqBody.ble;
    }
    return saveBody;
}

//Async function to save the user application
function saveUserApplicationInfo(saveBody) {
    let generalUserApplication = require("../../models/generalUserApplication.js")();
    let promise = new generalUserApplication(saveBody).save();
    return promise;
}

/////////////////////////////////////////////////////
//
// Put User Application Func
//
/////////////////////////////////////////////////////

obj.updateUserApplication = function(req, res, next) {
    let reqBody = req.body;
    let generalUserApplication = require("../../models/generalUserApplication.js")();
    let validationResult = generalUserAppValidation.validatePutReqBody(reqBody);
    if (validationResult.status === "success") {
        let updateBody = getUpdateBody(reqBody);
        updateUserApplicationInfo(updateBody).then((updateResponse) => {
            updateResponse = JSON.parse(JSON.stringify(updateResponse));
            //In the async function, we use findOneAndUpdate function.
            //When we use mongoose findOneAndUpdate function, we should notice:
            //1.If we cannot find the user application in the system, findOneAndUpdate function will return null to us
            //2.If we can find the user application in the system, findOneAndUpdate function will return the updated result
            if (updateResponse) {
                let updateResult = dataFormat.enforceTopLevelOfSchema(generalUserApplication, updateResponse);
                res.send(updateResult);
                next();
            } else {
                errorResp.send(res, "Bad Request", "Cannot find this device", 400);
                next();
            }
        }).catch((err) => {
            let msg = err + "";
            logger.error(err);
            errorResp.send(res, "Mongo Error", msg, 500);
            next();
        });
    } else {
        logger.error("Validation errors:", validationResult.errorMessage);
        errorResp.send(res, "Bad Request", validationResult.errorMessage, 400);
        next();
    }
};

//Get final valid update body
//1.generalUserApplicationID cannot be modified, it is only used to find the record
//2.modifiedTime is generated by system, set to current time
//3.If a field is undefined in reqBody, we sould not include this field in updateBody
//4.lora and scenarioID and ble can be null, means we want to delete these fields in the database
function getUpdateBody(reqBody) {
    let updateBody = {};
    updateBody.generalUserApplicationID = reqBody.generalUserApplicationID;
    //reqBody.generalUserApplicationName cannot be null, it exclude during validation
    if (reqBody.generalUserApplicationName !== undefined) {
        updateBody.generalUserApplicationName = reqBody.generalUserApplicationName;
    }
    //reqBody.lora can be null, it means we want to delete field lora in the database
    if (reqBody.lora !== undefined) {
        if (reqBody.lora !== null) {
            //Change reqBody.lora's loraApplicationID and devEUIs to upper case
            reqBody.lora.loraApplicationID = reqBody.lora.loraApplicationID.toUpperCase();
            for (let index in reqBody.lora.devEUIs) {
                reqBody.lora.devEUIs[index] = reqBody.lora.devEUIs[index].toUpperCase();
            }
        }
        updateBody.lora = reqBody.lora;
    }
    //reqBody.scenarioID can be null, it means we want to delete field scenarioID in the database
    if (reqBody.scenarioID !== undefined) {
        updateBody.scenarioID = reqBody.scenarioID;
    }
    //reqBody.ble can be null, it means we want to delete field ble in the database
    if (reqBody.ble !== undefined) {
        updateBody.ble = reqBody.ble;
    }
    return updateBody;
}

//Async function to update the user application
function updateUserApplicationInfo(updateBody) {
    let generalUserApplication = require("../../models/generalUserApplication.js")();
    //Update update object
    //1.update['$set'] means update the related fields
    //2.update['$unset'] means delete the related fields
    let update = {};
    update["$set"] = {};
    update["$unset"] = {};
    //updateBody.modifiedTime will always be exist
    //If updateBody.generalUserApplicationName exist, we update its value
    if (updateBody.generalUserApplicationName !== undefined) {
        update["$set"].generalUserApplicationName = updateBody.generalUserApplicationName;
    }
    //If updateBody.lora exist:
    //1.If updateBody.lora is null, we delete this field
    //2.If updateBody.lora is not null, we update this field
    if (updateBody.lora !== undefined) {
        if (updateBody.lora === null) {
            update["$unset"].lora = "";
        } else {
            update["$set"].lora = updateBody.lora;
        }
    }
    //If udpateBody.scenarioID exist:
    //1.If updateBody.scenarioID is null, we delete this field
    //2.If updateBody.scenarioID is not null, we update this field
    if (updateBody.scenarioID !== undefined) {
        if (updateBody.scenarioID === null) {
            update["$unset"].scenarioID = "";
        } else {
            update["$set"].scenarioID = updateBody.scenarioID;
        }
    }
    //If updateBody.ble exist:
    //1.If updateBody.ble is null, we delete this field
    //2.If updateBody.ble is not null, we update this field
    if (updateBody.ble !== undefined) {
        if (updateBody.ble === null) {
            update["$unset"].ble = "";
        } else {
            update["$set"].ble = updateBody.ble;
        }
    }
    //If update['unset'] is empty object, delete update['update']
    if (isEmpty(update["$unset"])) {
        delete update["$unset"];
    }
    return new Promise((resolve, reject) => {
        generalUserApplication.findOneAndUpdate({ generalUserApplicationID: updateBody.generalUserApplicationID },
            update, { new: true }, (err, resp) => {
                if (!err) {
                    resolve(resp);
                } else {
                    reject(err);
                }
            });
    });
}

function isEmpty(obj) {
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop))
            return false;
    }

    return JSON.stringify(obj) === JSON.stringify({});
}

/////////////////////////////////////////////////////
//
// Delete User Application Func
//
/////////////////////////////////////////////////////

// - DELETE "/generaluserapplication"
//Delete user application in the system
//1. Validate req body attribute
//2. Find if all the input user application exist in the system, if there is any user application
//   doesn't exist in the syste, throw an error message
//3. If all the input user application exist in the syste, then delete all of them
//4. summarize the delete result info and send back to frontend user
obj.deleteUserApplication = function(req, res, next) {
    let query = req.query;
    let validationResult = generalUserAppValidation.validateGetAndDelReqQuery(query);
    if (validationResult.status === "success") {
        getUserApplicationInfo(query.generalUserApplicationID).then((findResp) => {
            findResp = JSON.parse(JSON.stringify(findResp));
            let countForFindResult = findResp.length;
            let countForInputApp = query.generalUserApplicationID.split(",").length;
            if (countForFindResult === countForInputApp) {
                delUserApplicationInfo(query.generalUserApplicationID).then((delResp) => {
                    let delResult = {};
                    delResult.number = delResp.length;
                    delResult.generalUserApplicationIDs = delResp;
                    res.send(delResult);
                    next();
                }).catch((err) => {
                    let msg = err + "";
                    logger.error(err);
                    errorResp.send(res, "Mongo Error", msg, 500);
                    next();
                });
            } else {
                let notExistApp = findNotExistApp(findResp, query.generalUserApplicationID);
                let errorMessage = "We cannot find these device in the system: " + notExistApp;
                logger.error("Cannot find user application:", errorMessage);
                errorResp.send(res, "Bad Request", errorMessage, 400);
                next();
            }
        }).catch((err) => {
            let msg = err + "";
            logger.error(err);
            errorResp.send(res, "Mongo Error", msg, 500);
            next();
        });
    } else {
        logger.error("Validation errors:", validationResult.errorMessage);
        errorResp.send(res, "Bad Request", validationResult.errorMessage, 400);
        next();
    }
};

//Async function to get user application information
function getUserApplicationInfo(queryStr) {
    let array = [];
    let queryArr = queryStr.split(",");
    let generalUserApplication = require("../../models/generalUserApplication.js")();
    //Right now, the element in query is integer string, we need change it to integer number
    for (let i in queryArr) {
        array.push(parseInt(queryArr[i]));
    }
    return new Promise((resolve) => {
        if (generalUserApplication) {
            let query = {};
            query["$or"] = [];
            for (let i in array) {
                let elem = array[i];
                let queryObj = {};
                queryObj.generalUserApplicationID = elem;
                query["$or"].push(queryObj);
            }
            resolve(generalUserApplication.find(query));
        } else {
            resolve([]);
        }
    });
}

//Async function to delete the user application
//There are two methods to delete records in database:
//1. .remove({generalUserApplicationID: {$in:[1,2,3]}}), but these method only return the count of deleted records
//2. .findOneAndRemove({generalUserApplicationID:1}) + Promise.all(), findOneAndRemove will return the exact record
//   content instead of the count of records
//Thus, we choose findOneAndRemove + Promise.all() here. After deleting, we can show the deleted records info to
//frontend user
function delUserApplicationInfo(queryStr) {
    let promises = [];
    let queryArr = queryStr.split(",");
    let generalUserApplication = require("../../models/generalUserApplication.js")();
    for (let i in queryArr) {
        let promise = generalUserApplication.findOneAndRemove({ generalUserApplicationID: parseInt(queryArr[i]) });
        promises.push(promise);
    }
    return Promise.all(promises).then((resp) => {
        let userApplicationIDs = [];
        resp = JSON.parse(JSON.stringify(resp));
        for (let index in resp) {
            let elem = resp[index];
            userApplicationIDs.push(elem.generalUserApplicationID);
        }
        return userApplicationIDs;
    });
}

//Compare and find the user application doesn't exist in the req body
function findNotExistApp(findResp, userAppIDs) {
    let notExistApp = userAppIDs.split(",");
    for (let index in findResp) {
        let elem = findResp[index];
        let appID = elem.generalUserApplicationID.toString();
        if (notExistApp.includes(appID)) {
            notExistApp = notExistApp.filter((item) => item !== appID);
        }
    }
    return notExistApp;
}

// This function queries the full BLE applications so that we can get the remaining
// information such as latitude, longitude, etc.
function getAllBleAppIDsFromResp(resp) {
    let allBleAppIDs = [];

    for (let i in resp) {
        let app = resp[i];
        if (app.ble !== undefined) {
            app.ble.forEach((bleElem) => {
                if (allBleAppIDs.includes(bleElem.bleAppID) === false)
                    allBleAppIDs.push(bleElem.bleAppID);
            });
        }
    }

    return allBleAppIDs;
}

module.exports = obj;
