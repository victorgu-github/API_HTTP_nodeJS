module.exports = function(sqlize, DataTypes) {
    let sheepHybridInfo = sqlize.define("sheep_hybridization",{
        hybridizationID: {
            type:   DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false
        },
        maleSheepID: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        maleSheepType: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        maleSheepSemen: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        femaleSheepID: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        femaleSheepID2: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        hybridizationDate: {
            type: DataTypes.DATE,
            allowNull: false
        },
        maternityDate: {
            type: DataTypes.DATE,
            allowNull: false
        },
        maternityAmount: {
            type:   DataTypes.INTEGER,
            allowNull: false
        },
        comments: {
            type: DataTypes.STRING(45),
            allowNull: false
        }
    }, {
        timestamps: false,
        tableName: "sheep_hybridization"
    });
    return sheepHybridInfo;
};