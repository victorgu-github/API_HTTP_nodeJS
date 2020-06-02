module.exports = function(sqlize, DataTypes) {
    let sheepClinicHistory = sqlize.define("sheep_clinic_history",{
        mengyangID: {
            type: DataTypes.STRING(45),
            primaryKey: true,
            allowNull: false
        },
        mengyangID2: {
            type: DataTypes.STRING(45),
            allowNull: false            
        },
        diseaseDate: {
            type: DataTypes.DATE,
            allowNull: false
        },
        diseaseCategory: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        diseaseName: {
            type: DataTypes.DATE,
            allowNull: false
        },
        symptom: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        medicine: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        treatmentMethod: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        comments: {
            type: DataTypes.STRING(45),
            allowNull: false
        }
    }, {
        timestamps: false,
        tableName: "sheep_clinic_history"
    });

    return sheepClinicHistory;
};