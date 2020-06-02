let Sequelize = require("sequelize");
let seqOp = Sequelize.Op;
let consts = reqFile("./config/constants.js");
let errorResp = reqFile("./common/errorResponse");
let mengyangValidation = reqFile("./common/mengyangDataValidation.js");
let dataValidation = reqFile("./common/dataValidation.js");

let obj = {};

//- GET "/api/mengyang/pasture/:pastureID/sheephybrid"
obj.getSheepHybridInfo = function(req, res, next) {
    let validation = validateGetParams(req);
    if (validation.length === 0) {
        let sheepHybridInfo = reqFile("./sequelizeModels")("sheepHybridInfo", req.params.pastureID);
        // We format the queryObj based on which ID(s) are provided by the user
        let queryObj = {};
        queryObj.where = {};
        queryObj.order = [["hybridizationID", "DESC"]];
        if (req.query.maleSheepID) {
            let maleIds = req.query.maleSheepID.split(",");
            queryObj.where.maleSheepID = {[ seqOp.or ]: maleIds };
        }
        if (req.query.femaleSheepID) {
            let femaleIds = req.query.femaleSheepID.split(",");
            queryObj.where.femaleSheepID = {[ seqOp.or ]: femaleIds};
        }
        if (req.query.femaleSheepID2) {
            let femaleId2s = req.query.femaleSheepID2.split(",");
            queryObj.where.femaleSheepID2 = {[ seqOp.or ]:femaleId2s};
        }
        sheepHybridInfo.findAll(queryObj).then((resp) => {
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

    errors = errors.concat(mengyangValidation.getPastureIdValidation(req.params.pastureID, "pastureID", true));
    if (req.query.maleSheepID !== undefined) {
        let maleSheepIDs = req.query.maleSheepID.split(",");
        maleSheepIDs.forEach((id) => {
            errors = errors.concat(dataValidation.getNonEmptyStringValidation(id, "maleSheepID", false));
        });
    }

    if (req.query.femaleSheepID !== undefined) {
        let femaleSheepIDs = req.query.femaleSheepID.split(",");
        femaleSheepIDs.forEach((id) => {
            errors = errors.concat(dataValidation.getNonEmptyStringValidation(id, "femaleSheepID", false));
        });
    }
    
    if (req.query.femaleSheepID2 !== undefined) {
        let femaleSheepID2s = req.query.femaleSheepID2.split(",");
        femaleSheepID2s.forEach((id) => {
            errors = errors.concat(dataValidation.getNonEmptyStringValidation(id, "femaleSheepID2", false));
        });
    }
    
    return errors;
}
module.exports = obj;