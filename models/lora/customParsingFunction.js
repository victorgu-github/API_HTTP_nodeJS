let mongoose = require("mongoose");

let config = reqFile("./config/config.js");

let UserPayloadParsingFunc = new mongoose.Schema(
    {
        devType:            String,
        parsingFunction:    [ String ],
        createdBy:          String,
        creatorAccessRole:  String,
    }, {
        timestamps: {
            createdAt:  true,
            updatedAt:  true
        },
        collection: "custom_payload_parsing_funcs"
    }
);

module.exports = function() {
    let conn = reqFile("./db/dbConnections.js")(config.dbNames.systemInfo, null, config.nodejsDbServer);
    logger.debug("UserPayloadParsingFunc connection:\n\tname = " + conn.name + "\n\thost = " + conn.host +
                 "\n\tport = " + conn.port);
    return conn.model("UserPayloadParsingFunc", UserPayloadParsingFunc);
};
