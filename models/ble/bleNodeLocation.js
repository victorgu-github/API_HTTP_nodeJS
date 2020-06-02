const mongoose = require("mongoose");

const config = reqFile("./config/config.js");

let bleNodeLocationSchema = new mongoose.Schema({
    macAddress:     String,
    timestamp:      Date,
    geoLocation:    mongoose.Schema.Types.Mixed
}, {
    collection: "agts_ble_node_location",
    capped: {
        size:   10632560640 // 10 GB
    }
});

bleNodeLocationSchema.index({ timestamp: -1 });
bleNodeLocationSchema.index({
    timestamp: -1,
    macAddress: 1
});

module.exports = function(appID) {
    let conn = reqFile("./db/dbConnections.js")(config.dbNames.bleData, appID, config.bleDataDbServer);
    logger.debug("BleNodeLocation connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port, "\n\thosts =", conn.hosts);
    return conn.model("BleNodeLocation", bleNodeLocationSchema);
};
