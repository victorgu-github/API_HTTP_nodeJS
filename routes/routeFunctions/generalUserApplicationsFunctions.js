let mongoose = require("mongoose");
mongoose.Promise = global.Promise;

let logger = require("../../common/tracer.js");
let errorResp = require("../../common/errorResponse.js");
let generalUserAppValidation = require("../../common/generalUserAppValidation.js");
let consts = require("../../config/constants.js");
let dataFormat = require("../../common/dataFormat.js");

const GENERAL_USER_APPLICATION_NAME = "generalUserApplicationName";
const LORA = "lora";
const SCENARIOID = "scenarioID";

const NO_LORA = "no lora";

let obj = {};

/////////////////////////////////////////////////////
//
// Get User Application Func
//
/////////////////////////////////////////////////////

// - GET "/generaluserapplication"
obj.getUserApplication = function(req, res, next) {
    let query = req.query;
    let generalUserApplication = require("../../models/users/generalUserApplication.js")();
    let validationResult = generalUserAppValidation.validateGetAndDelReqQuery(query);
    if (validationResult.status === "success") {
        getUserApplicationInfo(query.generalUserApplicationID).then((resp) => {
            resp = JSON.parse(JSON.stringify(resp));
            resp = dataFormat.enforceTopLevelOfSchema(generalUserApplication, resp);
            res.send(resp);
            next();
        }).catch((err) => {
            let msg = err + "";
            logger.error(err);
            errorResp.send(res, "Mongo Error", msg, 500);
            next();
        });
    } else {
        logger.error("Validation errors:", validationResult.errorMessage);
        errorResp.send(res, "Bad Request", validationResult.errorMessage, 400);
        next();
    }
};

// - GET "/generaluserapplication/createdBy"
obj.getUserApplicationByCreatedBy = function(req, res, next) {
    let generalUserApplication = require("../../models/users/generalUserApplication.js")();
    let validationErrors = getInputValidationForGetCreatedBy(req.query);
    if (validationErrors.length === 0) {
        let query = {};
        if (req.query.username !== undefined) {
            query.createdBy = req.query.username;
            query.creatorAccessRole = req.query.accessRole;
        } else {
            query.createdBy = res.locals.username;
            query.creatorAccessRole = res.locals.accessRole;
        }
        
        generalUserApplication.find(query).sort({generalUserApplicationID: -1}).then((resp) => {
            resp = JSON.parse(JSON.stringify(resp));
            resp = dataFormat.enforceTopLevelOfSchema(generalUserApplication, resp);
            res.send(resp);
            next();
        }).catch((err) => {
            logger.error(err);
            let errMsg = err + "";
            errorResp.send(res, consts.error.serverErrorLabel, errMsg, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validationErrors, 400);
        next();
    }
};

function getInputValidationForGetCreatedBy(query) {
    let errors = [];

    if ((query.username === undefined && query.accessRole !== undefined) ||
        (query.username !== undefined && query.accessRole === undefined))
        errors.push("Must specify 'accessRole' parameter when defining 'username', and vice-versa");
    let acceptedParams = [ "username", "accessRole" ];
    let unknownFields = Object.keys(query).filter((field) => { return acceptedParams.includes(field) === false; });
    if (unknownFields.length > 0)
        errors.push("Unknown query parameter(s): " + (unknownFields + "").replace(/,/g, ", ") +
                    ". Accepted query parameters are: " + (acceptedParams + "").replace(/,/g, ", "));

    return errors;
}

// - GET "/generaluserapplication/lora"
obj.getUserAppByLoraAppID = function(req, res, next) {
    let query = req.query;
    let generalUserApplication = require("../../models/users/generalUserApplication.js")();
    let validationResult = generalUserAppValidation.validGetReqQueryByLoraAppID(query);
    if (validationResult.status === "success") {
        getUserAppInfoByLoraAppID(query.loraAppID).then((resp) => {
            resp = JSON.parse(JSON.stringify(resp));
            resp = dataFormat.enforceTopLevelOfSchema(generalUserApplication, resp);
            res.send(resp);
            next();
        }).catch((err) => {
            let msg = err + "";
            logger.error(err);
            errorResp.send(res, "Mongo Error", msg, 500);
            next();
        });
    } else {
        logger.error("Validation errors:", validationResult.errorMessage);
        errorResp.send(res, "Bad Request", validationResult.errorMessage, 400);
        next();
    }
};

// - GET "/generaluserapplication/exist_device"
//Get general user application for exist lora device
//1.Validate if the generalUserApplicationID is valid integer
//2.If general user application has "lora" field, we use loraApplicationID and devEUIs to find devices.
//  Otherwise, we return lora = null
obj.getUserAppForExistDev = function(req, res, next) {
    let query = req.query;
    let validationResult = generalUserAppValidation.validateGetAndDelReqQuery(query);
    if (validationResult.status === "success") {
        getUserApplicationInfo(query.generalUserApplicationID).then((responses) => {
            responses = JSON.parse(JSON.stringify(responses));
            parseGeneralUserApplications(responses).then((resps) => {
                resps = parseGetResp(resps);
                res.send(resps);
                next();
            });
        }).catch((err) => {
            let msg = err + "";
            logger.error(err);
            errorResp.send(res, "Mongo Error", msg, 500);
            next();
        });
    } else {
        logger.error("Validation errors:", validationResult.errorMessage);
        errorResp.send(res, "Bad Request", validationResult.errorMessage, 400);
        next();
    }
};

/////////////////////////////////////////////////////
//
// Post User Application Func
//
/////////////////////////////////////////////////////

// - POST "/generaluserapplication"
obj.saveUserApplication = function(req, res, next) {
    let reqBody = req.body;
    let generalUserApplication = require("../../models/users/generalUserApplication.js")();
    let validationResult = generalUserAppValidation.validatePostReqBody(reqBody);
    //1. If req.body valid, then continue
    //2. If req.body invalid, then send error message to frontend
    if (validationResult.status === "success") {
        //1. If we can find the max user application id, then continue
        //2. If we face mongo error during find the mas user application id, then send system error message to frontend
        getMaximumUserAppID().then((resp) => {
            resp = JSON.parse(JSON.stringify(resp));
            //1. resp.length === 0 means it may be there is no data in the database or the
            //   test env and nodejs database have different data records
            //2. because we use find({}).sort({generalUserApplicationID: -1}).limit(1), the
            //   resp only includes one element, and resp[0] can be used.
            let maxUserAppID = (resp.length === 0) ? 0 : resp[0].generalUserApplicationID;
            let currUserAppID = maxUserAppID + 1;
            let saveBody = getSaveBody(res, currUserAppID, reqBody);
            
            saveUserApplicationInfo(saveBody).then((saveResponse, error) => {
                saveResponse = JSON.parse(JSON.stringify(saveResponse));
                if (error === undefined || error === null) {
                    let registResult = dataFormat.enforceTopLevelOfSchema(generalUserApplication, saveResponse);
                    res.send(registResult);
                    next();
                } else {
                    errorResp.send(res, consts.error.serverErrorLabel, error, 500);
                    next();
                }
            }).catch((err) => {
                let msg = err + "";
                logger.error(err);
                errorResp.send(res, "Mongo Error", msg, 500);
                next();
            });
        }).catch((err) => {
            let msg = err + "";
            logger.error(err);
            errorResp.send(res, "Mongo Error", msg, 500);
            next();
        });
    } else {
        logger.error("Validation errors:", validationResult.errorMessage);
        errorResp.send(res, "Bad Request", validationResult.errorMessage, 400);
        next();
    }
};

/////////////////////////////////////////////////////
//
// Put User Application Func
//
/////////////////////////////////////////////////////

obj.updateUserApplication = function(req, res, next) {
    let reqBody = req.body;
    let generalUserApplication = require("../../models/users/generalUserApplication.js")();
    let validationResult = generalUserAppValidation.validatePutReqBody(reqBody);
    if (validationResult.status === "success") {
        let updateBody = getUpdateBody(reqBody);
        updateUserApplicationInfo(updateBody).then((updateResponse) => {
            updateResponse = JSON.parse(JSON.stringify(updateResponse));
            //In the async function, we use findOneAndUpdate function. 
            //When we use mongoose findOneAndUpdate function, we should notice:
            //1.If we cannot find the user application in the system, findOneAndUpdate function will return null to us
            //2.If we can find the user application in the system, findOneAndUpdate function will return the updated result
            if (updateResponse) {
                let updateResult = dataFormat.enforceTopLevelOfSchema(generalUserApplication, updateResponse);
                res.send(updateResult);
                next();
            } else {
                errorResp.send(res, "Bad Request", "Cannot find this device", 400);
                next();
            }
        }).catch((err) => {
            let msg = err + "";
            logger.error(err);
            errorResp.send(res, "Mongo Error", msg, 500);
            next();
        });
    } else {
        logger.error("Validation errors:", validationResult.errorMessage);
        errorResp.send(res, "Bad Request", validationResult.errorMessage, 400);
        next();
    }
};

/////////////////////////////////////////////////////
//
// Delete User Application Func
//
/////////////////////////////////////////////////////

// - DELETE "/generaluserapplication"
//Delete user application in the system
//1. Validate req body attribute
//2. Find if all the input user application exist in the system, if there is any user application
//   doesn't exist in the syste, throw an error message
//3. If all the input user application exist in the syste, then delete all of them
//4. summarize the delete result info and send back to frontend user
obj.deleteUserApplication = function(req, res, next) {
    let query = req.query;
    let validationResult = generalUserAppValidation.validateGetAndDelReqQuery(query);
    if (validationResult.status === "success") {
        getUserApplicationInfo(query.generalUserApplicationID).then((findResp) => {
            findResp = JSON.parse(JSON.stringify(findResp));
            let countForFindResult = findResp.length;
            let countForInputApp = query.generalUserApplicationID.split(",").length;
            if (countForFindResult === countForInputApp) {
                delUserApplicationInfo(query.generalUserApplicationID).then((delResp) => {
                    let delResult = {};
                    delResult.number = delResp.length;
                    delResult.generalUserApplicationIDs = delResp;
                    res.send(delResult);
                    next();
                }).catch((err) => {
                    let msg = err + "";
                    logger.error(err);
                    errorResp.send(res, "Mongo Error", msg, 500);
                    next();
                });
            } else {
                let notExistApp = findNotExistApp(findResp, query.generalUserApplicationID);
                let errorMessage = "We cannot find these device in the system: " + notExistApp;
                logger.error("Cannot find user application:", errorMessage);
                errorResp.send(res, "Bad Request", errorMessage, 400);
                next();
            }
        }).catch((err) => {
            let msg = err + "";
            logger.error(err);
            errorResp.send(res, "Mongo Error", msg, 500);
            next();
        });
    } else {
        logger.error("Validation errors:", validationResult.errorMessage);
        errorResp.send(res, "Bad Request", validationResult.errorMessage, 400);
        next();
    }
};

/////////////////////////////////////////////////////
//
// Async Func
//
/////////////////////////////////////////////////////

//Async function to get user application information
function getUserApplicationInfo(queryStr) {
    let array = [];
    let queryArr = queryStr.split(",");
    let generalUserApplication = require("../../models/users/generalUserApplication.js")();
    //Right now, the element in query is integer string, we need change it to integer number
    for (let i in queryArr) {
        array.push(parseInt(queryArr[i]));
    }
    return new Promise((resolve) => {
        if (generalUserApplication) {
            let query = {};
            query["$or"] = [];
            for (let i in array) {
                let elem = array[i];
                let queryObj = {};
                queryObj.generalUserApplicationID = elem;
                query["$or"].push(queryObj);
            }
            resolve(generalUserApplication.find(query));
        } else {
            resolve([]);
        }
    });
}

//Async function to get user application information by lora application id
function getUserAppInfoByLoraAppID(queryStr) {
    let array = [];
    let queryArr = queryStr.split(",");
    let generalUserApplication = require("../../models/users/generalUserApplication.js")();
    //Right now, the element in query is integer string, we need change it to integer number
    for (let i in queryArr) {
        array.push(queryArr[i]);
    }
    return new Promise((resolve) => {
        if (generalUserApplication) {
            let query = {};
            query["$or"] = [];
            for (let i in array) {
                let elem = array[i];
                let queryObj = {};
                queryObj["lora.loraApplicationID"] = elem;
                query["$or"].push(queryObj);
            }
            resolve(generalUserApplication.find(query).sort({ "lora.loraApplicationID": 1 }));
        } else {
            resolve([]);
        }
    });
}

//Async function to get the maximum user app id
function getMaximumUserAppID() {
    let generalUserApplication = require("../../models/users/generalUserApplication.js")();
    return new Promise((resolve) => {
        generalUserApplication.find({}).sort({ generalUserApplicationID: -1 }).limit(1).then((resp) => {
            resolve(resp);
        });
    });
}

//Async function to save the user application
function saveUserApplicationInfo(saveBody) {
    let generalUserApplication = require("../../models/users/generalUserApplication.js")();
    let promise = new generalUserApplication(saveBody).save();
    return promise;
}

//Async function to update the user application
function updateUserApplicationInfo(updateBody) {
    let generalUserApplication = require("../../models/users/generalUserApplication.js")();
    //Update update object
    //1.update['$set'] means update the related fields
    //2.update['$unset'] means delete the related fields
    let update = {};
    update["$set"] = {};
    update["$unset"] = {};
    //updateBody.modifiedTime will always be exist
    //1.updateBody.modifiedTime is generated by system
    update["$set"].modifiedTime = updateBody.modifiedTime;
    //If updateBody.generalUserApplicationName exist, we update its value
    if (updateBody.generalUserApplicationName !== undefined) {
        update["$set"].generalUserApplicationName = updateBody.generalUserApplicationName;
    }
    //If updateBody.lora exist:
    //1.If updateBody.lora is null, we delete this field
    //2.If updateBody.lora is not null, we update this field
    if (updateBody.lora !== undefined) {
        if (updateBody.lora === null) {
            update["$unset"].lora = "";
        } else {
            update["$set"].lora = updateBody.lora;
        }
    }
    //If udpateBody.scenarioID exist:
    //1.If updateBody.scenarioID is null, we delete this field
    //2.If updateBody.scenarioID is not null, we update this field
    if (updateBody.scenarioID !== undefined) {
        if (updateBody.scenarioID === null) {
            update["$unset"].scenarioID = "";
        } else {
            update["$set"].scenarioID = updateBody.scenarioID;
        }
    }
    //If update['unset'] is empty object, delete update['update']
    if (isEmpty(update["$unset"])) {
        delete update["$unset"];
    }
    return new Promise((resolve, reject) => {
        generalUserApplication.findOneAndUpdate({ generalUserApplicationID: updateBody.generalUserApplicationID },
            update, { new: true }, (err, resp) => {
                if (!err) {
                    resolve(resp);
                } else {
                    reject(err);
                }
            });
    });
}

function isEmpty(obj) {
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop))
            return false;
    }

    return JSON.stringify(obj) === JSON.stringify({});
}

//Async function to delete the user application
//There are two methods to delete records in database: 
//1. .remove({generalUserApplicationID: {$in:[1,2,3]}}), but these method only return the count of deleted records
//2. .findOneAndRemove({generalUserApplicationID:1}) + Promise.all(), findOneAndRemove will return the exact record 
//   content instead of the count of records
//Thus, we choose findOneAndRemove + Promise.all() here. After deleting, we can show the deleted records info to 
//frontend user
function delUserApplicationInfo(queryStr) {
    let promises = [];
    let queryArr = queryStr.split(",");
    let generalUserApplication = require("../../models/users/generalUserApplication.js")();
    for (let i in queryArr) {
        let promise = generalUserApplication.findOneAndRemove({ generalUserApplicationID: parseInt(queryArr[i]) });
        promises.push(promise);
    }
    return Promise.all(promises).then((resp) => {
        let userApplicationIDs = [];
        resp = JSON.parse(JSON.stringify(resp));
        for (let index in resp) {
            let elem = resp[index];
            userApplicationIDs.push(elem.generalUserApplicationID);
        }
        return userApplicationIDs;
    });
}

//1.Query all the devices for a general user application at a time, with "$or".
//2.Return specific fields for each lora device, {DevEUI: "AAAAAAAAAAAAAAAB", DevType:"bodysensor"}.
//  Notice: "_id" field is special, mongodb response will always display it by default. So, we need set _id: 0
function parseGeneralUserApplications(generalUserApplications) {
    let promises = [];
    for (let index in generalUserApplications) {
        let promise;
        let generalUserApplication = generalUserApplications[index];
        if (generalUserApplication.lora) {
            let appNodeSessions = require("../../models/nodeSessionAppServ.js")(generalUserApplication.lora.loraApplicationID);
            let query = { $or: [] };
            let specificFields = { DevEUI: 1, DevType: 1, _id: 0 };
            for (let i in generalUserApplication.lora.devEUIs) {
                let devEUI = generalUserApplication.lora.devEUIs[i];
                query["$or"].push({ DevEUI: devEUI });
            }
            promise = appNodeSessions.find(query, specificFields);
        } else {
            promise = NO_LORA;
        }
        promises.push(promise);
    }
    return Promise.all(promises).then((resps) => {
        resps = JSON.parse(JSON.stringify(resps));
        for (let index in resps) {
            let devices = resps[index];
            let generalUserApplication = generalUserApplications[index];
            if (devices !== NO_LORA) {
                delete generalUserApplication.lora.devEUIs;
                generalUserApplication.lora.devices = devices;
            }
        }
        return generalUserApplications;
    });
}

/////////////////////////////////////////////////////
//
// Private Func
//
/////////////////////////////////////////////////////

//Get final valid save body
//1.generalUserApplicationID, createdTime, modifiedTime is generated by system
//2.If a field is undefined in reqBody, we sould not include this field in saveBody
//3.But there is an exception, even if there is no 'lora' field in saveBody, mongoose
//  will save {devEUIs: []} for it
function getSaveBody(res, currUserAppID, reqBody) {
    let saveBody = {};
    saveBody.generalUserApplicationID = currUserAppID;
    saveBody.createdTime = new Date();
    saveBody.createdBy = res.locals.username;
    saveBody.creatorAccessRole = res.locals.accessRole;
    saveBody.modifiedTime = new Date();
    if (reqBody.generalUserApplicationName !== undefined) {
        saveBody.generalUserApplicationName = reqBody.generalUserApplicationName;
    }
    if (reqBody.lora !== undefined) {
        //Change reqBody.lora's loraApplicationID and devEUIs to upper case
        reqBody.lora.loraApplicationID = reqBody.lora.loraApplicationID.toUpperCase();
        for (let index in reqBody.lora.devEUIs) {
            reqBody.lora.devEUIs[index] = reqBody.lora.devEUIs[index].toUpperCase();
        }
        saveBody.lora = reqBody.lora;
    }
    if (reqBody.scenarioID !== undefined) {
        saveBody.scenarioID = reqBody.scenarioID;
    }
    return saveBody;
}

//Get final valid update body
//1.generalUserApplicationID cannot be modified, it is only used to find the record
//2.modifiedTime is generated by system, set to current time
//3.If a field is undefined in reqBody, we sould not include this field in updateBody
//  otherwise, it will be transfered to null and store in the database
//4.But there is an exception, even if there is no 'lora' field in updateBody, mongoose
//  will save {devEUIs: []} for it
//5.lora and scenarioID can be null, means we want to delete this field in the database
function getUpdateBody(reqBody) {
    let updateBody = {};
    updateBody.generalUserApplicationID = reqBody.generalUserApplicationID;
    updateBody.modifiedTime = new Date();
    //reqBody.generalUserApplicationName cannot be null, it exclude during validation
    if (reqBody.generalUserApplicationName !== undefined) {
        updateBody.generalUserApplicationName = reqBody.generalUserApplicationName;
    }
    //reqBody.lora can be null, it means we want to delete field lora in the database
    if (reqBody.lora !== undefined) {
        if (reqBody.lora !== null) {
            //Change reqBody.lora's loraApplicationID and devEUIs to upper case
            reqBody.lora.loraApplicationID = reqBody.lora.loraApplicationID.toUpperCase();
            for (let index in reqBody.lora.devEUIs) {
                reqBody.lora.devEUIs[index] = reqBody.lora.devEUIs[index].toUpperCase();
            }
        }
        updateBody.lora = reqBody.lora;
    }
    //reqBody.scenarioID can be null, it means we want to delete field scenarioID in the database
    if (reqBody.scenarioID !== undefined) {
        updateBody.scenarioID = reqBody.scenarioID;
    }
    return updateBody;
}

//Compare and find the user application doesn't exist in the req body
function findNotExistApp(findResp, userAppIDs) {
    let notExistApp = userAppIDs.split(",");
    for (let index in findResp) {
        let elem = findResp[index];
        let appID = elem.generalUserApplicationID.toString();
        if (notExistApp.includes(appID)) {
            notExistApp = notExistApp.filter((item) => item !== appID);
        }
    }
    return notExistApp;
}

//Parse get body
function parseGetResp(resp) {
    let result = [];
    for (let index in resp) {
        let elem = resp[index];
        elem = delExtraFieldsOfResult(elem);
        elem = setUndefinedAttrToNull(elem);
        result.push(elem);
    }
    return result;
}

//For get web api, when return the get result to frontend user. We need to change 
//the undefined field to null
function setUndefinedAttrToNull(object) {
    if (object[GENERAL_USER_APPLICATION_NAME] === undefined) {
        object[GENERAL_USER_APPLICATION_NAME] = null;
    }
    if (object[LORA] === undefined) {
        object[LORA] = null;
    }
    if (object[SCENARIOID] === undefined) {
        object[SCENARIOID] = null;
    }
    return object;
}

//Delete extra field of an object
function delExtraFieldsOfResult(registResult) {
    let result = registResult;
    delete result._id;
    delete result.__v;
    return result;
}

module.exports = obj;
