let config = require("../config/config.js");
let obj = {};

obj.protocol = "http://";
obj.apiPrefix = "/api";
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
obj.defaultCategoryMap = {
    "mengyang":                 "Mengyang",
    "anyue":                    "Anyue",
    ":scenario_id":             "APE Records",

    "lora_device":              "LoRa Device",
    "loraDevice":               "LoRa Device",

    "lora_gw":                  "LoRa Gateway Registration",

    "lora":                     "LoRa Device Control and Device Data",
    "content":                  "R&D File Upload / Download",
    "tcp":                      "R&D TCP Geo Data",

    "adminuserlogin":           "User Accounts",
    "adminuserregister":        "User Accounts",
    "admin":                    "User Accounts",
    "registerdevice":           "User Accounts",
    "generaluserapplication":   "User Accounts",

    "companyInfo":              "Others",

    "util":                     "LoRa Utilities",
    "generaluserregistry":      "User Accounts",
    "generaluserlogin":         "User Accounts",
    "generaluser":              "User Accounts",

    "ble":                      "BLE System"
};

// To separate web services that are grouped together in the above section, you can
// manually place individual web services into their own special category. To do this,
// copy-paste the exact URL stub as it appears in the 'api.js' file (i.e.: without
// the "/api" prefix) and defined your new category to the right. In this way, we
// can keep grouping which already works fine (like /util), and split grouping that
// has too many web services (such as /:scenario_id).
obj.individualCategoryMap = {
    // LoRa Device:
    "/lora/:applicationID/devices/dynamic": "LoRa Device",

    // Gateway Records:
    "/:scenario_id/latest_gw_records/":                     "R&D BLE Gateway Records",
    "/:scenario_id/latest_gw_records/mac/:gw_mac":          "R&D BLE Gateway Records",
    "/:scenario_id/latest_gw_records/sens/:sensor_type":    "R&D BLE Gateway Records",
    "/:scenario_id/recent_gw_records/":                     "R&D BLE Gateway Records",
    "/:scenario_id/recent_gw_records/mac/:gw_mac":          "R&D BLE Gateway Records",
    "/:scenario_id/recent_gw_records/sens/:sensor_type":    "R&D BLE Gateway Records",
    "/:scenario_id/recent_gw_records/mac/:gw_mac/sens/:sensor_type": "R&D BLE Gateway Records",

    // RSSI History Aggregation:
    "/lora/rssi/aggregated_data/time_unit/:time_unit":      "LoRa Data Aggregation",
    "/lora/rssi/aggregated_data/time_unit/:time_unit/start/:start_time/end/:end_time": "LoRa Data Aggregation",
    "/lora/devicetype/:devicetype/application_id/:application_id/aggregated_data": "LoRa Data Aggregation",

    // Maintenance:
    "/lora_device/maintenance/":                            "LoRa Device Maintenance",
    "/lora_device/maintenance/latest/appid/:applicationID/dev_eui/:devEUI": "LoRa Device Maintenance",

    // Multicast:
    "/lora_device/multicastgroups":                                 "LoRa Multicast Group",
    "/lora_device/multicastgroups/:applicationID/:multicastAddr":   "LoRa Multicast Group",

    // Others:
    "/generaluserapplication":              "Others",
    "/generaluserapplication/createdBy":    "Others",
    "/generaluserapplication/lora":         "Others",
    "/generaluserapplication/exist_device": "Others"

};

// 2. Because the same query parameter might be used by multiple web services, to
// save space we define each unique query parameter here, and then each web service
// can reference the same parameters by calling the function.
function getParamInfo(paramName, isRequired, multipleAllowed) {
    let paramCriteria = {
        mac:        "A 12-character, colon-separated uppercase hex string (e.g.: AA:BB:CC:11:22:33)",
        dur:        "Positive integer string (e.g.: 30, 60, 120)",
        deviceType: "The device type string as it appears in the 'device_info' collection (e.g.: " +
                    "'plugbase', 'smokedetector', etc.)",
        applicationID: "An integer string between 0 and 9,007,199,254,740,991, inclusive",
        devType:    "The device type string as it appears in the 'device_info' collection (e.g.: " +
                    "'plugbase', 'smokedetector', etc.)",
        duration:   "An integer between 1 and 24, inclusive",
        dev_eui:    "A 16-digit hexadecimal string",
        deveui:     "A 16-digit hexadecimal string",
        devEUI:     "A 16-digit hexadecimal string",
        devEUIs:    "A 16-digit hexadecimal string",
        mode:       "One of the following strings: 'continuous' or 'scatter'",
        relayNum:   "An integer between 1 and 3, inclusive",
        generalUserApplicationID: "An integer string between 0 and 9,007,199,254,740,991, inclusive",
        loraAppID:  "An integer string between 0 and 9,007,199,254,740,991, inclusive",
        userName:   "A string with a minimum length of 6 characters",
        geometry:   "A valid strinfified geoJSON object",
        spatialoperation: "A string representing the spatial operation type (e.g.: 'geoWithin')",
        aggMode:    "One of the following strings: 'lasthour' or 'lastday'",
        namePrefix: "Any valid string",
        startNum:   "Integer between 1 and 9,999, and where startNum + numDevices <= 10,000",
        numDevices: "Integer between 1 and 10,000",
        deviceMode: "String with one of the following values: 'OTAA' or 'ABP'",
        multicastAddr: "8-character hex string",
        companyID:  "An integer string greater than or equal to zero",
        username:   "A string with a minimum length of 6 characters",
        accessRole: "A string representing a user's access role, either 'admin' or 'general'",
        gwMAC:      "A 16-digit hexadecimal string",
        dur1To60:   "Positive integer string between 1 and 60",
        macAddress: "A 12-digit hex string representing the device's MAC address (e.g.: B0B448EB5403)",
        startTime:  "An ISO date string in UTC time (e.g.: yyyy-mm-ddThh:mm:ssZ)",
        endTime:    "An ISO date string in UTC time (e.g.: yyyy-mm-ddThh:mm:ssZ); Must be equal to or later than startTime",
        endTime24h: "An ISO date string in UTC time (e.g.: yyyy-mm-ddThh:mm:ssZ); Must be equal to or later than startTime, and no more than 24h away",
        bleAppID:   "An integer between 1 and 9,999, inclusive",
        whereClause:    "A string representing an Esri ArcGIS Server query string (e.g.: \"polygonid='1603' or polygonid='1604'\"). Cannot contain double quotes.",
        layerURL:   "The full URL of the ArcGIS Server services layer, beginning with 'http://' (/services/Hosted/Mengyang_Prod/FeatureServer/1)",
        pastureID:  "An integer between 1 and 9,999 (inclusive)",
        mengyangID: "A string containing an ID",
        mengyangID2: "A string containing an ID",
        vaccinationID: "A positive integer larger than or equal to 1",
        from:   "An ISO date string in UTC time (e.g.: yyyy-mm-ddThh:mm:ssZ)",
        to:     "An ISO date string in UTC time (e.g.: yyyy-mm-ddThh:mm:ssZ)",
        newsID: "A positive integer larger than or equal to 1",
        maleSheepID: "A string containing an ID, should be an unique value in its own category",
        femaleSheepID: "A string containing an ID, should be an unique value in its own category",
        femaleSheepID2: "A string containing an ID, should be an unique value in its own category"
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
        // Special exceptions below as there are name collisions:
        if (infoObj.paramName === "aggMode") { infoObj.paramName = "mode"; }
        if (infoObj.paramName === "dur1To60") { infoObj.paramName = "dur"; }
        if (infoObj.paramName === "endTime24h") { infoObj.paramName = "endTime"; }
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
    // --------------------------------- Mengyang ------------------------------------
    "GET/mengyang/pasture/general": [
        getParamInfo("pastureID", true, true),
    ],
    "GET/mengyang/pasture/:pastureID/sheep": [
        getParamInfo("mengyangID", false, true),
        getParamInfo("mengyangID2", false, true)
    ],
    "DELETE/mengyang/pasture/:pastureID/sheep": [
        getParamInfo("mengyangID", false, true),
        getParamInfo("mengyangID2", false, true)
    ],
    "GET/mengyang/pasture/:pastureID/sheepvaccination": [
        getParamInfo("vaccinationID", false, true)
    ],
    "DELETE/mengyang/pasture/:pastureID/sheepvaccination": [
        getParamInfo("vaccinationID", true, true)
    ],
    "GET/mengyang/pasture/:pastureID/sheepclinic": [
        getParamInfo("mengyangID", false, true),
        getParamInfo("mengyangID2", false, true)
    ],
    "GET/mengyang/news":[
        getParamInfo("pastureID", false, true),
        getParamInfo("from", false, false),
        getParamInfo("to", false, false),
    ],
    "DELETE/mengyang/news": [
        getParamInfo("newsID", true, true)],
    "GET/mengyang/pasture/:pastureID/sheephybridization": [
        getParamInfo("pastureID",true, false),
        getParamInfo("maleSheepID", false, true),
        getParamInfo("femaleSheepID", false, true),
        getParamInfo("femaleSheepID2", false, true)
    ],
    // -------------------------- APE / Gateway Records ------------------------------
    "GET/:scenario_id/latest_ape_records":                  [ getParamInfo("mac", false, false) ],
    "GET/:scenario_id/recent_ape_records/":                 [ getParamInfo("dur", false, false) ],
    "GET/:scenario_id/recent_ape_records/:node_mac":        [ getParamInfo("dur", false, false) ],
    "GET/:scenario_id/recent_gw_records/":                  [ getParamInfo("dur", false, false) ],
    "GET/:scenario_id/recent_gw_records/mac/:gw_mac":       [ getParamInfo("dur", false, false) ],
    "GET/:scenario_id/recent_gw_records/sens/:sensor_type": [ getParamInfo("dur", false, false) ],
    "GET/:scenario_id/recent_gw_records/mac/:gw_mac/sens/:sensor_type": [ getParamInfo("dur", false, false) ],

    // -------------------------- LORA GATEWAY REGISTRATION --------------------------
    "GET/lora_gw/config": [ getParamInfo("gwMAC", false, true) ],

    // --------------------------------- LORA DEVICE ---------------------------------
    "GET/lora_device/devices":      [
        getParamInfo("applicationID", true, true),
        getParamInfo("deviceType", false, false)
    ],
    "GET/lora_device/devices/num":  [
        getParamInfo("applicationID", true, true),
        getParamInfo("deviceType", false, false)
    ],
    "GET/lora/:applicationID/devices/dynamic": [
        getParamInfo("devEUIs", true, true)
    ],
    "GET/lora_device/payload/customparsing": [
        getParamInfo("devType", false, false)
    ],
    "DELETE/lora_device/payload/customparsing": [
        getParamInfo("devType", true, false)
    ],

    // --------------------------- MULTICAST REGISTRATION ----------------------------
    "GET/lora_device/multicastgroups": [
        getParamInfo("applicationID", true, true),
        getParamInfo("devType", false, false)
    ],
    "GET/lora_device/zmq_payload/appid/:application_id/dev_eui/:dev_eui": [ getParamInfo("duration", false, false) ],

    // --------------------------- FRONTEND DEVICE CONTROL ---------------------------
    "GET/lora/:devicetype/:application_id/currentstatus":   [ getParamInfo("dev_eui", false, false) ],
    "GET/lora/:devicetype/:application_id/latest_usage":    [ getParamInfo("dev_eui", false, false) ],
    "GET/lora/:devicetype/:application_id/recent_usage":    [
        getParamInfo("dev_eui", true, false),
        getParamInfo("dur", false, false),
        getParamInfo("mode", false, false)
    ],
    "GET/lora/:devicetype/:application_id/:human_command":  [
        getParamInfo("dev_eui", true, true),
        getParamInfo("relayNum", true, false)
    ],
    "GET/lora/:application_id/deviceStatus": [ getParamInfo("devEUIs", true, true) ],
    "GET/lora/devicetype/:devicetype/application_id/:application_id/aggregated_data": [
        getParamInfo("deveui", false, true),
        getParamInfo("aggMode", false, false)
    ],

    // ------------------------- USER REGISTRATION / LOGIN ---------------------------
    "GET/generaluser":                          [
        getParamInfo("companyID", false, true),
        getParamInfo("userName", false, false)
    ],
    "GET/generaluser/datausage": [
        getParamInfo("startTime", true, false),
        getParamInfo("endTime", true, false)
    ],
    "GET/generaluserapplication":               [ getParamInfo("generalUserApplicationID", true, true) ],
    "GET/generaluserapplication/createdBy":     [
        getParamInfo("username", false, false),
        getParamInfo("accessRole", false, false)
    ],
    "GET/generaluserapplication/exist_device":  [ getParamInfo("generalUserApplicationID", true, true) ],
    "DELETE/generaluserapplication":            [ getParamInfo("generalUserApplicationID", true, true) ],
    "GET/generaluserapplication/lora":          [ getParamInfo("loraAppID", true, true) ],

    // ------------------------- USER REGISTRATION / LOGIN ---------------------------
    "DELETE/generaluserregistry": [ getParamInfo("userName", true, true) ],

    // ------------------------------- TCP GEO DATA ----------------------------------
    "GET/tcp/latest_tcp_geo_data": [
        getParamInfo("geometry", false, false),
        getParamInfo("spatialoperation", true, false), // TODO: Only required when req.query.geometry is defined
        getParamInfo("dur", false, false)
    ],

    // --------------------------------- UTILITIES -----------------------------------
    "GET/util/manufacturing/lora/device": [
        getParamInfo("namePrefix", true, false),
        getParamInfo("startNum", true, false),
        getParamInfo("numDevices", true, false),
        getParamInfo("deviceMode", true, false)
    ],
    "GET/util/manufacturing/lora/device/multicast": [
        getParamInfo("multicastAddr", true, false),
        getParamInfo("applicationID", true, false),
        getParamInfo("namePrefix", true, false),
        getParamInfo("startNum", true, false),
        getParamInfo("numDevices", true, false),
        getParamInfo("deviceMode", true, false)
    ],

    // --------------------------------- BLE SYSTEM ----------------------------------
    "GET/ble/applications/:bleAppID/nodes": [
        getParamInfo("macAddress", false, true)
    ],
    "DELETE/ble/applications/:bleAppID/nodes": [
        getParamInfo("macAddress", true, true)
    ],
    "GET/ble/applications/:bleAppID/nodes/location": [
        getParamInfo("macAddress", false, true)
    ],
    "GET/ble/applications/:bleAppID/nodes/locationhistory": [
        getParamInfo("macAddress", true, false),
        getParamInfo("startTime", true, false),
        getParamInfo("endTime24h", true, false)
    ],
    "GET/ble/applications/:bleAppID/nodes/location/geocounting": [
        getParamInfo("whereClause", true, false),
        getParamInfo("layerURL", true, false),
        getParamInfo("macAddress", false, true),
        getParamInfo("dur1To60", false, false)
    ],
    "GET/ble/applications": [
        getParamInfo("bleAppID", true, true)
    ],
    "GET/ble/applications/createdby": [
        getParamInfo("username", false, false),
        getParamInfo("accessRole", false, false)
    ],
    "GET/ble/applications/count/createdby": [
        getParamInfo("username", false, false),
        getParamInfo("accessRole", false, false)
    ],
    "GET/ble/applications/count": [
        getParamInfo("bleAppID", false, true)
    ],
    "DELETE/ble/applications":  [ 
        getParamInfo("bleAppID", true, true) 
    ],
    "GET/ble/gateways":   [
        getParamInfo("macAddress",false, true)
    ],
    "DELETE/ble/gateways":   [
        getParamInfo("macAddress",true, true)
    ]
    
    
};

// This section is similar to the above but only for request parameters in the URL
// itself, and not for query parameters in the query string. For these parameters,
// the second argument ('required') should always be set to 'true'.
obj.reqParamsMap = {
    // --------------------------------- Mengyang ------------------------------------
    "GET/mengyang/pasture/:pastureID/sheep": [
        getParamInfo("pastureID", true, false)
    ],
    "POST/mengyang/pasture/:pastureID/sheep": [
        getParamInfo("pastureID", true, false)
    ],
    "PUT/mengyang/pasture/:pastureID/sheep": [
        getParamInfo("pastureID", true, false)
    ],
    "DELETE/mengyang/pasture/:pastureID/sheep": [
        getParamInfo("pastureID", true, false)
    ],
    "POST/mengyang/pasture/:pastureID/sheep/csvregister": [
        getParamInfo("pastureID", true, false)
    ],
    "GET/mengyang/pasture/:pastureID/sheepvaccination": [
        getParamInfo("pastureID", true, false)
    ],
    "POST/mengyang/pasture/:pastureID/sheepvaccination": [
        getParamInfo("pastureID", true, false)
    ],
    "PUT/mengyang/pasture/:pastureID/sheepvaccination": [
        getParamInfo("pastureID", true, false)
    ],
    "DELETE/mengyang/pasture/:pastureID/sheepvaccination": [
        getParamInfo("pastureID", true, false)
    ],
    "POST/mengyang/pasture/:pastureID/sheepvaccination/csvregister": [
        getParamInfo("pastureID", true, false)
    ],
    "GET/mengyang/news":[],
    "POST/mengyang/news":[],
    "PUT/mengyang/news":[],
    "DELETE/mengyang/news":[],
    // ---------------------------------- Anyue --------------------------------------
    "GET/anyue/lora/:applicationID/charginglotstatus": [
        getParamInfo("applicationID", true, false),
    ],
    // --------------------------------- LORA DEVICE ---------------------------------
    "GET/loraDevice/channelHistory/appID/:applicationID/devEUI/:devEUIs/start/:startTime/end/:endTime": [
        getParamInfo("applicationID", true, false),
        getParamInfo("devEUIs", true, true),
        getParamInfo("startTime", true, false),
        getParamInfo("endTime", true, false)
    ],
    "GET/lora/:applicationID/devices/dynamic": [
        getParamInfo("applicationID", true, false)
    ],

    // --------------------------------- BLE SYSTEM ----------------------------------
    "GET/ble/applications/:bleAppID/nodes": [
        getParamInfo("bleAppID", true, false)
    ],
    "POST/ble/applications/:bleAppID/nodes": [
        getParamInfo("bleAppID", true, false)
    ],
    "PUT/ble/applications/:bleAppID/nodes": [
        getParamInfo("bleAppID", true, false)
    ],
    "DELETE/ble/applications/:bleAppID/nodes": [
        getParamInfo("bleAppID", true, false),
    ],
    "GET/ble/applications/:bleAppID/nodes/location": [
        getParamInfo("bleAppID", true, false)
    ],
    "GET/ble/applications/:bleAppID/nodes/locationhistory": [
        getParamInfo("bleAppID", true, false)
    ],
    "GET/ble/applications/:bleAppID/nodes/location/geocounting": [
        getParamInfo("bleAppID", true, false)
    ],
    "POST/ble/applications/:bleAppID/nodes/csvregister": [
        getParamInfo("bleAppID", true, false)
    ],
    "PUT/ble/applications/:bleAppID/nodes/csvregister": [
        getParamInfo("bleAppID", true, false)
    ]
};

// These are environment-specific example URL parameters that changed based on the current
// environment so that we can give example URLs that work for every environment.
let urlParams = {
    scenarioID: {
        local:  1,
        test:   1,
        prod:   9,
        prodShanghai: 1
    },
    gw_mac: {
        local:  "5C:31:3E:06:88:BD",
        test:   "5C:31:3E:06:88:BD",
        prod:   "5C:31:3E:06:88:BD",
        prodShanghai: "5C:31:3E:06:88:BD"
    },
    devicesAppID: {
        local:  "3",
        test:   "8",
        testShanghai: "5",
        prod:   "1",
        prodShanghai: "9"
    },
    devicesMultAppID: {
        local:  "2,3,4",
        test:   "5,6,8",
        prod:   "1,2,3",
        prodShanghai: "7,9"
    },
    bleNodeMAC: {
        local:  "B0B448EB5403",
        test:   "B0B448EB5403",
        prod:   "B0B448EB5403",
        prodShanghai: "B0B448EB5403"
    },
    bleNodeMACs: {
        local:  "B0B448EB5403,B0B448EC3904",
        test:   "B0B448EB5403,B0B448EC3904",
        prod:   "B0B448EB5403,B0B448EC3904",
        prodShanghai: "B0B448EB5403,B0B448EC3904"
    },
    devEUI: {
        local:  "393338334A348403",
        test:   "393338334A348403",
        prod:   "393338334A348403",
        prodShanghai: "393338334A348403"
    },
    devEUIsForDynamic: {
        local:  "303637335A379301,3036373376377802",
        test:   "303637335A379301,3036373376377802",
        prod:   "303637335A379301,3036373376377802",
        prodShanghai: "303637335A379301,3036373376377802"
    },
    appIdForDynamic: {
        local:  "3",
        test:   "5",
        prod:   "1",
        prodShanghai: "9"
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
    // Mengyang:
    "GET/mengyang/pasture/general": [
        "/mengyang/pasture/general?pastureID=1",
        "/mengyang/pasture/general?pastureID=1,2,3,4,5"
    ],
    "GET/mengyang/pasture/:pastureID/sheep": [
        "/mengyang/pasture/1/sheep",
        "/mengyang/pasture/1/sheep?mengyangID=AAAA",
        "/mengyang/pasture/1/sheep?mengyangID=AAAA,BBBB",
        "/mengyang/pasture/1/sheep?mengyangID=AAAA&mengyangID2=CCCC",
        "/mengyang/pasture/1/sheep?mengyangID=AAAA,BBBB&mengyangID2=CCCC"
    ],
    "DELETE/mengyang/pasture/:pastureID/sheep": [
        "/mengyang/pasture/1/sheep?mengyangID=AAAA",
        "/mengyang/pasture/1/sheep?mengyangID=AAAA&mengyangID2=BBBB",
        "/mengyang/pasture/1/sheep?mengyangID2=BBBB"
    ],
    "GET/mengyang/pasture/:pastureID/sheepvaccination": [
        "/mengyang/pasture/1/sheepvaccination",
        "/mengyang/pasture/1/sheepvaccination?vaccinationID=23",
        "/mengyang/pasture/1/sheepvaccination?vaccinationID=23,24"
    ],
    "DELETE/mengyang/pasture/:pastureID/sheepvaccination": [
        "/mengyang/pasture/1/sheepvaccination?vaccinationID=23",
        "/mengyang/pasture/1/sheepvaccination?vaccinationID=23,24"
    ],
    "GET/mengyang/pasture/:pastureID/sheepclinic": [
        "/mengyang/pasture/1/sheepclinic?mengyangID=AAAA",
        "/mengyang/pasture/1/sheepclinic?mengyangID=AAAA&mengyangID2=BBBB,CCCC",
    ],
    "GET/mengyang/news": [
        "/mengyang/news",
        "/mengyang/news?pastureID=1",
        "/mengyang/news?pastureID=1&from=2018-02-02T00:00:00Z",
        "/mengyang/news?from=2018-02-02T00:00:00Z&to=2018-02-12T00:00:00Z"
    ],
    "DELETE/mengyang/news":[
        "/mengyang/news?newsID=1",
        "/mengyang/news?newsID=1,2,3"
    ],
    "GET/mengyang/pasture/:pastureID/sheephybridization": [
        "/mengyang/pasture/:pastureID/sheephybridization",
        "/mengyang/pasture/:pastureID/sheephybridization?maleSheepID=AABB",
        "/mengyang/pasture/:pastureID/sheephybridization?femaleSheepID=CCDD&femaleSheepID2=DDEE",
        "/mengyang/pasture/:pastureID/sheephybridization?maleSheepID=AABB&femaleSheepID=CCDD&femaleSheepID2=DDEE",
        "/mengyang/pasture/:pastureID/sheephybridization?maleSheepID=AABB&femaleSheepID2=DDEE",
        "/mengyang/pasture/:pastureID/sheephybridization?maleSheepID=AABB&femaleSheepID=CCDD"
    ],
    // Anyue:
    "GET/anyue/lora/:applicationID/charginglotstatus": [
        "/anyue/lora/1/charginglotstatus"
    ],
    // APE & Gateway Records:
    "GET/:scenario_id/activenodes":         [ "/" + urlParams.scenarioID[env] + "/activenodes" ],
    "GET/:scenario_id/latest_ape_records":  [ "/" + urlParams.scenarioID[env] + "/latest_ape_records" ],
    "GET/:scenario_id/recent_ape_records/": [ "/" + urlParams.scenarioID[env] + "/recent_ape_records?dur=10" ],
    "GET/:scenario_id/recent_gw_records/mac/:gw_mac/sens/:sensor_type": [
        "/" + urlParams.scenarioID[env] + "/recent_gw_records/mac/XX:XX:XX:XX:XX:XX/sens/qual_sensor?dur=30"
    ],

    // LoRa Gateway Registration:
    "GET/lora_gw/config": [
        "/lora_gw/config",
        "/lora_gw/config?gwMAC=XXXXXXXXXXXXXXXX,YYYYYYYYYYYYYYYY"
    ],

    // LoRa Device:
    "GET/lora_device/candidate_values": [ "/lora_device/candidate_values" ],
    "GET/lora_device/devices": [
        "/lora_device/devices?applicationID=" + urlParams.devicesAppID[env],
        "/lora_device/devices?applicationID=" + urlParams.devicesAppID[env] + "&deviceType=streetlight",
        "/lora_device/devices?applicationID=" + urlParams.devicesMultAppID[env]
    ],
    "GET/lora_device/zmq_payload/appid/:application_id/dev_eui/:dev_eui": [
        "/lora_device/zmq_payload/appid/" + urlParams.devicesAppID[env] + "/dev_eui/XXXXXXXXXXXXXXXX"
    ],
    "GET/loraDevice/channelHistory/appID/:applicationID/devEUI/:devEUIs/start/:startTime/end/:endTime": [
        "/loraDevice/channelHistory/appID/" + urlParams.devicesAppID[env] +
        "/devEUI/XXXXXXXXXXXXXXXX/start/2018-03-15T16:00:00Z/end/2018-03-15T17:00:00Z",
        "/loraDevice/channelHistory/appID/" + urlParams.devicesAppID[env] +
        "/devEUI/XXXXXXXXXXXXXXXX,XXXXXXXXXXXXXXXX/start/2018-03-15T16:00:00Z/end/2018-03-15T17:00:00Z",
    ],
    "GET/lora/:applicationID/devices/dynamic": [
        "/lora/" + urlParams.appIdForDynamic[env] + "/devices/dynamic?devEUIs=" + urlParams.devEUIsForDynamic[env]
    ],

    // LoRa Multicast Registration:
    "GET/lora_device/multicastgroups": [
        "/lora_device/multicastgroups?applicationID=" + urlParams.devicesAppID[env] + "",
        "/lora_device/multicastgroups?applicationID=" + urlParams.devicesAppID[env] + "&devType=smokedetector"
    ],

    // Maintenance:
    "GET/lora_device/maintenance/latest/appid/:applicationID/dev_eui/:devEUI": [
        "/lora_device/maintenance/latest/appid/" + urlParams.devicesAppID[env] + "/dev_eui/XXXXXXXXXXXXXXXX"
    ],

    // LoRa Device Control and Device Data:
    "GET/lora/:devicetype/:application_id/currentstatus": [
        "/lora/ceilinglight/" + urlParams.devicesAppID[env] + "/currentstatus"
    ],
    "GET/lora/:devicetype/:application_id/:human_command": [
        "/lora/streetlight/" + urlParams.devicesAppID[env] + "/turn_on?dev_eui=XXXXXXXXXXXXXXXX",
        "/lora/streetlight/" + urlParams.devicesAppID[env] + "/turn_off?dev_eui=XXXXXXXXXXXXXXXX,YYYYYYYYYYYYYYYY,ZZZZZZZZZZZZZZZZ",
        "/lora/ceilinglight/" + urlParams.devicesAppID[env] + "/turn_on?relayNum=1&dev_eui=YYYYYYYYYYYYYYYY,ZZZZZZZZZZZZZZZZ",
        "/lora/ceilinglight/" + urlParams.devicesAppID[env] + "/turn_off?relayNum=2&dev_eui=YYYYYYYYYYYYYYYY"
    ],
    "GET/lora/:devicetype/:application_id/latest_usage": [
        "/lora/plugbase/" + urlParams.devicesAppID[env] + "/latest_usage?dev_eui=XXXXXXXXXXXXXXXX"
    ],
    "GET/lora/:devicetype/:application_id/recent_usage": [
        "/lora/plugbase/" + urlParams.devicesAppID[env] + "/recent_usage?dev_eui=XXXXXXXXXXXXXXXX"
    ],
    "GET/lora/:application_id/dev_eui/:dev_eui/deviceStatus": [
        "/lora/" + urlParams.devicesAppID[env] + "/dev_eui/XXXXXXXXXXXXXXXX/deviceStatus"
    ],
    "GET/lora/:application_id/deviceStatus": [
        "/lora/" + urlParams.devicesAppID[env] + "/deviceStatus?devEUIs=XXXXXXXXXXXXXXXX,YYYYYYYYYYYYYYYY,ZZZZZZZZZZZZZZZZ"
    ],
    "GET/lora/devicetype/:devicetype/application_id/:application_id/aggregated_data": [
        "/lora/devicetype/bodysensor/application_id/" + urlParams.devicesAppID[env] + "/aggregated_data",
        "/lora/devicetype/bodysensor/application_id/" + urlParams.devicesAppID[env] + "/aggregated_data?deveui=393338335D348303&mode=lasthour"
    ],

    // RSSI History Aggregation
    "GET/lora/rssi/aggregated_data/time_unit/:time_unit": [
        "/lora/rssi/aggregated_data/time_unit/hour",
        "/lora/rssi/aggregated_data/time_unit/day"
    ],
    "GET/lora/rssi/aggregated_data/time_unit/:time_unit/start/:start_time/end/:end_time": [
        "/lora/rssi/aggregated_data/time_unit/day/start/2017-11-02T10:00:00/end/2017-11-07T10:00:00"
    ],

    // R&D File Upload / Download:
    "GET/content/loraDevice/:reqfilename": [
        "/content/loraDevice/ABP_Batch_Template.csv",
        "/content/loraDevice/OTAA_Batch_Template.csv"
    ],

    // User Accounts:
    "GET/generaluser": [
        "/generaluser",
        "/generaluser?companyID=1",
        "/generaluser?companyID=1,2,3",
        "/generaluser?userName=johnd"
    ],
    "GET/generaluser/datausage": [
        "/generaluser/datausage?startTime=2018-03-02T19:00:00Z&endTime=2018-03-02T21:00:00Z"
    ],
    "GET/generaluserapplication": [ "/generaluserapplication?generalUserApplicationID=1,2,3" ],
    "GET/generaluserapplication/createdBy": [
        "/generaluserapplication/createdBy",
        "/generaluserapplication/createdBy?username=johnd&accessRole=general"
    ],
    "GET/generaluserapplication/lora": [
        "/generaluserapplication/lora?loraAppID=2,5"
    ],
    "GET/generaluserapplication/exist_device": [
        "/generaluserapplication/exist_device?generalUserApplicationID=342,343,344,345,346"
    ],

    // R&D TCP Geo Data:
    "GET/tcp/latest_tcp_geo_data": [
        "/tcp/latest_tcp_geo_data",
        "/tcp/latest_tcp_geo_data?dur=30",
        "/tcp/latest_tcp_geo_data?spatialoperation=geoWithin&geometry={%22type%22:%22Polygon%22,%22coordinates%22:[[[-114.133591951259,51.0804815799142],[-114.133592690935,51.0805566439002],[-114.133507054369,51.0805572427093],[-114.133506316258,51.0804821787599],[-114.133591951259,51.0804815799142]]]}&dur=10"
    ],

    // Utilities:
    "GET/util/manufacturing/lora/device": [
        "/util/manufacturing/lora/device?namePrefix=something_&startNum=1&deviceMode=OTAA&numDevices=10",
    ],
    "GET/util/manufacturing/lora/device/multicast": [
        "/util/manufacturing/lora/device/multicast?namePrefix=something_&startNum=1&deviceMode=OTAA&multicastAddr=abcd1234&applicationID=" + urlParams.devicesAppID[env] + "&numDevices=10"
    ],

    // Company Info:
    "GET/companyInfo": [
        "/companyInfo"
    ],

    // BLE System:
    "GET/ble/applications/:bleAppID/nodes/location": [
        "/ble/applications/AAAA/nodes/location",
        "/ble/applications/AAAA/nodes/location?macAddress=XXXXXXXXXXXX",
        "/ble/applications/AAAA/nodes/location?macAddress=XXXXXXXXXXXX,YYYYYYYYYYYY,ZZZZZZZZZZZZ",
    ],
    "GET/ble/applications/:bleAppID/nodes/locationhistory": [
        "/ble/applications/AAAA/nodes/locationhistory?macAddress=XXXXXXXXXXXX&startTime=2018-05-25T10:40:00.100Z&endTime=2018-05-25T11:40:05Z",
    ],

    "GET/ble/gateways": [
        "ble/gateways",
        "ble/gateways/macAddress=AAAABBBBCCCC",
        "ble/gateways/macAddress=AAAABBBBCCCC,DDDDEEEEFFFF",
    ],
    
    "DELETE/ble/gateways": [
        "ble/gateways/macAddress=AAAABBBBCCCC",
        "ble/gateways/macAddress=AAAABBBBCCCC,DDDDEEEEFFFF",
    ],
    // BLE Application
    "GET/ble/applications" : [
        "/ble/applications?bleAppID=4,6,7,8"
    ],
    "GET/ble/applications/createdby": [
        "/ble/applications/createdby",
        "/ble/applications/createdby?username=admin_calgary&accessRole=admin"
    ],
    "GET/ble/applications/count/createdby": [
        "/ble/applications/count/createdby",
        "/ble/applications/count/createdby?username=admin_calgary&accessRole=admin"
    ],
    "GET/ble/applications/count": [
        "/ble/applications/count",
        "/ble/applications/count?bleAppID=XXX",
        "/ble/applications/count?bleAppID=XXX,YYY,ZZZ"
    ],
    "DELETE/ble/applications": [
        "/ble/applications?bleAppID=1,2,3,4"
    ],
};

let blurbStrs = {
    devEUI: "To get a DevEUI to put in the URL for this web service, simply place a call to the '/lora/:devicetype/:application_id/currentstatus' web service using your desired ApplicationID and device type, then retrieve a DevEUI from the results.",
    relayNum: "The 'relayNum' parameter is required when device type is either 'smartswitch' or 'ceilinglight'",
    spatialoperation: "Note that the 'spatialoperation' parameter is only required when the 'geometry' parameter is defined.",
    accessRole: "The 'accessRole' parameter is required when the 'username' parameter is given, and vice-versa."
};

// 4. Specify an optional blurb (i.e.: short sentence / paragraph) about
// your particular web services here, or use a pre-fabricated blurb in the
// "blurbStrs" object above.
obj.blurbs = {
    // Anyue:
    "GET/anyue/lora/:applicationID/charginglotstatus": "Note: Replace '1' in the example URL below with the desired application ID",
    
    "DELETE/mengyang/pasture/:pastureID/sheep": "Note: At least one of either 'mengyangID' or 'mengyangID2' is required for this web service",
    "GET/lora/:devicetype/:application_id/currentstatus":       blurbStrs.devEUI,
    "GET/lora/:devicetype/:application_id/:human_command":      blurbStrs.devEUI + " " + blurbStrs.relayNum,
    "GET/lora/:devicetype/:application_id/latest_usage":        blurbStrs.devEUI,
    "GET/lora/:devicetype/:application_id/recent_usage":        blurbStrs.devEUI,
    "GET/lora/:application_id/dev_eui/:dev_eui/deviceStatus":   blurbStrs.devEUI,
    "GET/lora/:application_id/deviceStatus":                    blurbStrs.devEUI,
    "GET/lora/devicetype/:devicetype/application_id/:application_id/aggregated_data": blurbStrs.devEUI,

    "GET/generaluserapplication/createdBy": blurbStrs.accessRole,

    "GET/tcp/latest_tcp_geo_data": blurbStrs.spatialoperation,
    "GET/loraDevice/channelHistory/appID/:applicationID/devEUI/:devEUIs/start/:startTime/end/:endTime": "Note: 'startTime' and 'endTime' values can be no more than 24 hours apart, for query performance reasons."
};

// 5. These categories' various web services each take device type as input
// in one of their web services, so to be helpful, we will display the list
// of available valid device types to choose from in the current environment.
obj.categoriesWithDevType = [
    "LoRa Device",
    "LoRa Multicast Group",
    "LoRa Device Control and Device Data",
    "LoRa Data Aggregation"
];

module.exports = obj;
