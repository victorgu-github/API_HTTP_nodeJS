let mongoose = require("mongoose");
mongoose.Promise = global.Promise;

let logger = require("../../common/tracer.js");
let dataValidation = require("../../common/dataValidation.js");
let errorResp = require("../../common/errorResponse.js");

let ApeRecordFuncs = {};

// Every APE record intentionally omits a device's MAC address for security reasons. Thus, for
// the web API server to get the MAC address, we must query the "objects" collection for the
// ObjectId value in the "objId" field, and if there's a match, that "objects" document will
// contain our MAC address.
ApeRecordFuncs.findObjIdRecords = function(scenario) {
    var ApeObjects = require("../../models/apeObject.js")(scenario);
    if (ApeObjects) {
        return ApeObjects.find().then((resp) => {
            // logger.debug("findObjIdRecords(): resp =", resp);
            if (resp) {
                var respClean = [];
                for (let i in resp) {
                    var temp = JSON.parse(JSON.stringify(resp[i]));
                    temp.name = temp.name.replace(/-/gi, ":");
                    respClean.push(temp);
                }
                // logger.debug("respClean =", respClean);
                return respClean;
            } else {
                logger.error("resp is " + resp);
                return Promise.resolve();
            }
        });
    } else {
        logger.error("ApeObjects is " + ApeObjects);
        return Promise.resolve();
    }
};

// ------------------------------------- ACTIVE NODES ---------------------------------------------------

// /api/:scenario_id/activenodes
ApeRecordFuncs.getActiveNodes = function(req, res, next) {
    var ActiveNode = require("../../models/activeNode.js")(req.params.scenario_id);
    return ActiveNode.find({ curr_scenario: req.params.scenario_id }).exec(function(err, nodes) {
        // console.log("nodes =", nodes);
        res.send({
            activeNodes: nodes
        });
        next();
    });
};

// /api/:scenario_id/activenodes/count
ApeRecordFuncs.getNumActiveNodes = function(req, res, next) {
    var ActiveNode = require("../../models/activeNode.js")(req.params.scenario_id);
    ActiveNode.count({ curr_scenario: req.params.scenario_id }).exec(function(err, numActiveNodes) {
        
        res.send({
            numActiveNodes: numActiveNodes
        });
        next();
    });
};

// /api/:scenario_id/activenodes/:node_mac
ApeRecordFuncs.getActiveNodesByMac = function(req, res, next) {
    var ActiveNode = require("../../models/activeNode.js")(req.params.scenario_id);
    var macAddr = req.params.node_mac;
    ActiveNode.find(
        {
            curr_scenario: req.params.scenario_id, // TODO: UPDATE
            node_mac: macAddr
        }
    ).exec(function(err, node) {
        res.send({ apeRecords: node });
        next();
    });
};

// /api/:scenario_id/latest_ape_records
ApeRecordFuncs.getLatestApeRecords = function(req, res, next) {
    /*
     * This function contains logic to lookup an "objId" based on the inputted MAC address. This
     * is temporary. Soon, the frontend will only pass objId's in the query string, and lookups
     * will be done that way. Eventually there will be no MAC address involved in any part of this
     * file or the associated database schemas.
     */
    var ApeRecord = require("../../models/apeRecord.js")(req.params.scenario_id);
    // console.log("Searching for records in", ApeRecord.db.name);
    if (ApeRecord !== undefined && ApeRecord !== null) {
        ApeRecordFuncs.findObjIdRecords(req.params.scenario_id).then((objIdRecords) => {
            // logger.debug("objIdRecords.length =", objIdRecords.length);//
            if (objIdRecords !== undefined && objIdRecords !== null) {
                var macLookup = {};
                for (let i in objIdRecords) {
                    macLookup[objIdRecords[i]._id] = objIdRecords[i].name;
                }
                var objIdLookup = {};
                for (let i in objIdRecords) {
                    objIdLookup[objIdRecords[i].name] = objIdRecords[i]._id;
                }
                var findPromises = [];

                // To speed up query performance for all "get latest"-type web services, we will
                // only search records that were created in the past 60 minutes.
                let anHourAgo = new Date();
                anHourAgo.setMinutes(anHourAgo.getMinutes() - 60);
                if (req.query.mac) { // If a MAC or set of MACs is given, search for their latest records
                    var macAddrs = [];
                    if (Array.isArray(req.query.mac))
                        for (var i = 0; i < req.query.mac.length; i++)
                            macAddrs.push(req.query.mac[i]);
                    else
                        macAddrs.push(req.query.mac);
                    // console.log("Looking for", macAddrs);
                    if (macAddrs.length > 0) {
                        for (let i in macAddrs)
                            findPromises.push(ApeRecord.findOne(
                                {
                                    date:   { $gt: anHourAgo },
                                    objId:  new mongoose.mongo.ObjectId(objIdLookup[macAddrs[i]])
                                }
                            ).sort({ date: -1 }));
                        Promise.all(findPromises).then((secondResp) => {
                            if (secondResp !== undefined && secondResp !== null) {
                                res.send({ latestApeRecords: getCleanResponseForLatest(secondResp, macLookup, macAddrs) });
                                next();
                            } else {
                                logger.error("secondResp is", secondResp);
                                res.send({ error: "secondResp is " + secondResp });
                                next();
                            }
                        });
                    } else {
                        logger.error("macAddrs.length is", macAddrs.length);
                        res.send({ error: "macAddrs.length is " + macAddrs.length });
                        next();
                    }
                } else { // ...else, get all active nodes' latest
                    ApeRecord.find(
                        {
                            date:       { $gt: anHourAgo },
                            setupId:    req.params.scenario_id // TO_DO: Once db data is fixed, change to "curr_scenario" instead
                        }
                    ).distinct("objId").exec(function(err, uniqueObjIds) {
                        logger.debug("uniqueObjIds = ", uniqueObjIds);
                        if (uniqueObjIds !== undefined && uniqueObjIds !== null) {
                            var findPromises = [];
                            for (var i = 0; i < uniqueObjIds.length; i++)
                                findPromises.push(ApeRecord.findOne(
                                    {
                                        date:   { $gt: anHourAgo },
                                        objId:  uniqueObjIds[i]
                                    }
                                ).sort({ date: -1 }));
                            Promise.all(findPromises).then((resp) => {
                                if (resp !== undefined && resp !== null) {
                                    var macs = [];
                                    for (let i in resp) {
                                        macs.push(macLookup[resp[i].objId]);
                                    }
                                    // console.log("Find all resp =", resp, "\n--------- END: find all resp");
                                    res.send({ latestApeRecords: getCleanResponseForLatest(resp, macLookup, macs) });
                                    next();
                                } else {
                                    logger.error("resp is", resp);
                                    res.send({ error: "resp is " + resp });
                                    next();
                                }
                            });
                        } else {
                            logger.error("uniqueObjIds is", uniqueObjIds);
                            res.send({ error: "uniqueObjIds is " + uniqueObjIds });
                            next();
                        }
                    });
                }
            } else {
                logger.error("objIdRecords is", objIdRecords);
                res.send({ error: "objIdRecords is " + objIdRecords });
                next();
            }
        });
    } else {
        logger.error("ApeRecord is", ApeRecord);
        res.send({ error: "ApeRecord is " + ApeRecord });
        next();
    }
};

// /api/:scenario_id/recent_ape_records/
ApeRecordFuncs.getAllRecentApeRecords = function(req, res, next) {
    /*
     * This function contains logic to lookup an "objId" based on the inputted MAC address. This
     * is temporary. Soon, the frontend will only pass objId's in the query string, and lookups
     * will be done that way. Eventually there will be no MAC address involved in any part of this
     * file or the associated database schemas.
     */
    var ApeRecord = require("../../models/apeRecord.js")(req.params.scenario_id);
    ApeRecordFuncs.findObjIdRecords(req.params.scenario_id).then((objIdRecords) => {
        if (objIdRecords !== undefined && objIdRecords !== null) {
            var macLookup = {};
            for (let i in objIdRecords) {
                macLookup[objIdRecords[i]._id] = objIdRecords[i].name;
            }
            logger.debug("macLookup =", macLookup);
            let howLongAgo;

            if (durIsUndefinedOrValid(req.query.dur)) {
                if (req.query.dur !== undefined && dataValidation.isInteger(req.query.dur) === true) {
                    howLongAgo = parseInt(req.query.dur);
                } else  {
                    howLongAgo = 30;
                }
                
                ApeRecord.find(
                    {
                        setupId: req.params.scenario_id,
                    }
                ).distinct("objId").exec(function(err, uniqueObjIds) {
                    if (uniqueObjIds !== undefined && uniqueObjIds !== null) {
                        // logger.debug("uniqueObjIds.length =", uniqueObjIds.length);// 
                        var findPromises = [];
                        for (let i in uniqueObjIds) {
                            var now = new Date(Date.now());
                            var xSecAgo = new Date(now);
                            xSecAgo.setSeconds(xSecAgo.getSeconds() - howLongAgo);
                            findPromises.push(ApeRecord.find(
                                {
                                    setupId:    req.params.scenario_id,
                                    objId:		uniqueObjIds[i],
                                    date:		{ $gt: xSecAgo }
                                }
                            ).sort({ date: -1 }));
                        }
                        Promise.all(findPromises).then((resp) => {
                            if (resp !== undefined && resp !== null) {
                                res.send({ recentApeRecords: getCleanResponseForRecent(resp, macLookup, uniqueObjIds) });
                                next();
                            } else {
                                logger.error("resp is", resp);
                                res.send({ error: "resp is " + resp });
                                next();
                            }
                        });
                    } else {
                        logger.error("uniqueObjIds is", uniqueObjIds);
                        res.send({ error: "uniqueObjIds is " + uniqueObjIds });
                        next();
                    }
                });        
            } else {
                errorResp.send(res, "Bad Request", "Request query parameter 'dur' must be a valid integer (e.g.: 0, 1, 2, 3...)", 400);
                next();
            }
        } else {
            logger.error("objIdRecords is", objIdRecords);
            res.send({ error: "objIdRecords is " + objIdRecords });
            next();
        }
    });
};

// /api/:scenario_id/recent_ape_records/:node_mac
ApeRecordFuncs.getAllRecentApeRecordsByMac = function(req, res, next) {
    /*
     * These functions contain logic to lookup an "objId" based on the inputted MAC address. This
     * is temporary. Soon, the frontend will only pass objId's in the query string, and lookups
     * will be done that way. Eventually there will be no MAC address involved in any part of this
     * file or the associated database schemas.
     */
    var ApeRecord = require("../../models/apeRecord.js")(req.params.scenario_id);
    if (ApeRecord !== undefined && ApeRecord !== null) {
        ApeRecordFuncs.findObjIdRecords(req.params.scenario_id).then((objIdRecords) => {
            if (objIdRecords !== undefined && objIdRecords !== null) {
                var macLookup = {};
                for (let i in objIdRecords) {
                    macLookup[objIdRecords[i]._id] = objIdRecords[i].name;
                }
                var objIdLookup = {};
                for (let i in objIdRecords) {
                    objIdLookup[objIdRecords[i].name] = objIdRecords[i]._id;
                }
                logger.debug("getAllRecentApeRecords macLookup =", macLookup);
                var howLongAgo;

                if (durIsUndefinedOrValid(req.query.dur)) {
                    if (req.query.dur !== undefined && dataValidation.isInteger(req.query.dur) === true) {
                        howLongAgo = parseInt(req.query.dur);
                    } else  {
                        howLongAgo = 30;
                    }

                    var now = new Date(Date.now());
                    var xSecAgo = new Date(now);
                    xSecAgo.setSeconds(xSecAgo.getSeconds() - howLongAgo);
                    ApeRecord.find(
                        {
                            setupId:    req.params.scenario_id,
                            objId:		objIdLookup[(req.params.node_mac)],
                            date:       { $gt: xSecAgo }
                        }
                    ).sort({ date: -1 }).exec(function(err, resp) {
                        logger.debug("getAllRecentApeRecordsByMac resp =", resp, "\n------- END getAllRecentApeRecordsByMac");
                        if (resp !== undefined && resp !== null) {
                            var MACs = [];
                            // The below ESLint ignore comment is to allow this legacy code
                            // to proceed with doing its functionality. In the future we
                            // needn't use a for loop. Instead, we could use forEach.
                            for (let i in resp) { // eslint-disable-line no-unused-vars
                                MACs.push((req.params.node_mac));
                            }
                            res.send({ recentApeRecords: getCleanResponseForLatest(resp, macLookup, MACs) });
                            next();
                        } else {
                            logger.error("resp is", resp);
                            res.send({ error: "resp is " + resp });
                            next();
                        }
                    });
                } else {
                    errorResp.send(res, "Bad Request", "Request query parameter 'dur' must be a valid integer (e.g.: 0, 1, 2, 3...)", 400);
                    next();
                }
            } else {
                logger.error("objIdRecords is", objIdRecords);
                res.send({ error: "objIdRecords is " + objIdRecords });
                next();
            }
        });
    } else {
        logger.error("ApeRecord is", ApeRecord);
        res.send({ error: "ApeRecord is " + ApeRecord });
        next();
    }
};

// ------------------------------------- GATEWAYS ---------------------------------------------------

// /api/:scenario_id/latest_gw_records/
ApeRecordFuncs.getLatestGatewayRecords = function(req, res, next) {
    if (dataValidation.isInteger(req.params.scenario_id) !== false) {
        var GatewayRecord = require("../../models/gatewayRecord.js")(req.params.scenario_id);
        var findPromises = [];
        var gwSensorRecs = [];

        // To speed up query performance for all "get latest"-type web services, we will
        // only search records that were created in the past 60 minutes.
        let anHourAgo = new Date();
        anHourAgo.setMinutes(anHourAgo.getMinutes() - 60);
        GatewayRecord.find(
            {
                date:   { $gt: anHourAgo }
            }
        ).distinct("gw_mac").exec((err, uniqueGwMacs) => {
            if (uniqueGwMacs !== undefined && uniqueGwMacs !== null) {
                for (var i = 0; i < uniqueGwMacs.length; i++) {
                    findPromises.push(GatewayRecord.findOne(
                        {
                            date:   { $gt: anHourAgo },
                            gw_mac: uniqueGwMacs[i]
                        }
                    ).sort({ date: -1 }));
                }
                Promise.all(findPromises).then((findPromisesContents) => {
                    for (var i = 0; i < findPromisesContents.length; i++) {
                        var gwR = findPromisesContents[i];
                        var gatewayObj = {};
                        gatewayObj["gw_mac"] = gwR.gw_mac;
                        gatewayObj["name"] = gwR.name;
                        gatewayObj["resv_sensors"] = gwR.resv_sensors;
                        gwSensorRecs.push(gatewayObj);
                    }
                    res.send({ gw_sensor_recs: gwSensorRecs });
                    next();
                });
            } else {
                errorResp.send(res, "Bad Request", "Scenario ID provided does not contain any gateway records", 400);
                next();
            }
        });
    } else {
        errorResp.send(res, "Bad Request", "Request query parameter 'scenario_id' must be a valid integer (e.g.: 0, 1, 2, 3...)", 400);
        next();
    }
};

// /api/:scenario_id/latest_gw_records/mac/:gw_mac
ApeRecordFuncs.getLatestGatewayRecordsByMac = function(req, res, next) {
    var GatewayRecord = require("../../models/gatewayRecord.js")(req.params.scenario_id);
    var findPromises = [];
    findPromises.push(GatewayRecord.findOne(
        {
            gw_mac:         req.params.gw_mac,
            curr_scenario:  req.params.scenario_id
        }
    ).sort({ date: -1 }));
    Promise.all(findPromises).then((findPromisesContents) => {
        logger.debug("promises contents:\n", findPromisesContents);
        res.send({ latest_gw_sensor_recs: findPromisesContents });
        next();
    });
};

// /api/:scenario_id/latest_gw_records/sens/:sensor_type
ApeRecordFuncs.getLatestGatewayRecordsBySensorType = function(req, res, next) {
    if (dataValidation.isInteger(req.params.scenario_id) !== false) {
        var GatewayRecord = require("../../models/gatewayRecord.js")(req.params.scenario_id);
        var findPromises = [];
        var gwSensorRecs = [];
        GatewayRecord.distinct("gw_mac").exec((err, uniqueGwMacs) => {
            if (uniqueGwMacs !== undefined && uniqueGwMacs !== null) {
                // To speed up query performance for all "get latest"-type web services, we will
                // only search records that were created in the past 60 minutes. Notice that we
                // are not doing a "find().distinct()" here like with latest APE records above -
                // data measurements showed that performance was actually a bit slower when doing
                // so compared to a single "distinct()" call.
                let anHourAgo = new Date();
                anHourAgo.setMinutes(anHourAgo.getMinutes() - 60);
                for (var i = 0; i < uniqueGwMacs.length; i++) {
                    findPromises.push(GatewayRecord.findOne(
                        {
                            date:   { $gt: anHourAgo },
                            gw_mac: uniqueGwMacs[i]
                        }
                    ).sort({ date: -1 }));
                }
                Promise.all(findPromises).then((findPromisesContents) => {
                    for (var i = 0; i < findPromisesContents.length; i++) {
                        var gwR = findPromisesContents[i];
                        var gatewayObj = {};
                        gatewayObj["gw_mac"] = gwR.gw_mac;
                        gatewayObj["name"] = gwR.name;
                        var sensorObjs = gwR.resv_sensors;
                        for (var j = 0; j < sensorObjs.length; j++) {
                            if (sensorObjs[j].sensor_type == req.params.sensor_type) {
                                gatewayObj[req.params.sensor_type] = sensorObjs[j];
                            }
                        }
                        gwSensorRecs.push(gatewayObj);
                    }
                    res.send({ gw_sensor_recs: gwSensorRecs });
                    next();
                });
            } else {
                errorResp.send(res, "Bad Request", "Scenario ID provided does not contain any gateway records", 400);
                next();
            }
        });
    } else {
        errorResp.send(res, "Bad Request", "Request query parameter 'scenario_id' must be a valid integer (e.g.: 0, 1, 2, 3...)", 400);
        next();
    }
    
    
};

// /api/:scenario_id/recent_gw_records/
ApeRecordFuncs.getRecentGatewayRecords = function(req, res, next) {
    if (dataValidation.isInteger(req.params.scenario_id) !== false) {
        var GatewayRecord = require("../../models/gatewayRecord.js")(req.params.scenario_id);
        var howLongAgo = 0;

        if (durIsUndefinedOrValid(req.query.dur)) {
            if (req.query.dur !== undefined && dataValidation.isInteger(req.query.dur) === true) {
                howLongAgo = parseInt(req.query.dur);
            } else  {
                howLongAgo = 30;
            }
            
            GatewayRecord.find(
                {
                    curr_scenario: req.params.scenario_id
                }
            ).distinct("gw_mac").exec((err, uniqueGwMacs) => {
                if (uniqueGwMacs !== undefined && uniqueGwMacs !== null) {
                    logger.debug("Found", uniqueGwMacs.length, "gateways");// 
                    var findPromises = [];
                    for (var i = 0; i < uniqueGwMacs.length; i++) {
                        var now = new Date(Date(now));
                        var xSecAgo = new Date(now);
                        xSecAgo.setSeconds(xSecAgo.getSeconds() - howLongAgo);
                        findPromises.push(GatewayRecord.find(
                            {
                                gw_mac: uniqueGwMacs[i],
                                date:   { $gt: xSecAgo }
                            }
                        ).sort({ date: -1 }));
                    }
                    Promise.all(findPromises).then((findPromisesContents) => {
                        res.send({ latest_gw_sensor_recs: findPromisesContents });
                        next();
                    });
                } else {
                    errorResp.send(res, "Bad Request", "Scenario ID provided does not contain any gateway records", 400);
                    next();
                }
            });
        } else {
            errorResp.send(res, "Bad Request", "Request query parameter 'dur' must be a valid integer (e.g.: 0, 1, 2, 3...)", 400);
            next();
        }
    } else {
        errorResp.send(res, "Bad Request", "Request query parameter 'scenario_id' must be a valid integer (e.g.: 0, 1, 2, 3...)", 400);
        next();
    }
};

// /api/:scenario_id/recent_gw_records/mac/:gw_mac
ApeRecordFuncs.getRecentGatewayRecordsByMac = function(req, res, next) {
    if (dataValidation.isInteger(req.params.scenario_id) !== false) {
        var GatewayRecord = require("../../models/gatewayRecord.js")(req.params.scenario_id);
        var howLongAgo = 0;

        if (durIsUndefinedOrValid(req.query.dur)) {
            if (req.query.dur !== undefined && dataValidation.isInteger(req.query.dur) === true) {
                howLongAgo = parseInt(req.query.dur);
            } else  {
                howLongAgo = 30;
            }
            
            GatewayRecord.find(
                {
                    gw_mac:         req.params.gw_mac,
                    curr_scenario:  req.params.scenario_id
                }
            ).distinct("gw_mac").exec((err, uniqueGwMacs) => {
                if (uniqueGwMacs !== undefined && uniqueGwMacs !== null) {
                    // logger.debug("Found", uniqueGwMacs.length, "gateways");// 
                    var findPromises = [];
                    for (var i = 0; i < uniqueGwMacs.length; i++) {
                        var now = new Date(Date(now));
                        var xSecAgo = new Date(now);
                        xSecAgo.setSeconds(xSecAgo.getSeconds() - howLongAgo);
                        findPromises.push(GatewayRecord.find(
                            {
                                gw_mac: uniqueGwMacs[i],
                                date:   { $gt: xSecAgo }
                            }
                        ).sort({ date: -1 }));
                    }
                    Promise.all(findPromises).then((findPromisesContents) => {
                        res.send({ latest_gw_sensor_recs: findPromisesContents[0] });
                        next();
                    });
                } else {
                    errorResp.send(res, "Bad Request", "Scenario ID provided does not contain any gateway records", 400);
                    next();
                }
            });
        } else {
            errorResp.send(res, "Bad Request", "Request query parameter 'dur' must be a valid integer (e.g.: 0, 1, 2, 3...)", 400);
            next();
        }
    } else {
        errorResp.send(res, "Bad Request", "Request query parameter 'scenario_id' must be a valid integer (e.g.: 0, 1, 2, 3...)", 400);
        next();
    }
};

// /api/:scenario_id/recent_gw_records/sens/:sensor_type
ApeRecordFuncs.getRecentGatewayRecordsBySensor = function(req, res, next) {
    if (dataValidation.isInteger(req.params.scenario_id) !== false) {
        var GatewayRecord = require("../../models/gatewayRecord.js")(req.params.scenario_id);
        var howLongAgo = 0;

        if (durIsUndefinedOrValid(req.query.dur)) {
            if (req.query.dur !== undefined && dataValidation.isInteger(req.query.dur) === true) {
                howLongAgo = parseInt(req.query.dur);
            } else  {
                howLongAgo = 30;
            }

            var recentGwSensorRecs = [];
            GatewayRecord.find(
                {
                    curr_scenario:  req.params.scenario_id
                }
            ).distinct("gw_mac").exec((err, uniqueGwMacs) => {
                if (uniqueGwMacs !== undefined && uniqueGwMacs !== null) {
                    // logger.debug("Found", uniqueGwMacs.length, "gateways");// 
                    var findPromises = [];
                    for (var i = 0; i < uniqueGwMacs.length; i++) {
                        var now = new Date(Date(now));
                        var xSecAgo = new Date(now);
                        xSecAgo.setSeconds(xSecAgo.getSeconds() - howLongAgo);
                        findPromises.push(GatewayRecord.find(
                            {
                                gw_mac: uniqueGwMacs[i],
                                date:   { $gt: xSecAgo }
                            }
                        ).sort({ date: -1 }));
                    }
                    Promise.all(findPromises).then((findPromisesContents) => {
                        // logger.debug("Iterating through", findPromisesContents.length, "MACs");// 
                        // Iterate through each MAC (length = num unique MACs)
                        for (var i = 0; i < findPromisesContents.length; i++) {
                            var indivMacArr = [];
                            // Build new object for MAC's j recent records
                            for (var j = 0; j < findPromisesContents[i].length; j++) {
                                // Build custom object
                                var sensObj;
                                for (var k = 0; k < findPromisesContents[i][j].resv_sensors.length; k++) {
                                    //console.log("Looking for", req.params.sensor_type);
                                    if (findPromisesContents[i][j].resv_sensors[k].sensor_type == req.params.sensor_type) {
                                        sensObj = findPromisesContents[i][j].resv_sensors[k];
                                    }
                                }
                                indivMacArr.push(
                                    {
                                        "gw_mac":       findPromisesContents[i][j].gw_mac,
                                        "name":         findPromisesContents[i][j].name,
                                        "resv_sensor":  sensObj
                                    }
                                );
                            }
                            recentGwSensorRecs.push(indivMacArr);
                        }
                        res.send({ latest_gw_sensor_recs: recentGwSensorRecs });
                        next();
                    });
                } else {
                    errorResp.send(res, "Bad Request", "Scenario ID provided does not contain any gateway records", 400);
                    next();
                }
            });
        } else {
            errorResp.send(res, "Bad Request", "Request query parameter 'dur' must be a valid integer (e.g.: 0, 1, 2, 3...)", 400);
            next();
        }
    } else {
        errorResp.send(res, "Bad Request", "Request query parameter 'scenario_id' must be a valid integer (e.g.: 0, 1, 2, 3...)", 400);
        next();
    }
};

// /api/:scenario_id/recent_gw_records/mac/:gw_mac/sens/:sensor_type
ApeRecordFuncs.getRecentGatewayRecordsByMacAndSensor = function(req, res, next) {
    if (dataValidation.isInteger(req.params.scenario_id) !== false) {
        var GatewayRecord = require("../../models/gatewayRecord.js")(req.params.scenario_id);
        var howLongAgo = 0;

        if (durIsUndefinedOrValid(req.query.dur)) {
            if (req.query.dur !== undefined && dataValidation.isInteger(req.query.dur) === true) {
                howLongAgo = parseInt(req.query.dur);
            } else  {
                howLongAgo = 30;
            }

            var recentGwSensorRecs = [];
            GatewayRecord.find(
                {
                    curr_scenario:  req.params.scenario_id,
                    gw_mac:         req.params.gw_mac
                }
            ).distinct("gw_mac").exec((err, uniqueGwMacs) => {
                if (uniqueGwMacs !== undefined && uniqueGwMacs !== null) {
                    // logger.debug("Found", uniqueGwMacs.length, "gateways");// 
                    var findPromises = [];
                    for (var i = 0; i < uniqueGwMacs.length; i++) {
                        var now = new Date(Date(now));
                        var xSecAgo = new Date(now);
                        xSecAgo.setSeconds(xSecAgo.getSeconds() - howLongAgo);
                        findPromises.push(GatewayRecord.find(
                            {
                                gw_mac: uniqueGwMacs[i],
                                date:   { $gt: xSecAgo }
                            }
                        ).sort({ date: -1 }));
                    }
                    Promise.all(findPromises).then((findPromisesContents) => {
                        // logger.debug("Iterating through", findPromisesContents.length, "MACs");// 
                        // Iterate through each MAC (length = num unique MACs)
                        for (var i = 0; i < findPromisesContents.length; i++) {
                            var indivMacArr = [];
                            // Build new object for MAC's j recent records
                            for (var j = 0; j < findPromisesContents[i].length; j++) {
                                // Build custom object
                                var sensObj;
                                for (var k = 0; k < findPromisesContents[i][j].resv_sensors.length; k++) {
                                    //console.log("Looking for", req.params.sensor_type);
                                    if (findPromisesContents[i][j].resv_sensors[k].sensor_type == req.params.sensor_type) {
                                        sensObj = findPromisesContents[i][j].resv_sensors[k];
                                    }
                                }
                                indivMacArr.push(
                                    {
                                        "gw_mac":       findPromisesContents[i][j].gw_mac,
                                        "name":         findPromisesContents[i][j].name,
                                        "resv_sensor":  sensObj
                                    }
                                );
                            }
                            recentGwSensorRecs.push(indivMacArr);
                        }
                        res.send({ latest_gw_sensor_recs: recentGwSensorRecs[0] });
                        next();
                    });
                } else {
                    errorResp.send(res, "Bad Request", "Scenario ID provided does not contain any gateway records", 400);
                    next();
                }
            });
        } else {
            errorResp.send(res, "Bad Request", "Request query parameter 'dur' must be a valid integer (e.g.: 0, 1, 2, 3...)", 400);
            next();
        }
    } else {
        errorResp.send(res, "Bad Request", "Request query parameter 'scenario_id' must be a valid integer (e.g.: 0, 1, 2, 3...)", 400);
        next();
    }
};

module.exports = ApeRecordFuncs;

// --------------------------- HELPER FUNCTIONS ---------------------------------------------

function getCleanResponseForLatest(rawResp, map, macAddrs) {
    // console.log("getCleanResponseForLatest map =", map);
    var rawRespClean = [];
    for (let i in rawResp) {
        if (rawResp[i] !== null) {
            var temp = JSON.parse(JSON.stringify(rawResp[i]));
            // delete map[temp.objId]; // For testing purposes, to test the error handling below:
            temp.node_mac = map[temp.objId];
            if (temp.node_mac === undefined) {
                logger.warn("temp.node_mac is undefined");
                temp.node_mac = "Error: No MAC address found for this objId (" + temp.objId + ") in the objects collection";
            }
            logger.debug("map[" + temp.objId + "] =", map[temp.objId]);
            rawRespClean.push(temp);
        } else {
            rawRespClean.push(
                {
                    error:  macAddrs[i] + " not found in database",
                    mac:    macAddrs[i]
                }
            );
        }
    }
    logger.debug("rawRespClean.length =", rawRespClean.length);
    return rawRespClean;
}

function getCleanResponseForRecent(rawRespArr, map, objIds) {
    var rawRespArrClean = JSON.parse(JSON.stringify(rawRespArr));
    for (let i in rawRespArrClean) {
        // console.log("rawRespArrClean[" + i + "].length =", rawRespArrClean[i].length);
        if (rawRespArr[i] != null) {
            if (rawRespArr[i].length > 0) {
                for (let j in rawRespArr[i]) {
                    // delete map[rawRespArr[i][j].objId]; // For testing purposes, to test the error handling below:
                    rawRespArrClean[i][j].node_mac = map[rawRespArr[i][j].objId];
                    if (rawRespArrClean[i][j].node_mac === undefined) {
                        logger.warn("rawRespArrClean[" + i + "][" + j + "].node_mac is undefined");
                        rawRespArrClean[i][j].node_mac = "Error: No MAC address found for this objId (" + rawRespArr[i][j].objId + ") in the objects collection";
                    }
                    // console.log("rawRespArr[i][j].node_mac = " + rawRespArr[i][j].node_mac);
                }
            } // Else empty array, i.e.: no APE records found. Nothing needed here.
        } else {
            logger.warn("rawRespArr[i] is null (MAC address " + map[objIds[i]] + ")");
            rawRespArrClean[i] = {
                error:  "getCleanResponseForRecent(): rawRespArr[" + i + "] is null",
                mac:    map[objIds[i]]
            };
        }
    }
    return rawRespArrClean;
}

// I.e.: proceed if either of the following are true:
//   - The user hasn't specified a "dur" value
//   - The HAVE specified a "dur" parameter, AND it's a valid integer string
// The condition is written like this because we don't want to call isInteger
// if req.query.dur is undefined, and if the first condition fails, the '&&' will
// ensure the code won't check the second condition.
function durIsUndefinedOrValid(dur) {
    return ((dur !== undefined && dataValidation.isInteger(dur) === false) === false);
}
