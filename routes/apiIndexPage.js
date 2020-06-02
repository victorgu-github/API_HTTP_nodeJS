let config = require("../config/config.js");
let apiIndexConfig = require("./apiIndexConfig.js");
let errorResp = require("../common/errorResponse.js");
let consts = require("../config/constants.js");

let apiIndex = {};

apiIndex.serveView = function(req, res, next, api, mengyang, anyue) {
    let DeviceInfo = require("../models/lora/deviceInfo.js")();
    let devTypes = DeviceInfo.distinct("devType", {});
    let viewInfo = {
        environment:    config.environment.replace(/\b\w/g, (a) => { return a.toUpperCase(); }),
        portNum:        (config.displayedPortNum !== undefined) ? config.displayedPortNum : config.expressPortNum,
        httpsPort:      config.httpsPortNum
    };
    let webServices = {};

    let fullApiStack = [];
    // Add /mengyang web services
    for (let field in mengyang.stack) {
        fullApiStack.push({
            path:   "/mengyang" + mengyang.stack[field].route.path,
            method: mengyang.stack[field].route.stack[0].method.toUpperCase()
        });
    }
    // Add /anyue web services
    for (let field in anyue.stack) {
        fullApiStack.push({
            path:   "/anyue" + anyue.stack[field].route.path,
            method: anyue.stack[field].route.stack[0].method.toUpperCase()
        });
    }
    for (let field in api.stack) {
        fullApiStack.push({
            path:   api.stack[field].route.path,
            method: api.stack[field].route.stack[0].method.toUpperCase()
        });
    }
    // let apiStack = Object.assign(api.stack, mengyang.stack);
    for (let i in fullApiStack) {
        let category = apiIndexConfig.individualCategoryMap[fullApiStack[i].path];
        if (category === undefined)
            category = apiIndexConfig.defaultCategoryMap[fullApiStack[i].path.split("/")[1]];
        let url = fullApiStack[i].path;
        let method = fullApiStack[i].method;
        let key = method + fullApiStack[i].path;
        let queryParams = apiIndexConfig.queryParamsMap[key];
        let reqParams = apiIndexConfig.reqParamsMap[key];
        let combinedParams = ((reqParams) ? reqParams : []).concat((queryParams) ? queryParams : []);

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
    viewInfo.webApiVersion =    "v1";
    viewInfo.releaseVersion =   config.currVersion;
    viewInfo.webServices =      webServices;
    viewInfo.protocol =         apiIndexConfig.protocol + config.serverHost;
    viewInfo.apiPrefix =        apiIndexConfig.apiPrefix;
    viewInfo.urlExamples =      apiIndexConfig.urlExamples;
    viewInfo.blurbs =           apiIndexConfig.blurbs;

    devTypes.then((devTypes) => {
        viewInfo.categoriesWithDevType = apiIndexConfig.categoriesWithDevType;
        viewInfo.devTypesInThisEnvironment = (devTypes + "").replace(/,/g, ", ");
        res.render("apiIndexView.ejs", { viewInfo: viewInfo });
    }).catch((err) => {
        logger.error(err);
        let msg = err + "";
        errorResp(res, consts.error.serverErrorLabel, msg, 500);
    });
};

module.exports = apiIndex;
