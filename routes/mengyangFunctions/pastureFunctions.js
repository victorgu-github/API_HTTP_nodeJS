let Sequelize = require("sequelize");
let seqOp = Sequelize.Op;
let config = reqFile("./config/config.js");
let consts = reqFile("./config/constants.js");
let errorResp = reqFile("./common/errorResponse");
let mengyangValidation = reqFile("./common/mengyangDataValidation.js");
let sequelizeUtils = reqFile("./common/sequelizeUtilities.js");

let obj = {};

// - GET "/api/mengyang/pasture/general?pastureID=..."
obj.getGeneralPasture = function(req, res, next) {
    let validation = getValidationForGET(req);
    if (validation.length === 0) {
        // Because the user enters multiple pastureIDs, and each of these pastureIDs maps
        // to a numbered database "mengyang_pasture_XXXX", where XXXX is the pastureID, we
        // need to first check if each of these databases exists otherwise we'll get an
        // error when we try to query it. To check if N distinct of these databases exist
        // we need to make N calls to the 'checkIfSqlDbExists' function below.
        let checkExistProms = [];
        let pastureIDs = req.query.pastureID.split(",").sort();
        pastureIDs.forEach((pastureID) => {
            checkExistProms.push(sequelizeUtils.checkIfNumberedSqlDbExists(config.mySqlDbNames.sheepInfo, pastureID));
        });
        // Once all database exists checks have come back:
        Promise.all(checkExistProms).then((checkDbExistsResps) => {
            // Now that we know which databases exist and which don't, we need to make the
            // following queries:
            //   1) Query the 'mengyang_system'.'pasture_general' table
            //   2) For each pastureID that was found, query the associated
            //      'mengyang_pasture_XXXX'.'sheep_info' table
            //
            // I.e.: If the user / frontend gave N different pastureIDs, then we will be
            // making at most N + 1 queries if all 'mengyang_pasture_XXXX' databases existed
            // and at least 1 query if none of these databases existed.

            // 1) Query the pasture_general table:
            let queryObj = {
                where: {
                    pastureID: { [seqOp.or]: pastureIDs }
                },
                order: [ [ "pastureID", "ASC" ] ]
            };
            let allQueryProms = [];
            let pastureGeneral = reqFile("./sequelizeModels")("pastureGeneral", null);
            allQueryProms.push(pastureGeneral.findAll(queryObj));

            // 2) For any 'mengyang_pasture_XXXX' databases that were found, group by and
            // count the 'variety' column inside the 'sheep_info' tables:
            checkDbExistsResps.forEach((dbCheck) => {
                if (dbCheck.exists) {
                    let sheepInfo = reqFile("./sequelizeModels")("sheepInfo", dbCheck.index);
                    allQueryProms.push(sheepInfo.findAll({
                        group:      [ "variety" ],
                        attributes: [ "variety", [ Sequelize.fn("COUNT", Sequelize.col("variety")), "numInVariety" ]]
                    }).then((aggResp) => {
                        // Transform the response to the desired format:
                        let outObj = {
                            pastureID:  dbCheck.index,
                            results:    []
                        };
                        aggResp.forEach((varietyPair) => {
                            // Annoyingly, the aggregated field is a hidden property of the
                            // object, so we need to convert it to regular JSON first.
                            let pair = JSON.parse(JSON.stringify(varietyPair.dataValues));
                            outObj.results.push({
                                [pair.variety]: pair.numInVariety
                            });
                        });
                        return outObj;
                    }));
                } else { // Otherwise there's no sheep_info to aggregate, so return empty obj
                    allQueryProms.push(Promise.resolve({}));
                }
            });

            // Now we're finished all of our queries, so simply assemble the final response:
            Promise.all(allQueryProms).then((allResps) => {
                let allRespsJSON = JSON.parse(JSON.stringify(allResps));

                // We'll need to match the pastureIDs found in the 'pasture_general' table
                // with the aggregation responses found in the 'sheep_info' tables, so
                // create two arrays with the data we want:
                //   - One with our 'pasture_general' found records
                //   - The other with all of our aggregation results
                let genPastureResp = allRespsJSON.slice(0, 1)[0];
                let sheepAggResps = allRespsJSON.slice(1, allRespsJSON.length);

                // Lastly, assemble our final output array, containing our 'pasture_general'
                // records and - if it exists - the aggregated sheep information.
                let finalResp = [];
                genPastureResp.forEach((genPasture) => {
                    // Look for aggregated data with a matching pastureID:
                    let sheepAgg = sheepAggResps.filter(each => each.pastureID == genPasture.pastureID)[0];
                    // If we didn't find any, we'll simply show an empty array:
                    let numByType = [];
                    if (sheepAgg !== undefined)
                        numByType = sheepAgg.results;
                    genPasture.numByType = numByType;
                    finalResp.push(genPasture);
                });
                res.send(finalResp);
                next();
            }).catch((err) => {
                logger.error(err);
                errorResp.send(res, consts.error.serverErrorLabel, "" + err, 500);
                next();
            });
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validation, 400);
        next();
    }
};

function getValidationForGET(req) {
    let errors = [];

    errors = errors.concat(mengyangValidation.getMultiplePastureIdValidation(req.query.pastureID, "pastureID", true, true));

    return errors;
}

module.exports = obj;
