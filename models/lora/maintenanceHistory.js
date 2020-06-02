let mongoose = require("mongoose");

let config = require("../../config/config.js");
let logger = require("../../common/tracer.js");

var appServNodeSchema = new mongoose.Schema({
    devEUI:         String,
    applicationID:  String,
    startTime:      Date,
    endTime:        Date,
    comments:       String,
    status:         String,
}, { collection: "device_maintenance_history" });
 
module.exports = function(app_id) {
    var conn = require("../../db/dbConnections.js")(config.dbNames.appServer, app_id, config.nodejsDbServer);
    logger.debug("AppServer connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port, "\n\thosts =", conn.hosts);
    return conn.model("AppServer", appServNodeSchema);
};
