let reqFile = require.main.require;

let consts = reqFile("./config/constants.js");
let errorResp = reqFile("./common/errorResponse.js");
let dataValidation = reqFile("./common/dataValidation.js");

let obj = {};

// - GET "/generaluser/applications/datausage?startTime=...&endTime=..."
obj.getUserDataUsage = function(req, res, next) {
    let validation = getValidationForDataUsage(req.query);
    if (validation.length === 0) {
        // First, find our general user application:
        let GenUserApplication = reqFile("./models/users/generalUserApplication.js")();
        GenUserApplication.find({
            createdBy: res.locals.username
        }).then((resp) => {
            // The following 2 lines are to bring old data in line with the
            // current format. Note that we don't need to query for device types
            // here like we did for the web service above.
            resp = JSON.parse(JSON.stringify(resp));
            resp = transformRespToNewFormat(resp);
            let finalRespObj = {
                username:               res.locals.username,
                timeInterval:           req.query.startTime + " - " + req.query.endTime,
                numberOfLoRaPackets:    0
            };
            let asyncProms = [];
            for (let k = 0; k < resp.length; k++) {
                asyncProms.push(new Promise((resolve, reject) => { // eslint-disable-line no-unused-vars
                    // Because the "networks" array can contain multiple types of
                    // objects, we need to filter for the one we want - "lora".
                    let loraObj = resp[k].networks.filter((each) => { return each.type === "lora"; })[0];
                    // If this general user application doesn't have a lora object, then
                    // there's no data usage to calculate.
                    if (loraObj !== undefined) {
                        // If there are no devices in this application, skip to the next one
                        if (loraObj.devices.length > 0) {
                            // Get all aggregated RSSI data for the devices in this application:
                            let LoRaAggData = reqFile("./models/rssiAggData.js")();
                            let devEUIs = loraObj.devices;
                            let queryObj = getQueryObjForAggregationBetweenTimes(devEUIs, req.query.startTime, req.query.endTime);
                            LoRaAggData.find(queryObj, {
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
                                resolve(null);
                            });
                        } else {
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                }));
            }
            Promise.all(asyncProms).then(() => {
                res.send(finalRespObj);
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

function getValidationForDataUsage(query) {
    let errors = [];

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

function transformRespToNewFormat(genUserApps) {
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
        }
        output.push(obj);
    }

    return output;
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

module.exports = obj;
