module.exports = function(sqlize, DataTypes) {
    let sheepInfo = sqlize.define("sheep_info", {
        mengyangID: {
            type:       DataTypes.STRING(45),
            primaryKey: true,
            allowNull:  false
        },
        mengyangID2: {
            type:       DataTypes.STRING(45),
            allowNull:  false
        },
        dateOfBirth: {
            type:       DataTypes.DATE,
            allowNull:  false
        },
        birthWeight: {
            type:       DataTypes.FLOAT,
            allowNull:  false
        },
        gender: {
            type:       DataTypes.STRING(45),
            allowNull:  false
        },
        origin: {
            type:       DataTypes.STRING(45),
            allowNull:  false
        },
        fatherID: {
            type:       DataTypes.STRING(45),
            allowNull:  false
        },
        motherID: {
            type:       DataTypes.STRING(45),
            allowNull:  false
        },
        comments: {
            type:       DataTypes.STRING(200),
            allowNull:  true
        },
        picture: {
            type:       DataTypes.STRING(200),
            allowNull:  true
        },
        variety: {
            type:       DataTypes.STRING(45),
            allowNull:  true
        },
        createdAt: {
            type:       DataTypes.DATE,
            allowNull:  false
        },
        createdBy: {
            type:       DataTypes.STRING(45),
            allowNull:  false
        },
        creatorAccessRole: {
            type:       DataTypes.STRING(45),
            allowNull:  false
        }
    }, {
        timestamps: false,
        tableName:  "sheep_info"
    });

    return sheepInfo;
};

