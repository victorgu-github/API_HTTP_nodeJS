let fs = require("fs");
let csvToJSON = require("csvtojson");
let request = require("then-request");
let turf = require("turf");

let errorResp = require("../../common/errorResponse.js");
let dataFormat = reqFile("./common/dataFormat.js");
let dataValidation = require("../../common/dataValidation.js");
let bleDataValidation = require("../../common/bleDataValidation.js");
let utilities = require("../../common/utilities.js");
let consts = require("../../config/constants.js");

const nodeLocationTimestampThresholdMinutes = 10;
const nodeDistanceTravelledThresholdHours = 24;

let obj = {};

// IMPORTANT: The following web service is strongly coupled to the "/location/geocounting"
// web service (below), as the latter calls it to get its node locations. As such, any
// changes made to this function will affect the "/location/geocounting" web service.
//
// - GET "/ble/applications/:bleAppID/nodes/location?macAddress=XXX,YYY,...&dur=..."
obj.getActiveBleNodes = function(req, res, next) {
    let validation = getValidationForGetActiveNodes(req);
    if (validation.length === 0) {
        let locQueryObj = getQueryObjForActiveNodes(req.query);
        // Now we need to query:
        //   1) all of our nodes' latest locations
        //   2) all of our active nodes (to get their foreign keys)
        //   3) each node's travelled distance over the past 24 hours
        let proms = [];
        // 1) Find node locations:
        let nodeLocation = reqFile("./models/ble/bleNodeLocation.js")(req.params.bleAppID);
        proms.push(nodeLocation.aggregate(
            { $match: locQueryObj },
            { $sort: { timestamp: -1 } },
            {
                $group: {
                    _id: { macAddress: "$macAddress" },
                    coordinates: { $first: "$geoLocation.coordinates" }
                }
            }
        ).then((locations) => {
            let finalSet = [];
            locations.forEach((loc) => {
                finalSet.push({
                    macAddress:   loc._id.macAddress,
                    latitude:     loc.coordinates[1],
                    longitude:    loc.coordinates[0]
                });
            });
            return finalSet;
        }));
        // 2) Find BLE nodes:
        let BleNode = reqFile("./models/ble/bleNode.js")(req.params.bleAppID);
        let bleNodeQuery = {};
        if (req.query.macAddress) {
            let macAddrs = req.query.macAddress.toUpperCase().split(",");
            bleNodeQuery.macAddress = { $in: macAddrs };
        }
        proms.push(BleNode.find(bleNodeQuery, { _id: 0, macAddress: 1, foreignKeys: 1 }));
        // 3) Get aggregated distances travelled:
        let bleDistances = reqFile("./models/ble/bleNodeDistanceTravelled.js")(req.params.bleAppID);
        let distQueryObj = getQueryObjForDistancesTravelled(req.query);
        proms.push(bleDistances.aggregate(
            { $match: distQueryObj },
            {
                $group: {
                    _id: { macAddress: "$macAddress" },
                    distanceTravelled: { $sum: "$distanceTravelledInKm" }
                }
            }
        ));
        Promise.all(proms).then((allResps) => {
            // let endTime = new Date();
            // logger.info("Find query took", (endTime - startTime), "milliseconds");
            let nodeLocations = getArrayOfLatestLocations(allResps[0]);
            // logger.info(nodeLocations.length)
            // logger.info(nodeLocations)
            // res.send(nodeLocations)
            let bleNodes = allResps[1];
            let distTravelled = allResps[2];

            let distLookup = getDistancesLookupObject(distTravelled);
            let fkLookup = dataFormat.getLookupObjectFromArrayOfObjects(bleNodes, "macAddress");
            let finalResp = [];
            nodeLocations.forEach((nodeLoc) => {
                // Below: If the distance travelled for each sheep is below a specific threshold, we
                // say that that sheep is in an abnormal state (i.e.: maybe it is sick, or maybe we
                // haven't calculated any travelled distances for that sheep in the past 24 hours).
                let dist = distLookup[nodeLoc.macAddress];
                let abnormal = (dist === undefined || dist < consts.minimumNormalDailySheepTravelDistanceKm) ? true : false;
                let locObj = {
                    macAddress:     nodeLoc.macAddress,
                    latitude:       nodeLoc.latitude,
                    longitude:      nodeLoc.longitude,
                    foreignKeys:    fkLookup[nodeLoc.macAddress].foreignKeys,
                    abnormal:       abnormal
                };
                // Arrays are unfortunately too complex to be handled by the schema
                // enforcement function, so they must be filtered manually. We do this
                // by sending a mini "model" of the objects inside this array:
                for (let i = 0; i < locObj.foreignKeys.length; i++) {
                    locObj.foreignKeys[i] = dataFormat.enforceSchemaOnDocument({
                        schema: {
                            tree: {
                                keyName:        null,
                                keyValue:       null,
                                description:    null
                            }
                        }
                    }, locObj.foreignKeys[i], false);
                }
                finalResp.push(locObj);
            });
            res.send(finalResp);
            next();
        }).catch((err) => {
            logger.error(err);
            let msg = err + "";
            errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validation, 400);
        next();
    }
};

function getValidationForGetActiveNodes(req) {
    let errors = [];

    errors = errors.concat(bleDataValidation.getBleAppIdValidation(req.params.bleAppID, "bleAppID", true));
    // TODO: Replace the following two if statements with their shorter equivalents in the
    // "common" > "bleDataValidation.js" file:
    if (req.query.macAddress !== undefined) {
        let macAddrs = req.query.macAddress.split(",");
        macAddrs.forEach((macAddr) => {
            if (dataValidation.isValidHexString(macAddr, 12) === false) {
                errors.push("'macAddress' parameter must be a valid 12-character hex string, or " +
                            "comma-separated list thereof (you gave " + (typeof macAddr) + " " + macAddr + ")");
            }
        });
    }
    if (req.query.dur !== undefined) {
        if (dataValidation.isIntegerString(req.query.dur) === false ||
            req.query.dur < 1 || req.query.dur > 60) {
            errors.push("'dur' parameter must be an integer string between 1 and 60 (you gave " +
                        (typeof req.query.dur) + " " + req.query.dur + ")");
        }
    }

    return errors;
}

function getQueryObjForActiveNodes(query) {
    let locQueryObj = {};

    if (query.macAddress) {
        let macAddrs = query.macAddress.toUpperCase().split(",");
        locQueryObj.macAddress = { $in: macAddrs };
    }
    let sixtyMinutesAgo = new Date();
    sixtyMinutesAgo.setUTCMinutes(sixtyMinutesAgo.getUTCMinutes() - nodeLocationTimestampThresholdMinutes);
    locQueryObj.timestamp = { $gte: sixtyMinutesAgo };

    return locQueryObj;
}

function getQueryObjForDistancesTravelled(query) {
    let distQueryObj = {};

    if (query.macAddress) {
        let macAddrs = query.macAddress.toUpperCase().split(",");
        distQueryObj.macAddress = { $in: macAddrs };
    }
    let last24Hours = new Date();
    last24Hours.setUTCHours(last24Hours.getUTCHours() - nodeDistanceTravelledThresholdHours);
    distQueryObj.timestamp = { $gte: last24Hours };

    return distQueryObj;
}

function getArrayOfLatestLocations(allNodeLocations) {
    let outArr = [];

    let lookup = {};
    for (let i = 0; i < allNodeLocations.length; i++) {
        if (lookup[allNodeLocations[i].macAddress] === undefined) {
            lookup[allNodeLocations[i].macAddress] = allNodeLocations[i];
        }
    }
    Object.keys(lookup).forEach((mac) => {
        outArr.push(lookup[mac]);
    });

    return outArr;
}

function getDistancesLookupObject(distTravelled) {
    let output = {};

    distTravelled.forEach((distancePair) => {
        output[distancePair._id.macAddress] = distancePair.distanceTravelled;
    });

    return output;
}

// - POST "/ble/applications/:bleAppID/nodes/csvregister"
obj.registerBleNodes = function(req, res, next) {
    let validation = getValidationForPostCsvRegister(req.params);
    if (validation.length === 0) {
        if (req.files) {
            let theFile = req.files.file;
            let filePathAndName = "./content/temp/" + theFile.name;
            theFile.mv(filePathAndName, (err) => {
                if (!err) {
                    // Query the database for any pre-existing MAC addresses
                    let BleNode = require("../../models/ble/bleNode.js")(req.params.bleAppID);
                    BleNode.find().sort({
                        macAddress: 1
                    }).then((resp) => {
                        let flattenedArr = [];
                        resp.forEach((node) => {
                            flattenedArr.push(node.macAddress);
                        });

                        let batch = [];
                        let dupeMACs = [];
                        let itr = 0;
                        let validationMsgs = [];
                        csvToJSON()
                            .fromFile(filePathAndName)
                            .on("json", (jsonObj) => {
                                let rowValidation = getCsvRowValidation(jsonObj, itr);
                                validationMsgs = validationMsgs.concat(rowValidation);
                                if (rowValidation.length === 0) {
                                    let nodeJSON = {
                                        macAddress:         jsonObj.MacAddress.toUpperCase(),
                                        deviceType:         jsonObj.DeviceType,
                                        name:               jsonObj.Name,
                                        foreignKeys:        parseCsvRowForForeignKeys(jsonObj),
                                        createdAt:          new Date(),
                                        createdBy:          res.locals.username,
                                        creatorAccessRole:  res.locals.accessRole
                                    };
                                    let mac = jsonObj.MacAddress.toUpperCase();
                                    // I.e.: If the user has typed a given MAC address twice in the CSV
                                    // file, or if the MAC address already exists in the database:
                                    if (batch.filter((each) => { return each.macAddress === nodeJSON.macAddress; }).length > 0 ||
                                        utilities.partitionSearchSortedArray(mac, flattenedArr, 0, flattenedArr.length)) {
                                        dupeMACs.push(mac);
                                    } else if (rowValidation.length === 0) {
                                        batch.push(new BleNode(nodeJSON));
                                    }
                                }
                                itr++;
                            })
                            .on("done", (err) => {
                                if (!err && validationMsgs.length === 0) {
                                    let biProm;
                                    if (batch.length > 0) {
                                        biProm = BleNode.collection.insert(batch);
                                    } else {
                                        biProm = Promise.resolve({ result: { n: 0 } });
                                    }
                                    let distinctDupeMACs = dupeMACs.filter((each, pos) => { return dupeMACs.indexOf(each) === pos; });
                                    while (biProm === undefined) {} // eslint-disable-line no-empty
                                    biProm.then((resp) => {
                                        res.send({
                                            numInserted:                resp.result.n,
                                            numDuplicatesNotInserted:   distinctDupeMACs.length,
                                            duplicateMACs:              distinctDupeMACs
                                        });
                                        next();
                                    });
                                    fs.unlink(filePathAndName, () => {});
                                } else {
                                    errorResp.send(res, consts.error.badRequestLabel, validationMsgs, 400);
                                    next();
                                }
                            })
                            .on("error", (err) => {
                                logger.error(err);
                                errorResp.send(res, consts.error.serverErrorLabel, "" + err, 500);
                                next();
                            });
                    }).catch((err) => {
                        logger.error(err);
                        errorResp.send(res, consts.error.serverErrorLabel, "" + err, 500);
                        next();
                    });
                } else {
                    logger.error(err);
                    errorResp.send(res, consts.error.serverErrorLabel, "" + err, 500);
                    next();
                }
            });
        } else {
            let msg = "Please specify a valid file in a 'file' field of your form data";
            errorResp.send(res, consts.error.badRequestLabel, msg, 400);
            next();
        }
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validation, 400);
        next();
    }
};

function getValidationForPostCsvRegister(params) {
    let errors = [];

    errors = errors.concat(bleDataValidation.getBleAppIdValidation(params.bleAppID, "bleAppID", true));

    return errors;
}

function getCsvRowValidation(jsonObj, itr) {
    let errors = [];

    // MacAddress:
    if (jsonObj.MacAddress !== undefined) {
        if (dataValidation.isValidHexString(jsonObj.MacAddress, 12) === false) {
            errors.push("'MacAddress' column must contain a valid 12-character hex string " +
                        "(you gave " + jsonObj.MacAddress + ") (problem in row " + itr + ")");
        }

        // foreignKeys:
        for (let i = 0; i < consts.maxBleNodeForeignKeys; i++) {
            let keyNameExists = (jsonObj["KeyName" + i] !== undefined && jsonObj["KeyName" + i].length > 0);
            let keyValueExists = (jsonObj["KeyValue" + i] !== undefined && jsonObj["KeyValue" + i].length > 0);
            if ((keyNameExists && keyValueExists === false) ||
                (keyNameExists === false && keyValueExists)) {
                errors.push("Must specify a 'KeyName' and 'KeyValue' pair for every 'foreignKey' object " +
                            "(problem in row " + itr + ", pair " + i + ")");
            }
        }
    } else { // Don't validate the rest of the row unless 'MacAddress' is present.
        errors.push("Missing 'MacAddress' column (problem in row " + itr + ")");
    }

    return errors;
}

function parseCsvRowForForeignKeys(jsonObj) {
    let foreignKeys = [];

    for (let i = 0; i < consts.maxBleNodeForeignKeys; i++) {
        let keyNameExists = (jsonObj["KeyName" + i] !== undefined && jsonObj["KeyName" + i].length > 0);
        let keyValueExists = (jsonObj["KeyValue" + i] !== undefined && jsonObj["KeyValue" + i].length > 0);
        let descriptionExists = (jsonObj["Description" + i] !== undefined && jsonObj["Description" + i].length > 0);
        if (keyNameExists && keyValueExists) {
            let fk = {
                keyName:        jsonObj["KeyName" + i],
                keyValue:       jsonObj["KeyValue" + i],
                description:    (descriptionExists) ? jsonObj["Description" + i] : ""
            };
            foreignKeys.push(fk);
        }
    }

    return foreignKeys;
}

// PUT - "/ble/applications/:bleAppID/nodes/csvregister"
obj.updateBleNodes = function(req, res, next) {
    let validation = getValidationForPutCsv(req.params);
    if (validation.length === 0) {
        if (req.files && req.files.file) {
            let csvFile = req.files.file;
            let filePath = "./content/temp/" + csvFile.name;
            csvFile.mv(filePath, (err) => {
                if (!err) {
                    // Query the ble
                    let errMsgs = [];
                    let macNotFound = "";
                    let macUpdated = "";
                    let cursor = 0;
                    let allPromises = [];
                    csvToJSON()
                        .fromFile(filePath)
                        .on("json", (jsonObj) => {
                                cursor++;
                                let rowValidation = getPutCsvRowValidation(jsonObj, cursor);
                                if (rowValidation.length === 0) {
                                    let promise = new Promise((resolve, reject) => {
                                        // Query the database to find the node
                                        let BleNode = require("../../models/ble/bleNode.js")(req.params.bleAppID);
                                        let mac = jsonObj.MacAddress.toUpperCase();
                                        BleNode.find({ "macAddress": mac }).then((resp) => {
                                            // If the node does not exist, push macAddress from the csv row into the macsNotFound array.
                                            if (resp.length === 0) {
                                                macNotFound = mac;
                                                resolve({macNotFound});
                                                
                                            } else {
                                                let objToUpdate = {
                                                    deviceType: (jsonObj.DeviceType === undefined || jsonObj.DeviceType === "null") ? undefined : jsonObj.DeviceType,
                                                    name: (jsonObj.Name === undefined || jsonObj.Name === "null") ? undefined : jsonObj.Name
                                                };
                                                if (jsonObj.UpdateForeignKeys === "T") {
                                                    objToUpdate.foreignKeys = parsePutCsvRowForForeignKeys(jsonObj);
                                                }
                                                for (let field in objToUpdate) {
                                                    if (objToUpdate[field] === undefined || objToUpdate[field] === null) {
                                                        delete objToUpdate[field];
                                                    } else {
                                                        if (field === "foreignKeys") {
                                                            objToUpdate.foreignKeys.forEach((pair) => {
                                                                pair.description = (pair.description) ? pair.description : "";
                                                            });
                                                        }
                                                    }
                                                }
                                                BleNode.findOneAndUpdate({ "macAddress": mac }, objToUpdate, { new: true }).then((newRecord) => {
                                                    if (newRecord) {
                                                        macUpdated = mac;
                                                        resolve({macUpdated});
                                                    } else {
                                                        reject("An unexpected error occurred during querying database.");
                                                    }
                                                    
                                                }).catch((err) => {
                                                    logger.error(err);
                                                    errorResp.send(res, consts.error.serverErrorLabel, err, 500);
                                                    next();
                                                });
                                            }
                                        }).catch((err) => {
                                            logger.error(err);
                                            errorResp.send(res, consts.error.serverErrorLabel, err, 500);
                                            next();
                                        });
                                    });
                                    allPromises.push(promise);         
                                } else {
                                    errMsgs = errMsgs.concat(rowValidation);
                                }                
                        })
                        .on("done", (err) => {
                            if (!err && errMsgs.length === 0) {
                                Promise.all(allPromises).then((resps) => {
                                    let macsUpdated = [];
                                    let macsNotFound = [];
                                    for (let i in resps) {
                                        if (resps[i].hasOwnProperty("macNotFound")) {
                                            macsNotFound.push(resps[i].macNotFound);
                                        } else {
                                            macsUpdated.push(resps[i].macUpdated);
                                        }
                                    }
                                    res.send({
                                        numModified:            macsUpdated.length,
                                        numNotFoundNotUpdated:  macsNotFound.length,
                                        notFoundMacs:           macsNotFound
                                    });
                                    next();
                                }).catch((err) => {
                                    logger.error(err);
                                    errorResp.send(res, consts.error.serverErrorLabel, err, 500);
                                    next();
                                });

                                fs.unlink(filePath, () => {});
                            } else {
                                errorResp.send(res, consts.error.badRequestLabel, errMsgs, 400);
                                next();
                            }
                        })
                        .on("error", (err) => {
                            logger.error(err);
                            errorResp.send(res, consts.error.serverErrorLabel, "" + err, 500);
                            next();
                        });
                }
            });
        } else {
            let errMsg = "Please specify a valid CSV file (size > 0 bytes) in the file field of your form data.";            
            errorResp.send(res, consts.error.badRequestLabel, errMsg, 400);
            next();
        }
    }
};

function getValidationForPutCsv(params) {
    let errors = [];
    errors = errors.concat(bleDataValidation.getBleAppIdValidation(params.bleAppID, "bleAppID", true));
    return errors;
} 

function getPutCsvRowValidation(jsonObj, itr) {
    let errors = [];

    // MacAddress:
    if (jsonObj.MacAddress !== undefined) {
        if (dataValidation.isValidHexString(jsonObj.MacAddress, 12) === false) {
            errors.push("'MacAddress' column must contain a valid 12-character hex string " +
                        "(you gave " + jsonObj.MacAddress + ") (problem in row " + itr + ")");
        }

        // foreignKeys:
        for (let i = 0; i < consts.maxBleNodeForeignKeys; i++) {
            let keyNameExists = (jsonObj["KeyName" + i] !== undefined && jsonObj["KeyName" + i].length > 0);
            let keyValueExists = (jsonObj["KeyValue" + i] !== undefined && jsonObj["KeyValue" + i].length > 0);
            if ((keyNameExists && keyValueExists === false) ||
                (keyNameExists === false && keyValueExists)) {
                errors.push("Must specify a 'KeyName' and 'KeyValue' pair for every 'foreignKey' object " +
                            "(problem in row " + itr + ", pair " + i + ")");
            }
        }

        // UpdateForeignKeys:
        if (jsonObj.UpdateForeignKeys !== undefined) {
            if (jsonObj.UpdateForeignKeys !== "T" && jsonObj.UpdateForeignKeys !== "F") {
                errors.push ("The 'UpdateForeignKeys' field must contain 'T' or 'F', inclusive. You gave " + jsonObj.UpdateForeignKeys + ". (problem in row " + itr + ")" );
            }
        } else {
            errors.push("Missing 'UpdateForeignKeys' column (problem in row " + itr + ")");
        }
    } else { // Don't validate the rest of the row unless 'MacAddress' is present.
        errors.push("Missing 'MacAddress' column (problem in row " + itr + ")");
    }

    return errors;
}

function parsePutCsvRowForForeignKeys(jsonObj) {
    let foreignKeys = [];
    let csvNotContainKeyPairs = true;

    for (let i = 0; i < consts.maxBleNodeForeignKeys; i++) {
        let keyNameExists = (jsonObj["KeyName" + i] !== undefined);
        let keyValueExists = (jsonObj["KeyValue" + i] !== undefined);
        let descriptionExists = (jsonObj["Description" + i] !== undefined);

        if (keyNameExists && keyValueExists) {
            csvNotContainKeyPairs = false;
            if (jsonObj["KeyName" + i].length > 0 && jsonObj["KeyValue" + i].length > 0){
                let fk = {
                    keyName:        jsonObj["KeyName" + i],
                    keyValue:       jsonObj["KeyValue" + i],
                    description:    (descriptionExists) ? jsonObj["Description" + i] : ""
                };
                foreignKeys.push(fk);
            }
        }
    }

    if (foreignKeys.length === 0) {
        if (csvNotContainKeyPairs) {
            foreignKeys = null;
        }
    }

    return foreignKeys;
}

// GET - "/ble/applications/:bleAppID/nodes/location/geocounting?whereClause=...&layerURL=...&macAddress=...&dur=..."
obj.getNumActiveBleNodesInPolygon = function(req, res, next) {
    let validation = getValidationForNumInPolygon(req);
    if (validation.length === 0) {
        let requestProms = [];
        // First, get our node locations by calling the "/location" web service (defined above)
        let queryStr = getQueryStrForLocations(req);
        let webApiURL = "http://" + req.get("host") + "/api/ble/applications/" + req.params.bleAppID +
            "/nodes/location" + queryStr;
        let webApiOpts = { headers: { "x-access-token": req.headers["x-access-token"] } };
        requestProms.push(request("GET", webApiURL, webApiOpts));
        // Next, get our polygons from ArcGIS Server:
        let layerURL = req.query.layerURL;
        let esriURL = layerURL + ((layerURL[layerURL.length - 1] !== "/") ? "/" : "") +
            "query?where=" + req.query.whereClause + consts.esriAllFieldsGeoJsonQuerySuffix;
        requestProms.push(new Promise((resolve, reject) => {
            request("GET", esriURL).then((resp) => { resolve(resp); });
            setTimeout(() => { reject("No response from ArcGIS Server"); }, consts.howLongWaitForEsriPolygons);
        }));
        // Once both requests have completed, we can begin our server-side
        // geocomputing.
        Promise.all(requestProms).then((bothResps) => {
            let webApiResp = bothResps[0];
            let esriResp = bothResps[1];
            // Below: Check for any errors from our two HTTP requests.
            if (webApiResp.statusCode === 200 && esriResp.statusCode === 200) {
                try { // Catch JSON parsing errors
                    let webApiJSON = JSON.parse(webApiResp.body.toString());
                    let esriGeoJSON = JSON.parse(esriResp.body.toString());

                    // At this point we have all of our points and all of our
                    // polygons. So simply iterate through all points, and for
                    // each point, iterate through all polygons and calculate if
                    // the point is inside the polygon. If it is, add 1 to that
                    // polygon's count.
                    let finalResp = [];
                    // First, create an object for each polygon:
                    esriGeoJSON.features.forEach((each) => {
                        finalResp.push({
                            polygonID:              each.properties.polygonid,
                            numberOfNodesWithin:    0
                        });
                    });
                    for (let pointItr = 0; pointItr < webApiJSON.length; pointItr++) {
                        // Convert out node locations to geoJSON format:
                        let point = {
                            type: "Feature",
                            properties: {},
                            geometry: {
                                type: "Point",
                                coordinates: [
                                    webApiJSON[pointItr].longitude,
                                    webApiJSON[pointItr].latitude
                                ]
                            }
                        };
                        for (let polygonItr = 0; polygonItr < esriGeoJSON.features.length; polygonItr++) {
                            if (turf.inside(point, esriGeoJSON.features[polygonItr])) {
                                finalResp[polygonItr].numberOfNodesWithin++;
                                break;
                            }
                        }
                    }

                    // All finished, so send our final response:
                    res.send(finalResp);
                    next();
                } catch (err) {
                    logger.error(err);
                    errorResp.send(res, consts.error.serverErrorLabel, "" + err, 500);
                    next();
                }
            } else { // Catch any invalid input (code 400) or server errors (500)
                let webApiCode = (webApiResp.statusCode !== 200) ? webApiResp.statusCode : undefined;
                let esriCode = (esriResp.statusCode !== 200) ? esriResp.statusCode : undefined;
                // If we have two different status codes, take the Web API status code.
                let statusCode = ((webApiCode) ? webApiCode : esriCode);
                res.status(statusCode);

                let webApiBody = webApiResp.body.toString();
                let esriBody = esriResp.body.toString();
                // If we've received two error responses, merge them and send:
                if (webApiCode && esriCode) {
                    let errorRespJSON = JSON.parse(webApiBody);
                    // Esri sends their error responses in HTML format:
                    let msg = esriBody.split("title")[1].split("\n")[1].split("<")[0];
                    errorRespJSON.error.errors.push({
                        domain:     "esri",
                        reason:     "Server Error",
                        message:    msg
                    });
                    res.send(errorRespJSON);
                    next();
                } else { // Send only one:
                    let errorRespJSON;
                    if (webApiCode)
                        errorRespJSON = JSON.parse(webApiBody);
                    // If we've only received an error response from the Web API, simply
                    // send the response.
                    if (errorRespJSON) {
                        res.send(errorRespJSON);
                        next();
                    } else { // Otherwise, send a response with the Esri error:
                        let msg = esriBody.split("title")[1].split("\n")[1].split("<")[0];
                        let errRespJSON = {
                            error: {
                                errors: [{
                                    domain:     "esri",
                                    reason:     "Server Error",
                                    message:    msg
                                }],
                                code:       statusCode,
                                message:    msg
                            }
                        };
                        res.send(errRespJSON);
                        next();
                    }
                }
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

function getValidationForNumInPolygon(req) {
    let errors = [];

    // Inherited from "/location" web service, and thus not duplicated below:
    //   - bleAppID: Non-zero integer
    //   - macAddress: 12-character hex string
    //   - dur: A non-negative integer between 1 and 60, inclusive

    // whereClause:
    if (req.query.whereClause !== undefined) {
        if (req.query.whereClause.includes("\"")) {
            errors.push("'whereClause' parameter cannot contain double quotes. " +
                        "Use single quotes around any strings in the whereClause.");
        }
    } else {
        errors.push("Must specify 'whereClause' query parameter containing a string");
    }
    // layerURL:
    if (req.query.layerURL !== undefined) {
        if (req.query.layerURL.substring(0, 7) !== "http://") {
            errors.push("'layerURL' parameter must be a valid URL beginning with 'http://'.");
        }
    } else {
        errors.push("Must specify 'layerURL' query parameter containing a string");
    }

    return errors;
}

function getQueryStrForLocations(req) {
    let outputStr = "?";
    if (req.query.dur)
        outputStr += "dur=" + req.query.dur;
    if (req.query.macAddress) {
        outputStr += ((outputStr.length > 1) ? "&" : "") + "macAddress=" + req.query.macAddress;
    }
    return outputStr;
}

// - GET "/ble/applications/:bleAppID/nodes/locationhistory?macAddress=...&startTime=...&endTime=..."
obj.getBleNodeLocationHistory = function(req, res, next) {
    let validation = getValidationForLocationHistory(req);
    if (validation.length === 0) {
        let queryObj = {
            macAddress: req.query.macAddress.toUpperCase(),
            timestamp: {
                $gte:   req.query.startTime,
                $lte:   req.query.endTime
            }
        };
        let nodeLocation = reqFile("./models/ble/bleNodeLocation.js")(req.params.bleAppID);
        nodeLocation.find(queryObj, {
            _id:        0,
            macAddress: 0
        }).sort({ timestamp: -1 }).then((nodeLocations) => {
            let finalResp = [];
            nodeLocations.forEach((nodeLoc) => {
                finalResp.push({
                    latitude:       nodeLoc.geoLocation.coordinates[1],
                    longitude:      nodeLoc.geoLocation.coordinates[0],
                    timestamp:      nodeLoc.timestamp
                });
            });
            res.send(finalResp);
            next();
        }).catch((err) => {
            logger.error(err);
            let msg = err + "";
            errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validation, 400);
        next();
    }
};

function getValidationForLocationHistory(req) {
    let errors = [];

    errors = errors.concat(bleDataValidation.getBleAppIdValidation(req.params.bleAppID, "bleAppID", true));
    errors = errors.concat(bleDataValidation.getMacAddrValidation(req.query.macAddress, "macAddress", true));
    errors = errors.concat(dataValidation.getRequiredUtcIsoDateValidation(req.query.startTime, "startTime", true));
    errors = errors.concat(dataValidation.getRequiredUtcIsoDateValidation(req.query.endTime, "endTime", true));
    errors = errors.concat(dataValidation.getTimeRangeValidation(req.query.startTime, req.query.endTime));
    let interval = Date.parse(req.query.endTime) - Date.parse(req.query.startTime);
    if (isNaN(interval) !== true) {
        if (interval > (24 * 3600 * 1000)) {
            errors.push("'startTime' and 'endTime' parameters must be within 24 hours of each other " +
                        "(yours span " + dataFormat.timeRangeInMsToHumanReadable(interval) + ")");
        }
    }

    return errors;
}

module.exports = obj;
