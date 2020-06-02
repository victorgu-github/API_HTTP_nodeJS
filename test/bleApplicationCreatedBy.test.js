let mongoose = require("mongoose");
mongoose.Promise = global.Promise;
let sinon = require("sinon");
require("sinon-mongoose");
let chai = require("chai");
reqFile = require.main.require;
let expect = chai.expect;
let consts = require("../config/constants.js");

// This unit test is for testing the get /ble/applications/count?createdby?username=..&accessRole=...
let bleAppFuncs = reqFile("./routes/routeFunctions/bleAppFunctions.js");
let next = () => {};

// Test 1: When the user does not provide username or access role in the URL.
describe("Test for all possible data configurations when the user does not provide username or access role in the URL.", () => {
    beforeEach(() => {
        this.bleApplicationMock = sinon.mock(reqFile("./models/ble/bleApplication.js")());
        this.req = {
            query: {}
        };
        this.res = {
            locals: {
                username:   "admin_calgary",
                accessRole: "admin"
            }
        };
    });
    afterEach(() => {
        this.bleApplicationMock.restore();
    });

    // Case 1-1
    it ("If the user has created some ble applications, some ble application have registered bleGws and bleTags and some don't. Meanwhile none of the ble applications have tags considered as 'abnormal'.", (done) => {
        // Assume the queryObj was formed correctly. This step is for getting all the
        // ble applications created by {username: "admin_calgary", accessRole: "admin"}
        let bleObjCreatedByDefaultUser = [
            {
                "bleAppName" : "AOA_Tags",
                "bleAppID" : 102,
                "createdBy" : "admin_calgary",
                "creatorAccessRole" : "admin",
                "foreignKeys" : [],
                "defaultZoomLevel3D" : null,
                "defaultZoomLevel2D" : null,
                "centerAlt" : null,
                "centerLng" : null,
                "centerLat" : null,
                "createdAt" : Date.parse("2018-06-19T21:07:09.283Z"),
                "relatedCompanyID" : 0,
                "detailDataLoc" : ""
            },
            {
                "bleAppName" : "test_name",
                "bleAppID" : 100,
                "createdBy" : "admin_calgary",
                "creatorAccessRole" : "admin",
                "foreignKeys" : [],
                "defaultZoomLevel3D" : 10.9,
                "defaultZoomLevel2D" : 9.9,
                "centerAlt" : 0,
                "centerLng" : 0,
                "centerLat" : 0,
                "createdAt" : Date.parse("2018-06-08T22:56:13.098Z"),
                "relatedCompanyID" : 9,
                "detailDataLoc" : "123"
            },
            {
                "bleAppName" : "app for sim data. don't delete!!!",
                "bleAppID" : 99,
                "createdBy" : "admin_calgary",
                "creatorAccessRole" : "admin",
                "foreignKeys" : [ 
                    {
                        "description" : "pasture 3",
                        "keyValue" : "0003",
                        "keyName" : "pastureID"
                    }
                ],
                "defaultZoomLevel3D" : 10.9,
                "defaultZoomLevel2D" : 9.9,
                "centerAlt" : 0,
                "centerLng" : 121.5,
                "centerLat" : 31.2,
                "createdAt" : Date.parse("2018-05-25T23:12:43.630Z"),
                "relatedCompanyID" : 9,
                "detailDataLoc" : "123"
            }
        ];
        this.bleApplicationMock.expects("find")
            .chain("sort").withArgs({ bleAppID: 1 })
            .resolves(bleObjCreatedByDefaultUser);
        // Because the function needs to count the number of gateways in the
        // 'agts_ble_gw' collection given a  bleApp, we will need to mock
        // the bleGw.aggregate() function

        // Assume that only the bleApp102 contains 2 gateways, the others do not.
        let bleGwMock = sinon.mock(reqFile("./models/ble/bleGw.js")());
        let bleGwAgg = [{
            _id: { bleAppID: 102 },
            macAddresses: ["12341234AAB2", "12341234AABB"]
        }];
        bleGwMock.expects("aggregate").resolves(bleGwAgg);

        // Next, the function will count the number of BLE nodes found in each each BLE
        // app database. As suggested by the input, we will need to mock app databases 102, 100 and 99.
        let bleNode102Mock = sinon.mock(reqFile("./models/ble/bleNode.js")(102));
        let bleNode100Mock = sinon.mock(reqFile("./models/ble/bleNode.js")(100));
        let bleNode99Mock = sinon.mock(reqFile("./models/ble/bleNode.js")(99));
        // And we assume that only app 102 and 99 have some valide BLE tags.
        bleNode102Mock.expects("distinct").resolves(["AAAAAABBBBBB", "CCCCCCDDDDDD"]);
        bleNode100Mock.expects("distinct").resolves([]);
        bleNode99Mock.expects("distinct").resolves(["111111222222", "333333444444"]);
       
        // In the meantime, the function also calculates the travelled distances of certain nodes
        // and count for the BLE tags that travelled under a certain threshold.
        // Assume there is no abnormality, which means we do not to mock the './models/ble/bleNodeDistanceTravelled.js'
        // collection

        this.res.send = function(finalResult) {
            let resultPromises = [];
            // First, expect the bleApp102 to have:
            // numBleGw: 2;
            // numBleTag: 2;
            // numberOfAbnormalTravelledDistances: 0
            let bleApp102 = finalResult.filter(bleObj => bleObj.bleAppID === 102);
            let bleApp102HasCorrectValues = true;
            if (bleApp102[0].numBleTag !== 2 || bleApp102[0].numBleGw !== 2 || bleApp102[0].numberOfAbnormalTravelledDistances !== 0) {
                bleApp102HasCorrectValues = false;
            }
            resultPromises.push(new Promise ((resolve, reject) => {
                resolve(expect(bleApp102HasCorrectValues).to.be.true)
            }));

            // Next, expect the bleApp100 to have:
            // numBleGw: 0;
            // numBleTag: 0;
            // numberOfAbnormalTravelledDistance: 0
            let bleApp100 = finalResult.filter(bleObj => bleObj.bleAppID === 100);
            let bleApp100HasCorrectValues = true;
            if (bleApp100[0].numBleTag !== 0 || bleApp100[0].numBleGw !== 0 || bleApp100[0].numberOfAbnormalTravelledDistances !== 0) {
                bleApp100HasCorrectValues = false;
            }
            resultPromises.push(new Promise ((resolve, reject) => {
                resolve(expect(bleApp100HasCorrectValues).to.be.true)
            }));

            // Finally, expect the bleApp99 to have:
            // numBleGw: 0
            // numBleTag: 2
            // numberOfAbnormalTravelledDistance: 0
            let bleApp99 = finalResult.filter(bleObj => bleObj.bleAppID === 99);
            let bleApp99HasCorrectValues = true;
            if (bleApp99[0].numBleTag !== 2 || bleApp99[0].numBleGw !== 0 | bleApp99[0].numberOfAbnormalTravelledDistances !== 0) {
                bleApp99HasCorrectValues = false;
            }
            resultPromises.push(new Promise ((resolve, reject) => {
                resolve(expect(bleApp99HasCorrectValues).to.be.true)
            }));

            Promise.all(resultPromises).then(() => {
                done();
                // Restore all the mocked functions
                bleGwMock.restore();
                bleNode102Mock.restore();
                bleNode100Mock.restore();
                bleNode99Mock.restore();
            }).catch((err) => {
                done(err);
                // Restore all the mocked functions
                bleGwMock.restore();
                bleNode102Mock.restore();
                bleNode100Mock.restore();
                bleNode99Mock.restore();
            })
            };
        // Finally, call the express function
        bleAppFuncs.getNumDevicesInBleAppsCreatedBy(this.req, this.res, next);
    });

    // Case 1-2
    it("If the default user has not created any ble applications, it will return an empty array.", (done) => {
        this.bleApplicationMock.expects("find")
            .chain("sort").withArgs({ bleAppID: 1 })
            .resolves([]);
        this.res.send = function(finalResult) {
            // Let's pretend the default user has not created any ble application,
            // therefore, we expect the return to be an empty array
            let result = new Promise((resolve, reject) => {
                resolve(expect(finalResult.length === 0 && Array.isArray(finalResult)).to.be.true);
            });
            result.then(() => {
                done();
            }).catch((err) => {
                done(err);
            });
            
        };

        // Call the express function
        bleAppFuncs.getNumDevicesInBleAppsCreatedBy(this.req, this.res, next);
    });
});

// Test 2: When the user provides incorrect username and access role combination
describe("Test for the possible data combinations where a user provide wrong username and access role combination.", () => {
    beforeEach(() => {
        this.bleApplicationMock = sinon.mock(reqFile("./models/ble/bleApplication.js")());
        this.req = {
            query: {
                username:   "somename",
                accessRole: "somerole"
            }
        };
        
    });
    afterEach(() => {
        this.bleApplicationMock.restore();
    })
    // Case 2-1
    it("If the username and access role combination is not registered in the database.", (done) => {
        // Because the the username and accessRole combination is not registered
        // we assume using these two as query parameters will return an empty array.
        this. bleApplicationMock.expects("find")
            .chain("sort").withArgs({ bleAppID: 1})
            .resolves([]);
        let res = {
            send: function(finalResult) {
                let result = new Promise((resolve, reject) => {
                    resolve(expect(finalResult.length === 0 && Array.isArray(finalResult) === true).to.be.true);
                });
                result.then(() => {
                    done();
                }).catch((err) => {
                    done(err);
                });
            }
        };
        // Call the express function
        bleAppFuncs.getNumDevicesInBleAppsCreatedBy(this.req, res, next);
    })
});

// Test 3: When one of the BLE application contains nodes that are behaving abnormally
describe("Test for all the possible data configurations where one BLE application contains nodes that are behaving normally.", () => {
    beforeEach(() => {
        this.bleApplicationMock = sinon.mock(reqFile("./models/ble/bleApplication.js")());
        this.req = {
            query: {
                username:   "admin_calgary",
                accessRole: "admin"
            }
        };
        this.bleGwMock = sinon.mock(reqFile("./models/ble/bleGw.js")());
        
    });
    afterEach(() => {
        this.bleApplicationMock.restore();
        this.bleGwMock.restore();
    })
    // Case 3-1
    it("When one of the BLE apps contains >1 abnormal tags", (done) => {
        let bleObjCreatedByAdminUser = [
            {
                "bleAppName" : "AOA_Tags",
                "bleAppID" : 102,
                "createdBy" : "admin_calgary",
                "creatorAccessRole" : "admin",
                "foreignKeys" : [],
                "defaultZoomLevel3D" : null,
                "defaultZoomLevel2D" : null,
                "centerAlt" : null,
                "centerLng" : null,
                "centerLat" : null,
                "createdAt" : Date.parse("2018-06-19T21:07:09.283Z"),
                "relatedCompanyID" : 0,
                "detailDataLoc" : ""
            },
            {
                "bleAppName" : "test_name",
                "bleAppID" : 100,
                "createdBy" : "admin_calgary",
                "creatorAccessRole" : "admin",
                "foreignKeys" : [],
                "defaultZoomLevel3D" : 10.9,
                "defaultZoomLevel2D" : 9.9,
                "centerAlt" : 0,
                "centerLng" : 0,
                "centerLat" : 0,
                "createdAt" : Date.parse("2018-06-08T22:56:13.098Z"),
                "relatedCompanyID" : 9,
                "detailDataLoc" : "123"
            },
            {
                "bleAppName" : "app for sim data. don't delete!!!",
                "bleAppID" : 99,
                "createdBy" : "admin_calgary",
                "creatorAccessRole" : "admin",
                "foreignKeys" : [ 
                    {
                        "description" : "pasture 3",
                        "keyValue" : "0003",
                        "keyName" : "pastureID"
                    }
                ],
                "defaultZoomLevel3D" : 10.9,
                "defaultZoomLevel2D" : 9.9,
                "centerAlt" : 0,
                "centerLng" : 121.5,
                "centerLat" : 31.2,
                "createdAt" : Date.parse("2018-05-25T23:12:43.630Z"),
                "relatedCompanyID" : 9,
                "detailDataLoc" : "123"
            }
        ];
        this.bleApplicationMock.expects("find")
            .chain("sort").withArgs({ bleAppID: 1})
            .resolves(bleObjCreatedByAdminUser);
        // Assume that all three bleApps has corresponding BLE gateways
        let bleGwAgg = [
            {
                _id: { bleAppID: 102},
                macAddresses: ["B9DAEBC98039"]
            },
            {
                _id: { bleAppID: 100},
                macAddresses: ["B9D3EBC98039"]
            },
            {
                _id: { bleAppID: 99},
                macAddresses: ["B911EBC98039"]
            }];
        this.bleGwMock.expects("aggregate").resolves(bleGwAgg);
        // Assume that only bleApp99 has 2 abnormal BLE tags: 111111222222, 333333444444
        let bleNode99Mock = sinon.mock(reqFile("./models/ble/bleNode.js")(99));
        bleNode99Mock.expects("distinct").resolves(["111111222222", "333333444444", "555555666666"]);
        
        // The BLE nodes in the rest of the BLE applications are fine.
        let bleNode100Mock = sinon.mock(reqFile("./models/ble/bleNode.js")(100));
        let bleNode102Mock = sinon.mock(reqFile("./models/ble/bleNode.js")(102));
        bleNode100Mock.expects("distinct").resolves([]);
        bleNode102Mock.expects("distinct").resolves(["AAAAAABBBBBB", "CCCCCCDDDDDD"]);

        // Next, the function uses the distinct BLE node mac addresses to query their travelled distances
        // within the past 24 hours, and determine if they were behaving abnormally.
        let nodeDistanceTravelledMock99 = sinon.mock(reqFile("./models/ble/bleNodeDistanceTravelled.js")(99));
        let nodeDistanceTravelledAgg = [{
            _id: { macAddress: "111111222222"},
            distanceTravelled: 4.5
        },{
            _id: { macAddress: "333333444444"},
            distanceTravelled: 4.5            
        },{
            _id: { macAddress: "555555666666"},
            distanceTravelled: 5.5            
        }];
        nodeDistanceTravelledMock99.expects("aggregate").resolves(nodeDistanceTravelledAgg);
        let res = {
            send: function(finalResult) {
                let resultPromises = [];
                let bleApp99 = finalResult.filter(bleObj => bleObj.bleAppID === 99)[0];
                let bleApp100 = finalResult.filter(bleObj => bleObj.bleAppID === 100)[0];
                let bleApp102 = finalResult.filter(bleObj => bleObj.bleAppID === 102)[0];
                // Test if the three BLE apps have correct abnoraml BLE tags
                let correctNumOfAbnormalTags = true;
                if (bleApp99.numberOfAbnormalTravelledDistances !== 2 || bleApp100.numberOfAbnormalTravelledDistances !== 0 || bleApp102.numberOfAbnormalTravelledDistances !== 0) {
                    correctNumOfAbnormalTags = false;
                }
                resultPromises.push(new Promise((resolve, reject) => {
                    resolve(expect(correctNumOfAbnormalTags).to.be.true);
                }));

                // Test if the three BLE apps have correct numBleTag
                let correctNumBleTag = true;
                if (bleApp99.numBleTag !== 3 || bleApp100.numBleTag !== 0 || bleApp102.numBleTag !== 2) {
                    correctNumBleTag = false;
                }
                resultPromises.push(new Promise((resolve, reject) => {
                    resolve(expect(correctNumBleTag).to.be.true);
                }));

                // Test if the three BLE apps have correct numBleGw
                let correctNumBleGw = true;
                if(bleApp99.numBleGw !== 1 || bleApp100.numBleGw !== 1 || bleApp102.numBleGw !== 1) {
                    correctNumBleGw = false;
                }
                resultPromises.push(new Promise((resolve, reject) => {
                    resolve(expect(correctNumBleGw).to.be.true);
                }));

                Promise.all(resultPromises).then(() => {
                    done();
                    // Restore the mocked functions
                    bleNode99Mock.restore();
                    bleNode100Mock.restore();
                    bleNode102Mock.restore();
                    nodeDistanceTravelledMock99.restore();
                }).catch((err) => {
                    done(err);
                    // Restore the mocked functions
                    bleNode99Mock.restore();
                    bleNode100Mock.restore();
                    bleNode102Mock.restore();
                    nodeDistanceTravelledMock99.restore();
                })
            }
        };

        bleAppFuncs.getNumDevicesInBleAppsCreatedBy(this.req, res, next);
    });
});
