// This file contains the user tracking middleware used by various web services.
// To track information for a given type of web service, add your own middleware
// function below and plug it into the "api.js" file.

let config = require("../config/config.js");

let obj = {};

obj.devCtrlAndDataTracking = function(req, res) {
    if (config.authenticateWebServices === true) {
        let usageRecord = getCommonFields(req, res);

        usageRecord.deviceType = res.locals.devType;
        usageRecord.deviceEUI = res.locals.devEUI;
        usageRecord.loraAppID = res.locals.appID;

        let DevCtrlUsageHistory = require("../models/users/webServiceUsageTracking.js")();
        (new DevCtrlUsageHistory(usageRecord)).save();
    }
};

function getCommonFields(req, res) {
    return {
        username:           res.locals.username,
        accessRole:         res.locals.accessRole,
        url:                "/api" + req.url,
        respCode:           res.statusCode,
        operationType:      res.locals.operationType,
        operationDetail:    res.locals.operationDetail
    };
}

module.exports = obj;
