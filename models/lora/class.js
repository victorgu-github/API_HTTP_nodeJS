let mongoose = require("mongoose");

let config = require("../../config/config.js");
let logger = require("../../common/tracer.js");

var classSchema = new mongoose.Schema(
    {
        class: Number
    },
    {
        collection: "regional_class_map"
    }
);

module.exports = function classGetModel() {
    var conn = require("../../db/dbConnections.js")(config.dbNames.systemInfo, null, config.agtsDbServer);
    logger.debug("Class connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("Class", classSchema);
};
