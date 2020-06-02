// This file contains the generic error response function used by every web
// service that returns an error response for bad input, server error, etc.
// Add any error response functions that you wish to call from multiple web
// services inside this file.

let obj = {};

obj.send = function(res, reason, msg, code, devEUI, appID) {
    res.status(code);
    let errResp;
    if (devEUI !== undefined && appID !== undefined) {
        errResp = {
            error: {
                errorForDevEUI: devEUI,
                inAppID: appID,
                errors: [],
                code: code,
            }
        };
    } else {
        errResp = {
            error: {
                errors: [],
                code: code,
            }
        };
    }


    if (Array.isArray(msg)) {
        for (let i in msg) {
            errResp.error.errors.push(
                {
                    domain:     "backend",
                    reason:     reason,
                    message:    msg[i]
                }
            );
        }
        errResp.error.message = "See 'errors' section for details.";
    } else {
        errResp.error.errors.push(
            {
                domain:     "backend",
                reason:     reason,
                message:    msg
            }
        );
        errResp.error.message = msg;
    }
    res.send(errResp);
};

obj.sendAnyueErrorResponse = function(res, reason, msg, code) {
    res.status(code);
    let errResp = {
        errorCode:  code,
        message:    "" + reason + ": " + msg
    };
    res.send(errResp);
};

module.exports = obj;
