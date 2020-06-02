let mongoose = require("mongoose");
mongoose.Promise = global.Promise;	// Set the Promise library to native ES6 promises

let config = require("../config/config.js");
let logger = require("../common/tracer.js");

var gatewayRecordSchema = new mongoose.Schema({
    gw_mac:				String,
    name:		 		String,
    description:		String,
    curr_scenario:      Number,
    sensor_info:		{
        acc_mode:	Number,
        acc_x:      Number,
        acc_y:      Number,
        acc_z:      Number,
        mag_mode:   Number,
        mag_x:      Number,
        mag_y:      Number,
        mag_z:      Number,
        gyro_mode:  Number,
        gyro_x:     Number,
        gyro_y:     Number,
        gyro_z:     Number
    },
    resv_sensors:		[{
        sensor_type:	String,
        resv_mode:		Number,
        value:			Number,
        unit:			String
    }],
    date:				Date
});

module.exports = function(scenario_id) {
    var conn = require("../db/dbConnections.js")(config.dbNames.ape, scenario_id, config.agtsDbServer);
    logger.debug("GatewayRecord connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("GatewayRecord", gatewayRecordSchema);
};
