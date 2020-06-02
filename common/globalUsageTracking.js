// This file contains the user tracking middleware used by various web services.
// To track information for a given type of web service, add your own middleware
// function below and plug it into the "api.js" file.

let jwt = require("jsonwebtoken");

let config = reqFile("./config/config.js");

let obj = {};

obj.logUsage = function(req, res, next) {
    // I.e.: We only track requests that come from logged-in users
    if (req.headers["x-access-token"] !== undefined && req.headers["x-access-token"] !== null) {
        let token = req.headers["x-access-token"];
        jwt.verify(token, config.secret, (err, decoded) => {
            if (err === null) {
                let userAndRoleParts = decoded.id.split(".");
                let accessRole = userAndRoleParts[userAndRoleParts.length - 1];
                res.locals.accessRole = accessRole;
                res.locals.username = decoded.id.substring(0, (decoded.id.length - (accessRole.length + 1)));
                let loggedInUserUsage = reqFile("./models/users/globalUsageTracking.js")();
                let objToSave = {
                    username:   res.locals.username,
                    accessRole: res.locals.accessRole,
                    url:        req.url,
                    respCode:   res.statusCode,
                    timestamp:  new Date()
                };
                if (res.locals.comments !== undefined) {
                    objToSave.comments = res.locals.comments;
                }
                (new loggedInUserUsage(objToSave)).save();
            }
        });
    }
};

module.exports = obj;
