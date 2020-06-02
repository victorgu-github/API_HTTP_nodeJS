let Sequelize = require("sequelize");
let seqOp = Sequelize.Op;
let consts = reqFile("./config/constants.js");
let errorResp = reqFile("./common/errorResponse");
let mengyangValidation = reqFile("./common/mengyangDataValidation.js");


let obj = {};

//GET /api/mengyang/pastureID/:pastureID/sheepclinic
obj.getSheepClinicInfo = function(req, res, next) {
    let validation = validateGetParams(req);
    if (validation.length === 0) {
        let sheepClinicInfo = reqFile("./sequelizeModels")("sheepClinicInfo", req.params.pastureID);
        let queryObj = {
            where: {}
        };
        if (req.query.mengyangID) {
            let mengyangIds = req.query.mengyangID.split(",");
            queryObj.where.mengyangID = {
                [ seqOp.or]: mengyangIds
            };
        }
        if (req.query.mengyangID2) {
            let mengyangId2s = req.query.mengyangID2.split(",");
            queryObj.where.mengyangID2 = {
                [ seqOp.or]: mengyangId2s
            };
        }
        
        sheepClinicInfo.findAll(queryObj).then((resp) => {
            res.send(resp);
            next();
        }).catch((err) => {
            logger.error(err);
            errorResp.send(res, consts.error.serverErrorLabel, "" + err, 500);
            next();
        });
    } else {
        errorResp.send(res,consts.error.badRequestLabel,validation, 400);
        next();
    }
};

function validateGetParams(req) {
    let errors = [];
    errors = errors.concat(mengyangValidation.getPastureIdValidation(req.params.pastureID, "pastureID", true));
    errors = errors.concat(mengyangValidation.getMengyangIdValidation(req.query.mengyangID, "mengyangID", false));
    errors = errors.concat(mengyangValidation.getMengyangIdValidation(req.query.mengyangID2, "mengyangID2", false));

    return errors;
}

module.exports = obj;