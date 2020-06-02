// This file contains the authentication middleware used by every secured
// web service.
// Put any authentication-related middleware in this file.

let jwt = require("jsonwebtoken");

let config = require("../config/config.js");
let errorResp = require("../common/errorResponse.js");
let consts = require("../config/constants.js");

let obj = {};

obj.authenticate = function(req, res, next) {
    if (config.authenticateWebServices === true) {
        if (req.headers["x-access-token"] !== undefined && req.headers["x-access-token"] !== null) {
            let token = req.headers["x-access-token"];
            jwt.verify(token, config.secret, (err, decoded) => {
                if (err === null) {
                    let userAndRoleParts = decoded.id.split(".");
                    let accessRole = userAndRoleParts[userAndRoleParts.length - 1];
                    res.locals.accessRole = accessRole;
                    res.locals.username = decoded.id.substring(0, (decoded.id.length - (accessRole.length + 1)));
                    next();
                } else {
                    errorResp.send(res, consts.error.badRequestLabel, config.unauthMsg, 403);
                }
            });
        } else {
            errorResp.send(res, consts.error.badRequestLabel, config.unauthMsg, 403);
        }
    } else {
        next();
    }
};

module.exports = obj;
