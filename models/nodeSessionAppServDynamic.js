let mongoose = require("mongoose");

let config = require("../config/config.js");
let logger = require("../common/tracer.js");

let appServNodeDynamicSchema = new mongoose.Schema({
    DevEUI:                     String,
    GwSvrDbUpdated:             Number,
    GwSvrDbUpdateAccessTime:    Date
}, { collection: "app_node_session" });

module.exports = function(app_id) {
    let conn = require("../db/dbConnections.js")(config.dbNames.appServer, app_id, config.agtsDbServer);
    logger.debug("AppServNodeSessionDynamic connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port, "\n\thosts =", conn.hosts);
    return conn.model("AppServNodeSessionDynamic", appServNodeDynamicSchema);
};

