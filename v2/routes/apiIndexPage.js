let reqFile = require.main.require;

let config = reqFile("./config/config.js");
let apiIndexConfig = require("./apiIndexConfig.js");
let errorResp = reqFile("./common/errorResponse.js");
let consts = reqFile("./config/constants.js");

let apiIndex = {};

apiIndex.serveView = function(req, res, next, api) {
    let DeviceInfo = reqFile("./models/lora/deviceInfo.js")();
    let devTypes = DeviceInfo.distinct("devType", {});
    let viewInfo = {
        environment:    config.environment.replace(/\b\w/g, (a) => { return a.toUpperCase(); }),
        portNum:        (config.displayedPortNum !== undefined) ? config.displayedPortNum : config.expressPortNum,
        httpsPort:      config.httpsPortNum
    };
    let webServices = {};
    
    for (let i in api.stack) {
        let category = apiIndexConfig.individualCategoryMap[api.stack[i].route.path];
        if (category === undefined)
            category = apiIndexConfig.defaultCategoryMap[api.stack[i].route.path.split("/")[1]];
        let url = api.stack[i].route.path;
        let method = api.stack[i].route.stack[0].method.toUpperCase();
        let key = method + api.stack[i].route.path;
        let queryParams = apiIndexConfig.queryParamsMap[key];
        let reqParams = apiIndexConfig.reqParamsMap[key];
        let combinedParams = ((queryParams) ? queryParams : []).concat((reqParams) ? reqParams : []);

        let queryParamsStr = "";
        for (let j in queryParams) {
            queryParamsStr += (j == 0) ? "?" : "&";
            queryParamsStr += queryParams[j].paramName + "=...";
        }
        if (category) {
            if (webServices[category] === undefined)
                webServices[category] = [];
            webServices[category].push({
                url:            apiIndexConfig.apiPrefix + url,
                combinedParams: combinedParams,
                paramsStr:      queryParamsStr,
                method:         method,
                key:            key
            });
        } // Else skip these web services
    }
    viewInfo.webApiVersion =    "v2";
    viewInfo.releaseVersion =   config.currVersion;
    viewInfo.webServices =      webServices;
    viewInfo.protocol =         apiIndexConfig.protocol + config.serverHost;
    viewInfo.apiPrefix =        apiIndexConfig.apiPrefix;
    viewInfo.urlExamples =      apiIndexConfig.urlExamples;
    viewInfo.blurbs =           apiIndexConfig.blurbs;

    devTypes.then((devTypes) => {
        viewInfo.categoriesWithDevType = apiIndexConfig.categoriesWithDevType;
        viewInfo.devTypesInThisEnvironment = (devTypes + "").replace(/,/g, ", ");
        res.render("apiIndexViewV2.ejs", { viewInfo: viewInfo });
    }).catch((err) => {
        logger.error(err);
        let msg = err + "";
        errorResp(res, consts.error.serverErrorLabel, msg, 500);
    });
};

module.exports = apiIndex;
