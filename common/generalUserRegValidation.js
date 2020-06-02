// This file contains route-specific validation functions that should instead live
// in their route function files, as they aren't generic enough to be reused by any
// other web services.
// For the time being, though, we will leave this file here as moving it to its
// correct location is not of high importance.

let dataValidation = require("./dataValidation.js");

let obj = {};

//////////////////////////////////////////////////////////////
//
// Validate Req Body for Post Web Service
//
//////////////////////////////////////////////////////////////

obj.validatePostReqBody = function(reqBody) {
    let validationResult = {
        status: "success",
        errorMessage: []
    };

    let validRequiredFieldResult = validatePostRequiredField(reqBody);
    if (validRequiredFieldResult.status === "success") {
        let validSettableFieldResult = validatePostSettableField(reqBody);
        if (validSettableFieldResult.status !== "success") {
            validationResult.status = "error";
            validationResult.errorMessage = validationResult.errorMessage.concat(validSettableFieldResult.errorMessage);
        }
    }
    else {
        validationResult.status = "error";
        validationResult.errorMessage = validationResult.errorMessage.concat(validRequiredFieldResult.errorMessage);
    }

    return validationResult;
};

////////////////////////////////////////////////////////////////////
//
// Validate Req Body for Put Web Service
//
////////////////////////////////////////////////////////////////////

obj.validatePutReqBody = function(reqBody) {
    let validationResult = {
        status: "success",
        errorMessage: []
    };

    let validRequiredFieldResult = validatePutRequiredField(reqBody);
    if (validRequiredFieldResult.status === "success") {
        let validSettableFieldResult = validatePutSettableField(reqBody);
        if (validSettableFieldResult.status !== "success") {
            validationResult.status = "error";
            validationResult.errorMessage = validationResult.errorMessage.concat(validSettableFieldResult.errorMessage);
        }
    }
    else {
        validationResult.status = "error";
        validationResult.errorMessage = validationResult.errorMessage.concat(validRequiredFieldResult.errorMessage);
    }

    return validationResult;
};

////////////////////////////////////////////////////////////////////
//
// Validate Req Body for Delete Web Service
//
////////////////////////////////////////////////////////////////////

//Validate the delete query string
obj.validateDelReqQuery = function(query) {
    let validationResult = {
        status: "success",
        errorMessage: ""
    };
    let userName = query.userName;
    //If get query string exist and not null, it will always be string
    if (userName !== undefined && userName !== null) {
        let array = userName.split(",");
        for (let index in array) {
            let elem = array[index];
            let userNameValidationResult = dataValidation.validateUserNameFor6Digits(elem);
            if (userNameValidationResult.status !== "success") {
                validationResult.status = "error";
                validationResult.errorMessage = validationResult.errorMessage.concat(userNameValidationResult.errorMessage);
            }
        }
    }
    else {
        validationResult.status = "error";
        validationResult.errorMessage = "Must provide userName";
    }
    return validationResult;
};

////////////////////////////////////////////////////////////////////
//
// Validate Req Body for Login Web Service
//
////////////////////////////////////////////////////////////////////

obj.validateLoginInput = function(reqBody) {
    let validationResult = {
        status: "success",
        errorMessage: []
    };

    let validRequiredFieldResult = validateLoginRequiredField(reqBody);
    if (validRequiredFieldResult.status === "success") {
        let validSettableFieldResult = validateLoginContentField(reqBody);
        if (validSettableFieldResult.status !== "success") {
            validationResult.status = "error";
            validationResult.errorMessage = validationResult.errorMessage.concat(validSettableFieldResult.errorMessage);
        }
    }
    else {
        validationResult.status = "error";
        validationResult.errorMessage = validationResult.errorMessage.concat(validRequiredFieldResult.errorMessage);
    }

    return validationResult;
};

////////////////////////////////////////////////////////////////////
//
// Private Function
//
////////////////////////////////////////////////////////////////////

//Validate the post request body, the required fields must exist.
//Otherwise the validationResult.status is "error"
function validatePostRequiredField(reqBody) {
    let validRequiredFieldResult = {
        status: "success",
        errorMessage: []
    };

    let firstName = reqBody.firstName;
    let lastName = reqBody.lastName;
    let userName = reqBody.userName;
    let password = reqBody.password;

    if (firstName === undefined) {
        validRequiredFieldResult.status = "error";
        validRequiredFieldResult.errorMessage.push("Must provide firstName");
    }
    if (lastName === undefined) {
        validRequiredFieldResult.status = "error";
        validRequiredFieldResult.errorMessage.push("Must provide lastName");
    }
    if (userName === undefined) {
        validRequiredFieldResult.status = "error";
        validRequiredFieldResult.errorMessage.push("Must provide userName");
    }
    if (password === undefined) {
        validRequiredFieldResult.status = "error";
        validRequiredFieldResult.errorMessage.push("Must provide password");
    }

    return validRequiredFieldResult;
}

//Validate if all the fields in post req body are valid
function validatePostSettableField(reqBody) {
    let validSettableFieldResult = {
        status: "success",
        errorMessage: []
    };

    //Validate shared fields in post req body
    let validSpecificSettableFieldsResult = validSpecificSettableFields(reqBody);
    if (validSpecificSettableFieldsResult.status !== "success") {
        validSettableFieldResult.status = "error";
        validSettableFieldResult.errorMessage = validSettableFieldResult.errorMessage.concat(validSpecificSettableFieldsResult.errorMessage);
    }

    return validSettableFieldResult;
}

//Validate the put request body, the required fields must exist.
//Otherwise the validationResult.status is "error"
function validatePutRequiredField(reqBody) {
    let validRequiredFieldResult = {
        status: "success",
        errorMessage: []
    };

    let userName = reqBody.userName;

    if (userName === undefined) {
        validRequiredFieldResult.status = "error";
        validRequiredFieldResult.errorMessage.push("Must provide userName");
    }

    return validRequiredFieldResult;
}

//Validate if all the fields in put req body are valid
//For put web service, we don't validate the username, because it is not a settable field
function validatePutSettableField(reqBody) {
    let validSettableFieldResult = {
        status: "success",
        errorMessage: []
    };

    //Validate shared fields in post req body
    let validSpecificSettableFieldsResult = validSpecificSettableFields(reqBody);
    if (validSpecificSettableFieldsResult.status !== "success") {
        validSettableFieldResult.status = "error";
        validSettableFieldResult.errorMessage = validSettableFieldResult.errorMessage.concat(validSpecificSettableFieldsResult.errorMessage);
    }

    return validSettableFieldResult;
}

//1.Validate 6 specific fields: firstName, lastName, password, email, wechatOpenID, generalAppIDs
//  These 6 specific fields are shared between post req body and put req body
//2.firstName, lastName, wechatOpenID have the same validation rule: If they exist, they must be string
//3.password validation rule: Minimum eight characters, at least one letter and one number:
//4.email validation rule: must have @ and domain, need to summarize later
function validSpecificSettableFields(reqBody) {
    let validSpecificSettableFieldsResult = {
        status: "success",
        errorMessage: []
    };

    let firstName = reqBody.firstName;
    let lastName = reqBody.lastName;
    let userName = reqBody.userName;
    let password = reqBody.password;
    let email = reqBody.email;
    let wechatOpenID = reqBody.wechatOpenID;
    let generalAppIDs = reqBody.generalAppIDs;

    if (firstName !== undefined && typeof firstName !== "string") {
        validSpecificSettableFieldsResult.status = "error";
        validSpecificSettableFieldsResult.errorMessage.push("firstName must be a string");
    }
    if (lastName !== undefined && typeof lastName !== "string") {
        validSpecificSettableFieldsResult.status = "error";
        validSpecificSettableFieldsResult.errorMessage.push("lastName must be a string");
    }
    //userName validation:
    //1. Minimum 6 characters in the string.
    //2. Only support 3 special characters: '.', '_', '-'.
    //3. Special character can only be in the middle of the string: "general_calgary".
    //4. Special characters can not be used continuously.
    if (userName !== undefined) {
        if (typeof userName === "string") {
            let userNameValidationResult = dataValidation.validateUserNameFor6Digits(userName);
            if (userNameValidationResult.status !== "success") {
                validSpecificSettableFieldsResult.status = "error";
                validSpecificSettableFieldsResult.errorMessage = validSpecificSettableFieldsResult.errorMessage.concat(userNameValidationResult.errorMessage);
            }
        }
        else {
            validSpecificSettableFieldsResult.status = "error";
            validSpecificSettableFieldsResult.errorMessage.push("userName must be a string");
        }
    }
    //If password exist, validate password:
    //1. In post web service, password is required
    //2. In put web service, password is not required
    //password validation:
    //1. Minimum 8 letters,
    //2. At least one uppercase letter, one lowercase letter and one number
    if (password !== undefined) {
        if (typeof password === "string") {
            if (!dataValidation.validatePassword(password)) {
                validSpecificSettableFieldsResult.status = "error";
                validSpecificSettableFieldsResult.errorMessage.push("Passwords must be a minimum of eight characters, and must include at least one uppercase letter, one lowercase letter, and one number");
            }
        }
        else {
            validSpecificSettableFieldsResult.status = "error";
            validSpecificSettableFieldsResult.errorMessage.push("password must be a string");
        }
    }
    if (email !== undefined) {
        if (typeof email === "string") {
            if (!dataValidation.validateEmail(email)) {
                validSpecificSettableFieldsResult.status = "error";
                validSpecificSettableFieldsResult.errorMessage.push("You must input valid email address, for example, account@yahoo.com, must have '@' and '.' and separated into 3 sections");
            }
        }
        else {
            validSpecificSettableFieldsResult.status = "error";
            validSpecificSettableFieldsResult.errorMessage.push("email must be a string");
        }
    }
    if (wechatOpenID !== undefined && typeof wechatOpenID !== "string") {
        validSpecificSettableFieldsResult.status = "error";
        validSpecificSettableFieldsResult.errorMessage.push("wechatOpenID must be a string");
    }
    if (generalAppIDs !== undefined) {
        if (Array.isArray(generalAppIDs)) {
            if (generalAppIDs.length !== 0 && !validGeneralAppIDs(generalAppIDs)) {
                validSpecificSettableFieldsResult.status = "error";
                validSpecificSettableFieldsResult.errorMessage.push("generalAppIDs must be an array of integer");
            }
        }
        else {
            validSpecificSettableFieldsResult.status = "error";
            validSpecificSettableFieldsResult.errorMessage.push("generalAppIDs must be array");
        }
    }
    return validSpecificSettableFieldsResult;
}

function validGeneralAppIDs(generalAppIDs) {
    let result = true;
    for (let index in generalAppIDs) {
        if (!Number.isInteger(generalAppIDs[index])) {
            result = false;
            break;
        }
    }
    return result;
}

function validateLoginRequiredField(reqBody) {
    let validRequiredFieldResult = {
        status: "success",
        errorMessage: []
    };
    let wechatOpenID = reqBody.wechatOpenID;
    let userName = reqBody.userName;
    let password = reqBody.password;
    //1. If wechatOpenID exist, userName and password both exist, success to pass required validation
    //2. If wechatOpenID exist, userName and password both not exist, success to pass required validation
    //3. If wechatOpenID exist, (userName not exist and password exist) or (userName exist and password not exist), failed to pass required validation
    if (wechatOpenID !== undefined) {
        if (userName !== undefined && password === undefined || userName === undefined && password !== undefined) {
            validRequiredFieldResult.status = "error";
            validRequiredFieldResult.errorMessage.push("Must provide 'username' and 'password' fields together in request body.");
        }
    }
    //1. If wechatOpenID not exist, userName and password both exist, success to pass required validation
    //2. If wechatOpenID not exist, userName and password both not exist, failed to pass required validation
    //3. If wechatOpenID not exist, (userName not exist and password exist) or (userName exist and password not exist), failed to pass required validation
    else if (wechatOpenID === undefined) {
        if (userName !== undefined && password === undefined || userName === undefined && password !== undefined) {
            validRequiredFieldResult.status = "error";
            validRequiredFieldResult.errorMessage.push("Must provide 'username' and 'password' fields together in request body.");
        }
        else if (userName === undefined && password === undefined) {
            validRequiredFieldResult.status = "error";
            validRequiredFieldResult.errorMessage.push("Must provide one of wechatOpenID or userName/password combination");
        }
    }

    return validRequiredFieldResult;
}

function validateLoginContentField(reqBody) {
    let validSettableFieldResult = {
        status: "success",
        errorMessage: []
    };

    let wechatOpenID = reqBody.wechatOpenID;
    let userName = reqBody.userName;
    let password = reqBody.password;

    if (wechatOpenID !== undefined && typeof wechatOpenID !== "string") {
        validSettableFieldResult.status = "error";
        validSettableFieldResult.errorMessage.push("wechatOpenID must be a string");
    }
    if (!validUserName(userName) || !validPassword(password)) {
        validSettableFieldResult.status = "error";
        validSettableFieldResult.errorMessage.push("Username or password is not correct");
    }

    return validSettableFieldResult;
}

function validUserName(userName) {
    let result = true;
    if (userName !== undefined) {
        if (typeof userName === "string") {
            let userNameValidationResult = dataValidation.validateUserNameFor6Digits(userName);
            if (userNameValidationResult.status !== "success") {
                result = false;
            }
        }
        else {
            result = false;
        }
    }
    return result;
}

function validPassword(password){
    let result = true;
    if (password !== undefined) {
        if (typeof password === "string") {
            if (!dataValidation.validatePassword(password)) {
                result = false;
            }
        }
        else {
            result = false;
        }
    }
    return result;
}

module.exports = obj;
