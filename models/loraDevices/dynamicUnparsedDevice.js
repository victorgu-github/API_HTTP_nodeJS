let mongoose = require("mongoose");

let config = require("../../config/config.js");

let savedSchemas = {};

module.exports = function(appID, collectionName) {
    let conn = require("../../db/dbConnections.js")(config.dbNames.appServer, appID, config.nodejsDbServer);
    logger.debug(collectionName + " connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);

    if (savedSchemas[collectionName] === undefined) {
        // Start with the shared raw data schema portion:
        let schemaObj = {
            applicationID:  String,
            devEUI:         String,
            timestamp:      Date,
            rawData: [
                {
                    timeSecond:     Number,
                    payload:        String,
                    fCntUp:         Number,
                    parsePayload:   Boolean
                }
            ]
        };

        savedSchemas[collectionName] = new mongoose.Schema(schemaObj, { collection: collectionName });
        savedSchemas[collectionName].index({ timestamp: -1 });
    }

    return conn.model(collectionName, savedSchemas[collectionName]);
};
