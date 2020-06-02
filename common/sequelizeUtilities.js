let dataFormat = reqFile("./common/dataFormat.js");

let obj = {};

obj.checkIfNumberedSqlDbExists = function(baseName, index) {
    let dbName = baseName + dataFormat.padWithZerosToFixedLength(index, 4);
    // First, we make a connection to a database that we know exists so that
    // we can get an instance of the 'Sequelize' object to run a custom query.
    let conn = reqFile("./db/sequelizeConnections.js")("mengyang_pasture_", 1);
    return conn.query("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA " +
                      "WHERE SCHEMA_NAME = '" + dbName + "';")
        .spread((result, meta) => { // eslint-disable-line no-unused-vars
            // 'result' is an array. If the database exists, the array will
            // contain an object with the database name, else the array will
            // be empty.
            return {
                index:  index,
                exists: (result.length !== 0) ? true : false
            };
        });
};

module.exports = obj;
