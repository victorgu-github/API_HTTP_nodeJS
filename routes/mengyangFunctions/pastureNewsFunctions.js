let Sequelize = require("sequelize");
let seqOp = Sequelize.Op;
let consts = reqFile("./config/constants.js");
let errorResp = reqFile("./common/errorResponse");
let mengyangValidation = reqFile("./common/mengyangDataValidation.js");
let generalValidation = reqFile("./common/dataValidation.js");

let obj = {};

// - GET "/api/mengyang/news"
obj.getNewsRecords = function(req, res, next) {
    let validation = validateGetParams(req);
    if (validation.length === 0) {
        // First step is to connect to the pasture_news data table.
        let pastureNews = reqFile("./sequelizeModels")("pastureNews", null);
        let queryObj = {};
        queryObj.where = {};
        // Since each record has a auto-increment index: newsID, we would like to
        // sort on it in descending order, so that the latest record always comes
        // in first.
        queryObj.order = [["newsID", "DESC"]];

        // Form the query object based on the user's input.
        if (req.query.pastureID !== undefined) {
            let pastureIDs = req.query.pastureID.split(",");
            queryObj.where.pastureID = { [seqOp.or]: pastureIDs };
        }
        if (req.query.from !== undefined || req.query.to !== undefined) {
            queryObj.where.date = {};
            if (req.query.from === undefined) {
                queryObj.where.date = {[seqOp.lte]: req.query.to};
            } else if (req.query.to === undefined) {
                queryObj.where.date = {[seqOp.gte]: req.query.from};
            } else {
                queryObj.where.date = {
                    $between: [req.query.from, req.query.to]
                };
            }
        }
        pastureNews.findAll(queryObj).then((resp) => {
            res.send(resp);
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
    errors = errors.concat(mengyangValidation.getMultipleQueryPastureIdsValidation(req.query.pastureID, false));
    errors = errors.concat(generalValidation.getRequiredUtcIsoDateValidation(req.query.from, "from", false));
    errors = errors.concat(generalValidation.getRequiredUtcIsoDateValidation(req.query.to, "to", false));

    if (errors.length === 0 && req.query.from !== undefined && req.query.to !== undefined) {
        let fromDate = Date.parse(req.query.from);
        let toDate = Date.parse(req.query.to);
        if (fromDate > toDate) {
            errors = errors.concat(["The from date must be earlier or equal to the to date"]);
        }
    }

    return errors;
}

// - POST "/api/mengyang/news"
obj.saveNewsRecord = function(req, res, next) {
    let validation = validatePostParams(req);
    if (validation.length === 0) {
        // Because each record needs to have a auto-increment newsID, we will need to query
        // the database and get the maximum value first
        let pastureNews = reqFile("./sequelizeModels")("pastureNews", null);
        let queryObj = {};
        queryObj.order = [["newsID", "DESC"]];
        pastureNews.findAll(queryObj).then((records) => {
            let maxNewsID = (records.length === 0) ? 0 : records[0].newsID;
            let newsID = maxNewsID + 1;
            let objToSave = {
                newsID:             newsID,
                pastureID:          req.body.pastureID,
                date:               req.body.date,
                content:            req.body.content,
                createdAt:          new Date(),
                createdBy:          res.locals.username,
                creatorAccessRole:  res.locals.accessRole
            };
            pastureNews.build(objToSave).save().then((resp) => {
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
    // Validate the pastureID field in the POST request body
    if (req.body.pastureID !== undefined && typeof req.body.pastureID !== "number") {
        errors = errors.concat(["The 'pastureID' parameter must be an integer (you gave " + typeof req.body.pastureID + " " + req.body.pastureID + ")."]);
    } else {
        errors = errors.concat(mengyangValidation.getPastureIdValidation(req.body.pastureID, "pastureID", true));
    }
    errors = errors.concat(generalValidation.getRequiredUtcIsoDateValidation(req.body.date, "date", true));
    errors = errors.concat(mengyangValidation.getNewsContentValidation(req.body.content, true));
    return errors;
}

obj.updateNewsRecord = function(req, res, next) {
    let validation = validatePutParams(req);
    if (validation.length === 0) {
        let pastureNews = reqFile("./sequelizeModels")("pastureNews", null);
        let queryObj = {};
        queryObj.where = {
            newsID: req.body.newsID
        };
        pastureNews.find(queryObj).then((record) => {
            if (record) {
                let objToUpdate = {
                    pastureID: (req.body.pastureID !== undefined) ? req.body.pastureID : undefined,
                    date:      (req.body.date !== undefined) ? req.body.date : undefined,
                    content:   (req.body.content !== undefined) ? req.body.content : undefined
                };

                for (let field in objToUpdate) {
                    if (objToUpdate[field] === undefined) {
                        delete objToUpdate[field];
                    }
                }

                record.updateAttributes(objToUpdate).then((resp) => {
                    res.send(resp);
                    next();
                }).catch((err) => {
                    logger.error(err);
                    errorResp.send(res, consts.error.serverErrorLabel, "" + err, 500);
                    next();
                });


            } else {
                let errMsg = [];
                errMsg.push("No record with newsID " + req.body.newsID + " found in the database.");
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
    // Validate the newsID field in PUT request body
    if (req.body.newsID !== undefined && typeof req.body.newsID !== "number") {
        errors = errors.concat(["The 'newsID' parameter must be an integer larger than or equal to 1 (you gave " + typeof req.body.newsID + " " + req.body.newsID + ")."]);
    } else {
        errors = errors.concat(mengyangValidation.getNewsIdValidation(req.body.newsID, "newsID", true));
    }
    // Validate the pastureID field in the PUT request body
    if (req.body.pastureID !== undefined && typeof req.body.pastureID !== "number") {
        errors = errors.concat(["The 'pastureID' parameter must be an integer, (you gave " + typeof req.body.pastureID + " " + req.body.pastureID + ")."]);
    } else {
        errors = errors.concat(mengyangValidation.getPastureIdValidation(req.body.pastureID, "pastureID", false));
    }
    errors = errors.concat(generalValidation.getRequiredUtcIsoDateValidation(req.body.date, "date",false));
    errors = errors.concat(mengyangValidation.getNewsContentValidation(req.body.content, false));

    return errors;
}

// - DELETE "/api/mengyang/news"
obj.deleteNewsRecords = function(req, res, next) {
    let validation = validateDeleteParams(req);
    if (validation.length === 0) {
        let pastureNews = reqFile("./sequelizeModels")("pastureNews", null);
        let newsIds = req.query.newsID.split(",");
        let queryObj = {};
        queryObj.where = {
            newsID: {
                [ seqOp.or ]: newsIds
            }
        };
        pastureNews.findAll(queryObj).then((records) => {
            let idsToDelete = [];
            records.forEach((record) => {
                idsToDelete.push(record.newsID);
            });
            pastureNews.destroy(queryObj).then((resp) => {
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
    let newsIds = req.query.newsID;
    if (newsIds === undefined) {
        errors = errors.concat(mengyangValidation.getMultipleNewsIdsValidation(newsIds, true));
    } else {
        errors = errors.concat(mengyangValidation.getMultipleNewsIdsValidation(newsIds, true));
    }
    
    return errors;
}

module.exports = obj;