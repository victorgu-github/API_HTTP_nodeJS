let mongoose = require("mongoose");
mongoose.Promise = global.Promise;	// Set the Promise library to native ES6 promises

let config = require("../config/config.js");
let logger = require("../common/tracer.js");

var apeRecordSchema = new mongoose.Schema(
    {
        node_mac:			Buffer,
        curr_scenario:		Number,
        objId:              mongoose.Schema.Types.ObjectId,
        setupId:            Number,
        date:               Date,
        mode:               Number,
        rssChannel:         Number,
        spatial_info: {
            pos_lat:		Number,
            pos_lon:		Number,
            pos_hgt:		Number,
            pos_std_e:		Number,
            pos_std_n:		Number,
            pos_std_u:		Number,
            pix_x:			Number,
            pix_y:			Number,
            pix_std_x:		Number,
            pix_std_y:		Number
        },
        sensor_info: {
            acc_mode:		Number,
            acc_x:			Number,
            acc_y:			Number,
            acc_z:			Number,
            mag_mode:		Number,
            mag_x:			Number,
            mag_y:			Number,
            mag_z:			Number,
            gyro_mode:		Number,
            gyro_x:			Number,
            gyro_y:			Number,
            gyro_z:			Number
        },
        num_resv_sens:      Number,
        resv_sensors: [{
            sensor_type:    String,
            resv_mode:      Number,
            value:          Number,
            unit:           String
        }],
        valid_gateways:     Number,
        gateways: [{
            gw_mac:			String,
            gw_id: 			Number,
            rssi: 			Number
        }]
    }, { collection: "ape_record" }
);

module.exports = function(scenario_id) {
    var conn = require("../db/dbConnections.js")(config.dbNames.ape, scenario_id, config.agtsDbServer);
    logger.debug("ApeRecord connection:\n\tname =", conn.name, "\n\thost =", conn.host + "\n\tport = " + conn.port);
    return conn.model("ApeRecord", apeRecordSchema);
};
