var config = {};

// ---------------------------------------------------------------------
// ---------------------------- MODIFY ---------------------------------
// ---------------------------------------------------------------------
// Manually modify this to either "test" or "prod" based on your desired
// environment, and all other settings will be set accordingly:

config.environment = "test";
config.runApeSimOn = 1; // 1 == run APE record simulator on scenario 1, i.e.: data_loc_1
config.authenticateWebServices = true;
config.currVersion = "v1.4.0";

// ---------------------------------------------------------------------
// ------------------------- DO NOT MODIFY -----------------------------
// ---------------------------------------------------------------------
config.dbSvrVendor = "mongodb";

config.acceptedEnvironments = [
    "local",
    "staging",
    "test",
    "testShanghai",
    "prod",
    "prodShanghai"
];

// DB server names:
config.agtsDbServer =   "agtsDbServer";
config.nodejsDbServer = "nodejsDbServer";
config.bleConfigDbServer =  "bleConfigDbServer";
config.bleDataDbServer =    "bleDataDbServer";
config.mengyangDbServer = "mengyangDbServer";

if (config.environment === "local") {
    config.serverHost = "localhost";
    let commonDbSettings = {
        instance:    "localhost:27017",
        replicaName: "",
        username:    "",
        password:    "",
        authSource:  ""
    };
    config.dbServer = {
        agtsDbServer:       commonDbSettings,
        nodejsDbServer:     commonDbSettings,
        bleConfigDbServer:  commonDbSettings,
        bleDataDbServer:    commonDbSettings
    };
    config.sequelize = {
        username:   "",
        password:   "",
        databaseBaseName: "mengyang_pasture_",
        host:       "localhost",
        dialect:    "mysql",
        logging:    false,
    };
    config.expressPortNum = 8333;
    config.displayedPortNum = 8333;
}
if (config.environment === "staging") {
    config.serverHost = "10.10.10.7";
    let commonDbSettings = {
        instance:    "10.10.10.9:27018",
        replicaName: "",
        username:    "",
        password:    "",
        authSource:  ""
    };
    config.dbServer = {
        agtsDbServer:       commonDbSettings,
        nodejsDbServer:     commonDbSettings,
        bleConfigDbServer:  commonDbSettings,
        bleDataDbServer:    commonDbSettings
    };
    config.sequelize = {
        username:   "",
        password:   "",
        databaseBaseName: "mengyang_pasture_",
        host:       "",
        dialect:    "mysql",
        logging:    false,
    };
    config.expressPortNum = 8333;
    config.displayedPortNum = 8333;
}
if (config.environment === "test") {
    config.serverHost = "207.34.103.154";
    config.ssl ={
        key:"config/ssl_calgary/private.key",
        cert:"config/ssl_calgary/mydomain.crt"
    };
    config.dbServer = {
        agtsDbServer: {
            instance:    "10.10.10.6:27901",
            replicaName: "",
            username:    "",
            password:    "",
            authSource:  ""
        },
        nodejsDbServer: {
            instance:    "10.10.10.9:26100",
            replicaName: "",
            username:    "root",
            password:    "loraroot",
            authSource:  "admin"
        },
        bleConfigDbServer: {
            instance:    "10.10.10.6:27901",
            replicaName: "",
            username:    "",
            password:    "",
            authSource:  ""
        },
        bleDataDbServer: {
            instance:    "10.10.10.9:26100",
            replicaName: "",
            username:    "root",
            password:    "loraroot",
            authSource:  "admin"
        }
    };
    config.sequelize = {
        username:   "root",
        password:   "test",
        databaseBaseName: "mengyang_pasture_",
        host:       "10.10.10.10",
        dialect:    "mysql",
        logging:    false,
    };
    config.expressPortNum = 8100;
    config.displayedPortNum = 8100;
    config.httpsPortNum = 8442;
}
if (config.environment === "testShanghai") {
    config.serverHost = "180.169.137.162";
    let commonDbSettings = {
        instance:    "192.168.0.177:27017",
        replicaName: "",
        username:    "",
        password:    "",
        authSource:  ""
    };
    config.dbServer = {
        agtsDbServer:       commonDbSettings,
        nodejsDbServer:     commonDbSettings,
        bleConfigDbServer:  commonDbSettings,
        bleDataDbServer:    commonDbSettings
    };
    config.sequelize = {
        username:   "",
        password:   "",
        databaseBaseName: "mengyang_pasture_",
        host:       "",
        dialect:    "mysql",
        logging:    false,
    };
    config.expressPortNum = 8100;
    config.displayedPortNum = 8100;
}
if (config.environment === "prod") {
    config.serverHost = "207.34.103.154";
    config.ssl ={
        key:"config/ssl_calgary/private.key",
        cert:"config/ssl_calgary/mydomain.crt"
    };
    let commonDbSettings = {
        instance:    "10.10.10.7:27016,10.10.10.8:27017,10.10.10.9:27017",
        replicaName: "prodReplica",
        username:    "root",
        password:    "test",
        authSource:  "admin"
    };
    config.dbServer = {
        agtsDbServer:       commonDbSettings,
        nodejsDbServer:     commonDbSettings,
        bleConfigDbServer:  commonDbSettings,
        bleDataDbServer:    commonDbSettings
    };
    config.sequelize = {
        username:   "",
        password:   "",
        databaseBaseName: "mengyang_pasture_",
        host:       "",
        dialect:    "mysql",
        logging:    false,
    };
    config.expressPortNum = 8000;
    config.displayedPortNum = 8000;
    config.httpsPortNum = 8443;
}
if (config.environment === "prodShanghai") {
    config.serverHost = "222.73.246.22";
    config.ssl ={
        key:"config/ssl_shanghaiProd/214359287160986.key",
        cert:"config/ssl_shanghaiProd/214359287160986.pem"
    };
    config.dbServer = {
        agtsDbServer: {
            instance:    "192.168.0.60:27017,192.168.0.61:27017,192.168.0.61:27016",
            replicaName: "loraCentralReplica",
            username:    "root",
            password:    "loracentralreplica",
            authSource:  "admin"
        },
        nodejsDbServer: {
            instance:    "192.168.0.65:27017,192.168.0.66:27017,192.168.0.63:27013",
            replicaName: "loraDSCentralReplica",
            username:    "loracentralds",
            password:    "loracentraldsreplica",
            authSource:  "admin"
        },
        bleConfigDbServer: {
            instance:    "192.168.0.71:27017,192.168.0.72:27017,192.168.0.63:27011",
            replicaName: "bleConfigReplica",
            username:    "bleconfig",
            password:    "bleconfigreplica",
            authSource:  "admin"
        },
        bleDataDbServer: {
            instance:    "192.168.0.67:27017,192.168.0.68:27017,192.168.0.63:27012",
            replicaName: "bleCentralReplica", // Replica name is misleading; known issue.
            username:    "blecentral",
            password:    "blecentralreplica",
            authSource:  "admin"
        }
    };
    config.sequelize = {
        username:   "root",
        password:   "@ppMySQL2018idc",
        databaseBaseName: "mengyang_pasture_",
        host:       "localhost",
        dialect:    "mysql",
        logging:    false,
    };
    config.expressPortNum = 8100;
    config.displayedPortNum = 8000;
    config.httpsPortNum = 8443;
}

if (config.acceptedEnvironments.includes(config.environment) == false) {
    throw new Error("Error: Invalid environment name. Please check your config file.");
}

config.dbNames = {
    ape:            "data_loc_",
    userAccounts:   "useraccounts",
    systemInfo:     "system_info",
    gwServer:       "agts_lora_gw",
    appServer:      "agts_lora_app_",
    geoData:        "tcp_geo_data",
    bleConfig:      "agts_ble_system_configure",
    bleApp:         "agts_ble_app_",
    bleData:        "agts_ble_ds_"
};

config.mySqlDbNames = {
    sheepInfo:          "mengyang_pasture_",
    pastureGeneral:     "mengyang_system",
    pastureNews:        "mengyang_system",
    sheepVaccineInfo:   "mengyang_pasture_",
    sheepClinicInfo:    "mengyang_pasture_",
    sheepHybridInfo:    "mengyang_pasture_"
};

config.secret = "@ppr0pOlis-YYC_5up3r_53cr3t(JWT)*private*.KEY#";
config.unauthMsg = "Not authorized to access this resource. Must supply valid JSON web token (JWT).";

config.zmqUpdateIntervalMilliseconds = 1000;

module.exports = config;
