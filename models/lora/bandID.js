let mongoose = require("mongoose");

let config = require("../../config/config.js");
let logger = require("../../common/tracer.js");

var bandIDSchema = new mongoose.Schema(
    {
        bandID: Number,
        bandName: String,
    },
    {
        collection: "regional_band_map"
    }
);

module.exports = function bandIDGetModel() {
    var conn = require("../../db/dbConnections.js")(config.dbNames.systemInfo, null, config.agtsDbServer);
    logger.debug("BandID connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("BandID", bandIDSchema);
};
