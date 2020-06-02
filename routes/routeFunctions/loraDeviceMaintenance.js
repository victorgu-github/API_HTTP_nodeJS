let mongoose = require("mongoose");
mongoose.Promise = global.Promise;

let errorResp = require("../../common/errorResponse.js");
let logger = require("../../common/tracer.js");
let dataValidation = require("../../common/dataValidation.js");
let consts = require("../../config/constants.js");
let loraDataValidation = require("../../common/loraDataTypesValidation.js");
let dataFormat = require("../../common/dataFormat.js");

//Use in get maintenance status web api, make sure return a complete maintenance history object to frontend
const MAINTENANCE_STATUS_ATTRIBUTES = [
    "devEUI",
    "applicationID",
    "startTime",
    "endTime",
    "comments",
    "status"
];

let obj = {};

// - POST "/lora_device/maintenance/"
obj.updateStatus = function(req, res, next) {
    let inputValidation = getPostRequestValidation(req.body);
    if (inputValidation.length === 0) {
        let devEUIsToFind = getDevEUIsToFind(req.body);
        getNodeSessions(req, devEUIsToFind).then((nodeSessions) => {
            let devEuiFound = {};
            nodeSessions.forEach((node) => {
                devEuiFound[node.DevEUI] = true;
            });
            if (devEUIsToFind.length === nodeSessions.length) {
                let proms = [];
                // 1. Update all node sessions with InMaintenance status
                proms.push(setNodeSessionMaintField(req, devEUIsToFind));
                // 2. Create / update all maintenance history records
                proms.push(updateMaintHistoryRecords(req, devEUIsToFind));
                Promise.all(proms).then((resp) => {
                    if (resp[0].n === nodeSessions.length) {
                        res.send({ result: resp[1] });
                        next();
                    } else {
                        let errMsg = "Problem updating one or more app server node sessions";
                        errorResp.send(res, consts.error.serverErrorLabel, errMsg, 500);
                        next();
                    }
                }).catch((err) => {
                    let errMsg = "" + err;
                    logger.error(errMsg);
                    errorResp.send(res, consts.error.serverErrorLabel, errMsg, 500);
                    next();
                });
            } else {
                let errMsg = "Could not find the following DevEUIs: [ ";
                for (let i in devEUIsToFind) {
                    if (devEuiFound[devEUIsToFind[i]] === undefined) {
                        errMsg += devEUIsToFind[i] + ", ";
                    }
                }
                errMsg = errMsg.substring(0, (errMsg.length - 2));
                errMsg += " ]";
                errorResp.send(res, consts.error.badRequestLabel, errMsg, 400);
                next();
            }
        }).catch((err) => {
            let errMsg = "" + err;
            logger.error(errMsg);
            errorResp.send(res, consts.error.serverErrorLabel, errMsg, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, inputValidation, 400);
        next();
    }
};

function getPostRequestValidation(body) {
    let errors = [];
    if (body.devEUI === undefined) {
        errors.push("Must include 'devEUI' field in the request body containing single or multiple comma-separated DevEUIs");
    }
    let devEuiValidation = dataValidation.getDevEuiArrValidation(body.devEUI);
    errors = errors.concat(devEuiValidation);
    if (body.comments !== undefined && typeof body.comments !== "string") {
        errors.push("Comments must be of type string");
    }

    errors = errors.concat(loraDataValidation.getApplicationIdValidation(body.applicationID, "applicationID", true, false));

    if (body.maintCommand !== "enable" && body.maintCommand !== "disable") {
        errors.push("Must specify a 'maintCommand' string in the request body whose value must be either 'enable' or 'disable'");
    }
    return errors;
}

function getDevEUIsToFind(body) {
    let outArr = [];
    if (body.devEUI.includes(",")) {
        outArr = body.devEUI.split(",");
    } else {
        outArr.push(body.devEUI);
    }
    for (let i in outArr) {
        outArr[i] = outArr[i].toUpperCase();
    }
    return outArr;
}

function getNodeSessions(req, devEUIsToFind) {
    let AppNodeSession = require("../../models/nodeSessionAppServ.js")(dataFormat.padWithZerosToFixedLength(req.body.applicationID, 16));
    let query = {
        DevEUI: { $in: devEUIsToFind }
    };
    return AppNodeSession.find(query);
}

function setNodeSessionMaintField(req, devEUIsToFind) {
    let AppNodeSession = require("../../models/nodeSessionAppServ.js")(dataFormat.padWithZerosToFixedLength(req.body.applicationID, 16));
    let maintVal = (req.body.maintCommand === "enable") ? true : false;
    let query = { DevEUI: { $in: devEUIsToFind } };
    let update = { $set: { InMaintenance: maintVal } };
    return AppNodeSession.update(query, update, { multi: true });
}

function updateMaintHistoryRecords(req, devEUIsToFind) {
    let upsertProms = [];
    for (let i in devEUIsToFind) {
        upsertProms.push(findThenModifyMaintRecord(req.body, devEUIsToFind[i]));
    }
    return Promise.all(upsertProms);
}

function findThenModifyMaintRecord(body, devEUI) {
    let paddedAppID = dataFormat.padWithZerosToFixedLength(body.applicationID, 16);
    let MaintHist = require("../../models/lora/maintenanceHistory.js")(paddedAppID);
    let query;
    let update;
    let outObj;
    return MaintHist.find({
        devEUI: devEUI
    }).limit(1).sort({ _id: -1 }).then((resp) => {
        let latestMaintRec = resp[0];
        let latestStatus;
        if (latestMaintRec !== undefined)
            latestStatus = latestMaintRec.status;
        let opts = { new: true };
        // From here, there are 4 categories of outcomes:
        // Case 1: open new record:
        if ((latestMaintRec === undefined && body.maintCommand === "enable") ||
            (latestMaintRec !== undefined && latestStatus === "Closed" && body.maintCommand === "enable")) {
            query = {
                devEUI:         devEUI,
                applicationID:  paddedAppID,
                startTime:      new Date(),
                status:         "Open"
            };
            if (body.comments !== undefined) {
                query.comments = formatNewComment(body.comments);
            }
            update = query;
            opts.upsert = true;
        }
        // Case 2: close existing record:
        else if (latestMaintRec !== undefined && latestStatus === "Open" && body.maintCommand === "disable") {
            query = { _id: latestMaintRec._id };
            update = {
                $set: {
                    endTime:    new Date(),
                    status:     "Closed"
                }
            };
            if (body.comments !== undefined) {
                let latestComments = "";
                if (latestMaintRec !== undefined)
                    latestComments = latestMaintRec.comments;
                update.$set.comments = latestComments + formatNewComment(body.comments);
            }
        }
        // Case 3: update comments in existing record:
        else if (latestMaintRec !== undefined && latestStatus === "Open" && body.comments !== undefined) {
            query = { _id: latestMaintRec._id };
            let latestComments = "";
            if (latestMaintRec !== undefined && latestMaintRec.comments !== undefined)
                latestComments = latestMaintRec.comments;
            update = {
                $set: {
                    comments: latestComments + formatNewComment(body.comments)
                }
            };
        }
        // Case 4: don't do any database changes, just return maintenance status object:
        else {
            outObj = {
                devEUI: devEUI
            };
            if (latestMaintRec === undefined) {
                outObj.inMaintenance = false;
            } else if (latestMaintRec !== undefined) {
                if (latestMaintRec.comments !== undefined)
                    outObj.comments = latestMaintRec.comments;
                if (latestMaintRec.status === "Open")
                    outObj.inMaintenance = true;
                if (latestMaintRec.status === "Closed")
                    outObj.inMaintenance = false;
            }
            return Promise.resolve(outObj);
        }

        // Perform our maintenance record updates:
        return MaintHist.findOneAndUpdate(query, update, opts).then((upsResp) => {
            // Set our response object:
            outObj = {
                devEUI:     devEUI,
                comments:   upsResp.comments
            };
            // "inMaintenance" field:
            if (latestMaintRec === undefined && body.maintCommand === "enable") {
                outObj.inMaintenance = true;
            } else if (latestMaintRec !== undefined) {
                if (upsResp.status === "Open")
                    outObj.inMaintenance = true;
                if (upsResp.status === "Closed")
                    outObj.inMaintenance = false;
            }
            return outObj;
        });
    });
}

function formatNewComment(comment) {
    return (new Date()).toISOString() + ": " + comment + "\n";
}

// - GET "/lora_device/maintenance/latest/appid/:applicationID/dev_eui/:devEUI"
obj.getStatus = function(req, res, next) {
    let application_id = req.params.applicationID;
    let devEUI = req.params.devEUI.toUpperCase();
    let errors = validateReqParams(application_id, devEUI);
    if (errors.length === 0) {
        let maintenanceModel = getMaintenanceModel(application_id);
        maintenanceModel.find({ devEUI: devEUI }).sort({ startTime: -1 }).limit(1).then((resp) => {
            resp = JSON.parse(JSON.stringify(resp));
            if (resp.length !== 0) {
                let maintenanceResult = prepMaintenanceResult(resp[0]);
                res.send(maintenanceResult);
                next();
            }
            else {
                res.send({});
                next();
            }
        }).catch((err) => {
            let errMsg = "" + err;
            logger.error(errMsg);
            errorResp.send(res, consts.error.serverErrorLabel, errMsg, 500);
            next();
        });
    }
    else {
        errorResp.send(res, consts.error.badRequestLabel, errors, 400);
        next();
    }
};

//Validate the parameters from request url
function validateReqParams(application_id, devEUI) {
    let errors = [];
    // User required fields:
    errors = errors.concat(loraDataValidation.getApplicationIdValidation(application_id, "applicationID", true, false));
    errors = errors.concat(loraDataValidation.getDevEuiValidation(devEUI, true));
    return errors;
}

//Prepare complete maintenance history data to send to frontend, if "endTime" has no data stored in the database
//we will send null value for it
function prepMaintenanceResult(maintenanceRecord) {
    let maintenanceResult = {};
    let maintenaceStatusAttributes = MAINTENANCE_STATUS_ATTRIBUTES;
    for (let index in maintenaceStatusAttributes) {
        let attribute = maintenaceStatusAttributes[index];
        if (maintenanceRecord[attribute] !== undefined) {
            maintenanceResult[attribute] = maintenanceRecord[attribute];
        }
        else {
            maintenanceResult[attribute] = null;
        }
    }
    return maintenanceResult;
}

function getMaintenanceModel(applicationID) {
    return require("../../models/lora/maintenanceHistory.js")(applicationID);
}

module.exports = obj;
