let mongoose = require("mongoose");
mongoose.Promise = global.Promise;	// Set the Promise library to native ES6 promises

let config = require("../config/config.js");
let logger = require("../common/tracer.js");

var activeNodeSchema = new mongoose.Schema(
    {
        curr_scenario:		Number,
        node_mac:			String,
        displayName: 		String,
        wireless_mode:		String,
        setup_id:			Number,
        channel_info:		Number,
        epoch_timestamp:	Date,
        last_update_time:	Date
    }
);

module.exports = function(scenario_id) {
    var conn = require("../db/dbConnections.js")(config.dbNames.ape, scenario_id, config.agtsDbServer);
    logger.debug("ActiveNode connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("ActiveNode", activeNodeSchema);
};
