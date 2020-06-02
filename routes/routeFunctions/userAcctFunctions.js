let mongoose = require("mongoose");
mongoose.Promise = global.Promise;
let jwt = require("jsonwebtoken");
let bcrypt = require("bcryptjs");
const saltRounds = 10;
let request = require("then-request");
let FormData = request.FormData;

let config = require("../../config/config.js");
let logger = require("../../common/tracer.js");
let consts = require("../../config/constants.js");

let AdminUserAccount = require("../../models/users/adminUserAccount.js")();
let userAccValidation = require("../../common/userAccValidation.js");
let dataFormat = require("../../common/dataFormat.js");
let errorResp = require("../../common/errorResponse.js");

var userAcctRoutingFuncs = {};

function getEsriAuthObject(req, featureURL) {
    let data = new FormData();
    if (req.headers.origin !== undefined) {
        if (req.headers.origin.includes("://")) {
            let originParts = req.headers.origin.split("/");
            data.append("referer", originParts[2]);
        } else {
            data.append("referer", req.headers.origin);
        }
    } else {
        data.append("referer", req.headers.host);
    }

    data.append("f", "pjson");
    let tokenLifeMinutes = (req.body.tokenLifeMinutes) ? req.body.tokenLifeMinutes : consts.userLogin.tokenLifeMinutes;
    data.append("expiration", tokenLifeMinutes);

    let featureUrlParts = featureURL.split("/");
    let featuresDomain = featureUrlParts[2];
    let authConfig = consts.esriAuth[featuresDomain];
    if (authConfig === undefined) {
        return Promise.resolve();
    }
    for (let i in authConfig.formData) {
        data.append(i, authConfig.formData[i]);
    }

    let input = {
        form: data
    };
    if (authConfig.selfSignedSSL === true) {
        // We need the following code because of Shanghai portal's self-signed SSL
        let https = require("https");
        let agent = new https.Agent({ rejectUnauthorized: false });
        input.agent = agent;
    }
    return new Promise((resolve, reject) => {
        request("POST", authConfig.url, input).then((resp) => { resolve(resp); });
        setTimeout(() => { reject(); }, consts.howLongWaitForEsriAuthMs);
    });
}

// - "/userlogin"
userAcctRoutingFuncs.userLogin = function(req, res) {
    let validationErrors = userAccValidation.validateLoginInput(req.body);
    if (validationErrors.length === 0) {
        AdminUserAccount = require("../../models/users/adminUserAccount.js")();
        AdminUserAccount.find(
            {
                username: req.body.username
            }
        ).then((userAccts) => {
            if (userAccts.length == 1) {
                let userAcct = JSON.parse(JSON.stringify(userAccts[0]));
                bcrypt.compare(req.body.password, userAcct.password).then((pwMatch) => {
                    if (pwMatch === true) {
                        let loginResult = delExtraFieldsOfResult(userAcct);
                        let tokenLifeMinutes = (req.body.tokenLifeMinutes) ? req.body.tokenLifeMinutes : consts.userLogin.tokenLifeMinutes;
                        // "expiresIn" (below) is in seconds
                        let token = jwt.sign({ id: req.body.username + "." + consts.userLogin.adminRoleName }, config.secret, { expiresIn: tokenLifeMinutes * 60 });
                        loginResult.token = token;
                        let expireTime = (new Date()).getTime() + (tokenLifeMinutes * 60 * 1000);
                        loginResult.tokenExpiresAt = expireTime;

                        let resumeAfterEsriAuth = function(resp) {
                            // "then-request" does not throw errors; it returns a promise that always
                            // resolves. We therefore check the resolved contents and add any valid
                            // data to the web service's response.
                            loginResult.esriAuthResult = null;
                            if (resp) {
                                try {
                                    let esriRespBodyJSON = JSON.parse(resp.body);
                                    loginResult.esriAuthResult = esriRespBodyJSON;
                                } catch (err) {
                                    logger.error("Error parsing JSON response from Esri for", req.headers.host +
                                                 ".\nEsri request settings:\n", consts.esriAuth[req.headers.host]);
                                }
                            } else {
                                logger.error("Error fetching Esri authentication object for", req.headers.host +
                                             ".\nEsri request settings:\n", consts.esriAuth[req.headers.host]);
                            }
                            // Regardless if an Esri auth object was successfully retrieved & parsed,
                            // we will still return a successful login response so that a user can at
                            // least login even if Esri or one of our hosted Portals is down.
                            res.send({ result: loginResult });
                        };
                        getEsriAuthObject(req, userAcct.featureLayerBaseURL).then(resumeAfterEsriAuth)
                            .catch(resumeAfterEsriAuth);
                    } else {
                        errorResp.send(res, consts.error.badRequestLabel, "Username or password is not correct", 400);
                    }
                });
            } else {
                errorResp.send(res, consts.error.badRequestLabel, "Username or password is not correct", 400);
            }
        }).catch((err) => {
            logger.error(err);
            let errMsg = err + "";
            errorResp.send(res, consts.error.serverErrorLabel, errMsg, 500);
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validationErrors, 400);
    }
};

// - "/adminuserregister"
userAcctRoutingFuncs.userRegister = function(req, res) {
    let validationErrors = userAccValidation.validateRegisterInput(req.body);
    if (validationErrors.length === 0) {
        checkIfUserAlreadyExist(req.body.username).then((findResp) => {
            if (findResp === null || findResp === undefined) {
                // The following code does 2 things in one call:
                //
                //   1 - Computes a new random salt based on the "saltRounds" value
                //   2 - Uses this random salt to hash the plain text password, and appends the salt
                //       to the final hashed output
                //
                // This means that later on when you want to login to a user's account and you type in a
                // plain text password, bcrypt first extracts the salt from the hashed password in the
                // database, hashes your plain text input using the same salt, then compares the two
                // hashed strings.
                bcrypt.hash(req.body.password, saltRounds).then((hashedPw) => {
                    // No need to "try / catch" this JSON.parse call because any JSON errors in the
                    // request body would've been caught by Express.
                    let reqBody = JSON.parse(JSON.stringify(req.body));
                    reqBody.password = hashedPw;
                    let preppedInput = dataFormat.prepUserAccountInput(reqBody);
                    saveUserAccountToDB(preppedInput).then((saveResp, err) => {
                        if (err === null || err === undefined) {
                            let registResult = delExtraFieldsOfResult(JSON.parse(JSON.stringify(saveResp)));
                            res.send({ result: registResult });
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
                errorResp.send(res, consts.error.badRequestLabel, "User '" + req.body.username + "' already exists in database", 400);
            }
        }).catch((promReject) => {
            logger.error(promReject);
            let msg = (promReject.message !== undefined) ? promReject.message : promReject + "";
            errorResp.send(res, consts.error.serverErrorLabel, msg, 500);
        });
    } else {
        errorResp.send(res, consts.error.badRequestLabel, validationErrors, 400);
    }
};

function checkIfUserAlreadyExist(username) {
    // Get a fresh connection in case the previous one has errored out
    AdminUserAccount = require("../../models/users/adminUserAccount.js")();
    let promise = AdminUserAccount.findOne({
        username: username
    });
    return promise;
}

function saveUserAccountToDB(preppedInput) {
    // Get a fresh connection in case the previous one has errored out
    AdminUserAccount = require("../../models/users/adminUserAccount.js")();
    let promise = new AdminUserAccount(preppedInput).save();
    return promise;
}

//Should return username and not return password
function delExtraFieldsOfResult(registResult) {
    let result = registResult;
    delete result.password;
    delete result._id;
    delete result.__v;
    for (let i = 0; i < result.scenarios.length; i++) {
        delete result.scenarios[i]._id;
    }
    return result;
}

module.exports = userAcctRoutingFuncs;
