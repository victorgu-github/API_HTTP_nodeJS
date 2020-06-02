let fs = require("fs");
let csvStream = require("csv-write-stream");
let csvWriter = csvStream();

let consts = require("../../config/constants.js");
let dataValidation = require("../../common/dataValidation.js");
let dataFormat = reqFile("./common/dataFormat.js");
let loraDataValidation = require("../../common/loraDataTypesValidation.js");
let errorResp = require("../../common/errorResponse.js");
let zmqModelSelector = require("../../models/loraDevices/modelSelector.js");

let obj = {};

// GET "/loraDevice/channelHistory/appID/:applicationID/devEUI/:devEUIs/start/:startTime/end/:endTime"
obj.getChannelHistoryForTimeRange = function(req, res, next) {
    let validation = getValidationForGetHistoryReq(req.params);
    let devEUIs = req.params.devEUIs.toUpperCase().split(",");
    if (validation.length === 0) {
        // From here, the database operations are as follows:
        //   1) Query the app_node_session collection to get the device type
        //   2) Use the device type to query the appropriate ZMQ collection for all records in the
        //      specified time range
        //   3) Query the app_rssi_history collection for all records in the specified time range
        let proms = [];
        let AppNodeSession = require("../../models/nodeSessionAppServ.js")(req.params.applicationID);
        let AppRssiHist = require("../../models/appServRssiHistory.js")(req.params.applicationID);
        AppNodeSession.find(
            {
                DevEUI: {$in: devEUIs}
            }, { DevEUI: 1, DevType: 1 } // Project only the "DevType" field
        ).then((nsResp) => {
            if (nsResp.length === devEUIs.length) { // I.e.: Make sure we've actually found all the devices in question
                //find{DevEUI: {$in: devEUIs}} only return result, no order
                //order is totally different from devEUIs, so we need find the order manually
                nsResp = findOrder(devEUIs, nsResp);
                // Put all the devEUI's rssi history data query and zmq data into promises array in pairs
                // [[device1 rssi data], [device1 zmq data], [device2 rssi data], [device2 zmq data]]
                // the rssi data and zmq data will appear in pairs in the promises, when you use the response
                // should notice this 
                let deviceInfo = reqFile("./models/lora/deviceInfo.js")();
                for (let index in nsResp) {
                    let devEUI = devEUIs[index];
                    let device = nsResp[index];
                    proms.push(AppRssiHist.find(
                        {
                            DevEUI: devEUI.toUpperCase(),
                            Timestamp: {
                                $gte: new Date(Date.parse(req.params.startTime)),
                                $lt: new Date(Date.parse(req.params.endTime))
                            }
                        }, { // We're only finding for one device, so we already know its DevEUI
                            DevEUI: 0
                        }
                    ).sort({ Timestamp: -1 }));
                    let devType = device.DevType;
                    // Below: For each device, find its collection name and use that to look up the ZMQ
                    // model. Once the model has been retrieved, find the ZMQ records in question (or not,
                    // in specific cases).
                    proms.push(deviceInfo.findOne({ devType: devType }).then((resp) => {
                        let collectionName = (resp.collectionName !== undefined) ? resp.collectionName : null;
                        let ZmqModel = zmqModelSelector.getZmqModel(device.DevType, req.params.applicationID, collectionName);
                        if (ZmqModel !== null) { // Some devices like streetlights don't have a ZMQ model
                            return ZmqModel.find(
                                {
                                    devEUI: devEUI.toUpperCase(),
                                    timestamp: {
                                        $gte: new Date(Date.parse(req.params.startTime)),
                                        $lt: new Date(Date.parse(req.params.endTime))
                                    }
                                }, {
                                    timestamp: 1,
                                    rawData: 1
                                }
                            ).sort({ timestamp: -1 }).then((zmqRecs) => {
                                return zmqRecs;
                            });
                        } else {
                            return [];
                        }
                    }));
                }

                Promise.all(proms).then((promsResp) => {
                    // At this point we have all of the information we need, so simply organize the
                    // data, write it to CSV file, and download the file to the user's computer.
                    // Construct csvInput
                    let csvInput = [];
                    let len = promsResp.length/2;
                    for (let i = 0; i < len; i++) {
                        let rssiLookup = getRssiLookup(promsResp[2*i]);
                        let flattenedZmqRecs = [];
                        if (Array.isArray(promsResp[2*i + 1])) {
                            flattenedZmqRecs = unrollZmqRecords(promsResp[2*i + 1]);
                        }
                        
                        for (let j = 0; j < flattenedZmqRecs.length; j++) {
                            let rssiObjs = rssiLookup[flattenedZmqRecs[j].fCntUp];
                            if (rssiObjs === undefined) {
                                rssiObjs = [{
                                    GwMAC:      "null",
                                    Timestamp:  "null",
                                    RSSI:       "null",
                                    SNR:        "null"
                                }];
                            }
                            for (let k = 0; k < rssiObjs.length; k++) {
                                let csvEntry = {
                                    DevEUI:     devEUIs[i].toUpperCase(),
                                    FCntUp:     flattenedZmqRecs[j].fCntUp,
                                    Payload:    flattenedZmqRecs[j].payload,
                                    GwMAC:      rssiObjs[k].GwMAC,
                                    Timestamp:  rssiObjs[k].Timestamp,
                                    RSSI:       rssiObjs[k].RSSI,
                                    SNR:        rssiObjs[k].SNR
                                };
                                if (csvEntry.Timestamp !== "null") {
                                    csvEntry.Timestamp = csvEntry.Timestamp.toISOString();
                                }
                                // For old data:
                                if (csvEntry.FCntUp === undefined) {
                                    csvEntry.FCntUp = "null";
                                }
                                csvInput.push(csvEntry);
                            }
                        }
                    }

                    // Build our CSV file and download it to the host machine:
                    csvWriter = csvStream();
                    let filePath = "./content/";
                    let filename = Date.now() + "-ChannelHistory.csv";
                    let ws = new fs.createWriteStream(filePath + filename);
                    csvWriter.pipe(ws);
                    for (let i = 0; i < csvInput.length; i++) {
                        let row = {
                            DevEUI:     dataFormat.getCsvSafeHex(csvInput[i].DevEUI),
                            FCntUp:     csvInput[i].FCntUp,
                            Payload:    dataFormat.getCsvSafeHex(csvInput[i].Payload),
                            GwMAC:      dataFormat.getCsvSafeHex(csvInput[i].GwMAC),
                            Timestamp:  csvInput[i].Timestamp,
                            RSSI:       csvInput[i].RSSI,
                            SNR:        csvInput[i].SNR,
                        };
                        csvWriter.write(row);
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
                }).catch((err) => {
                    logger.error(err);
                    errorResp.send(res, consts.error.serverErrorLabel, "" + err, 500);
                    next();
                });
            } else {
                let notFoundDevEUIs = getNotFoundDevEUIs(nsResp, devEUIs);
                let msg = "Could not find devices: " + notFoundDevEUIs.join() + " in app server " + req.params.applicationID;
                errorResp.send(res, consts.error.badRequestLabel, msg, 400);
                next();
            }
        }).catch((err) => {
            logger.error(err);
            errorResp.send(res, consts.error.serverErrorLabel, "" + err, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validation, 400);
        next();
    }
};

function getValidationForGetHistoryReq(params) {
    let errors = [];

    errors = errors.concat(loraDataValidation.getApplicationIdValidation(params.applicationID, "applicationID", true, false));
    errors = errors.concat(loraDataValidation.getUrlDevEuiValidation(params.devEUIs, "devEUIs", true, true));
    errors = errors.concat(dataValidation.getUtcIsoDateValidation(params.startTime, "startTime"));
    errors = errors.concat(dataValidation.getUtcIsoDateValidation(params.endTime, "endTime"));
    errors = errors.concat(dataValidation.getTimeRangeValidation(params.startTime, params.endTime));

    let interval = Date.parse(params.endTime) - Date.parse(params.startTime);
    if (isNaN(interval) !== true) {
        if (interval > (24 * 3600 * 1000)) {
            errors.push("'startTime' and 'endTime' parameters must be within 24 hours of each other");
        }
    }

    return errors;
}

function getRssiLookup(rssiRecords) {
    let lookup = {};

    rssiRecords.forEach((rssiRec) => {
        if (lookup[rssiRec.FCntUp] === undefined)
            lookup[rssiRec.FCntUp] = [];
        lookup[rssiRec.FCntUp].push(rssiRec);
    });

    return lookup;
}

function unrollZmqRecords(zmqRecords) {
    let array = [];
    for (let i = 0; i < zmqRecords.length; i++) {
        for (let j = zmqRecords[i].rawData.length - 1; j >= 0; j--) {
            array.push({
                fCntUp:     zmqRecords[i].rawData[j].fCntUp,
                payload:    zmqRecords[i].rawData[j].payload
            });
        }
    }
    return array;
}

function findOrder(devEUIs, nsResp) {
    let array = [];
    for (let index in devEUIs) {
        let devEUI = devEUIs[index];
        let ns = nsResp.find((element) => { return element.DevEUI === devEUI; });
        array.push(ns);
    }
    return array;
}

function getNotFoundDevEUIs(nsResp, devEUIs) {
    let notFoundDevEUIs = [];
    let nsRespDevEUIs = nsResp.map((element) => { return element.DevEUI; });
    devEUIs.forEach((devEUI) => {
        if (!nsRespDevEUIs.includes(devEUI)) {
            notFoundDevEUIs.push(devEUI);
        }
    });
    return notFoundDevEUIs;
}

module.exports = obj;
