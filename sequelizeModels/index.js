let config = reqFile("./config/config.js");

module.exports = function(modelName, appID) {
    let conn = reqFile("./db/sequelizeConnections.js")(config.mySqlDbNames[modelName], appID);
    return conn.import("./" + modelName + ".js");
};
