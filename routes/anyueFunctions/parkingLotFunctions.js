let loraDataValidation = reqFile("./common/loraDataTypesValidation.js");
let errorResp = reqFile("./common/errorResponse.js");
let consts = reqFile("./config/constants.js");

const lastActiveThresholdHours = 24;

let obj = {};

// - GET "/api/anyue/lora/:applicationID/charginglotstatus"
obj.parkingLotFunction = function(req, res, next) {
    let validation = getValidationForGET(req);
    if (validation.length === 0) {
        // Now, we query two different collections:
        //   1) The parkinglot_data collection to get our latest parsed data
        //   2) The app_node_session collection to get the device name to use as the
        //      'anyueChargingLotID' field

        // 1) Parking lot data:
        let parkingLot = reqFile("./models/loraDevices/parkingLotSensor.js")(req.params.applicationID);
        let lastActiveThreshold = new Date();
        lastActiveThreshold.setUTCHours(lastActiveThreshold.getUTCHours() - lastActiveThresholdHours);
        parkingLot.aggregate(
            {
                $match: {
                    timestamp: {
                        $gte: lastActiveThreshold
                    }
                }
            },
            { $sort: { timestamp: -1 } },
            {
                $group: {
                    _id: { devEUI: "$devEUI" },
                    latest: { $first: "$$CURRENT" }
                }
            },
            {
                $project: {
                    _id: 0
                }
            }
        ).then((zmqResp) => {
            // 2) App node sessions:
            let devEUIs = [];
            zmqResp.forEach((record) => { devEUIs.push(record.latest.devEUI); });
            let appNodeSession = reqFile("./models/nodeSessionAppServ.js")(req.params.applicationID);
            appNodeSession.find({
                DevEUI: { $in: devEUIs }
            }, {
                _id: 0,
                DevEUI: 1,
                Name: 1
            }).then((nsResp) => {
                // Format our final response:
                let finalResp = [];
                zmqResp.forEach((eachZMQ) => {
                    let devEUI = eachZMQ.latest.devEUI;
                    let anyueID = nsResp.filter((each) => { return each.DevEUI === devEUI; })[0];
                    let parkingSensorDate = eachZMQ.latest.timestamp;
                    let zmqParsedData;
                    if (eachZMQ.latest.parsedData !== undefined) {
                        zmqParsedData = eachZMQ.latest.parsedData[eachZMQ.latest.parsedData.length - 1];
                        parkingSensorDate.setUTCSeconds(zmqParsedData.timeSecond);
                    } else {
                        zmqParsedData = null;
                        parkingSensorDate.setUTCSeconds(eachZMQ.latest.rawData[eachZMQ.latest.rawData.length - 1].timeSecond);
                    }
                    finalResp.push({
                        anyueChargingLotID: (anyueID !== undefined && anyueID.Name !== undefined) ? anyueID.Name : null,
                        status:             obj.combineChargingLotStatuses(zmqParsedData),
                        date:               parkingSensorDate
                    });
                });
                res.send(finalResp);
                next();
            }).catch((err) => {
                logger.error(err);
                errorResp.sendAnyueErrorResponse(res, consts.error.serverErrorLabel, ("" + err), 500);
            });
        }).catch((err) => {
            logger.error(err);
            errorResp.sendAnyueErrorResponse(res, consts.error.serverErrorLabel, ("" + err), 500);
        });
    } else {
        errorResp.sendAnyueErrorResponse(res, consts.error.badRequestLabel, validation, 400);
    }
};

function getValidationForGET(req) {
    let errors = [];

    errors = errors.concat(loraDataValidation.getApplicationIdValidation(req.params.applicationID, "applicationID", true, false));

    return errors;
}

obj.combineChargingLotStatuses = function(zmqParsedData) {
    if (zmqParsedData !== null) {
        let statusCode = zmqParsedData.statusCode;
        // Two outcomes:
        //   1) There is no error detected in the statusCode, so show either "available"
        //      or "occupied"
        //   2) There is an error detected in the statusCode, so show "error"
        if (consts.parkingLotSensor.errorCodes.includes(statusCode)) {
            return "error";
        } else {
            return zmqParsedData.parkFlag;
        }
    } else {
        return null;
    }
};

module.exports = obj;
