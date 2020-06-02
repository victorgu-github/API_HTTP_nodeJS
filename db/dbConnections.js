let mongoose = require("mongoose");

let config = require("../config/config.js");
let logger = require("../common/tracer.js");
let dataFormat = require("../common/dataFormat.js");

// Because the Linux Mongo driver creates a new thread for every connection, we will cache our connections
// so that they can be reused.
var dbConns = {};

module.exports = function(dbName, index, whichDbServer) {
    // Because the web API reads from and writes to multiple different databases depending on the
    // type of data being requested and other parameters, each Mongo / Mongoose model first requests
    // a connection to the appropriate database.
    let finalDbName;
    if (index !== undefined && index !== null) {
        let indexFormatted;
        if (dbName === config.dbNames.ape) {
            indexFormatted = index;
        }
        if (dbName === config.dbNames.appServer) {
            indexFormatted = dataFormat.padWithZerosToFixedLength(index, 16);
        }
        if (dbName === config.dbNames.bleApp || dbName === config.dbNames.bleData) {
            indexFormatted = dataFormat.padWithZerosToFixedLength(index, 4);
        }
        finalDbName = dbName + indexFormatted;
    } else {
        finalDbName = dbName;
    }

    logger.debug("DB connection requested to \"" + finalDbName + "\"");

    // All connections are saved in a property of the "dbConns" object in this file. If a connection
    // experiences an error, it is deleted, then recreated the next time it is required.
    if (dbConns[whichDbServer + finalDbName] === undefined) {
        let credentials = "";
        let authSource = "";
        let replica = "";

        if (config.dbServer[whichDbServer].username.length > 0 &&
           config.dbServer[whichDbServer].password.length > 0 &&
           config.dbServer[whichDbServer].authSource.length > 0) {
            credentials = config.dbServer[whichDbServer].username + ":" + config.dbServer[whichDbServer].password + "@";
            authSource = "authSource=" + config.dbServer[whichDbServer].authSource;
        }
        if (config.dbServer[whichDbServer].replicaName.length > 0) {
            replica = "replicaSet=" + config.dbServer[whichDbServer].replicaName;
        }

        let queryString = "";
        if (replica.length > 0) {
            queryString += replica;
        }
        if (authSource.length > 0) {
            if (queryString.length > 0) {
                queryString += "&" + authSource;
            } else {
                queryString += authSource;
            }
        }
        
        dbConns[whichDbServer + finalDbName] = mongoose.createConnection(config.dbSvrVendor + "://" + credentials + config.dbServer[whichDbServer].instance + "/" + finalDbName + "?" + queryString);
        
        dbConns[whichDbServer + finalDbName].on("error", connError);
        dbConns[whichDbServer + finalDbName].on("reconnect", connReconn);
        dbConns[whichDbServer + finalDbName].on("timeout", connTimeout);
        dbConns[whichDbServer + finalDbName].on("parseError", connParseError);
        dbConns[whichDbServer + finalDbName].on("disconnected", connDisconn);
    }
    
    return dbConns[whichDbServer + finalDbName];
};

function connDisconn() {
    for (let i in dbConns) {
        if (dbConns[i]._readyState === 0) {
            logger.error("Mongo Connection to", i, "on", dbConns[i].host + ":" + dbConns[i].port, "Disconnected");
        }
    }
}
function connError(msg) { logger.error("Mongo Connection Error:"); errorCleanup(msg); }
function connReconn(msg) { logger.error("Mongo Connection Reconnected"); errorCleanup(msg); }
function connTimeout(msg) { logger.error("Mongo Connection Timed Out"); errorCleanup(msg); }
function connParseError(msg) { logger.error("Mongo Connection ParseErrored"); errorCleanup(msg); }

function errorCleanup(msg) {
    if (msg) {
        logger.warn(msg);
        // Remove the offending connection:
        for (let i in dbConns) {
            if (dbConns[i]._readyState === 0) {
                logger.error("Deleting connection to", i, "on", dbConns[i].host + ":" + dbConns[i].port);
                delete dbConns[i];
            }
        }
    }
}
