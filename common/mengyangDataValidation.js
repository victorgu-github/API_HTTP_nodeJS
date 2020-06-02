// This file contains individual sheep info type validation functions which are called
// (and should be called) by various other web services that need various sheep info
// type validation.
// Put any BLE protocol-related data type validation in this file.

let consts = reqFile("./config/constants.js");
let dataFormat = reqFile("./common/dataFormat.js");
let dataValidation = require("./dataValidation.js");

let obj = {};

// ----------------------------------------------------------------------------------------------------------------
// -------------------------------------------- BLE Data Types ----------------------------------------------------
// ----------------------------------------------------------------------------------------------------------------

obj.getPastureIdValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (dataValidation.isInteger(param) === false || (param > 0 && param < 10000) === false) {
            errors.push("'" + paramName + "' parameter must be an integer between 1 and 9999, inclusive " +
                        "(you gave " + typeof param + " " + param + ").");
        }
    } else if (isRequired) {
        errors.push("Must specify '" + paramName + "' parameter containing an integer between 1 and 9999, inclusive.");
    }
    return errors;
};

obj.getMultiplePastureIdValidation = function(param, paramName, isRequired, multipleAllowed) {
    let errors = [];
    if (param !== undefined) {
        if (multipleAllowed) {
            let ids = param.split(",");
            ids.forEach((id) => {
                if (dataValidation.isInteger(id) === false || (id > 0 && id < 10000) === false) {
                    errors.push("'" + paramName + "' parameter must be an integer between 1 and 9999 (inclusive) " +
                                "or a comma-separated list thereof " + "(you gave " + typeof id + " " + id + ")");
                }
            });
        } else {
            if (dataValidation.isInteger(param) === false || (param > 0 && param < 10000) === false) {
                errors.push("'" + paramName + "' parameter must be an integer between 1 and 9999, inclusive " +
                            "(you gave " + typeof param + " " + param + ")");
            }
        }
    } else if (isRequired) {
        errors.push("Must specify '" + paramName + "' parameter containing an integer between 1 and 9999, inclusive");
    }
    return errors;
};

obj.getMengyangIdValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (typeof param !== "string") {
            errors.push("'" + paramName + "' parameter must be a string " +
                        "(you gave " + (typeof param) + " " + param + ")");
        } else if (dataFormat.stringContainsOnlySpaces(param)) {
            errors.push("'" + paramName + "'cannot contain only spaces");
        }
    } else if (isRequired) {
        errors.push("Must specify '" + paramName + "' parameter containing a string");
    }
    return errors;
};

obj.getDateOfBirthValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (dataValidation.isValidUtcIsoDateString(param) === false) {
            errors.push("'" + paramName + "' parameter must be a valid UTC ISO date string in the format " +
                        "'yyyy-mm-ddThh-mm-ssZ' (you gave " + (typeof param) + " " + param + ")");
        }
    } else if (isRequired) {
        errors.push("Must specify '" + paramName + "' parameter containing a valid UTC ISO date string " +
                    "in the format 'yyyy-mm-ddThh-mm-ssZ'");
    }
    return errors;
};

obj.getBirthWeightValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if ((typeof param !== "number" && typeof param !== "string") || isNaN(param) || param <= 0) {
            errors.push("'" + paramName + "' parameter must be a valid positive decimal number " +
                        "(you gave " + (typeof param) + " " + param + ")");
        }
    } else if (isRequired) {
        errors.push("Must specify '" + paramName + "' parameter containing a valid positive decimal number");
    }
    return errors;
};

obj.getGenderValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (typeof param !== "string" || param.length === 0) {
            errors.push("'" + paramName + "' parameter must be a non-empty string " +
                        "(you gave " + (typeof param) + " " + param + ")");
        }
    } else if (isRequired) {
        errors.push("Must specify '" + paramName + "' parameter containing a non-empty string");
    }
    return errors;
};

obj.getOriginValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (typeof param !== "string" || param.length === 0) {
            errors.push("'" + paramName + "' parameter must be a non-empty string " +
                        "(you gave " + (typeof param) + " " + param + ")");
        }
    } else if (isRequired) {
        errors.push("Must specify '" + paramName + "' parameter containing a non-empty string");
    }
    return errors;
};

obj.getFatherIdValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (typeof param !== "string") {
            errors.push("'" + paramName + "' parameter must be a string " +
                        "(you gave " + (typeof param) + " " + param + ")");
        }
    } else if (isRequired) {
        errors.push("Must specify '" + paramName + "' parameter containing a string");
    }
    return errors;
};

obj.getMotherIdValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (typeof param !== "string") {
            errors.push("'" + paramName + "' parameter must be a string " +
                        "(you gave " + (typeof param) + " " + param + ")");
        }
    } else if (isRequired) {
        errors.push("Must specify '" + paramName + "' parameter containing a string");
    }
    return errors;
};

obj.getCommentsValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (typeof param !== "string") {
            errors.push("'" + paramName + "' parameter must be a string " +
                        "(you gave " + (typeof param) + " " + param + ")");
        }
    } else if (isRequired) {
        errors.push("Must specify '" + paramName + "' parameter containing a string");
    }
    return errors;
};

obj.getPictureValidation = function(file, isRequired) {
    let errors = [];
    if (file !== null) {
        let fileType = file.mimetype.split("/")[1];
        let acceptedFileTypes = [ "jpg", "jpeg", "png" ];
        if (acceptedFileTypes.includes(fileType) === false) {
            errors.push("Unknown file type. Picture file must be a .jpg, .jpeg, or .png.");
        }
        let maxSize = consts.maxMengyangSheepPictureFileSizeBytes;
        if (file.data.length > maxSize) {
            errors.push("Max file size exceeded (" + (maxSize / (1024 * 1024)) + " MB / " +
                        dataFormat.intWithThousandsSeparator(maxSize) + " bytes). Yours was " +
                        (file.data.length / (1024 * 1024)).toFixed(1) +" MB / " +
                        dataFormat.intWithThousandsSeparator(file.data.length) + " bytes");
        }
    } else if (isRequired) {
        errors.push("Must specify picture file containing a .jpg, .jpeg, or .png file");
    }
    return errors;
};

obj.getVarietyValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (typeof param !== "string") {
            errors.push("'" + paramName + "' parameter must be a non-empty string " +
                        "(you gave " + (typeof param) + " " + param + ")");
        }
    } else if (isRequired) {
        errors.push("Must specify '" + paramName + "' parameter containing a non-empty string");
    }
    return errors;
};

obj.getVaccineSheepfoldIdValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (typeof param !== "string") {
            errors.push("'" + paramName + "' parameter must be an non-empty string " + "(you gave " + (typeof param) + " " + param + ")");
        } else if (param.length === 0 || param.replace(/\s/g, "").length === 0) {
            errors.push("'" + paramName + "' parameter must be an non-empty string " + "(you gave an empty string).");
        }
    } else if (isRequired) {
        errors.push("Must specify '" + paramName + "' parameter that contains a non-empty string.");
    }
    return errors;
};

obj.getVaccinePolygonIdValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (typeof param !== "string") {
            errors.push("'" + paramName + "' parameter must be an non-empty string " + "(you gave " + (typeof param) + " " + param + ")");
        } else if (param.length === 0 || param.replace(/\s/g, "").length === 0) {
            errors.push("'" + paramName + "' parameter must be an non-empty string " + "(you gave an empty string).");
        }
    } else if (isRequired) {
        errors.push("Must specify '" + paramName + "' parameter that contains a non-empty string.");
    }
    return errors;
};

obj.getVaccinationDateValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {                       
        if (dataValidation.isValidUtcIsoDateString(param) === false) {
            errors.push("'" + paramName + "' parameter must be a valid UTC ISO date string in the format " +
                        "'yyyy-mm-ddThh:mm:ssZ' (you gave " + (typeof param) + " " + param + ")");
        }
    } else if (isRequired) {
        errors.push("Must specify '" + paramName + "' parameter that contains a valid ISO Date string in the format 'yyyy-mm-ddThh-mm-ssZ'");
    }
    return errors;
};

obj.getVaccinationTechnicianValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (typeof param !== "string") {
            errors.push("'" + paramName + "' parameter must be an non-empty string " + "(you gave " + (typeof param) + " " + param + ")");
        } else if (param.length === 0 || param.replace(/\s/g, "").length === 0) {
            errors.push("'" + paramName + "' parameter must be an non-empty string " + "(you gave an empty string).");
        }
    } else if (isRequired) {
        errors.push("Must specify '" + paramName + "' parameter that contains a non-empty string.");
    }
    return errors;
};

obj.getNumberOfSheepValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (Number.isInteger(param) === false || param < 0 === true) {
            errors.push("'" + paramName + "' parameter must be a positive integer (you gave " + (typeof param) + " " + param + ")");
        }
    } else if (isRequired) {
        errors.push("Must specify '" + paramName + "' parameter that contains a non-empty string.");
    }
    return errors;
};

// This function validates all string parameters that allows empty string in the Sheep Vaccination web services.
obj.getStringParameterValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (typeof param !== "string") {
            errors.push("'" + paramName + "' parameter must be a string (you gave " + (typeof param) + " " + param + ")");
        }
    } else if (isRequired) {
        errors.push("Must specify '" + paramName + "' parameter that contains a non-empty string.");
    }
    return errors;
};

obj.getVaccinationIdValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (Number.isInteger(Number(param)) === false || Number(param) < 1) {
            let type = (isNaN(Number(param)) === false && param !== "") ? "number" : typeof param;
            errors.push("'" + paramName + "' parameter must be an integer equal to or larger than 1 (you gave " + type + " " + param + ").");
        }
    } else if (isRequired) {
        errors.push("Must provide a " + paramName + " parameter, which is a integer equal to or larger than 1.");
    }
    return errors;
};

obj.getMultipleQueryPastureIdsValidation = function(params, isRequired) {
    let errors = [];
    // The input params is a list of pastureIDs in string format, separated by comma
    if (params !== undefined) {
        let list  = params.split(",");
        for (let i in list) {
            if (parseInt(list[i])>9999 || parseInt(list[i]) < 1 || dataValidation.isInteger(list[i]) === false) {
                errors.push("The pastureID parameter must be an integer between 1 and 9999 (you gave " + list[i] + ").");
            }
        }
    } else if (isRequired === true) {
        errors.push("Must provide the parameter pastureID.");
    }

    return errors;
};

obj.getNewsContentValidation = function(param, isRequired) {
    let errors = [];
    // The content field for each news record has to be an non-empty string
    // and must have less than 2000 characters.
    if (param !== undefined) {
        if (typeof param !== "string") {
            errors.push("The 'content' parameter must be a string (you gave " + (typeof param) + " " + param + ")");
        } else if (param.length === 0 || param.replace(/\s/g, "").length === 0) {
            errors.push("The 'content' parameter must be a non-empty string (a string that only contains space is considered as an empty string, you gave an empty string).");
        } else if (param.length > 2000) {
            errors.push("The length in your 'content' parameter exceeds the maximum length (2000 characters, you gave " + param.length + " characters).");
        }
    } else if (isRequired === true){
        errors.push("Must provide a 'content' parameter in the request body.");
    }
    return errors;
};

obj.getNewsIdValidation = function(param, paramName, isRequired) {
    let errors = [];
    if (param !== undefined) {
        if (Number.isInteger(Number(param)) === false || Number(param) < 1) {
            let type = (isNaN(Number(param)) === false && param !== "") ? "number" : typeof param;
            errors.push("'" + paramName + "' parameter must be an integer equal to or larger than 1 (you gave " + type + " " + param + ").");
        }
    } else if (isRequired) {
        errors.push("Must provide a " + paramName + " parameter, an integer equal to or larger than 1.");
    }
    return errors;
};

obj.getMultipleNewsIdsValidation = function(params, isRequired) {
    let errors = [];
    // The input params is a list of pastureIDs in string format, separated by comma
    if (params !== undefined) {
        let list  = params.split(",");
        for (let i in list) {
            if (parseInt(list[i]) < 1 || dataValidation.isInteger(list[i]) === false) {
                errors.push("The newsID parameter must be an integer larger or equal to 1. You gave " + list[i] + ".");
            }
        }
    } else if (isRequired === true) {
        errors.push("Must provide the parameter newsID.");
    }

    return errors;
};

module.exports = obj;