let mongoose = require("mongoose");
mongoose.Promise = global.Promise;
let request = require("then-request");
let FormData = request.FormData;

let consts = require("../../config/constants.js");
let config = require("../../config/config.js");
let logger = require("../../common/tracer.js");
let errorResp = require("../../common/errorResponse.js");
let jwt = require("jsonwebtoken");
let bcrypt = require("bcryptjs");
let generalUserRegValidation = require("../../common/generalUserRegValidation.js");
let dataValidation = require("../../common/dataValidation.js");
let dataFormat = require("../../common/dataFormat.js");

const saltRounds = 10;
const EMAIL = "email";
const WECHAT_OPENID = "wechatOpenID";
const GENERAL_APPIDS = "generalAppIDs";
const MINIMUM_COMPANY_ID = 0;

let obj = {};

/////////////////////////////////////////////////////
//
// Get User Account Func
//
/////////////////////////////////////////////////////

// - GET "/generaluser"
obj.getUserAccounts = function(req, res, next) {
    let inputErrors = getInputErrorsForGetRequest(req.query);
    if (inputErrors.length === 0) {
        getAllUserAccounts(req.query).then((findResp) => {
            let cleanedResp = [];
            let model = require("../../models/users/generalUserAccount.js")();
            findResp.forEach((user) => { cleanedResp.push(dataFormat.enforceSchemaOnDocument(model, user, false)); });
            cleanedResp = parseUserAccount(cleanedResp);
            res.send(cleanedResp);
            next();
        }).catch((promReject) => {
            logger.error(promReject);
            let msg = (promReject.message !== undefined) ? promReject.message : promReject + "";
            errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
            next();
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, inputErrors, 400);
        next();
    }
};

function getInputErrorsForGetRequest(query) {
    let errors = [];

    // When adding new parameters to validate, always follow the waterfall structure:
    //   - Is the parameter undefined? (throw error if applicable)
    //   - Is the data format the correct type, and does it satisfy our business logic?
    if (query.companyID !== undefined) {
        let isValid = true;
        if (typeof query.companyID === "string") {
            if (query.companyID.includes(",")) {
                let companyIDs = query.companyID.split(",");
                companyIDs.forEach((companyID) => {
                    if (dataValidation.isInteger(companyID) === false || companyID < MINIMUM_COMPANY_ID) {
                        isValid = false;
                    }
                });
            } else {
                if (dataValidation.isInteger(query.companyID) === false || query.companyID < MINIMUM_COMPANY_ID) {
                    isValid = false;
                }
            }
        } else {
            isValid = false;
        }
        if (isValid === false) {
            errors.push("'companyID' parameter must contain an integer string greater than or equal to " + MINIMUM_COMPANY_ID +
                        ", or comma-separated list thereof (you gave " + (typeof query.companyID) + " " + query.companyID + ")");
        }
    }

    // No validation for 'userName' field b/c it need only be of type string, and all
    // query parameters are of type string.

    return errors;
}

//1.Set wechatOpenIDExist field according to wechatOpenID field
//2.Remove _id, __v, password and wechatOpenID fields
function parseUserAccount(find_Resp) {
    let responses = find_Resp;
    for (let i in responses) {
        let response = responses[i];
        //wechatOpenID, email, generalAppIDs could be undefined in the database, we need set then to null and
        //send back to front-end
        response = setUndefinedAttrToNull(response);
        //If response.wechatOpenID === undefined, null, "", then response.wechatOpenIDExist will be set to false
        //In register and update validation process, we have make sure wechatOpenID will always be string
        response.wechatOpenIDExist = !response.wechatOpenID ? false : true;
        delete response["_id"];
        delete response["__v"];
        delete response["password"];
        delete response["wechatOpenID"];
    }
    return responses;
}

/////////////////////////////////////////////////////
//
// Post User Account Func
//
/////////////////////////////////////////////////////

// - POST "/generaluserregistry"
//1. Validate requried fields and settable fields
//2. Check if wechatOpenID is unique in the system
//3. Check if userName is unique in the system
//4. Encrypt password 
//5. Store the record into database
obj.saveUserAccount = function(req, res) {
    let reqBody = req.body;
    let validationResult = generalUserRegValidation.validatePostReqBody(reqBody);
    let inputErrors = getInputErrorsForPostRequest(req.body);
    //1. If req.body valid, then continue
    //2. If req.body invalid, then send error message to frontend
    if (validationResult.status === "success" && inputErrors.length === 0) {
        //1. If wechatOpenID exist, make sure this wechatOpenID is unique in the system. Otherwise, send error message
        if (reqBody.wechatOpenID) {
            findUserAccountByWechatOpenID(reqBody.wechatOpenID).then((wechatResp) => {
                wechatResp = JSON.parse(JSON.stringify(wechatResp));
                if (!wechatResp) {
                    findUserAccAndSave(req, res, reqBody);
                } else {
                    let errorMessage = "Wechat OpenID already exist";
                    logger.error("Validation errors:", errorMessage);
                    errorResp.send(res, consts.error.badRequestLabel, errorMessage, 400);
                }
            }).catch((promReject) => {
                logger.error(promReject);
                let msg = (promReject.message !== undefined) ? promReject.message : promReject + "";
                errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
            });
        } else {
            findUserAccAndSave(req, res, reqBody);
        }
    } else {
        let errors = validationResult.errorMessage;
        errors = errors.concat(inputErrors);
        errorResp.send(res, consts.error.badRequestLabel, errors, 400);
    }
};

function getInputErrorsForPostRequest(body) {
    let errors = [];

    // When adding new parameters to validate, always follow the waterfall structure:
    //   - Is the parameter undefined? (throw error if applicable)
    //   - Is the data format the correct type, and does it satisfy our business logic?
    if (body.companyID !== undefined) {
        if (dataValidation.isIntegerString(body.companyID) === false || body.companyID < MINIMUM_COMPANY_ID) {
            errors.push("'companyID' parameter must contain an integer string greater than or equal to " + MINIMUM_COMPANY_ID +
                        " (you gave " + (typeof body.companyID) + " " + body.companyID + ")");
        }
    } else {
        errors.push("Must specify 'companyID' parameter containing an integer string between 0 and 1,000, inclusive");
    }

    return errors;
}

//Share function between reqBody.wechatOpenID exist and reqBody.wechatOpenID not exist condition
function findUserAccAndSave(req, res, reqBody) {
    //1. Find if userName already exist in the system, if userName doesn't exist, continue
    findUserAccountByUserName(reqBody.userName).then((userNameResp) => {
        userNameResp = JSON.parse(JSON.stringify(userNameResp));
        if (!userNameResp) {
            let unsaltedPassword = reqBody.password;
            bcrypt.hash(reqBody.password, saltRounds).then((hashedPw) => {
                reqBody.password = hashedPw;
                saveUserAccountToDB(reqBody).then((saveResp, err) => {
                    if (err === null || err === undefined) {
                        let registResult = delExtraFieldsOfResult(JSON.parse(JSON.stringify(saveResp)));
                        registResult = setUndefinedAttrToNull(registResult);
                        let data = new FormData();
                        data.append("f", "pjson");
                        data.append("userName", saveResp.userName);
                        data.append("password", unsaltedPassword);
                        let input = {
                            form: data
                        };
                        request("POST", "http://" + req.get("host") + "/api/generaluserlogin", input).then((addnlResp) => {
                            let json = {};
                            if (addnlResp.statusCode === 200) {
                                json = JSON.parse(addnlResp.body.toString());
                            } else {
                                logger.error(JSON.parse(addnlResp.body.toString()).error.errors);
                            }
                            registResult.token = (json.token) ? json.token : null;
                            registResult.tokenExpiresAt = (json.tokenExpiresAt) ? json.tokenExpiresAt : null;
                            res.send(registResult);
                        }).catch((err) => {
                            logger.error(err);
                            registResult.token = null;
                            registResult.tokenExpiresAt = null;
                            res.send(registResult);
                        });
                    } else {
                        errorResp.send(res, consts.error.serverErrorLabel, err, 500);
                    }
                }).catch((promReject) => {
                    logger.error(promReject);
                    let msg = (promReject.message !== undefined) ? promReject.message : promReject + "";
                    errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
                });
            });
        } else {
            let errorMessage = "User account already exist";
            errorResp.send(res, "Bad Request", errorMessage, 400);
        }
    }).catch((promReject) => {
        logger.error(promReject);
        let msg = (promReject.message !== undefined) ? promReject.message : promReject + "";
        errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
    });
}

/////////////////////////////////////////////////////
//
// Put User Account Func
//
/////////////////////////////////////////////////////

// - PUT "/generaluserregistry"
//1. Validate requried fields and settable fields
//2. Check if wechatOpenID is unique in the system
//3. Check if userName is unique in the system
//4. Encrypt password 
//5. Update the record into database
obj.updateUserAccount = function(req, res, next) {
    let reqBody = req.body;
    let validationResult = generalUserRegValidation.validatePutReqBody(reqBody);
    let inputErrors = getInputErrorsForPutRequest(req.body);
    if (validationResult.status === "success" && inputErrors.length === 0) {
        //If wechatOpenID exist, make sure this wechatOpenID is unique in the system. Otherwise, throw error message
        if (reqBody.wechatOpenID) {
            findUserAccountByWechatOpenID(reqBody.wechatOpenID).then((wechatResp) => {
                wechatResp = JSON.parse(JSON.stringify(wechatResp));
                if (!wechatResp) {
                    findUserAccAndUpdate(req, res, next, reqBody);
                } else {
                    let errorMessage = "Wechat OpenID already exist";
                    logger.error("Validation errors:", errorMessage);
                    errorResp.send(res, "Bad Request", errorMessage, 400);
                    next();
                }
            }).catch((promReject) => {
                logger.error(promReject);
                let msg = (promReject.message !== undefined) ? promReject.message : promReject + "";
                errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
                next();
            });
        } else {
            findUserAccAndUpdate(req, res, next, reqBody);
        }
    } else {
        let errors = validationResult.errorMessage;
        errors = errors.concat(inputErrors);
        errorResp.send(res, "Bad Request", errors, 400);
        next();
    }
};

function getInputErrorsForPutRequest(body) {
    let errors = [];

    // When adding new parameters to validate, always follow the waterfall structure:
    //   - Is the parameter undefined? (throw error if applicable)
    //   - Is the data format the correct type, and does it satisfy our business logic?
    if (body.companyID !== undefined) {
        if (dataValidation.isIntegerString(body.companyID) === false || body.companyID < MINIMUM_COMPANY_ID) {
            errors.push("'companyID' parameter must contain an integer string greater than or equal to " + MINIMUM_COMPANY_ID +
                        " (you gave " + (typeof body.companyID) + " " + body.companyID + ")");
        }
    }

    return errors;
}

//Shared function between wechatOpenID exist condition and wechatOpenID not exist condition
function findUserAccAndUpdate(req, res, next, reqBody) {
    //If reqBody.password exist, we need to apply encrypt method
    if (reqBody.password) {
        bcrypt.hash(reqBody.password, saltRounds).then((hashedPw) => {
            reqBody.password = hashedPw;
            updateUserAccount(req, res, next, reqBody);
        });
    }
    else {
        updateUserAccount(req, res, next, reqBody);
    }
}

//Shared function between password exist condition and password not exist condition
function updateUserAccount(req, res, next, reqBody) {
    updateUserAccountToDB(reqBody).then((updateResponse) => {
        updateResponse = JSON.parse(JSON.stringify(updateResponse));
        //In the async function, we use findOneAndUpdate function. 
        //When we use mongoose findOneAndUpdate function, we should notice:
        //1.If we cannot find the user account in the system, findOneAndUpdate function will return null to us
        //2.If we can find the user account in the system, findOneAndUpdate function will return the updated result
        if (updateResponse) {
            let updateResult = delExtraFieldsOfResult(updateResponse);
            updateResult = setUndefinedAttrToNull(updateResponse);
            res.send(updateResult);
            next();
        } else {
            errorResp.send(res, "Bad Request", "Cannot find this account", 400);
            next();
        }
    }).catch((err) => {
        let msg = err + "";
        logger.error(err);
        errorResp.send(res, "Mongo Error", msg, 500);
        next();
    });
}

/////////////////////////////////////////////////////
//
// Delete User Account Func
//
/////////////////////////////////////////////////////

// - DELETE "/generaluserregistry"
//Delete user account in the system
//1. Validate req body attribute
//2. Find if all the input user account exist in the system, if there is any user account
//   doesn't exist in the system, throw an error message
//3. If all the input user account exist in the system, then delete all of them
//4. summarize the delete result info and send back to frontend user
obj.deleteUserAccount = function(req, res, next) {
    let query = req.query;
    let validationResult = generalUserRegValidation.validateDelReqQuery(query);
    if (validationResult.status === "success") {
        getUserAccountInfo(query.userName).then((findResp) => {
            findResp = JSON.parse(JSON.stringify(findResp));
            let countForFindResult = findResp.length;
            let countForInputAccount = query.userName.split(",").length;
            if (countForFindResult === countForInputAccount) {
                delUserApplicationInfo(query.userName).then((delResp) => {
                    let delResult = {};
                    delResult.number = delResp.length;
                    delResult.userNames = delResp;
                    res.send(delResult);
                    next();
                }).catch((err) => {
                    let msg = err + "";
                    logger.error(err);
                    errorResp.send(res, "Mongo Error", msg, 500);
                    next();
                });
            } else {
                let notExistApp = findNotExistApp(findResp, query.userName);
                let errorMessage = "We cannot find these device in the system: [" + notExistApp + "],"
                    + " string should be separated by comma and without space";
                logger.error("Cannot find user account:", errorMessage);
                errorResp.send(res, "Bad Request", errorMessage, 400);
                next();
            }
        }).catch((err) => {
            let msg = err + "";
            logger.error(err);
            errorResp.send(res, "Mongo Error", msg, 500);
            next();
        });
    }
    else {
        logger.error("Validation errors:", validationResult.errorMessage);
        errorResp.send(res, "Bad Request", validationResult.errorMessage, 400);
        next();
    }
};

/////////////////////////////////////////////////////
//
// Login User Account Func
//
/////////////////////////////////////////////////////

// - POST "/generaluserlogin"
//User Login Function
//1.Validate if required fields exist in the req body
//2.Validate if all the existing requried fields are valid
//3.Find if the user account exist in the system with wechatOpenID or userName
//4.If reqBody.password exist, need compare password and continue
//  If reqBody.password not exist, continue
//5.Get token and add to find result
//6.Send back find result
obj.loginUserAccount = function(req, res) {
    let reqBody = req.body;
    let validationResult = generalUserRegValidation.validateLoginInput(reqBody);
    if (validationResult.status === "success") {
        findLoginUserAccount(reqBody).then((findResp) => {
            findResp = JSON.parse(JSON.stringify(findResp));
            if (findResp) {
                if (reqBody.password) {
                    bcrypt.compare(reqBody.password, findResp.password).then((pwMatch) => {
                        if (pwMatch === true) {
                            sendLoginResult(req, res, reqBody, findResp);
                        } else {
                            let errorMessage = "Username or password is not correct";
                            logger.error("Validation errors:", errorMessage);
                            errorResp.send(res, consts.error.badRequestLabel, errorMessage, 400);
                        }
                    });
                } else {
                    sendLoginResult(req, res, reqBody, findResp);
                }
            } else {
                let errorMessage = "Username or password is not correct";
                logger.error("Validation errors:", errorMessage);
                errorResp.send(res, "Bad Request", errorMessage, 400);
            }
        }).catch((err) => {
            let msg = err + "";
            logger.error(err);
            errorResp.send(res, "Mongo Error", msg, 500);
        });
    } else {
        logger.error("Validation errors:", validationResult.errorMessage);
        errorResp.send(res, "Bad Request", validationResult.errorMessage, 400);
    }
};

//Shared function between reqBody.password exist condition and reqBody.password not exist condition
function sendLoginResult(req, res, reqBody, findResp) {
    let loginResult = dataFormat.enforceSchemaOnDocument(require("../../models/users/generalUserAccount.js")(), findResp, false);
    loginResult = delExtraFieldsOfResult(loginResult);
    let tokenLifeMinutes = consts.userLogin.tokenLifeMinutes;
    // "expiresIn" (below) is in seconds
    let username = (reqBody.userName) ? reqBody.userName : findResp.userName;
    let token = jwt.sign({ id: username + "." + consts.userLogin.generalRoleName }, config.secret, { expiresIn: tokenLifeMinutes * 60 });
    loginResult.token = token;
    let expireTime = (new Date()).getTime() + (tokenLifeMinutes * 60 * 1000);
    loginResult.tokenExpiresAt = expireTime;
    res.send(loginResult);
}

/////////////////////////////////////////////////////
//
// Async Func
//
/////////////////////////////////////////////////////

//Async function to find the user wechatID
function findUserAccountByWechatOpenID(wechatID) {
    let generalUserAccount = require("../../models/users/generalUserAccount.js")();
    return new Promise((resolve, reject) => {
        generalUserAccount.findOne({ wechatOpenID: wechatID }, (err, resp) => {
            if (!err) {
                resolve(resp);
            } else {
                reject(err);
            }
        });
    });
}

//Async function to find the user account
function findUserAccountByUserName(name) {
    let generalUserAccount = require("../../models/users/generalUserAccount.js")();
    return new Promise((resolve, reject) => {
        generalUserAccount.findOne({ userName: name }, (err, resp) => {
            if (!err) {
                resolve(resp);
            } else {
                reject(err);
            }
        });
    });
}

//Async function to save the user account
function saveUserAccountToDB(saveBody) {
    // Get a fresh connection in case the previous one has errored out
    let generalUserAccount = require("../../models/users/generalUserAccount.js")();
    let promise = new generalUserAccount(saveBody).save();
    return promise;
}

//Async function to update the user account
function updateUserAccountToDB(updateBody) {
    let generalUserAccount = require("../../models/users/generalUserAccount.js")();
    return new Promise((resolve, reject) => {
        generalUserAccount.findOneAndUpdate({ userName: updateBody.userName },
            updateBody, { new: true }, (err, resp) => {
                if (!err) {
                    resolve(resp);
                } else {
                    reject(err);
                }
            });
    });
}

//Async function to get user account information
function getUserAccountInfo(queryStr) {
    let queryArr = queryStr.split(",");
    let generalUserAccount = require("../../models/users/generalUserAccount.js")();
    return new Promise((resolve) => {
        let query = {};
        query["$or"] = [];
        for (let i in queryArr) {
            let elem = queryArr[i];
            let queryObj = {};
            queryObj.userName = elem;
            query["$or"].push(queryObj);
        }
        resolve(generalUserAccount.find(query));
    });
}

//Async function to get all the user account information
function getAllUserAccounts(query) {
    let generalUserAccount = require("../../models/users/generalUserAccount.js")();
    return new Promise((resolve) => {
        let queryObj = {};

        if (query.companyID !== undefined) {
            if (query.companyID.includes(",")) {
                queryObj.companyID = { $in: query.companyID.split(",") };
            } else {
                queryObj.companyID = query.companyID;
            }
        }

        if (query.userName !== undefined) {
            queryObj.userName = query.userName;
        }

        resolve(generalUserAccount.find(queryObj));
    });
}

//Async function to delete the user account
//There are two methods to delete records in database: 
//1. .remove({userName: {$in:["calgary_test", "shanghai_test"]}}), but these method only return the count of deleted records
//2. .findOneAndRemove({userName:1}) + Promise.all(), findOneAndRemove will return the exact record 
//   content instead of the count of records
//Thus, we choose findOneAndRemove + Promise.all() here. After deleting, we can show the deleted records info to 
//frontend user
function delUserApplicationInfo(queryStr) {
    let promises = [];
    let queryArr = queryStr.split(",");
    let generalUserAccount = require("../../models/users/generalUserAccount.js")();
    for (let i in queryArr) {
        let promise = generalUserAccount.findOneAndRemove({ userName: queryArr[i] });
        promises.push(promise);
    }
    return Promise.all(promises).then((resp) => {
        let userNames = [];
        resp = JSON.parse(JSON.stringify(resp));
        for (let index in resp) {
            let elem = resp[index];
            userNames.push(elem.userName);
        }
        return userNames;
    });
}

//Find if user account exist in the system when user login
function findLoginUserAccount(reqBody) {
    let query = {};
    let generalUserAccount = require("../../models/users/generalUserAccount.js")();
    if (reqBody.wechatOpenID !== undefined) {
        query.wechatOpenID = reqBody.wechatOpenID;
    }
    if (reqBody.userName !== undefined) {
        query.userName = reqBody.userName;
    }
    return new Promise((resolve, reject) => {
        generalUserAccount.findOne(query, (err, resp) => {
            if (!err) {
                resolve(resp);
            } else {
                reject(err);
            }
        });
    });
}

/////////////////////////////////////////////////////
//
// Private Func
//
/////////////////////////////////////////////////////

//Should return username and not return password
function delExtraFieldsOfResult(registResult) {
    let result = registResult;
    delete result.password;
    delete result._id;
    delete result.__v;
    return result;
}

//For post web api, when return the result to frontend user. We need to change 
//the undefined field to null
function setUndefinedAttrToNull(object) {
    if (object[EMAIL] === undefined) {
        object[EMAIL] = null;
    }
    if (object[WECHAT_OPENID] === undefined) {
        object[WECHAT_OPENID] = null;
    }
    if (object[GENERAL_APPIDS] === undefined) {
        object[GENERAL_APPIDS] = null;
    }
    return object;
}

//Compare and find the user account doesn't exist in the req body
function findNotExistApp(findResp, userAccounts) {
    let notExistApp = userAccounts.split(",");
    for (let index in findResp) {
        let elem = findResp[index];
        let userName = elem.userName;
        if (notExistApp.includes(userName)) {
            notExistApp = notExistApp.filter((item) => item !== userName);
        }
    }
    return notExistApp;
}

module.exports = obj;
