let consts = require("../../config/constants.js");
let errorResp = require("../../common/errorResponse.js");
let dataFormat = require("../../common/dataFormat.js");

let obj = {};

// - GET "/companyInfo"
obj.getCompanyInfo = function(req, res, next) {
    let CompanyInfo = require("../../models/users/companyInfo.js")();
    CompanyInfo.find().then((resp) => {
        let respFormatted = [];
        resp.forEach((companyInfo) => {
            respFormatted.push(dataFormat.filterDocumentBySchema(CompanyInfo, companyInfo));
        });
        res.send(respFormatted);
        next();
    }).catch((err) => {
        logger.error(err);
        let msg = err + "";
        errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
        next();
    });
};

module.exports = obj;
