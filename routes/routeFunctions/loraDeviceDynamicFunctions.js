let reqFile = require.main.require;

let errorResp = reqFile("./common/errorResponse.js");
let consts = reqFile("./config/constants.js");
let loraDataValidation = reqFile("./common/loraDataTypesValidation.js");
let nodeSessionFuncs = require("./loraDeviceOneStepRegistGetFunctions.js");
let dataFormat = reqFile("./common/dataFormat.js");

let obj = {};

// GET "/lora/:applicationID/devices/dynamic"
obj.getLoRaDeviceDynamic = function(req, res, next) {
    let validation = getValidationForGetRequest(req);
    if (validation.length === 0) {
        // This function makes numerous database queries and operations. These
        // can be grouped into the following stages:
        //   1) Query and assemble combined node session
        //   2) Query the app_rssi_history once for each DevEUI to get the
        //      latest SNR & RSSI values, and latest uplink time
        //   3) Query the lora_dyn_agg_info collection for the latest 1 record,
        //      use it to get the last hour average SNR & RSSI for all DevEUIs
        //   4) Aggregate the lora_dyn_agg_info collection once for all DevEUIs
        //      to get their number of RSSI records in last day

        // First, get our combined node sessions:
        let nsProms = [];
        let GwNodeSession = reqFile("./models/nodeSessionGwServ.js")();
        let AppNodeSession = reqFile("./models/nodeSessionAppServ.js")(req.params.applicationID);
        nsProms.push(GwNodeSession.find({
            DevEUI: { $in: req.query.devEUIs.toUpperCase().split(",") }
        }));
        nsProms.push(AppNodeSession.find({
            DevEUI: { $in: req.query.devEUIs.toUpperCase().split(",") }
        }));
        Promise.all(nsProms).then((nodes) => {
            for (let i in nodes[0]) {
                nodes[0][i] = dataFormat.enforceSchemaOnDocument(GwNodeSession, nodes[0][i], false);
            }
            for (let i in nodes[1]) {
                nodes[1][i] = dataFormat.enforceSchemaOnDocument(AppNodeSession, nodes[1][i], false);
            }
            let gwNodeSessionsMap = nodeSessionFuncs.transGwNodeSessionsArrayToMap(nodes[0]);
            let combinedNodeSessions = getCombinedNodeSessions(gwNodeSessionsMap, nodes[1]);
            for (let i in combinedNodeSessions) { combinedNodeSessions[i].dynamicFields = {}; }

            let dynamicProms = [];
            // Get the latest RSSI & SNR values for each DevEUI:
            let RssiHistory = reqFile("./models/rssiHistoryAppServ.js")(req.params.applicationID);
            let twentyFourHoursAgo = new Date();
            twentyFourHoursAgo.setUTCDate(twentyFourHoursAgo.getUTCDate() - 1);
            combinedNodeSessions.forEach((combNode) => {
                dynamicProms.push(RssiHistory.find({
                    DevEUI: combNode.DevEUI,
                    Timestamp: {
                        $gte: twentyFourHoursAgo
                    }
                }, {
                    RSSI:       1,
                    SNR:        1,
                    Timestamp:  1
                }).limit(1).sort({ Timestamp: -1 }));
            });
            // Next, query for our highest average SNR & RSSI in the past hour:
            let LoRaAggData = reqFile("./models/rssiAggData.js")();
            dynamicProms.push(LoRaAggData.find({}, {
                highestAvgRssiAndSnrByDevEUI: 1
            }).limit(1).sort({ aggStartTime: -1 }));
            // Next, get the aggregate number of records in the past day for all DevEUIs:
            let aggQueryObj = getQueryObjForAggregation(req.query);
            dynamicProms.push(LoRaAggData.aggregate(
                {
                    $match: aggQueryObj
                }, {
                    $facet: {
                        "totalRssiInLastDayByDevEUI": [
                            {
                                $project: {
                                    aggregationByDevEUI: {
                                        $filter: {
                                            input:  "$aggregationByDevEUI",
                                            as:     "byDevEUI",
                                            cond:   {
                                                $in: [ "$$byDevEUI.devEUI", req.query.devEUIs.toUpperCase().split(",") ]
                                            }
                                        }
                                    }
                                }
                            }, {
                                $unwind: "$aggregationByDevEUI"
                            }, {
                                $group: {
                                    _id:            "$aggregationByDevEUI.devEUI",
                                    rssiInLastDay:  { $sum: "$aggregationByDevEUI.numRssiEntries" }
                                }
                            }
                        ]
                    }
                }
            ));

            Promise.all(dynamicProms).then((dynamicPromsResp) => {
                let numDevEUI = combinedNodeSessions.length;
                if (numDevEUI !== 0) {
                    let highestValsAgg = dynamicPromsResp[numDevEUI][0];
                    let highestValsMap;
                    if (highestValsAgg !== undefined) {
                        highestValsMap = getMapOfHighestValues(highestValsAgg.highestAvgRssiAndSnrByDevEUI);
                    } else {
                        highestValsMap = {};
                    }
                    let totalRssiPerDevEuiMap = getMapOfTotalRssiPerDevEUI(dynamicPromsResp[numDevEUI + 1]);
                    // Iterate through each found DevEUI:
                    for (let i in combinedNodeSessions) {
                        let node = combinedNodeSessions[i];
                        // Parse the latest RSSI history for each found DevEUI:
                        let latestRssiRecord = dynamicPromsResp[i][0];
                        let hasLatest = (latestRssiRecord !== undefined);
                        node.dynamicFields.latestRSSI =   (hasLatest) ? latestRssiRecord.RSSI : null;
                        node.dynamicFields.latestSNR =    (hasLatest) ? latestRssiRecord.SNR : null;
                        // Parse highest RSSI and SNR:
                        let highestVals = highestValsMap[node.DevEUI];
                        let hasHighest = (highestVals !== undefined);
                        node.dynamicFields.lastHourHighestAverageRSSI = (hasHighest) ? highestVals.highestAvgRssi.avgRSSI : null;
                        node.dynamicFields.lastHourHighestAverageSNR =  (hasHighest) ? highestVals.highestAvgSnr.avgSNR : null;
                        // Get the total number of RSSI records for this device in the last day:
                        let totalInLastDay = totalRssiPerDevEuiMap[node.DevEUI];
                        let hasTotal = (totalInLastDay !== undefined);
                        node.dynamicFields.numRssiRecsInLastDay = (hasTotal) ? totalInLastDay : null;
                        // Latest uplink time:
                        node.dynamicFields.latestUplinkTime = (hasLatest) ? latestRssiRecord.Timestamp : null;
                        // Latest downlink time:
                        node.dynamicFields.latestDownlinkTime = new Date(Math.max(
                            node.EncryptedMacCmdSentTime.getTime(),
                            node.UnencryptedMacCmdSentTime.getTime(),
                            node.UserPayloadDataSentTime.getTime()
                        ));
                    }
                }
                res.send(combinedNodeSessions);
                next();
            }).catch((err) => {
                logger.error(err);
                errorResp.send(res, consts.serverErrorLabel, ("" + err), 500);
                next();
            });
        }).catch((err) => {
            logger.error(err);
            errorResp.send(res, consts.serverErrorLabel, ("" + err), 500);
            next();
        });
    } else {
        errorResp.send(res, consts.badRequestLabel, validation, 400);
        next();
    }
};

function getValidationForGetRequest(req) {
    let errors = [];

    errors = errors.concat(loraDataValidation.getApplicationIdValidation(req.params.applicationID, "applicationID", true, false));
    errors = errors.concat(loraDataValidation.getUrlDevEuiValidation(req.query.devEUIs, "devEUIs", true, true));

    return errors;
}

function getCombinedNodeSessions(gwNodeSessionsMap, appNodeSessions) {
    let result = [];

    for (let j = 0; j < appNodeSessions.length; j++) {
        let devEUI = appNodeSessions[j].DevEUI;
        let applicationID = appNodeSessions[j].ApplicationID;
        let index = devEUI + "_" + applicationID;
        let gwNS = gwNodeSessionsMap[index];
        if (gwNS) {
            let combObj = nodeSessionFuncs.addFieldsFromGwNodeSessionToAppNodeSession(gwNS, appNodeSessions[j]);
            combObj.UserPayloadData = combObj.UserPayloadData.toString("hex").toUpperCase();
            delete combObj.UserPayloadDataLen;
            result.push(combObj);
        }
    }

    return result;
}

function getMapOfHighestValues(highestValues) {
    let output = {};

    highestValues.forEach((highestVal) => {
        output[highestVal.devEUI] = highestVal;
    });

    return output;
}

function getQueryObjForAggregation(query) {
    let queryObj = {};

    let devEUIs = query.devEUIs.toUpperCase().split(",");
    queryObj.aggregationByDevEUI = { $elemMatch: { devEUI: { $in: devEUIs } } };
    let endTime = new Date();
    endTime.setMilliseconds(0);
    endTime.setSeconds(0);
    endTime.setMinutes(0);
    endTime.setHours(0);
    let startTime = new Date(endTime);
    startTime.setDate(startTime.getDate() - 1);
    queryObj.aggStartTime = {
        $gte:   startTime,
        $lt:    endTime
    };

    return queryObj;
}

function getMapOfTotalRssiPerDevEUI(rssiInLastDay) {
    let output = {};

    rssiInLastDay[0].totalRssiInLastDayByDevEUI.forEach((dailyRssiTotal) => {
        output[dailyRssiTotal._id] = dailyRssiTotal.rssiInLastDay;
    });

    return output;
}

module.exports = obj;
