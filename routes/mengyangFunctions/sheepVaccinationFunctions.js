let fs = require("fs");
let csvToJSON = require("csvtojson");
let Sequelize = require("sequelize");
let seqOp = Sequelize.Op;
let consts = reqFile("./config/constants.js");
let errorResp = reqFile("./common/errorResponse");
let mengyangValidation = reqFile("./common/mengyangDataValidation.js");


let obj = {};

// Get "/api/mengyang/pasture/:pastureID/sheepvaccination?vaccinationID=..""
obj.getSheepVaccinationInfo = function(req, res, next) {
    let validation = validateGetParams(req);
    if (validation.length === 0) {
        let sheepVaccinationInfo = reqFile("./sequelizeModels")("sheepVaccineInfo", req.params.pastureID);
        // // Now, if the request does not contain query parameters, we will return
        // // all the records in the mengyang_pasture_pastureid database
        let queryObj = {};
        queryObj.order = [["vaccinationID", "DESC"]];

        if (req.query.vaccinationID) {
            let ids = req.query.vaccinationID.split(",");
            queryObj.where = {
                vaccinationID: {
                    [seqOp.or]: ids
                }
            };
        }

        sheepVaccinationInfo.findAll(queryObj).then((data) => {
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

function validateGetParams(req) {
    let errors = [];
    errors = errors.concat(mengyangValidation.getPastureIdValidation(req.params.pastureID, "pastureID", true));
    if (req.query.vaccinationID || req.query.vaccinationID === ""){
        let ids = req.query.vaccinationID.split(",");
        for (let i in ids) {
            errors = errors.concat(mengyangValidation.getVaccinationIdValidation(ids[i], "vaccinationID", false));
        }
    }
    return errors;
}

//- POST "/mengyang/pasture/:pastureID/sheepvaccination"
obj.saveSheepVaccinationInfo = function(req, res, next) {
    let validation = validatePostParams(req);
    if (validation.length === 0) {
        // Connect to the database
        let sheepVaccineInfo = reqFile("./sequelizeModels")("sheepVaccineInfo", req.params.pastureID);
        // Now we need to query the database and find the maximum vaccinationID,
        // And increment it by 1.
        sheepVaccineInfo.findAll({
            order:[
                ["vaccinationID","DESC"]
            ],
            attributes: ["vaccinationID"]
        }).then((resp) => {
            let maxVaccinationID = (resp.length === 0) ? 0 : resp[0].vaccinationID;
            let vaccinationID = maxVaccinationID + 1;
            let objToSave = {
                vaccinationID:          vaccinationID,
                sheepfoldID:            req.body.sheepfoldID,
                polygonID:              req.body.polygonID,
                vaccinationDate:        Date.parse(req.body.vaccinationDate),
                vaccinationTechnician:  req.body.vaccinationTechnician,
                numberOfSheep:          (req.body.numberOfSheep !== undefined) ? req.body.numberOfSheep : 0,
                sheepAge:               (req.body.sheepAge !== undefined) ? req.body.sheepAge : "",
                medicineName:           (req.body.medicineName !== undefined) ? req.body.medicineName : "",
                medicineCompany:        (req.body.medicineCompany !== undefined) ? req.body.medicineCompany : "",
                medicinePreservation:   (req.body.medicinePreservation !== undefined) ? req.body.medicinePreservation : "",
                medicineInstruction:    (req.body.medicineInstruction !== undefined) ? req.body.medicineInstruction : "",
                medicineDosage:         (req.body.medicineDosage !== undefined) ? req.body.medicineDosage : "",
                companyPhone:           (req.body.companyPhone !== undefined) ? req.body.companyPhone : "",
                approvalID:             (req.body.approvalID !== undefined) ? req.body.approvalID : "",
                approvalDocNumber:      (req.body.approvalDocNumber !== undefined) ? req.body.approvalDocNumber : "",
                createdAt:              new Date(),
                createdBy:              res.locals.username,
                creatorAccessRole:      res.locals.accessRole

            };
            sheepVaccineInfo.build(objToSave).save().then((resp) => {
                res.send(resp);
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

function validatePostParams(req) {
    let errors = [];
    // Validate URL parameter: pastureID
    errors = errors.concat(mengyangValidation.getPastureIdValidation(req.params.pastureID, "pastureID", true));
    // Validate request body
    errors = errors.concat(mengyangValidation.getVaccineSheepfoldIdValidation(req.body.sheepfoldID, "sheepfoldID", true));
    errors = errors.concat(mengyangValidation.getVaccinePolygonIdValidation(req.body.polygonID, "polygonID", true));
    errors = errors.concat(mengyangValidation.getVaccinationDateValidation(req.body.vaccinationDate, "vaccinationDate", true));
    errors = errors.concat(mengyangValidation.getVaccinationTechnicianValidation(req.body.vaccinationTechnician, "vaccinationTechnician", true));
    errors = errors.concat(mengyangValidation.getNumberOfSheepValidation(req.body.numberOfSheep, "numberOfSheep", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(req.body.sheepAge, "sheepAge", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(req.body.medicineName, "medicineName", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(req.body.medicineCompany, "medicineCompany", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(req.body.medicinePreservation, "medicinePreservation", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(req.body.medicineInstruction, "medicineInstruction", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(req.body.medicineDosage, "medicineDosage", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(req.body.companyPhone, "companyPhone", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(req.body.approvalID, "approvalID", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(req.body.approvalDocNumber, "approvalDocNumber", false));

    return errors;
}

// PUT "mengyang/pasture/:pastureID/sheepvaccination"
obj.updateSheepVaccinationInfo = function(req, res, next) {
    let validation = validatePutParams(req);
    if (validation.length === 0) {
        let sheepVaccinationInfo = reqFile("./sequelizeModels")("sheepVaccineInfo", req.params.pastureID);
        let queryObj = {};
        queryObj.where = {
            vaccinationID: req.body.vaccinationID
        };
        sheepVaccinationInfo.find(queryObj).then((record) => {
            if (record) {
                let objToUpdate = {
                    sheepfoldID:            (req.body.sheepfoldID !== undefined) ? req.body.sheepfoldID : undefined,
                    polygonID:              (req.body.polygonID !== undefined) ? req.body.polygonID : undefined,
                    vaccinationDate:         (req.body.vaccinationDate !== undefined) ? Date.parse(req.body.vaccinationDate) : undefined,
                    vaccinationTechnician:  (req.body.vaccinationTechnician !== undefined) ? req.body.vaccinationTechnician : undefined,
                    numberOfSheep:          (req.body.numberOfSheep !== undefined) ? req.body.numberOfSheep : undefined,
                    sheepAge:               (req.body.sheepAge !== undefined) ? req.body.sheepAge : undefined,
                    medicineName:           (req.body.medicineName !== undefined) ? req.body.medicineName : undefined,
                    medicineCompany:        (req.body.medicineCompany !== undefined) ? req.body.medicineCompany : undefined,
                    medicinePreservation:   (req.body.medicinePreservation !== undefined) ? req.body.medicinePreservation : undefined,
                    medicineInstruction:    (req.body.medicineInstruction !== undefined) ? req.body.medicineInstruction : undefined,
                    medicineDosage:         (req.body.medicineDosage !== undefined) ? req.body.medicineDosage : undefined,
                    companyPhone:           (req.body.companyPhone !== undefined) ? req.body.companyPhone : undefined,
                    approvalID:             (req.body.approvalID !== undefined) ? req.body.approvalID : undefined,
                    approvalDocNumber:      (req.body.approvalDocNumber !== undefined) ? req.body.approvalDocNumber : undefined
                };
                for (let i in objToUpdate) {
                    if (objToUpdate[i] === undefined) {
                        delete objToUpdate[i];
                    }
                }

                record.updateAttributes(objToUpdate).then((resp) => {
                    let formattedResp = JSON.parse(JSON.stringify(resp));
                    formattedResp.numberOfSheep = parseInt(formattedResp.numberOfSheep);
                    res.send(formattedResp);
                    next();
                }).catch((err) => {
                    logger.error(err);
                    errorResp.send(res, consts.error.serverErrorLabel, "" + err, 500);
                    next();
                });

            } else {
                let errMsg = [];
                errMsg.push("No record with vaccinationID " + req.body.vaccinationID + " found in the database.");
                errorResp.send(res, consts.error.badRequestLabel, errMsg, 400);
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

function validatePutParams(req) {
    let errors = [];
    // Validate the URL parameter and the primary key
    errors = errors.concat(mengyangValidation.getPastureIdValidation(req.params.pastureID, "pastureID", true));
    errors = errors.concat(mengyangValidation.getVaccinationIdValidation(req.body.vaccinationID, "vaccinationID", true));
    // Validate the rest of the request body
    errors = errors.concat(mengyangValidation.getVaccineSheepfoldIdValidation(req.body.sheepfoldID, "sheepfoldID", false));
    errors = errors.concat(mengyangValidation.getVaccinePolygonIdValidation(req.body.polygonID, "polygonID", false));
    errors = errors.concat(mengyangValidation.getVaccinationDateValidation(req.body.vaccinationDate, "vaccinationDate", false));
    errors = errors.concat(mengyangValidation.getVaccinationTechnicianValidation(req.body.vaccinationTechnician, "vaccinationTechnician", false));
    errors = errors.concat(mengyangValidation.getNumberOfSheepValidation(req.body.numberOfSheep, "numberOfSheep", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(req.body.sheepAge, "sheepAge", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(req.body.medicineName, "medicineName", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(req.body.medicineCompany, "medicineCompany", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(req.body.medicinePreservation, "medicinePreservation", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(req.body.medicineInstruction, "medicineInstruction", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(req.body.medicineDosage, "medicineDosage", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(req.body.companyPhone, "companyPhone", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(req.body.approvalID, "approvalID", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(req.body.approvalDocNumber, "approvalDocNumber", false));
    return errors;
}

// DELETE "mengyang/pasture/:pastureID/sheepvaccination?vaccinationID=..."
obj.deleteSheepVaccinationRecord = function(req, res, next) {
    let validation = validateDeleteParams (req);
    if (validation.length === 0 ) {
        let sheepVaccinationInfo = reqFile("./sequelizeModels")("sheepVaccineInfo", req.params.pastureID);
        let queryObj = {};
        let ids = req.query.vaccinationID.split(",");
        queryObj.where = {
            vaccinationID: {
                [ seqOp.or ]: ids
            }
        };
        sheepVaccinationInfo.findAll(queryObj).then((records) => {
            let idsToDelete = [];
            records.forEach((record) => {
                idsToDelete.push(record.vaccinationID);
            });
            sheepVaccinationInfo.destroy(queryObj).then((resp) => {
                res.send({
                    idsDeleted: idsToDelete
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

function validateDeleteParams(req) {
    let errors = [];
    errors = errors.concat(mengyangValidation.getPastureIdValidation(req.params.pastureID, "pastureID", true));
    
    if (req.query.vaccinationID) {
        let vaccinationIDs = req.query.vaccinationID.split(",");
        for (let i in vaccinationIDs) {
            errors = errors.concat(mengyangValidation.getVaccinationIdValidation(vaccinationIDs[i], "vaccinationID", true));
        }
    } else {
        errors = errors.concat(mengyangValidation.getVaccinationIdValidation(req.params.vaccinationID, "vaccinationID", true));
    }

    return errors;
}

// POST "/mengyang/pasture/:pastureID/sheepvaccination/csvregister"
obj.saveSheepVaccineInfoCsv = function(req, res, next) {
    let validation = validateCsvPostParams (req.params);
    if (validation.length === 0) {     
        if (req.files && req.files.file) {
            let csvFile = req.files.file;
            let filePath = "./content/temp/" + csvFile.name;
            csvFile.mv(filePath, (err) => {
                if (!err) {
                    // Query the database for the maximum vaccinationID
                    let sheepVaccinationInfo = reqFile("./sequelizeModels")("sheepVaccineInfo", req.params.pastureID);
                    sheepVaccinationInfo.findAll({
                        order:[
                            ["vaccinationID","DESC"]
                        ],
                        attributes: ["vaccinationID"]
                    }).then((resp) => {
                        let maxVaccinationID = (resp.length === 0) ? 0 : resp[0].vaccinationID;
                        let batchInsert = [];
                        let csvErrorMsgs = [];
                        let cursor = 1;
                        let csvFileIsValid = true;
                        csvToJSON()
                            .fromFile(filePath)
                            .on("json", (jsonObj) => {
                                if (csvFileIsValid === true && validateCsvColumns(Object.keys(jsonObj)) === false) {
                                    csvFileIsValid = false;
                                    csvErrorMsgs.push("CSV file is missing columns. Please check the interface document and try again.");
                                } else {
                                    let rowValidation = vadliateCsvRows(jsonObj, cursor);
                                    csvErrorMsgs = csvErrorMsgs.concat(rowValidation);
                                    if (rowValidation.length === 0) {
                                        let recordToSave = {
                                            vaccinationID:          maxVaccinationID + cursor,
                                            sheepfoldID:            jsonObj.sheepfoldID,
                                            polygonID:              jsonObj.polygonID,
                                            vaccinationDate:        jsonObj.vaccinationDate,
                                            vaccinationTechnician:  jsonObj.vaccinationTechnician,
                                            numberOfSheep:          parseInt(jsonObj.numberOfSheep),
                                            sheepAge:               jsonObj.sheepAge,
                                            medicineName:           jsonObj.medicineName,
                                            medicineCompany:        jsonObj.medicineCompany,
                                            medicineDosage:         jsonObj.medicineDosage,
                                            medicinePreservation:   jsonObj.medicinePreservation,
                                            medicineInstruction:    jsonObj.medicineInstruction,
                                            companyPhone:           jsonObj.companyPhone,
                                            approvalID:             jsonObj.approvalID,
                                            approvalDocNumber:      jsonObj.approvalDocNumber,
                                            createdAt:              new Date(),
                                            createdBy:              res.locals.username,
                                            creatorAccessRole:      res.locals.accessRole
                                        };
                                        batchInsert.push(recordToSave);
                                    }
                                    cursor++;
                                }
                            })
                            .on("done",(err) => {
                                if (!err && csvErrorMsgs.length === 0) {
                                    let biProm;
                                    if (batchInsert.length > 0) {
                                        biProm = sheepVaccinationInfo.bulkCreate(batchInsert);
                                    } else {
                                        biProm = Promise.resolve([]);
                                    }
                                    biProm.then((resp) => {
                                        res.send({
                                            numInserted: resp.length
                                        });
                                        next();
                                    }).catch((err) => {
                                        logger.error(err);
                                        errorResp.send(res, consts.error.serverErrorLabel, "" + err, 500);
                                        next();
                                    });
                                    fs.unlink(filePath, () => {});
                                } else {
                                    errorResp.send(res, consts.error.badRequestLabel, csvErrorMsgs, 400);
                                    next();
                                }
                            })
                            .on("error", (err) => {
                                logger.error(err);
                                errorResp.send(res, consts.error.serverERrorLabel, "" + err, 500);
                                next();
                            });
                    }).catch((err) => {
                        logger.error(err);
                        errorResp.send(res, consts.error.serverErrorLabel, "" + err, 500);
                        next();
                    });                                            
                } else {
                    logger.error(err);
                    errorResp.send(res, consts.error.serverERrorLabel, "" + err, 500);
                    next();
                }
            });
        } else {
            let errMsg = "Please specify a CSV file (size > 0 bytes) in a 'file' field of your form data.";
            errorResp.send(res, consts.error.badRequestLabel, errMsg, 400);
            next();
        }
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validation, 400);
        next();
    }
};

function validateCsvPostParams(params) {
    let errors = [];
    errors = errors.concat(mengyangValidation.getPastureIdValidation(params.pastureID, "pastureID", true));
    return errors;
}

function validateCsvColumns(columns) {
    let requiredColumns = [
        "sheepfoldID",
        "polygonID",
        "vaccinationDate",
        "vaccinationTechnician",
        "numberOfSheep",
        "sheepAge",
        "medicineName",
        "medicineCompany",
        "medicinePreservation",
        "medicineInstruction",
        "companyPhone",
        "approvalID",
        "approvalDocNumber"
    ];
    for (let i in requiredColumns) {
        if (columns.includes(requiredColumns[i]) === false) {
            return false;
        }
    }
    return true;
}

function vadliateCsvRows(row, cursor) {
    let errors = [];

    errors = errors.concat(mengyangValidation.getVaccineSheepfoldIdValidation(row.sheepfoldID, "sheepfoldID", true)) ;
    errors = errors.concat(mengyangValidation.getVaccinePolygonIdValidation(row.polygonID, "polygonID", true));
    errors = errors.concat(mengyangValidation.getVaccinationDateValidation(row.vaccinationDate, "vaccinationDate", true));
    errors = errors.concat(mengyangValidation.getVaccinationTechnicianValidation(row.vaccinationTechnician, "vaccinationTechnician", true));
    errors = errors.concat(mengyangValidation.getNumberOfSheepValidation(parseInt(row.numberOfSheep), "numberOfSheep", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(row.sheepAge, "sheepAge", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(row.medicineName, "medicineName", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(row.medicineCompany, "medicineCompany", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(row.medicinePreservation, "medicinePreservation", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(row.medicineInstruction, "medicineInstruction", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(row.medicineDosage, "medicineDosage", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(row.companyPhone, "companyPhone", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(row.approvalID, "approvalID", false));
    errors = errors.concat(mengyangValidation.getStringParameterValidation(row.approvalDocNumber, "approvalDocNumber", false));

    for (let i in errors) {
        errors[i] = errors[i] + " (problem in row " + cursor + ")"; 
    }

    return errors;
}

module.exports = obj;