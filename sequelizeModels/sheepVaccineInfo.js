module.exports = function(sqlize, DataTypes) {
    let sheepVaccineRecord = sqlize.define("sheep_vaccination", {
        vaccinationID: {
            type:   DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false
        },
        sheepfoldID: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        polygonID: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        vaccinationDate: {
            type: DataTypes.DATE,
            allowNull: false
        },
        vaccinationTechnician : {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        numberOfSheep: {
            type:   DataTypes.INTEGER,
            allowNull: false
        },
        sheepAge: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        medicineName: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        medicineCompany: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        medicinePreservation: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        medicineInstruction: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        medicineDosage: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        companyPhone: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        approvalID: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        approvalDocNumber: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false
        },
        createdBy: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        creatorAccessRole: {
            type: DataTypes.STRING(45),
            allowNull: false
        }
    }, {
        timestamps: false,
        tableName: "sheep_vaccination"
    });

    return sheepVaccineRecord;
};