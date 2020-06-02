var mongoose = require("mongoose");
mongoose.Promise = global.Promise;

var logger = require("../../common/tracer.js");
let dataValidation = require("../../common/dataValidation.js");
let errorResp = require("../../common/errorResponse.js");

var GeoData = require("../../models/geoData.js")();

var GeoDataFuncs = {};

// ------------------------------------- ACTIVE NODES ---------------------------------------------------

// - GET "/tcp/latest_tcp_geo_data"
GeoDataFuncs.getLatestTcpGeoData = function(req, res, next) {
    // Get a fresh connection if the previous one has errored out
    GeoData = require("../../models/geoData.js")();

    // If the user has passed a polygon in the query string, validate their input and
    // handle any errors.
    var errorMsgs;
    if (req.query.geometry !== undefined) {
        // Right now we only support "geoWithin" spatial operations
        if (req.query.spatialoperation !== undefined) {
            if (req.query.spatialoperation === "geoWithin") {
                var geometry = dataValidation.parseGeoJSON(req.query.geometry);
                if (Array.isArray(geometry) === true) {
                    errorMsgs = geometry;
                }
            } else {
                errorMsgs = [ "Function only supports 'geoWithin' spatial operations"];
            }
        } else {
            errorMsgs = [ "Must pass a 'spatialoperation' query parameter together with 'geometry' (i.e.: ?spatialoperation=geoWithin&geometry={...})" ];
        }
    }

    // If the user has passed a duration parameter in the query string, validate their
    // input and handle any errors. Otherwise, set the default duration to the past
    // 60 minutes.
    let xMinsAgo = new Date();
    if (req.query.dur !== undefined) {
        if (dataValidation.isInteger(req.query.dur)) {
            xMinsAgo.setMinutes(xMinsAgo.getMinutes() - parseInt(req.query.dur));
        } else {
            // If there's already one or more error messages from the polygon validation,
            // add our newest message to the end of the array; otherwise, return our single
            // error message.
            if (errorMsgs !== undefined) {
                errorMsgs.push("'dur' must be a valid integer (e.g.: 1, 2, 3...)");
            } else {
                errorMsgs = "'dur' must be a valid integer (e.g.: 1, 2, 3...)";
            }
        }
    } else {
        xMinsAgo.setMinutes(xMinsAgo.getMinutes() - 60);
    }
    
    if (errorMsgs === undefined) {
        // Stage 1: Perform and "find-distinct" to get an array of all users who have a
        // latest geo data record within the past 60 / 'dur' minutes.
        let query = {
            timestamp: { $gt: xMinsAgo }
        };
        if (geometry !== undefined) {
            let spatOp = "$" + req.query.spatialoperation;
            query.geoJSON = {};
            query.geoJSON[spatOp] = {
                $geometry: geometry
            };
        }
        GeoData.find(query).distinct("userID").then((resp) => {
            // Stage 2: Iterate through this array and find the latest geo data record
            // for each user.
            var findPromises = [];
            for (let i in resp) {
                findPromises.push(GeoData.findOne(
                    {
                        timestamp: { $gt: xMinsAgo },
                        userID: i
                    }
                ).sort({ _id: -1 }));
            }
            Promise.all(findPromises).then((resp2) => {
                if (resp !== undefined && resp !== null) {
                    let finalResp = JSON.parse(JSON.stringify(resp2));
                    for (let i in finalResp) {
                        delete finalResp[i]._id;
                    }
                    res.send({ result: finalResp });
                    next();
                } else {
                    logger.error("resp =", resp);
                    res.send({ result: [] });
                    next();
                }
            }).catch((promReject) => {
                logger.error(promReject);
                let msg = (promReject.message !== undefined) ? promReject.message : promReject + "";
                errorResp.send(res, "Server Error", msg, 500);
                next();
            });
        }).catch((promReject) => {
            logger.error(promReject);
            let msg = (promReject.message !== undefined) ? promReject.message : promReject + "";
            errorResp.send(res, "Server Error", msg, 500);
            next();
        });
    } else {
        errorResp.send(res, "Bad Request", errorMsgs, 400);
        next();
    }
};

module.exports = GeoDataFuncs;
