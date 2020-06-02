let mongoose = require("mongoose");

let config = require("../config/config.js");
let logger = require("../common/tracer.js");

var geoDataSchema = new mongoose.Schema(
    {
        userID:             String,
        name:               String,
        timestamp:          Date,
        // 'properties' is simply an empty object for the time being.
        properties:         { type: mongoose.Schema.Types.Mixed, default: { } },
        // The geoJSON standard allows for altitude to be the 3rd element of the
        // "coordinates" array, but Mongo currently only supports 2D geospatial
        // queries, so we'll just move it out for now:
        altitude:           Number,

        geoJSON: {
            type:           { type: String },
            coordinates:    [ Number ] // Array contains: Longitude, Latitude
        }
    }, { collection: "geo_data",
         // This ensures that Mongo or Mongoose won't omit fields containing
         // empty objects:
         minimize: false }
);

module.exports = function() {
    var conn = require("../db/dbConnections.js")(config.dbNames.geoData, null, config.nodejsDbServer);
    logger.debug("GeoData connection:\n\tname = " + conn.name + "\n\thost = " + conn.host + "\n\tport = " + conn.port);
    return conn.model("GeoData", geoDataSchema);
};
