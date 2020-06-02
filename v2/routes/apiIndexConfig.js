let reqFile = require.main.require;

let config = reqFile("./config/config.js");
let obj = {};

obj.protocol = "http://";
obj.apiPrefix = "/api/v2";
let env = config.environment;

// The API index page is automatically rendered from the contents of this file.
// To add information about your new web service, follow these steps:
//
//   1 - Defined a new category for your web services
//   2 - Add any URL parameters that your web service accepts
//   3 - Add some example URLs
//   4 - Add an optional blurb for your web service
//   5 - Display a list of valid device types to choose from for this category

// 1. Below, if your new web services already begin with the same string as other
// web services (excluding '/api'), then they already show up in the API index
// page and you can skip this step. Otherwise, create a new category for your
// web services in the "defaultCategoryMap" object below. For example, if your new
// web services are of the form:
//
//      /api/traffic/control_light/.../etc.
//
// ...then you would create a new category like this:
//
//      "traffic": "LoRa Traffic Light Control"
//
obj.defaultCategoryMap = {};

// To separate web services that are grouped together in the above section, you can
// manually place individual web services into their own special category. To do this,
// copy-paste the exact URL stub as it appears in the 'api.js' file (i.e.: without
// the "/api" prefix) and defined your new category to the right. In this way, we
// can keep grouping which already works fine (like /util), and split grouping that
// has too many web services (such as /:scenario_id).
obj.individualCategoryMap = {
    "/generaluser/applications/existingdevices": "Others",
    "/generaluser/applications/datausage":       "Others",
    "/generaluser/applications/createdby":       "Others",
    "/generaluser/applications":                 "Others"
};

// 2. Because the same query parameter might be used by multiple web services, to
// save space we define each unique query parameter here, and then each web service
// can reference the same parameters by calling the function.
function getParamInfo(paramName, isRequired, multipleAllowed) {
    let paramCriteria = {
        generalUserApplicationID: "An integer string between 0 and 9,007,199,254,740,991, inclusive",
        username:                 "must be a string",
        accessRole:               "must be a string",
        genAppID:                 "An integer string between 0 and 9,007,199,254,740,991, inclusive",
        startTime:                "An ISO date string in UTC time (e.g.: yyyy-mm-ddThh:mm:ssZ)",
        endTime:                  "An ISO date string in UTC time (e.g.: yyyy-mm-ddThh:mm:ssZ); Must be equal to or later than startTime",
    };
    let criteria = paramCriteria[paramName];
    if (criteria === undefined) {
        throw new Error("No query parameter with that name found '(" + paramName + "')." +
                        "Please check your spelling in the apiIndexConfig.js file.");
    } else {
        let infoObj = {
            paramName:          paramName,
            criteria:           criteria + ((multipleAllowed) ? ", or a comma-separated list thereof" : ""),
            isRequired:         isRequired,
            multipleAllowed:    multipleAllowed
        };
        // Insert special exceptions when there are name collisions. Ex:
        // if (infoObj.paramName === "aggMode") { infoObj.paramName = "mode"; }
        // if (infoObj.paramName === "dur1To60") { infoObj.paramName = "dur"; }
        return infoObj;
    }
}

// In this section, you can manually specify any query parameters which your web
// service accepts, provide a short description of their data formats, and specify
// whether they are required or optional, and if multiples can be passed, separated
// by commas.
// IMPORTANT: If you want this section to work properly, type each new entry in the
// following format:
//
//   <REQUEST_TYPE + URL_STUB>: [ getParamInfo(<paramName>, <isRequired>, <multipleAllowed>) ]
//
// Type the request type in uppercase (e.g.: GET, PUT, etc.), and copy-paste the
// exact URL stub as it appears in the 'api.js' file (i.e.: excluding the "/api"
// prefix and including any trailing slashes, if they appear).
obj.queryParamsMap = {
    "GET/generaluser/applications/existingdevices": [ getParamInfo("generalUserApplicationID", true, true) ],
    "GET/generaluser/applications/datausage":       [ getParamInfo("genAppID", true, false), getParamInfo("startTime", true, false), getParamInfo("endTime", true, false)],
    "GET/generaluser/applications/createdby":       [ getParamInfo("username", false, false), getParamInfo("accessRole", false, false)],
    "GET/generaluser/applications":                 [ getParamInfo("generalUserApplicationID", false, true)],
    "DELETE/generaluser/applications":              [ getParamInfo("generalUserApplicationID", false, true)],
};

// This section is similar to the above but only for request parameters in the URL
// itself, and not for query parameters in the query string. For these parameters,
// the second argument ('required') should always be set to 'true'.
obj.reqParamsMap = {};

// These are environment-specific example URL parameters that changed based on the current
// environment so that we can give example URLs that work for every environment.
let urlParams = {
    generalUserApplicationID: {
        local:  "342,343,344,345,346",
        test:   "342,343,344,345,346",
        prod:   "342,343,344,345,346",
        prodShanghai: "342,343,344,345,346"
    },
    username: {
        local: "admin_calgary",
        test:  "admin_calgary",
        prod:  "admin_calgary",
        prodShanghai: "admin_calgary"
    },
    accessRole: {
        local: "admin",
        test:  "admin",
        prod:  "admin",
        prodShanghai: "admin"
    }
};

// 3. Specify some URL examples below. Similar to above, type the request type in uppercase
// (e.g.: GET, PUT, etc.), and copy-paste the exact URL stub as it appears in the 'api.js'
// file (i.e.: excluding the "/api" prefix and including any trailing slashes, if they
// appear).
// You can define environment-specific variables within the URL itself by defining your
// variable in the 'urlParams' object above, and accessing it with the current environment,
// 'env'.
obj.urlExamples = {
    "GET/generaluser/applications/existingdevices": [
        "/generaluser/applications/existingdevices?generalUserApplicationID=" + urlParams.generalUserApplicationID[env]
    ],
    "GET/generaluser/applications/createdby": [
        "/generaluser/applications/createdby?username=" + urlParams.username[env] + "&accessRole=" + urlParams.accessRole[env]
    ],
    "GET/generaluser/applications/datausage": [
        "/generaluser/applications/datausage?genAppID=xxx&startTime=2018-04-10T00:00:00Z&endTime=2018-04-10T00:00:00.000Z"
    ],
    "GET/generaluser/applications": [
        "generaluser/applications?generalUserApplicationID=" + urlParams.generalUserApplicationID[env]
    ],
    "DELETE/generaluser/applications": [
        "generaluser/applications?generalUserApplicationID=" + urlParams.generalUserApplicationID[env]
    ]
};

// ESLint ignore below to keep the structure of this file until such time as the section
// below is needed:
let blurbStrs = {}; // eslint-disable-line no-unused-vars

// 4. Specify an optional blurb (i.e.: short sentence / paragraph) about
// your particular web services here, or use a pre-fabricated blurb in the
// "blurbStrs" object above.
obj.blurbs = {};

// 5. These categories' various web services each take device type as input
// in one of their web services, so to be helpful, we will display the list
// of available valid device types to choose from in the current environment.
obj.categoriesWithDevType = [];

module.exports = obj;
