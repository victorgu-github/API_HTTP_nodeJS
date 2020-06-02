var obj = {};

obj.defaultUserAccountScenarios = [{
    "id": 1,
    "bleAppID": "1",
    "loraAppID": "8",
    "default": true
}];

obj.userAccountDefaultValue = {
    firstName: "",
    lastName: "",
    email: "",
    accessRole: "general",
    tiledLayerBaseURL: "http://tiles.arcgis.com/tiles/gSP83wC6PGs7J2Yu/arcgis/rest/services",
    featureLayerBaseURL: "https://services7.arcgis.com/gSP83wC6PGs7J2Yu/ArcGIS/rest/services"
};

module.exports = obj;
