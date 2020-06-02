// This file contains general-purpose date and time data types validation
// functions, and should be renamed to reflect this purpose.

let obj = {};

let validTimeUnits = [
    "hour",
    "day"
];

// This function could be reused by any web service that takes discrete
// fixed time intervals as input (e.g.: hour, day, week, etc.).
obj.isValidTimeUnit = function(inputStr) {
    if (validTimeUnits.includes(inputStr) === false) {
        let msgStr = "'time_unit' parameter must be one of the following: [ ";
        for (let i in validTimeUnits) {
            msgStr += validTimeUnits[i];
            if ((parseInt(i) + 1) !== validTimeUnits.length) {
                msgStr += ", ";
            }
        }
        msgStr += " ]";
        return msgStr;
    } else {
        return true;
    }
};

// This function could be reused by any web service that takes as input a
// start and end time in ISO date string formats.
obj.areValidTimeBounds = function(params) {
    let startTime = new Date(Date.parse(params.start_time));
    let endTime = new Date(Date.parse(params.end_time));
    if (isNaN(Date.parse(params.start_time)) || isNaN(Date.parse(params.end_time))) {
        return "Input dates must be valid UTC ISO date strings in the format 'yyyy-mm-ddThh-mm-ssZ'";
    }

    if (startTime.getMinutes() !== 0 || endTime.getMinutes() !== 0 ||
        startTime.getSeconds() !== 0 || endTime.getSeconds() !== 0 ||
        startTime.getMilliseconds() !== 0 || endTime.getMilliseconds() !== 0) {
        return "Input dates must fall on the boundary between two adjacent time unit blocks";
    }

    if (params.time_unit === "day") {
        if (startTime.getUTCHours() !== endTime.getUTCHours()) {
            return "Input range must be an integer multiple of days (i.e.: 24, 48, 72 hours, etc. )";
        }
    }

    return true;
};

module.exports = obj;
