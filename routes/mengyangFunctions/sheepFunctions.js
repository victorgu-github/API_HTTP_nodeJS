let fs = require("fs");
let csvToJSON = require("csvtojson");
let Sequelize = require("sequelize");
let seqOp = Sequelize.Op;

let config = reqFile("./config/config.js");
let consts = reqFile("./config/constants.js");
let utilities = reqFile("./common/utilities.js");
let errorResp = reqFile("./common/errorResponse");
let mengyangValidation = reqFile("./common/mengyangDataValidation.js");

let obj = {};

// - GET "/mengyang/pasture/:pastureID/sheep?mengyangID=...&mengyangID2=..."
obj.getAllSheepInfo = function(req, res, next) {
    let validation = getValidationForGET(req);
    if (validation.length === 0) {
        let sheepInfo = reqFile("./sequelizeModels")("sheepInfo", req.params.pastureID);
        // Now, we query for any records that contain either mengyangID or mengyangID2
        // or both, depending on which query parameters the user specified.
        let queryObj = {};
        if (req.query.mengyangID) {
            let ids = req.query.mengyangID.split(",");
            queryObj.where = {
                mengyangID: {
                    [ seqOp.or ]: ids
                }
            };
        }
        if (req.query.mengyangID2) {
            let id2s = req.query.mengyangID2.split(",");
            if (queryObj.where === undefined) {
                queryObj.where = {};
            }
            queryObj.where.mengyangID2 = {
                [ seqOp.or ]: id2s
            };
        }
        sheepInfo.findAll(queryObj).then((data) => {
            res.send(data);
            next();
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

function getValidationForGET(req) {
    let errors = [];

    errors = errors.concat(mengyangValidation.getPastureIdValidation(req.params.pastureID, "pastureID", true));
    errors = errors.concat(mengyangValidation.getMengyangIdValidation(req.query.mengyangID, "mengyangID", false));
    errors = errors.concat(mengyangValidation.getMengyangIdValidation(req.query.mengyangID2, "mengyangID2", false));

    return errors;
}

// - POST "/mengyang/pasture/:pastureID/sheep"
obj.saveSheepInfo = function(req, res, next) {
    let validation = getValidationForPOST(req);
    if (validation.length === 0) {
        let sheepInfo = reqFile("./sequelizeModels")("sheepInfo", req.params.pastureID);
        // Now we need to check to ensure that neither of the specified keys already exist
        // in the database:
        sheepInfo.findAll({
            where: {
                [ seqOp.or ]: [
                    { mengyangID: req.body.mengyangID },
                    { mengyangID2: req.body.mengyangID2 }
                ]
            }
        }).then((resp) => {
            if (resp.length === 0) {
                let objToSave = {
                    mengyangID:     (req.body.mengyangID !== undefined) ? req.body.mengyangID : "",
                    mengyangID2:    (req.body.mengyangID2 !== undefined) ? req.body.mengyangID2 : "",
                    dateOfBirth:    req.body.dateOfBirth,
                    birthWeight:    req.body.birthWeight,
                    gender:         req.body.gender,
                    origin:         req.body.origin,
                    fatherID:       (req.body.fatherID !== undefined) ? req.body.fatherID : "",
                    motherID:       (req.body.motherID !== undefined) ? req.body.motherID : "",
                    comments:       (req.body.comments !== undefined) ? req.body.comments : "",
                    variety:        (req.body.variety !== undefined) ? req.body.variety : "",
                    createdAt:      new Date(),
                    createdBy:      res.locals.username,
                    creatorAccessRole:  res.locals.accessRole
                };
                if (req.files && req.files.picture !== undefined) {
                    let theFile = req.files.picture;
                    objToSave.picture = getPictureDirectLink(encodeURI(theFile.name));
                    let filePathAndName = "./content/mengyang/" + theFile.name;
                    theFile.mv(filePathAndName, (err) => {
                        if (err !== null) {
                            logger.error(err);
                        }
                    });
                } else {
                    objToSave.picture = "";
                }
                sheepInfo.build(objToSave).save().then((resp) => {
                    let formattedResp = JSON.parse(JSON.stringify(resp));
                    formattedResp.birthWeight = parseFloat(formattedResp.birthWeight);
                    res.send(formattedResp);
                    next();
                }).catch((err) => {
                    logger.error(err);
                    errorResp.send(res, consts.error.serverErrorLabel, "" + err, 500);
                    next();
                });
            } else {
                // Format an error message or series of messages describing the duplicate keys
                // found in the database:
                let msgs = [];
                for (let i = 0; i < resp.length; i++) {
                    if (resp[i].mengyangID !== "" && resp[i].mengyangID === req.body.mengyangID) {
                        msgs.push("A sheep info record with 'mengyangID' " + resp[i].mengyangID +
                                  " already exists in the database");
                    }
                    if (resp[i].mengyangID2 !== "" && resp[i].mengyangID2 === req.body.mengyangID2) {
                        msgs.push("A sheep info record with 'mengyangID2' " + resp[i].mengyangID2 +
                                  " already exists in the database");
                    }
                }
                if (msgs.length === 1) {
                    msgs = msgs[0];
                }
                errorResp.send(res, consts.error.badRequestLabel, msgs, 400);
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

function getValidationForPOST(req) {
    let errors = [];

    errors = errors.concat(mengyangValidation.getPastureIdValidation(req.params.pastureID, "pastureID", true));
    errors = errors.concat(mengyangValidation.getMengyangIdValidation(req.body.mengyangID, "mengyangID", false));
    errors = errors.concat(mengyangValidation.getMengyangIdValidation(req.body.mengyangID2, "mengyangID2", false));
    // Additional business logic validation:
    if (req.body.mengyangID === undefined && req.body.mengyangID2 === undefined) {
        errors.push("Must specify at least one of either 'mengyangID' or 'mengyangID2' fields");
    } else {
        // Here we check that at least one of the provided values is not an emtpy string:
        let atLeastOneNonEmpty = false;
        if (req.body.mengyangID !== undefined && req.body.mengyangID !== "")
            atLeastOneNonEmpty = true;
        if (req.body.mengyangID2 !== undefined && req.body.mengyangID2 !== "")
            atLeastOneNonEmpty = true;
        if (atLeastOneNonEmpty === false) {
            errors.push("At least one of either 'mengyangID' or 'mengyangID2' must be a non-empty string");
        }
    }
    errors = errors.concat(mengyangValidation.getDateOfBirthValidation(req.body.dateOfBirth, "dateOfBirth", true));
    errors = errors.concat(mengyangValidation.getBirthWeightValidation(req.body.birthWeight, "birthWeight", true));
    errors = errors.concat(mengyangValidation.getGenderValidation(req.body.gender, "gender", true));
    errors = errors.concat(mengyangValidation.getOriginValidation(req.body.origin, "origin", true));
    errors = errors.concat(mengyangValidation.getFatherIdValidation(req.body.fatherID, "fatherID", false));
    errors = errors.concat(mengyangValidation.getMotherIdValidation(req.body.motherID, "motherID", false));
    errors = errors.concat(mengyangValidation.getCommentsValidation(req.body.comments, "comments", false));
    if (req.body.picture !== undefined) {
        if (req.body.picture !== "") {
            errors.push("'picture' parameter must either be a valid .jpg, .jpeg, or .png file, or an empty string");
        }
    } else if (req.files && req.files.picture) {
        errors = errors.concat(mengyangValidation.getPictureValidation(req.files.picture, false));
    }
    errors = errors.concat(mengyangValidation.getVarietyValidation(req.body.variety, "variety", false));

    return errors;
}

// - PUT "/mengyang/pasture/:pastureID/sheep"
obj.updateSheepInfo = function(req, res, next) {
    let validation = getValidationForPUT(req);
    if (validation.length === 0) {
        let sheepInfo = reqFile("./sequelizeModels")("sheepInfo", req.params.pastureID);
        let queryObj = {};
        if (req.body.mengyangID !== undefined && req.body.mengyangID !== "")
            queryObj.where = { mengyangID: req.body.mengyangID };
        if (req.body.mengyangID2 !== undefined && req.body.mengyangID2 !== "") {
            if (queryObj.where === undefined) {
                queryObj.where = {};
            }
            queryObj.where.mengyangID2 = req.body.mengyangID2;
        }
        sheepInfo.find(queryObj).then((record) => {
            if (record) {
                let updateObj = {
                    dateOfBirth:    (req.body.dateOfBirth !== undefined) ? req.body.dateOfBirth : undefined,
                    birthWeight:    (req.body.birthWeight !== undefined) ? req.body.birthWeight : undefined,
                    gender:         (req.body.gender !== undefined) ? req.body.gender : undefined,
                    origin:         (req.body.origin !== undefined) ? req.body.origin : undefined,
                    fatherID:       (req.body.fatherID !== undefined) ? req.body.fatherID : undefined,
                    motherID:       (req.body.motherID !== undefined) ? req.body.motherID : undefined,
                    comments:       (req.body.comments !== undefined) ? req.body.comments : undefined,
                    variety:        (req.body.variety !== undefined) ? req.body.variety : undefined
                };
                for (let field in updateObj) { if (updateObj[field] === undefined) delete updateObj[field]; }
                if (req.files && req.files.picture !== undefined) {
                    let theFile = req.files.picture;
                    updateObj.picture = getPictureDirectLink(encodeURI(theFile.name));
                    let filePathAndName = "./content/mengyang/" + theFile.name;
                    theFile.mv(filePathAndName, (err) => {
                        if (err !== null) {
                            logger.error(err);
                        }
                    });
                } else if (req.body.picture !== undefined) {
                    updateObj.picture = "";
                }
                record.updateAttributes(updateObj).then((resp) => {
                    let formattedResp = JSON.parse(JSON.stringify(resp));
                    formattedResp.birthWeight = parseFloat(formattedResp.birthWeight);
                    res.send(formattedResp);
                    next();
                }).catch((err) => {
                    logger.error(err);
                    errorResp.send(res, consts.error.serverErrorLabel, "" + err, 500);
                    next();
                });
            } else {
                // Format an error message describing that the specified keys were not
                // found in the database:
                let msgPart1 = "No sheep info record with ";
                let middlePart = "";
                if (req.body.mengyangID !== undefined && req.body.mengyangID !== "")
                    middlePart += "'mengyangID' " + req.body.mengyangID;
                if (req.body.mengyangID2 !== undefined && req.body.mengyangID2 !== "") {
                    if (middlePart !== "")
                        middlePart += " and ";
                    middlePart += "'mengyangID2' " + req.body.mengyangID2;
                }
                let msg = msgPart1 + middlePart + " found in the database";
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

function getValidationForPUT(req) {
    let errors = [];

    errors = errors.concat(mengyangValidation.getPastureIdValidation(req.params.pastureID, "pastureID", true));
    errors = errors.concat(mengyangValidation.getMengyangIdValidation(req.body.mengyangID, "mengyangID", false));
    errors = errors.concat(mengyangValidation.getMengyangIdValidation(req.body.mengyangID2, "mengyangID2", false));
    // Additional business logic validation:
    if (req.body.mengyangID === undefined && req.body.mengyangID2 === undefined) {
        errors.push("Must specify at least one of either 'mengyangID' or 'mengyangID2' fields");
    } else {
        // Here we check that at least one of the provided values is not an emtpy string:
        let atLeastOneNonEmpty = false;
        if (req.body.mengyangID !== undefined && req.body.mengyangID !== "")
            atLeastOneNonEmpty = true;
        if (req.body.mengyangID2 !== undefined && req.body.mengyangID2 !== "")
            atLeastOneNonEmpty = true;
        if (atLeastOneNonEmpty === false) {
            errors.push("At least one of either 'mengyangID' or 'mengyangID2' must be a non-empty string");
        }
    }
    errors = errors.concat(mengyangValidation.getDateOfBirthValidation(req.body.dateOfBirth, "dateOfBirth", false));
    errors = errors.concat(mengyangValidation.getBirthWeightValidation(req.body.birthWeight, "birthWeight", false));
    errors = errors.concat(mengyangValidation.getGenderValidation(req.body.gender, "gender", false));
    errors = errors.concat(mengyangValidation.getOriginValidation(req.body.origin, "origin", false));
    errors = errors.concat(mengyangValidation.getFatherIdValidation(req.body.fatherID, "fatherID", false));
    errors = errors.concat(mengyangValidation.getMotherIdValidation(req.body.motherID, "motherID", false));
    errors = errors.concat(mengyangValidation.getCommentsValidation(req.body.comments, "comments", false));
    if (req.body.picture !== undefined) {
        if (req.body.picture !== "") {
            errors.push("'picture' parameter must either be a valid .jpg, .jpeg, or .png file, or an empty string");
        }
    } else if (req.files && req.files.picture) {
        errors = errors.concat(mengyangValidation.getPictureValidation(req.files.picture, false));
    }
    errors = errors.concat(mengyangValidation.getVarietyValidation(req.body.variety, "variety", false));

    return errors;
}

// - DELETE "/mengyang/pasture/:pastureID/sheep?mengyangID=...&mengyangID2=..."
obj.deleteSheepInfo = function(req, res, next) {
    let validation = getValidationForDELETE(req);
    if (validation.length === 0) {
        let sheepInfo = reqFile("./sequelizeModels")("sheepInfo", req.params.pastureID);
        let queryObj = {};
        if (req.query.mengyangID) {
            let ids = req.query.mengyangID.split(",");
            queryObj.where = {
                mengyangID: {
                    [ seqOp.or ]: ids
                }
            };
        }
        if (req.query.mengyangID2) {
            let id2s = req.query.mengyangID2.split(",");
            if (queryObj.where === undefined) {
                queryObj.where = {};
            }
            queryObj.where.mengyangID2 = {
                [ seqOp.or ]: id2s
            };
        }
        sheepInfo.findAll(queryObj).then((records) => {
            let foundIDs = [];
            records.forEach((record) => {
                foundIDs.push({
                    mengyangID:     record.mengyangID,
                    mengyangID2:    record.mengyangID2
                });
            });
            sheepInfo.destroy(queryObj).then((resp) => {
                res.send({
                    idsDeleted:  foundIDs
                });
                next();
            }).catch((err) => {
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
        errorResp.send(res, consts.error.badRequestLabel, validation, 400);
        next();
    }
};

function getValidationForDELETE(req) {
    let errors = [];

    errors = errors.concat(mengyangValidation.getPastureIdValidation(req.params.pastureID, "pastureID", true));
    errors = errors.concat(mengyangValidation.getMengyangIdValidation(req.query.mengyangID, "mengyangID", false));
    errors = errors.concat(mengyangValidation.getMengyangIdValidation(req.query.mengyangID2, "mengyangID2", false));
    // Additional business logic validation:
    if (req.query.mengyangID === undefined && req.query.mengyangID2 === undefined) {
        errors.push("Must specify at least one of either 'mengyangID' or 'mengyangID2' fields");
    } else {
        // Here we check that at least one of the provided values is not an emtpy string:
        let atLeastOneNonEmpty = false;
        if (req.query.mengyangID !== undefined && req.query.mengyangID !== "")
            atLeastOneNonEmpty = true;
        if (req.query.mengyangID2 !== undefined && req.query.mengyangID2 !== "")
            atLeastOneNonEmpty = true;
        if (atLeastOneNonEmpty === false) {
            errors.push("At least one of either 'mengyangID' or 'mengyangID2' must be a non-empty string");
        }
    }

    return errors;
}

// - POST "/mengyang/pasture/:pastureID/sheep/csvregister"
obj.saveSheepInfoBatch = function(req, res, next) {
    let validation = getValidationForBatchPOST(req.params);
    if (validation.length === 0) {
        if (req.files) {
            let theFile = req.files.file;
            let filePathAndName = "./content/temp/" + theFile.name;
            theFile.mv(filePathAndName, (err) => {
                if (!err) {
                    // Query the database for any pre-existing MAC addresses
                    let sheepInfo = reqFile("./sequelizeModels")("sheepInfo", req.params.pastureID);
                    sheepInfo.findAll({
                        attributes: [ "mengyangID", "mengyangID2" ]
                    }).then((resp) => {
                        let mIDsInDb = [];
                        let mID2sInDb = [];
                        resp.forEach((record) => {
                            if (record.mengyangID !== "")
                                mIDsInDb.push(record.mengyangID);
                            if (record.mengyangID2 !== "")
                                mID2sInDb.push(record.mengyangID2);
                        });
                        mIDsInDb.sort();
                        mID2sInDb.sort();

                        let batch = [];
                        let dupeMIDs = [];
                        let dupeMID2s = [];
                        let itr = 1;
                        let csvValidationMsgs = [];
                        let csvFileIsValid = true;
                        csvToJSON()
                            .fromFile(filePathAndName)
                            .on("json", (jsonObj) => {
                                if (csvFileIsValid === true && csvFileIsMissingColumns(Object.keys(jsonObj))) {
                                    csvFileIsValid = false;
                                    csvValidationMsgs.push("CSV file is missing columns. " +
                                                           "Please check the interface document and try again.");
                                } else if (csvFileIsValid) {
                                    let rowValidation = getRowValidationForBatchPOST(jsonObj, itr);
                                    csvValidationMsgs = csvValidationMsgs.concat(rowValidation);
                                    if (rowValidation.length === 0) {
                                        let sheepInfo = {
                                            mengyangID:     jsonObj.MengyangID,
                                            mengyangID2:    jsonObj.MengyangID2,
                                            dateOfBirth:    jsonObj.DateOfBirth,
                                            birthWeight:    jsonObj.BirthWeight,
                                            gender:         jsonObj.Gender,
                                            origin:         jsonObj.Origin,
                                            fatherID:       jsonObj.FatherID,
                                            motherID:       jsonObj.MotherID,
                                            picture:        "",
                                            comments:       jsonObj.Comments,
                                            variety:        jsonObj.Variety,
                                            createdAt:      new Date(),
                                            createdBy:      res.locals.username,
                                            creatorAccessRole:  res.locals.accessRole
                                        };
                                        let mID = sheepInfo.mengyangID;
                                        let mID2 = sheepInfo.mengyangID2;
                                        // I.e.: If the user has typed a given MID or MID2 twice in the CSV file,
                                        // or if it already exists in the database:
                                        let mIdIsDuplicate = false;
                                        let mId2IsDuplicate = false;
                                        if (mID !== "" &&
                                            batch.filter((each) => { return each.mengyangID === sheepInfo.mengyangID; }).length > 0 ||
                                            utilities.partitionSearchSortedArray(mID, mIDsInDb, 0, mIDsInDb.length)) {
                                            mIdIsDuplicate = true;
                                        }
                                        if (mID2 !== "" &&
                                            batch.filter((each) => { return each.mengyangID2 === sheepInfo.mengyangID2; }).length > 0 ||
                                                   utilities.partitionSearchSortedArray(mID2, mID2sInDb, 0, mID2sInDb.length)) {
                                            mId2IsDuplicate = true;
                                        }
                                        if (mIdIsDuplicate === false && mId2IsDuplicate === false) {
                                            batch.push(sheepInfo);
                                        } else {
                                            if (mIdIsDuplicate) {
                                                dupeMIDs.push(mID);
                                            }
                                            if (mId2IsDuplicate) {
                                                dupeMID2s.push(mID2);
                                            }
                                        }
                                    }
                                    itr++;
                                } // Else ignore, as this CSV file is invalid
                            })
                            .on("done", (err) => {
                                if (!err && csvValidationMsgs.length === 0) {
                                    let biProm;
                                    if (batch.length > 0) {
                                        biProm = sheepInfo.bulkCreate(batch);
                                    } else {
                                        biProm = Promise.resolve([]);
                                    }
                                    biProm.then((resp) => {
                                        res.send({
                                            numInserted:                            resp.length,
                                            numDuplicateMengyangIDsNotInserted:     dupeMIDs.length,
                                            duplicateMengyangIDs:                   dupeMIDs,
                                            numDuplicateMengyangID2sNotInserted:    dupeMID2s.length,
                                            duplicateMengyangID2s:                  dupeMID2s
                                        });
                                        next();
                                    }).catch((err) => {
                                        logger.error(err);
                                        errorResp.send(res, consts.error.serverErrorLabel, "" + err, 500);
                                        next();
                                    });
                                    fs.unlink(filePathAndName, () => {});
                                } else {
                                    errorResp.send(res, consts.error.badRequestLabel, csvValidationMsgs, 400);
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

function getValidationForBatchPOST(params) {
    let errors = [];

    errors = errors.concat(mengyangValidation.getPastureIdValidation(params.pastureID, "pastureID", true));

    return errors;
}

function csvFileIsMissingColumns(fields) {
    let requiredFields = [
        "MengyangID",
        "MengyangID2",
        "DateOfBirth",
        "BirthWeight",
        "Gender",
        "Origin",
        "FatherID",
        "MotherID",
        "Comments",
        "Variety"
    ];
    for (let i in requiredFields) {
        if (fields.includes(requiredFields[i]) === false) {
            return true;
        }
    }
    return false;
}

function getRowValidationForBatchPOST(row, rowNum) {
    let errors = [];

    errors = errors.concat(mengyangValidation.getMengyangIdValidation(row.MengyangID, "MengyangID", true));
    errors = errors.concat(mengyangValidation.getMengyangIdValidation(row.MengyangID2, "MengyangID2", true));
    // Here we check that at least one of the provided values is not an emtpy string:
    let atLeastOneNonEmpty = false;
    if (row.MengyangID !== undefined && row.MengyangID !== "")
        atLeastOneNonEmpty = true;
    if (row.MengyangID2 !== undefined && row.MengyangID2 !== "")
        atLeastOneNonEmpty = true;
    if (atLeastOneNonEmpty === false) {
        errors.push("At least one of either 'mengyangID' or 'mengyangID2' must be a non-empty string");
    }
    errors = errors.concat(mengyangValidation.getDateOfBirthValidation(row.DateOfBirth, "DateOfBirth", true));
    errors = errors.concat(mengyangValidation.getBirthWeightValidation(row.BirthWeight, "BirthWeight", true));
    errors = errors.concat(mengyangValidation.getGenderValidation(row.Gender, "Gender", true));
    errors = errors.concat(mengyangValidation.getOriginValidation(row.Origin, "Origin", true));
    errors = errors.concat(mengyangValidation.getFatherIdValidation(row.FatherID, "FatherID", true));
    errors = errors.concat(mengyangValidation.getMotherIdValidation(row.MotherID, "MotherID", true));
    errors = errors.concat(mengyangValidation.getCommentsValidation(row.Comments, "Comments", true));
    errors = errors.concat(mengyangValidation.getVarietyValidation(row.Variety, "Variety", true));

    for (let i = 0; i < errors.length; i++) {
        errors[i] = errors[i] + "  (problem in row " + rowNum + ")";
    }
    return errors;
}

function getPictureDirectLink(filename) {
    return config.serverHost + ":" + config.displayedPortNum + "/static/mengyang/" + filename;
}

module.exports = obj;
