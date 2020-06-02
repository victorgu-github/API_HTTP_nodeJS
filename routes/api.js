var express = require("express");
var mongoose = require("mongoose");
mongoose.Promise = global.Promise;
var router = express.Router();

let config = require("../config/config.js");
let auth = require("../common/authentication.js");
let track = reqFile("./common/globalUsageTracking.js"); // "track" == global usage tracking
let usageTrack = require("../common/usageTrackingMiddleware.js");

var apeFuncs = require("./routeFunctions/apeFunctions.js");
var userFuncs = require("./routeFunctions/userAcctFunctions.js");
var frontendDeviceFuncs = require("./routeFunctions/frontendDeviceFunctions.js");
var fileUploadFuncs = require("./routeFunctions/fileUploadFunctions.js");
var candidateValsFuncs = require("./routeFunctions/candidateValuesFunctions.js");
let loraGatewayRegFuncs = require("./routeFunctions/loraGatewayRegistFunctions.js");
let loraDeviceOneStepRegGetFuncs = require("./routeFunctions/loraDeviceOneStepRegistGetFunctions.js");
let loraDeviceOneStepRegPostFuncs = require("./routeFunctions/loraDeviceOneStepRegistPostFunctions.js");
let loraDeviceOneStepRegPutFuncs =  require("./routeFunctions/loraDeviceOneStepRegistPutFunctions.js");
let loraDeviceOneStepRegDeleteFuncs = require("./routeFunctions/loraDeviceOneStepRegistDeleteFunctions.js");
let loraDevChanHist = require("./routeFunctions/loraDeviceChannelHistory.js");
let loraDeviceDynamicFuncs = require("./routeFunctions/loraDeviceDynamicFunctions.js");
var tcpGeoDataFuncs = require("./routeFunctions/tcpGeoDataFunctions.js");
let aggRssiDataFuncs = require("./routeFunctions/aggregateRssiData.js");
let loraDevMaintFuncs = require("./routeFunctions/loraDeviceMaintenance.js");
let aggLoraDevFuncs = require("./routeFunctions/aggregateLoraDeviceData.js");
let generalUserApplicationsFunctions = require("./routeFunctions/generalUserApplicationsFunctions.js");
let genUserRegFuncs = require("./routeFunctions/generalUserRegistryFunctions.js");
let utilFuncs = require("./routeFunctions/utilFunctions.js");
let loraMulticastFuncs = require("./routeFunctions/loraMulticastFunctions.js");
let loraDevicePayloadDataFuncs = require("./routeFunctions/loraDevicePayloadDataFunctions.js");
let companyFuncs = require("./routeFunctions/companyFunctions.js");
let bleFunctions = require("./routeFunctions/bleFunctions.js");
let bleNodesFuncs = require("./routeFunctions/bleNodesFunctions.js");
let bleAppFunctions = require("./routeFunctions/bleAppFunctions.js");
let dataUsageFuncs = require("./routeFunctions/dataUsageFunctions.js");
let customParsingFuncs = require("./routeFunctions/loraDeviceCustomParsingFuncs.js");
let bleGatewayFuncs = require("./routeFunctions/bleGatewayRegistrationFunctions.js");

router.get("/", (req, res) => {
    res.send("The API index page has been moved to http://" + config.serverHost + ":" + config.expressPortNum + "/");
});

// ----------------------------- ACTIVE NODES / APE RECORDS -----------------------------------
router.get("/:scenario_id/activenodes",           auth.authenticate, apeFuncs.getActiveNodes, track.logUsage);
router.get("/:scenario_id/activenodes/count",     auth.authenticate, apeFuncs.getNumActiveNodes, track.logUsage);
router.get("/:scenario_id/activenodes/:node_mac", auth.authenticate, apeFuncs.getActiveNodesByMac, track.logUsage);
router.get("/:scenario_id/latest_ape_records",    auth.authenticate, apeFuncs.getLatestApeRecords, track.logUsage);
router.get("/:scenario_id/recent_ape_records/",   auth.authenticate, apeFuncs.getAllRecentApeRecords, track.logUsage);
router.get("/:scenario_id/recent_ape_records/:node_mac", auth.authenticate, apeFuncs.getAllRecentApeRecordsByMac, track.logUsage);

// ----------------------------------- BLE SYSTEM ---------------------------------------------
router.get("/ble/applications/:bleAppID/nodes",     auth.authenticate, bleNodesFuncs.getAllNodes, track.logUsage);
router.post("/ble/applications/:bleAppID/nodes",    auth.authenticate, bleNodesFuncs.registerNewNode, track.logUsage);
router.put("/ble/applications/:bleAppID/nodes",     auth.authenticate, bleNodesFuncs.updateExistingNode, track.logUsage);
router.delete("/ble/applications/:bleAppID/nodes",  auth.authenticate, bleNodesFuncs.deleteExistingNodes, track.logUsage);
router.delete("/ble/applications/:bleAppID/nodes/all",  auth.authenticate, bleNodesFuncs.deleteAllExistingNodes, track.logUsage);
router.get("/ble/applications/:bleAppID/nodes/location", auth.authenticate, bleFunctions.getActiveBleNodes, track.logUsage);
router.get("/ble/applications/:bleAppID/nodes/locationhistory", auth.authenticate, bleFunctions.getBleNodeLocationHistory, track.logUsage);
router.get("/ble/applications/:bleAppID/nodes/location/geocounting", auth.authenticate, bleFunctions.getNumActiveBleNodesInPolygon, track.logUsage);
router.post("/ble/applications/:bleAppID/nodes/csvregister",    auth.authenticate, bleFunctions.registerBleNodes, track.logUsage);
router.put("/ble/applications/:bleAppID/nodes/csvregister", auth.authenticate, bleFunctions.updateBleNodes, track.logUsage);

// -------------------------------- BLE APPLICATION ------------------------------------------
router.get("/ble/applications",           auth.authenticate, bleAppFunctions.getBleApplications, track.logUsage);
router.get("/ble/applications/createdby", auth.authenticate, bleAppFunctions.getBleApplicationsByCreatedBy, track.logUsage);
router.get("/ble/applications/count/createdby", auth.authenticate, bleAppFunctions.getNumDevicesInBleAppsCreatedBy, track.logUsage);
router.get("/ble/applications/count",   auth.authenticate, bleAppFunctions.getNumDevicesInBleApps, track.logUsage);
router.post("/ble/applications",        auth.authenticate, bleAppFunctions.saveBleApplication,   track.logUsage);
router.put("/ble/applications",         auth.authenticate, bleAppFunctions.updateBleApplication, track.logUsage);
router.delete("/ble/applications",      auth.authenticate, bleAppFunctions.deleteBleApplication, track.logUsage);

//--------------------- BLE GATEWAY -----------------------------------------------------------------------
router.get("/ble/gateways",         auth.authenticate, bleGatewayFuncs.getBleGatewayInfo, track.logUsage);
router.post("/ble/gateways",    auth.authenticate, bleGatewayFuncs.saveBleGatewayInfo, track.logUsage);
router.put("/ble/gateways",    auth.authenticate, bleGatewayFuncs.updateBleGatewayInfo, track.logUsage);
router.delete("/ble/gateways", auth.authenticate, bleGatewayFuncs.deleteBleGatewayInfo, track.logUsage);

// ----------------------------- LORA GATEWAY REGISRATION ------------------------------------
router.get("/lora_gw/config",           loraGatewayRegFuncs.getLoRaGateways, track.logUsage);
router.post("/lora_gw/config",          auth.authenticate, loraGatewayRegFuncs.saveLoRaGateway, track.logUsage);
router.put("/lora_gw/config",           auth.authenticate, loraGatewayRegFuncs.updateLoRaGateway, track.logUsage);
router.delete("/lora_gw/config/:gwMAC", auth.authenticate, loraGatewayRegFuncs.deleteLoRaGateway, track.logUsage);

router.get("/lora_device/candidate_values", auth.authenticate, candidateValsFuncs.getLoRaDeviceCandidateValues, track.logUsage);

// ---------------------------------- LORA DEVICE ---------------------------------------------
router.get("/lora_device/devices",      auth.authenticate, loraDeviceOneStepRegGetFuncs.getLoRaDevices, track.logUsage);
router.get("/lora_device/devices/num",  auth.authenticate, loraDeviceOneStepRegGetFuncs.getLoRaDevicesNum, track.logUsage);
router.post("/lora_device/devices",     auth.authenticate, loraDeviceOneStepRegPostFuncs.saveLoRaDevices, track.logUsage);
router.put("/lora_device/devices",      auth.authenticate, loraDeviceOneStepRegPutFuncs.updateLoRaDevices, track.logUsage);
router.delete("/lora_device/devices/:applicationID/:devEUI",   auth.authenticate, loraDeviceOneStepRegDeleteFuncs.deleteLoRaDevices, track.logUsage);
router.post("/lora_device/maintenance/", auth.authenticate, loraDevMaintFuncs.updateStatus, track.logUsage);
router.get("/lora_device/maintenance/latest/appid/:applicationID/dev_eui/:devEUI", auth.authenticate, loraDevMaintFuncs.getStatus, track.logUsage);
router.get("/lora_device/multicastgroups",     auth.authenticate, loraMulticastFuncs.getMulticastSessions, track.logUsage);
router.post("/lora_device/multicastgroups",    auth.authenticate, loraMulticastFuncs.saveMulticastSessions, track.logUsage);
router.put("/lora_device/multicastgroups",     auth.authenticate, loraMulticastFuncs.updateMulticastSessions, track.logUsage);
router.delete("/lora_device/multicastgroups/:applicationID/:multicastAddr",  auth.authenticate, loraMulticastFuncs.deleteMulticastSessions, track.logUsage);
router.get("/lora_device/zmq_payload/appid/:application_id/dev_eui/:dev_eui", auth.authenticate, loraDevicePayloadDataFuncs.getLoRaDevicePayloadData, track.logUsage);
router.get("/loraDevice/channelHistory/appID/:applicationID/devEUI/:devEUIs/start/:startTime/end/:endTime", auth.authenticate, loraDevChanHist.getChannelHistoryForTimeRange, track.logUsage);
router.get("/lora/:applicationID/devices/dynamic", auth.authenticate, loraDeviceDynamicFuncs.getLoRaDeviceDynamic, track.logUsage);
router.get("/lora_device/payload/customparsing",    auth.authenticate,  customParsingFuncs.getCustomPayloadParsingFunction,      track.logUsage);
router.post("/lora_device/payload/customparsing",   auth.authenticate,  customParsingFuncs.createCustomPayloadParsingFunction,   track.logUsage);
router.delete("/lora_device/payload/customparsing", auth.authenticate,  customParsingFuncs.deleteCustomPayloadParsingFunction,   track.logUsage);

// --------------------------- DEVICE CONTROL / DEVICE DATA -----------------------------------
router.get("/lora/:devicetype/:application_id/currentstatus",   auth.authenticate, frontendDeviceFuncs.getDeviceStatus, usageTrack.devCtrlAndDataTracking, track.logUsage);
router.get("/lora/:devicetype/:application_id/numdevices",      auth.authenticate, frontendDeviceFuncs.getNumDevices, usageTrack.devCtrlAndDataTracking, track.logUsage);
router.get("/lora/:devicetype/:application_id/latest_usage",    auth.authenticate, frontendDeviceFuncs.getLatestDeviceData, usageTrack.devCtrlAndDataTracking, track.logUsage);
router.get("/lora/:devicetype/:application_id/recent_usage",    auth.authenticate, frontendDeviceFuncs.getRecentDeviceData, usageTrack.devCtrlAndDataTracking, track.logUsage);
router.get("/lora/:devicetype/:application_id/:human_command",  auth.authenticate, frontendDeviceFuncs.ctrlDevice, usageTrack.devCtrlAndDataTracking, track.logUsage);
router.get("/lora/:application_id/dev_eui/:dev_eui/deviceStatus", auth.authenticate, frontendDeviceFuncs.getTotalDevicesInfo, usageTrack.devCtrlAndDataTracking, track.logUsage);
router.get("/lora/:application_id/deviceStatus", auth.authenticate, frontendDeviceFuncs.getTotalDevicesInfoForMultipleDevices, usageTrack.devCtrlAndDataTracking, track.logUsage);

// ------------------------------ AGGREGATED RSSI DATA ----------------------------------------
router.get("/lora/rssi/aggregated_data/time_unit/:time_unit",   auth.authenticate, aggRssiDataFuncs.getLatestAggRssiData, track.logUsage);
router.get("/lora/rssi/aggregated_data/time_unit/:time_unit/start/:start_time/end/:end_time", auth.authenticate, aggRssiDataFuncs.getAggRssiDataForTimeRange, track.logUsage);
router.get("/lora/devicetype/:devicetype/application_id/:application_id/aggregated_data", auth.authenticate, aggLoraDevFuncs.getLoraDevAggrData, track.logUsage, track.logUsage);

// ------------------------------ General User Applications -----------------------------------
router.get("/generaluserapplication", auth.authenticate, generalUserApplicationsFunctions.getUserApplication, track.logUsage);
router.get("/generaluserapplication/createdBy", auth.authenticate, generalUserApplicationsFunctions.getUserApplicationByCreatedBy, track.logUsage);
router.get("/generaluserapplication/lora", auth.authenticate, generalUserApplicationsFunctions.getUserAppByLoraAppID, track.logUsage);
router.get("/generaluserapplication/exist_device", auth.authenticate, generalUserApplicationsFunctions.getUserAppForExistDev, track.logUsage);
router.post("/generaluserapplication", auth.authenticate, generalUserApplicationsFunctions.saveUserApplication, track.logUsage);
router.put("/generaluserapplication", auth.authenticate, generalUserApplicationsFunctions.updateUserApplication, track.logUsage);
router.delete("/generaluserapplication", auth.authenticate, generalUserApplicationsFunctions.deleteUserApplication, track.logUsage);

// ------------------------ General User Registry / LOGIN---------------------------------------
router.get("/generaluser",              auth.authenticate,  genUserRegFuncs.getUserAccounts, track.logUsage);
router.get("/generaluser/datausage",    auth.authenticate,  dataUsageFuncs.getUserDataUsage, track.logUsage);
router.post("/generaluserregistry",                         genUserRegFuncs.saveUserAccount);
router.put("/generaluserregistry",      auth.authenticate,  genUserRegFuncs.updateUserAccount, track.logUsage);
router.delete("/generaluserregistry",   auth.authenticate,  genUserRegFuncs.deleteUserAccount, track.logUsage);
router.post("/generaluserlogin",                            genUserRegFuncs.loginUserAccount);

// ---------------------------------- COMPANY INFO --------------------------------------------
router.get("/companyInfo",  companyFuncs.getCompanyInfo, track.logUsage);

// --------------------- User ACCOUNT CREATION / LOGIN / OPERATIONS --------------------------
// The login functions are the only ones that don't have authentication middleware
router.post("/adminuserlogin",       userFuncs.userLogin, track.logUsage);
router.post("/adminuserregister",    userFuncs.userRegister, track.logUsage);

// ------------------------------------- UTILITES ---------------------------------------------
// The following two web services are unsecured because they're just utility tools with no chance of containing
// sensitive data.
router.get("/util/manufacturing/lora/device",           utilFuncs.downloadManufacturerSettingsCSV,  track.logUsage);
router.get("/util/manufacturing/lora/device/multicast", utilFuncs.downloadMulticastSettingsCSV,     track.logUsage);

// ------------------------------ R&D FILE UPLOAD ---------------------------------------------
router.post("/content/gateway/upload",      auth.authenticate, fileUploadFuncs.uploadFile, track.logUsage);
router.get("/content/gateway",              auth.authenticate, fileUploadFuncs.getListOfFiles, track.logUsage);
router.get("/content/gateway/:reqfilename", auth.authenticate, fileUploadFuncs.downloadFile, track.logUsage);
router.get("/content/loraDevice/:reqfilename", auth.authenticate, fileUploadFuncs.downloadBatchFile, track.logUsage);

// -------------------------------- R&D GATEWAYS ----------------------------------------------
router.get("/:scenario_id/latest_gw_records/",                  auth.authenticate, apeFuncs.getLatestGatewayRecords, track.logUsage);
router.get("/:scenario_id/latest_gw_records/mac/:gw_mac",       auth.authenticate, apeFuncs.getLatestGatewayRecordsByMac, track.logUsage);
router.get("/:scenario_id/latest_gw_records/sens/:sensor_type", auth.authenticate, apeFuncs.getLatestGatewayRecordsBySensorType, track.logUsage);
router.get("/:scenario_id/recent_gw_records/",                  auth.authenticate, apeFuncs.getRecentGatewayRecords, track.logUsage);
router.get("/:scenario_id/recent_gw_records/mac/:gw_mac",       auth.authenticate, apeFuncs.getRecentGatewayRecordsByMac, track.logUsage);
router.get("/:scenario_id/recent_gw_records/sens/:sensor_type", auth.authenticate, apeFuncs.getRecentGatewayRecordsBySensor, track.logUsage);
router.get("/:scenario_id/recent_gw_records/mac/:gw_mac/sens/:sensor_type", auth.authenticate, apeFuncs.getRecentGatewayRecordsByMacAndSensor, track.logUsage);

// --------------------------- R&D TCP SERVER GEO DATA ----------------------------------------
router.get("/tcp/latest_tcp_geo_data",  auth.authenticate, tcpGeoDataFuncs.getLatestTcpGeoData, track.logUsage);

module.exports = router;
