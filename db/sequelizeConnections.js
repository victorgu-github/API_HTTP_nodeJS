let Sequelize = require("sequelize");

let config = require("../config/config.js");
let dataFormat = require("../common/dataFormat.js");

// Cache our connections so that they can be reused.
let dbConns = {};

module.exports = function(dbName, index) {
    let finalDbName = dbName;
    if (index !== null)
        finalDbName = finalDbName + dataFormat.padWithZerosToFixedLength(index, 4);
    if (dbConns[dbName + index] === undefined) {
        logger.debug("Creating new connection to", finalDbName);
        dbConns[dbName + index] = new Sequelize(
            finalDbName,
            config.sequelize.username,
            config.sequelize.password,
            {
                username:   config.sequelize.username,
                password:   config.sequelize.password,
                databaseBaseName: finalDbName,
                host:       config.sequelize.host,
                dialect:    config.sequelize.dialect,
                logging:    config.sequelize.logging,
            }
        );
        dbConns[dbName + index].sync();
    }
    return dbConns[dbName + index];
};
