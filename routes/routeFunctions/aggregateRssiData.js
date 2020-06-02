let mongoose = require("mongoose");
mongoose.Promise = global.Promise;

let logger = require("../../common/tracer.js");
let rssiValidation = require("../../common/aggRssiValidation.js");
let errorResp = require("../../common/errorResponse.js");
let AggRssiData = require("../../models/rssiAggData.js")();

let obj = {};

function getAggRssiRecordsBetweenDates(dateLow, dateHigh) {
    // Get a fresh connection in case the previous one has errored out
    AggRssiData = require("../../models/rssiAggData.js")();
    return AggRssiData.find(
        {
            aggStartTime:   {
                $gte: dateLow,
                $lt: dateHigh
            }
        }
    ).sort({ aggStartTime: -1 }).then((resp) => {
        let respJSON = JSON.parse(JSON.stringify(resp));
        let cleanResp = [];
        for (let i in respJSON) {
            cleanResp.push(removeMongoIdFields(respJSON[i]));
        }
        
        return cleanResp;
    });
}

// - GET "/lora/rssi/aggregated_data/time_unit/:time_unit"
obj.getLatestAggRssiData = function(req, res, next) {
    // Get a fresh connection in case the previous one has errored out
    AggRssiData = reqFile("./models/rssiAggData.js")();
    let timeUnitValidationResult = rssiValidation.isValidTimeUnit(req.params.time_unit);
    if (timeUnitValidationResult === true) {
        if (req.params.time_unit === "hour") {
            let timestampThreshold = new Date();
            timestampThreshold.setUTCMilliseconds(0);
            timestampThreshold.setUTCSeconds(0);
            timestampThreshold.setUTCMinutes(0);
            timestampThreshold.setUTCHours(timestampThreshold.getUTCHours() - 1);
            AggRssiData.findOne({
                aggStartTime: {
                    $gte: timestampThreshold
                }
            }).limit(1).then((resp) => {
                let respJSON;
                if (resp !== null) {
                    respJSON = removeMongoIdFields(JSON.parse(JSON.stringify(resp)));
                } else {
                    respJSON = null;
                }
                
                res.send({ result: respJSON });
                next();
            }).catch((promReject) => {
                logger.error(promReject);
                let msg = (promReject.message !== undefined) ? promReject.message : promReject + "";
                errorResp.send(res, "Server Error", msg, 500);
                next();
            });
        } else if (req.params.time_unit === "day") {
            let aggUpperBound = new Date();
            aggUpperBound.setMilliseconds(0);
            aggUpperBound.setSeconds(0);
            aggUpperBound.setMinutes(0);
            aggUpperBound.setHours(0);
            let aggLowerBound = new Date(aggUpperBound);
            aggLowerBound.setDate(aggUpperBound.getDate() - 1);

            getAggRssiRecordsBetweenDates(aggLowerBound, aggUpperBound).then((resp) => {
                // combineHoursIntoDays returns an array of days. But since we are only
                // passing it a maximum of 24 hours to combine, we know the result will
                // be an array of one day.
                let aggResp = combineHoursIntoDays(resp, aggLowerBound, aggUpperBound);
                if (aggResp.length > 0) {
                    res.send({ result: aggResp[0] });
                    next();
                } else {
                    res.send({ result: null });
                    next();
                }
            }).catch((promReject) => {
                logger.error(promReject);
                let msg = (promReject.message !== undefined) ? promReject.message : promReject + "";
                errorResp.send(res, "Server Error", msg, 500);
                next();
            });
        }
    } else {
        errorResp.send(res, "Bad Request", timeUnitValidationResult, 400);
        next();
    }
};

// - /lora/rssi/aggregated_data/time_unit/:time_unit/start/:start_time/end/:end_time
obj.getAggRssiDataForTimeRange = function(req, res, next) {
    let timeUnitValidationResult = rssiValidation.isValidTimeUnit(req.params.time_unit);
    if (timeUnitValidationResult === true) {
        let timeBoundsValidationResult = rssiValidation.areValidTimeBounds(req.params);
        if (timeBoundsValidationResult === true) {
            if (req.params.time_unit === "hour") {
                let aggLowerBound = new Date(req.params.start_time);
                let aggUpperBound = new Date(req.params.end_time);
                getAggRssiRecordsBetweenDates(aggLowerBound, aggUpperBound).then((resp) => {
                    res.send({ result: resp });
                    next();
                }).catch((promReject) => {
                    logger.error(promReject);
                    let msg = (promReject.message !== undefined) ? promReject.message : promReject + "";
                    errorResp.send(res, "Server Error", msg, 500);
                    next();
                });
            } else if (req.params.time_unit === "day") {
                let aggLowerBound = new Date(req.params.start_time);
                let aggUpperBound = new Date(req.params.end_time);
                getAggRssiRecordsBetweenDates(aggLowerBound, aggUpperBound).then((resp) => {
                    let aggResp = combineHoursIntoDays(resp, aggLowerBound, aggUpperBound);
                    res.send({ result: aggResp });
                    next();
                }).catch((promReject) => {
                    logger.error(promReject);
                    let msg = (promReject.message !== undefined) ? promReject.message : promReject + "";
                    errorResp.send(res, "Server Error", msg, 500);
                    next();
                });
            }
        } else {
            logger.error(timeBoundsValidationResult);
            errorResp.send(res, "Bad Request", timeBoundsValidationResult, 400);
            next();
        }
    } else {
        logger.error(timeUnitValidationResult);
        errorResp.send(res, "Bad Request", timeUnitValidationResult, 400);
        next();
    }
};

function combineHoursIntoDays(input, timeLow, timeHigh) {
    let numDays = (timeHigh - timeLow) / (1000 * 3600 * 24);
    let combinedOutput = [];
    // Iterate through the number of days that the input spans. We'll return "null"
    // for days in which there are no records.
    let timeItr = new Date(timeHigh);
    for (let i = 0; i < numDays; i++) {
        // Find out when the current day ends, then look for the (up to) 24 hour-boxed
        // records to combine for that day.
        let dayEnd = new Date(timeItr);
        dayEnd.setDate(dayEnd.getDate() - 1);
        let hoursToCombine = [];
        for (let j in input) {
            let aggTime = new Date(input[j].aggStartTime);
            if (aggTime >= dayEnd && aggTime < timeItr) {
                hoursToCombine.push(input[j]);
            }
        }
        if (hoursToCombine.length > 0) {
            combinedOutput.push(getOneAggRssiRecord(hoursToCombine, dayEnd));
        // } else {
        //     combinedOutput.push(
        //         {
        //             aggStartTime:       dayEnd,
        //             totalRssiEntries:   0
        //         }
        //     );
        }
        timeItr.setDate(timeItr.getDate() - 1);
    }
    return combinedOutput;
}

function getOneAggRssiRecord(inputArr, aggStartTime) {
    let output = {
        aggDur:                 "oneDay",
        aggStartTime:           aggStartTime,
        totalNumDevices:        0,
        totalNumGateways:       0,
        totalRssiEntries:       0,
        aggregationByDevEUI:    [],
        aggregationByGateway:   [],
        aggregationByDevType:   []
    };

    let byDevEUI = {};
    let byGwMAC = {};
    let byDevType = {};
    
    for (let j in inputArr) {
        output.totalRssiEntries += inputArr[j].totalRssiEntries;
        // Aggregate all "by DevEUI" values
        let byDevEuiArr = inputArr[j].aggregationByDevEUI;
        for (let k in byDevEuiArr) {
            let key = byDevEuiArr[k].devEUI;
            if (byDevEUI[key] === undefined) {
                byDevEUI[key] = byDevEuiArr[k];
            } else {
                byDevEUI[key].numRssiEntries += byDevEuiArr[k].numRssiEntries;
            }
        }
        // Aggregate all "by GwMAC" values
        let byGwMacArr = inputArr[j].aggregationByGateway;
        for (let k in byGwMacArr) {
            let key = byGwMacArr[k].gatewayMAC;
            if (byGwMAC[key] === undefined) {
                byGwMAC[key] = byGwMacArr[k];
            } else {
                byGwMAC[key].numRssiEntries += byGwMacArr[k].numRssiEntries;
            }
        }
        // Aggregate all "by DevType" values
        let byDevTypeArr = inputArr[j].aggregationByDevType;
        for (let k in byDevTypeArr) {
            let key = byDevTypeArr[k].devType;
            if (byDevType[key] === undefined) {
                byDevType[key] = byDevTypeArr[k];
            } else {
                byDevType[key].numRssiEntries += byDevTypeArr[k].numRssiEntries;
                let devEUIs = byDevTypeArr[k].devEUIs;
                for (let m in devEUIs) {
                    if (byDevType[key].devEUIs.includes(devEUIs[m]) === false) {
                        byDevType[key].devEUIs.push(devEUIs[m]);
                    }
                }
            }
        }
    }
    output.totalNumDevices = Object.keys(byDevEUI).length;
    output.totalNumGateways = Object.keys(byGwMAC).length;
    // Convert to arrays
    for (let j in byDevEUI) {
        output.aggregationByDevEUI.push(byDevEUI[j]);
    }
    for (let j in byGwMAC) {
        output.aggregationByGateway.push(byGwMAC[j]);
    }
    for (let j in byDevType) {
        output.aggregationByDevType.push(byDevType[j]);
    }
    return output;
}

function removeMongoIdFields(inputJSON) {
    delete inputJSON._id;
    delete inputJSON.__v;
    for (let i in inputJSON.aggregationByDevEUI) {
        delete inputJSON.aggregationByDevEUI[i]._id;
    }
    for (let i in inputJSON.aggregationByGateway) {
        delete inputJSON.aggregationByGateway[i]._id;
    }
    for (let i in inputJSON.aggregationByDevType) {
        delete inputJSON.aggregationByDevType[i]._id;
    }

    return inputJSON;
}

module.exports = obj;
