module.exports = function(sqlize, DataTypes) {
    let pastureGeneral = sqlize.define("pasture_general", {
        pastureID: {
            type:       DataTypes.INTEGER,
            primaryKey: true,
            allowNull:  false
        },
        pastureName: {
            type:       DataTypes.STRING(45),
            allowNull:  false
        },
        centerLoc: {
            type:       DataTypes.GEOMETRY("POINT"),
            allowNull:  false
        },
        zoomLevel2D: {
            type:       DataTypes.FLOAT,
            allowNull:  false
        },
        zoomLevel3D: {
            type:       DataTypes.FLOAT,
            allowNull:  false
        },
        address: {
            type:       DataTypes.STRING(45),
            allowNull:  false
        },
        legalPerson: {
            type:       DataTypes.STRING(45),
            allowNull:  false
        }
    }, {
        timestamps: false,
        tableName:  "pasture_general"
    });

    return pastureGeneral;
};

