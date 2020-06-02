let reqFile = require.main.require;

let mongoose = require("mongoose");

let config = reqFile("./config/config.js");

let BleNodeSchema = new mongoose.Schema({
    macAddress:         String,
    name:               { type: String, default: "" },
    deviceType:         { type: String, default: "" },
    foreignKeys: [{
        keyName:        String,
        keyValue:       String,
        description:    String
    }],

    createdBy:          String,
    creatorAccessRole:  String
}, {
    collection: "agts_ble_node",
    timestamps: {
        createdAt:  "createdAt",
        updatedAt:  false
    }
}
);

module.exports = function(bleAppID) {
    let conn = reqFile("./db/dbConnections.js")(config.dbNames.bleApp, bleAppID, config.bleConfigDbServer);
    logger.debug("BleNode connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("BleNode", BleNodeSchema);
};
