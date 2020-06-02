let mongoose = require("mongoose");
mongoose.Promise = global.Promise;	// Set the Promise library to native ES6 promises

let config = require("../config/config.js");
let logger = require("../common/tracer.js");

var apeObjectSchema = new mongoose.Schema({
    _id:            mongoose.Schema.ObjectId,
    name:           String,
    floorPlanUrl:   String,
}, {
    versionKey: false,
    collection: "objects"
});

module.exports = function(scenario_id) {
    var conn = require("../db/dbConnections.js")(config.dbNames.ape, scenario_id, config.agtsDbServer);
    logger.debug("ApeObject connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("ApeObject", apeObjectSchema);
};
