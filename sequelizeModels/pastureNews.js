module.exports = function(sqlize, DataTypes) {
    let pastureNews = sqlize.define("pasture_news", {
        newsID: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false
        },
        pastureID: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        date: {
            type: DataTypes.DATE,
            allowNull: false
        },
        content: {
            type: DataTypes.STRING(2000),
            allowNull: false
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false
        },
        createdBy: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        creatorAccessRole: {
            type: DataTypes.STRING(50),
            allowNull: false
        }
    },  {
        timestamps: false,
        tableName: "pasture_news"
        });

    return pastureNews;
};