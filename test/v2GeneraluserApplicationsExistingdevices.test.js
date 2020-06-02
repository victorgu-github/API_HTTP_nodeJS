let mongoose = require("mongoose");
mongoose.Promise = global.Promise;
let sinon = require("sinon");
require("sinon-mongoose");
let chai = require("chai");
reqFile = require.main.require;
let expect = chai.expect;
let consts = require("../config/constants.js");

let getExistingDevFuncs = reqFile("./v2/routes/routeFunctions/generalUserAppsFunctions.js");

// This unit test is for testing the getExistingDevFuncs: getUserAppForExistingDev function.
// Let's start by mocking a req parameter. According to the code, it should contain a generalUserApplicationID attribute, otherwise web service will
// throw an error. For simplicity purposes, we do not test the request parameter validation in this unit test.

let req = {
    query: {
        generalUserApplicationID: "5"
    }
};

let next = () => {};

// Define logger so that they can be used in the functions to be tested
// later on.
logger = reqFile("./common/tracer.js");
    
// Test 1: test for any possible outcomes for a general user application without a ble object
describe("Test for all possible data configurations where the general user application has no ble object", () => {
    // Before each it() test, we need to mock the mongo collections and their find functions.
    beforeEach(() => {
        this.GenUserApplicationMock = sinon.mock(reqFile("./models/users/generalUserApplication.js")());     
    });
    // After each test, restore the stubbed Mongo query functions to their original status
    afterEach(() => {
        this.GenUserApplicationMock.restore();
    });

    // Case 1-1: If the general user has neither lora nor ble object
    it("General user apps without either 'lora' or 'ble' fields will produce an empty 'networks' and 'statistics' arrays.", (done) => {
        // Defined the resolved object
        let genUserAppResp = [{
            "generalUserApplicationID" : 5,
            "createdTime" : Date.parse("2018-06-13T17:09:17.714Z"),
            "createdBy" : "admin_calgary",
            "creatorAccessRole" : "admin",
            "modifiedTime" : Date.parse("2018-06-13T17:09:17.714Z"),
            "generalUserApplicationName" : "应用1"
        }];
        // Mock or stub the Mongoose find() method to resolve to customed return
        this.GenUserApplicationMock.expects("find").resolves(genUserAppResp);
        
        let res = {
            send: function(finalResult) {
                let  resultPromises = [
                    new Promise ((resolve, reject) => {
                    resolve(expect(finalResult[0].statistics.length === 0).to.be.true);
                    }),
                    new Promise ((resolve, reject) => {
                        resolve(expect(finalResult[0].networks.length === 0).to.be.true);
                    })
                ];

                Promise.all(resultPromises).then((results) => {
                    done();                    
                }).catch((err) => {
                    done(err);
                });

            }
        };
        getExistingDevFuncs.getUserAppForExistingDev(req, res, next);    
    });
    // Case 1-2: if one general user application does not contain lora and the other contains a complete lora object, but the lora object only has made-up devices.
    it("If one general user application does not contain 'lora' field, or contains a 'lora' field with non-registered devices, the 'networks' and 'statistics' array should be empty.", (done) => {
        // Mock the general user application output
        let genUserAppResp = [
            {
                "generalUserApplicationID" : 5,
                "createdTime" : Date.parse("2018-06-13T17:09:17.714Z"),
                "createdBy" : "admin_calgary",
                "creatorAccessRole" : "admin",
                "modifiedTime" : Date.parse("2018-06-13T17:09:17.714Z"),
                "generalUserApplicationName" : "应用1"
            },
            {
                "modifiedTime" : Date.parse("2018-06-18T23:11:23.952Z"),
                "createdTime" : Date.parse("2018-06-18T23:11:23.952Z"),
                "generalUserApplicationID" : 766,
                "createdBy" : "admin_calgary",
                "creatorAccessRole" : "admin",
                "generalUserApplicationName" : "xy_test_name",
                "ble" : [ 
                    {
                        "bleAppID" : "1",
                        "devices" : "all"
                    }
                ],
                "lora" : {
                    "loraApplicationID" : "8",
                    "devEUIs" : [ 
                        "AAAAAAAABBBBBBBB", 
                        "CCCCCCCCDDDDDDDD"
                    ]
                }
            }
        ];
        
        this.GenUserApplicationMock.expects("find").resolves(genUserAppResp);
        // If the lora devices contained are made-up devices, they should not have any rssi inputs, therefore, we will mock the
        // rssi query result to be an empty array.
        // Optionally, we can choose not to mock the rssiAggData collection, and because there is no mongodb connection
        // in the actual code the attempt to connect to rssiAggData will be handled and the code will continue. That will
        // also give us a statistics[] in the result.
        let LoRaAggData = reqFile("./models/rssiAggData.js")();
        let LoRaAggDataMock = sinon.mock(LoRaAggData);
        LoRaAggDataMock.expects("find").resolves([]);
        // Define the res.send() function, and write the expectations based on the analysis above
        // If the lora obj only contains made-up devices, the networks should be the following format:
        // {networkds: [{type: "lora", applicationID: 8, devices: []}]}
        let res = {
            send: function(result) {
                let resultPromises = [
                    new Promise((resolve, reject) => {
                    resolve(expect(result[0].statistics.length === 0).to.be.true);
                    }),
                    new Promise((resolve, reject) => {
                                    resolve(expect(result[0].networks.length === 0).to.be.true);
                    }),
                    new Promise((resolve, reject) => {
                        resolve(expect(result[1].statistics.length === 0).to.be.true);
                    }),
                    new Promise((resolve, reject) => {
                        resolve(expect(result[1].networks[0].type === "lora").to.be.true);
                    }),
                    new Promise((resolve, reject) => {
                        resolve(expect(result[1].networks[0].applicationID === "8").to.be.true);
                    }),
                    new Promise((resolve, reject) => {
                        resolve(expect(result[1].networks[0].devices.length === 0).to.be.true);
                    })                   
                    ];
                // resolve all the expectations
                Promise.all(resultPromises).then(() => { done(); }).catch((err) => {
                    done(err);
                })
            }
        };
        // Call the function to get the response of the /existingdevices endpoint
        getExistingDevFuncs.getUserAppForExistingDev(req, res, next);       
        // In the end, restore the mocked functions
        LoRaAggDataMock.restore();
    });
    
    // Case 1-3: If the general user application contains valid lora object, and the lora object contains some valid devices.
    it("If the general user application contains a 'lora' field with registered lora devices, the devices' rssi records and DevEUIs will show up in the final output.", (done) => {
        // Let's assume that only AAAAAAAABBBBBBBB is a valid device and is registered in the system.
        let genUserAppResp = [
            {
                "modifiedTime" : Date.parse("2018-06-18T23:11:23.952Z"),
                "createdTime" : Date.parse("2018-06-18T23:11:23.952Z"),
                "generalUserApplicationID" : 766,
                "createdBy" : "admin_calgary",
                "creatorAccessRole" : "admin",
                "generalUserApplicationName" : "xy_test_name",
                "lora" : {
                    "loraApplicationID" : "8",
                    "devEUIs" : [ 
                        "AAAAAAAABBBBBBBB", 
                        "CCCCCCCCDDDDDDDD"
                    ]
                }
            }
        ];
        this.GenUserApplicationMock.expects("find").resolves(genUserAppResp);
        
        // Mock the AppNodeSession Mongo collection and control its return
        // We do not have to mock the rssiAggData collection here. Because not
        // being able to connect to the collection in the unit test scope has the
        // effect as not being able to find any rssi entries in real life. And because
        // we already mocked the device to be found in the database, the number of
        // rssi entries should be automatically set to 24.
        let AppNodeSession = reqFile("./models/nodeSessionAppServ.js")("8");
        let AppNodeSessionMock = sinon.mock(AppNodeSession);
        let appResp = [{
            "DevType" : "bodysensor",
            "DevEUI" : "AAAAAAAABBBBBBBB"
        }];
        AppNodeSessionMock.expects("find").resolves(appResp);
        // Because there is an valid device in the general user application, the statistics array will contain 24 records,
        // and part of the networks[] elements will be valid device(s)
        let res = {
            send: function(finalResp) {
                
                let numOfStatEntry = finalResp[0].statistics[0].data.length;
                let resultPromises = [
                    new Promise((resolve, reject) => {
                        resolve(expect(numOfStatEntry === 24).to.be.true);
                    }),
                    new Promise((resolve, reject) => {
                        resolve(expect(finalResp[0].networks[0].applicationID === "8").to.be.true);
                    }),
                    new Promise((resolve, reject) => {
                        resolve(expect(finalResp[0].networks[0].devices.length === 1).to.be.true);
                    })
                    
                ];
                Promise.all(resultPromises).then(() => { done();AppNodeSessionMock.restore(); }).catch((err) => {
                    done(err);
                    AppNodeSessionMock.restore();
                });
            }
        };
        // Call the function to get the response of the /existingdevices endpoint
        getExistingDevFuncs.getUserAppForExistingDev(req, res, next);

    });
});

// Test 2: test for all the possible outcomes if a general user application does not have lora object
describe("Test for all the possible data configurations when the general user application(s) does not have lora object(s)", () => {
    beforeEach(() => {
        this.GenUserApplicationMock = sinon.mock(reqFile("./models/users/generalUserApplication.js")());
        this.BleAppMock = sinon.mock(reqFile("./models/ble/bleApplication.js")());
    });
    afterEach(() => {
        this.GenUserApplicationMock.restore();
        this.BleAppMock.restore();
    });

    // Case 2-1
    it("If one of the genApp's ble application contains an 'all' string in its device field, and the rest of the ble application do not exist in the system.", (done) => {

        let genUserAppResp = [{
            "modifiedTime" : Date.parse("2018-06-08T23:56:59.615Z"),
            "createdTime" : Date.parse("2018-06-08T23:56:59.615Z"),
            "generalUserApplicationID" : 761,
            "createdBy" : "evan",
            "creatorAccessRole" : "admin",
            "generalUserApplicationName" : "some name with no duplicate app IDs",
            "ble" : [ 
                {
                    "bleAppID" : "1",
                    "devices" : "all"
                }, 
                {
                    "bleAppID" : "2",
                    "devices" : []
                }, 
                {
                    "bleAppID" : "3",
                    "devices" : []
                }
            ]
        }];
        this.GenUserApplicationMock.expects("find").resolves(genUserAppResp);
        let bleAppResp = [{
            "bleAppName" : "calgary test (don't delete!!!)",
            "bleAppID" : 1,
            "createdBy" : "admin_calgary",
            "creatorAccessRole" : "admin",
            "defaultZoomLevel3D" : 16,
            "defaultZoomLevel2D" : 20,
            "centerAlt" : null,
            "centerLng" : -114,
            "centerLat" : 51,
            "createdAt" : Date.parse("2018-04-18T20:36:03.519Z"),
            "relatedCompanyID" : 4,
            "detailDataLoc" : "",
            "foreignKeys" : [ 
                {
                    "description" : "pasture 1",
                    "keyValue" : "0001",
                    "keyName" : "pastureID"
                }, 
                {
                    "description" : "pasture 2",
                    "keyValue" : "0002",
                    "keyName" : "pastureID"
                }
            ]
        }];
        this.BleAppMock.expects("find").resolves(bleAppResp);

        let bleNodeSession1Mock = sinon.mock(reqFile("./models/ble/bleNode.js")("1"));
        bleNodeSession1Mock.expects("find").resolves([]);

        // Write the expected output in the res.send() function, based on the analysis abovve
        let res = {
            send: function(finalResp) {
                let bleApp1 = finalResp[0].networks[0].bleApps.filter(bleApp => bleApp.bleAppID === "1");
                let bleApp2 = finalResp[0].networks[0].bleApps.filter(bleApp => bleApp.bleAppID === "2");
                let bleApp3 = finalResp[0].networks[0].bleApps.filter(bleApp => bleApp.bleAppID === "3");
                // The bleAppID 1 should have devices as "all", and valid numOfDevices
                // This unit test revealed a bug in the code in terms of finding numOfDevices for ble object that contains "all"
                let resultPromises = [
                    new Promise((resolve, reject) => {
                        resolve(expect(bleApp1[0].devices === "all").to.be.true);
                    }),
                    new Promise((resolve, reject) => {
                        resolve(expect(bleApp2[0].devices.length === 0).to.be.true);
                    }),
                    new Promise((resolve, reject) => {
                        resolve(expect(bleApp3[0].devices.length === 0).to.be.true);
                    })
                ];
                Promise.all(resultPromises).then(() =>
                    { bleNodeSession1Mock.restore();
                      done();
                    }).catch((err) => {
                        bleNodeSession1Mock.restore;
                        done(err);
                })
            }
        };
        // Call the function to get the response of the /existingdevices endpoint
        getExistingDevFuncs.getUserAppForExistingDev(req, res, next);
    });

    // Case 2-2
    it("If a genApp's ble app contains 'all' string in its device field, and the rest of the bleApps contain valid devices.", (done) => {
        // Assume the bleApp2 has a valid device "AABBCCDDAABBCCDD".
        // In order to validate the given macAddress, we need to mock the reqFile("./models/ble/bleNode.js")(bleAppID) function
        // used by the 'queryAllBleDevicesInSpecifiedBleApps' function
        let genUserAppResp = [{
            "modifiedTime" : Date.parse("2018-06-08T23:56:59.615Z"),
            "createdTime" : Date.parse("2018-06-08T23:56:59.615Z"),
            "generalUserApplicationID" : 761,
            "createdBy" : "evan",
            "creatorAccessRole" : "admin",
            "generalUserApplicationName" : "some name with no duplicate app IDs",
            "ble" : [ 
                {
                    "bleAppID" : "1",
                    "devices" : "all"
                }, 
                {
                    "bleAppID" : "2",
                    "devices" : ["B0B448EC3C04"]
                }
            ]
        }];
        this.GenUserApplicationMock.expects("find").resolves(genUserAppResp);
        let bleAppResp = [{
            "bleAppName" : "calgary test (don't delete!!!)",
            "bleAppID" : 1,
            "createdBy" : "admin_calgary",
            "creatorAccessRole" : "admin",
            "defaultZoomLevel3D" : 16,
            "defaultZoomLevel2D" : 20,
            "centerAlt" : null,
            "centerLng" : -114,
            "centerLat" : 51,
            "createdAt" : Date.parse("2018-04-18T20:36:03.519Z"),
            "relatedCompanyID" : 4,
            "detailDataLoc" : "",
            "foreignKeys" : [ 
                {
                    "description" : "pasture 1",
                    "keyValue" : "0001",
                    "keyName" : "pastureID"
                }, 
                {
                    "description" : "pasture 2",
                    "keyValue" : "0002",
                    "keyName" : "pastureID"
                }
            ]
        },
        {
            "bleAppName" : "calgary test (don't delete!!!)",
            "bleAppID" : 2,
            "createdBy" : "admin_calgary",
            "creatorAccessRole" : "admin",
            "defaultZoomLevel3D" : 16,
            "defaultZoomLevel2D" : 20,
            "centerAlt" : null,
            "centerLng" : -114,
            "centerLat" : 51,
            "createdAt" : Date.parse("2018-04-18T20:36:03.519Z"),
            "relatedCompanyID" : 4,
            "detailDataLoc" : "",
            "foreignKeys" : [ 
                {
                    "description" : "pasture 1",
                    "keyValue" : "0001",
                    "keyName" : "pastureID"
                }, 
                {
                    "description" : "pasture 2",
                    "keyValue" : "0002",
                    "keyName" : "pastureID"
                }
            ]
         }];
        this.BleAppMock.expects("find").resolves(bleAppResp);
        // Mock the queryAllBleDevicesInSpecifiedBleApps function to find valid ble nodes
        // given a specific bleAppID
        let bleNodeSession1Mock = sinon.mock(reqFile("./models/ble/bleNode.js")("1"));
        bleNodeSession1Mock.expects("find").resolves([{
            "macAddress": "B0B448EC3C03"
        }, {
            "macAddress": "B0B448EC3C11"
        }]);
        let bleNodeSession2Mock = sinon.mock(reqFile("./models/ble/bleNode.js")("2"));
        bleNodeSession2Mock.expects("find").resolves([{ "macAddress": "B0B448EC3C04"}]);
        // Write the expected output into the res.send() function based on the analysis above
        let res = {
            send: function(finalResp) {
                let resultPromises = [];
                let bleApp1 = finalResp[0].networks[0].bleApps.filter(bleApp => bleApp.bleAppID === "1") ;
                let bleApp2 = finalResp[0].networks[0].bleApps.filter(bleApp => bleApp.bleAppID === "2");
                // Expect the bleApp1 contains 2 devices, which is all the devices belonging
                // to the corresponding application
                resultPromises.push( new Promise(( resolve, reject ) => {
                    resolve(expect(bleApp1[0].numOfDevices === 2).to.be.true);
                }));
                // Expect the bleApp2 contains 1 device, which is the valid device in
                // bleApp2 node session
                resultPromises.push( new Promise(( resolve, reject) => {
                    resolve(expect(bleApp2[0].numOfDevices === 1).to.be.true);
                }));

                // If the bleApplications exist in the system, the output should have the correct attributes
                let blePropertiesSetCorrectly = true;
                let ble1SpatialInfo = {
                    "lat": 51,
                    "lon": -114,
                    "alt": null,
                    "zoomLevel2D": 20,
                    "zoomLevel3D": 16
                };
                for (let field in ble1SpatialInfo) {

                    if (bleApp1[0].spatialInfo[field] !== ble1SpatialInfo[field]) {
                        logger.info(field);
                        blePropertiesSetCorrectly = false;
                    }
                }

                let ble2SpatialInfo = {
                    "lat": 51,
                    "lon": -114,
                    "alt": null,
                    "zoomLevel2D": 20,
                    "zoomLevel3D": 16
                };
                for (let field in ble2SpatialInfo) {
                    if (bleApp2[0].spatialInfo[field] !== ble2SpatialInfo[field]) {
                        logger.info(field);
                        blePropertiesSetCorrectly = false;
                    }
                }
                // Expect the ble spatialInfo fields were set properly
                resultPromises.push( new Promise(( resolve, reject ) => {
                    resolve(expect(blePropertiesSetCorrectly).to.be.true);
                }));

                Promise.all(resultPromises).then(() => {
                    done();
                    // Restore the mocked functions
                    bleNodeSession1Mock.restore();
                    bleNodeSession2Mock.restore();  })
                    .catch((err) => {
                        done(err);
                        // Restore the mocked functions
                        bleNodeSession1Mock.restore();
                        bleNodeSession2Mock.restore();  
                });
                             
            }
        };
        // Call the function to get the response of the /existingdevices endpoint
        getExistingDevFuncs.getUserAppForExistingDev(req, res, next);
    });
});

// Test 3: The general user application(s) have both ble and lora object, test for all the possible outputs
describe("Test for all the possible data configurations for general user application(s) that contain(s) both ble object and lora object.", () => {
    beforeEach(() => {
        this.GenUserApplicationMock = sinon.mock(reqFile("./models/users/generalUserApplication.js")());
        this.BleAppMock = sinon.mock(reqFile("./models/ble/bleApplication.js")());
        this.appNodeSessionMock = sinon.mock(reqFile("./models/nodeSessionAppServ.js")("8"));
        this.genUserAppResp = [{
            "modifiedTime" : Date.parse("2018-05-08T03:24:38.246Z"),
            "createdTime" : Date.parse("2018-05-07T06:55:58.142Z"),
            "generalUserApplicationID" : 5,
            "createdBy" : "admin_calgary",
            "creatorAccessRole" : "admin",
            "generalUserApplicationName" : "test",
            "lora" : {
                "devEUIs" : [ 
                    "3839313077367A01"
                ],
                "loraApplicationID" : "8"
            },
            "ble" : [ 
                {
                    "devices" : [ 
                        "AAAAAAAAAA27", 
                        "AAAAAAAAAA28", 
                        "AAAAAAAAAA29", 
                        "AAAAAAAAAA30", 
                        "AAAAAAAAAA31", 
                        "AAAAAAAAAA32", 
                        "AAAAAAAAAA33", 
                        "AAAAAAAAAA34", 
                        "AAAAAAAAAA35"
                    ],
                    "bleAppID" : "38"
                }, 
                {
                    "devices" : "all",
                    "bleAppID" : "31"
                }
            ]
        }];
    });
    
    afterEach(() => {
        this.GenUserApplicationMock.restore();
        this.BleAppMock.restore();
        this.appNodeSessionMock.restore();
    });
    // Case 3-1
    it("If neither of the genApp's 'ble' non 'lora' fields contain any registered devices.", (done) => {
        this.GenUserApplicationMock.expects("find").resolves(this.genUserAppResp);
        this.appNodeSessionMock.expects("find").resolves([]);
        this.BleAppMock.expects("find").resolves([]);
        // Mock querying ble nodes based on bleAppID. Because we assume all the ble nodes were invalid,
        // we assign the returned results with empty arrays for both applications.
        let bleNodeSession38Mock = sinon.mock(reqFile("./models/ble/bleNode.js")("38"));
        bleNodeSession38Mock.expects("find").resolves([]);

        let bleNodeSession31Mock = sinon.mock(reqFile("./models/ble/bleNode.js")("31"));
        bleNodeSession31Mock.expects("find").resolves([]);

        let res = {
            send: function(finalResult) {
                let resultPromises = [];
                // Expect both ble applcications have 0 devices
                let bleApps = finalResult[0].networks.filter(obj => obj.type === "ble")[0].bleApps;
                let bleDeviceNumIs0 = true;
                for (let i in bleApps) {
                    if (bleApps[i].numOfDevices !== 0) {
                        bleDeviceNumIs0 = false;
                    }
                }
                resultPromises.push(new Promise((resolve, reject) => {
                    resolve(expect(bleDeviceNumIs0).to.be.true);
                }));
                
                Promise.all(resultPromises).then(() => {
                    // restore the mocked functions
                    bleNodeSession38Mock.restore();
                    bleNodeSession31Mock.restore();
                    done();

                }).catch((err) => {
                    // restore the mocked functions
                    bleNodeSession38Mock.restore();
                    bleNodeSession31Mock.restore();
                    done(err);

                })
            }
        };
        
        // Call the function to get the response of the /existingdevices endpoint
        getExistingDevFuncs.getUserAppForExistingDev(req, res, next);
    });

    // Case 3-2
    it("If only one of the genApp's bleApp object contains registered device, while the 'lora' object does not contain any registered device.", (done) => {
        this.GenUserApplicationMock.expects("find").resolves(this.genUserAppResp);
        // Mock the querying ble nodes based on bleAppID
        let bleNodeSession38Mock = sinon.mock(reqFile("./models/ble/bleNode.js")("38"));
        bleNodeSession38Mock.expects("find").resolves([]);
        // Let's pretend that only bleApp31 has one valid device, and because it queries all, the final
        // output should be 1 under the field numOfDevices.
        let bleNodeSession31Mock = sinon.mock(reqFile("./models/ble/bleNode.js")("31"));
        bleNodeSession31Mock.expects("find").resolves([{ "macAddress": "AAAABBBBCCCC" }]);

        this.appNodeSessionMock.expects("find").resolves([]);

        let bleAppResp = [{
            "bleAppName" : "calgary test (don't delete!!!)",
            "bleAppID" : 31,
            "createdBy" : "admin_calgary",
            "creatorAccessRole" : "admin",
            "defaultZoomLevel3D" : 16,
            "defaultZoomLevel2D" : 20,
            "centerAlt" : null,
            "centerLng" : -114,
            "centerLat" : 51,
            "createdAt" : Date.parse("2018-04-18T20:36:03.519Z"),
            "relatedCompanyID" : 4,
            "detailDataLoc" : "",
            "foreignKeys" : [ 
                {
                    "description" : "pasture 1",
                    "keyValue" : "0001",
                    "keyName" : "pastureID"
                }, 
                {
                    "description" : "pasture 2",
                    "keyValue" : "0002",
                    "keyName" : "pastureID"
                }
            ]
        }];
        this.BleAppMock.expects("find").resolves(bleAppResp);
        let res = {
            send: function(finalResult) {
                let resultPromises = [];
                // Because there is no valid lora device, expect the statistics object to be
                // an empty array.
                resultPromises.push(new Promise((resolve, reject) => {
                    resolve(expect(finalResult[0].statistics.length === 0).to.be.true);
                }));
                // Also expect the lora object in networks[] has an empty devices[] field
                let loraObj = finalResult[0].networks.filter(obj => obj.type === "lora");
                resultPromises.push(new Promise((resolve, reject) => {
                    resolve(expect(loraObj[0].devices.length === 0).to.be.true);
                }));
                // Next, expect that the bleAPp38 does not exist, which means it should
                // contain no valid devices and no valid spatial infos
                let bleApp38NotExist = true;
                let bleApps = finalResult[0].networks.filter(obj => obj.type === "ble");
                let bleApp38 = bleApps[0].bleApps.filter(bleObj => bleObj.bleAppID === "38" );
                if (bleApp38[0].numOfDevices > 0) {
                    bleApp38NotExist = false;
                }
                
                for (let field in bleApp38[0].spatialInfo) {
                    if (bleApp38[0].spatialInfo[field] !== null) {
                        bleApp38NotExist = false;
                    }
                }
                resultPromises.push(new Promise((resolve, reject) => {
                    resolve(expect(bleApp38NotExist).to.be.true);
                }));
                // Finally, expect that the bleApp31 exists and has valid devices.
                let bleApp31HasCorrectValues = true;
                let bleApp31 = bleApps[0].bleApps.filter(bleObj => bleObj.bleAppID === "31");
                if (bleApp31[0].numOfDevices !== 1) {
                    bleApp31HasCorrectValues = false;
                }
                let expectedSpatialInfo = {
                    "zoomLevel3D" : 16,
                    "zoomLevel2D" : 20,
                    "lat" : 51,
                    "lon" : -114
                }
                for (let field in expectedSpatialInfo) {
                    if (expectedSpatialInfo[field] !== bleApp31[0].spatialInfo[field]) {
                        bleApp31HasCorrectValues = false;
                    }
                }
                resultPromises.push(new Promise((resolve, reject) => {
                    resolve(expect(bleApp31HasCorrectValues).to.be.true);
                }));
                // Resolve all the promises
                Promise.all(resultPromises).then(() => {
                    done();
                    // Restore mocked functions
                    bleNodeSession31Mock.restore();
                    bleNodeSession38Mock.restore();
                }).catch((err) => {
                    done(err);
                    // Restore mocked functions
                    bleNodeSession31Mock.restore();
                    bleNodeSession38Mock.restore();
                })
            }
        };

        // Call the function to get the response of the /existingdevices endpoint
        getExistingDevFuncs.getUserAppForExistingDev(req, res, next);
    });

    // Case 3-3
    it("If the genApp's 'lora' object contains registered devices, and none of its 'ble' objects contains registered devices.", (done) => {
        this.GenUserApplicationMock.expects("find").resolves(this.genUserAppResp);
        
        // Mock the AppNodeSession Mongo collection and control its return
        // We do not have to mock the rssiAggData collection here. Because not
        // being able to connect to the collection in the unit test scope has the
        // effect as not being able to find any rssi entries in real life. And because
        // we already mocked the device to be found in the database, the number of
        // rssi entries should be automatically set to 24.
        let AppNodeSession = reqFile("./models/nodeSessionAppServ.js")("8");
        let AppNodeSessionMock = sinon.mock(AppNodeSession);
        let appResp = [{
            "DevType" : "bodysensor",
            "DevEUI" : "3839313077367A01"
        }];
        AppNodeSessionMock.expects("find").resolves(appResp);
        // Because there is an valid device in the general user application, the statistics array will contain 24 records,
        // and part of the networks[] elements will be valid device(s)
        let res = {
            send: function(finalResp) {
                
                let numOfStatEntry = finalResp[0].statistics[0].data.length;
                let resultPromises = [
                    new Promise((resolve, reject) => {
                        resolve(expect(numOfStatEntry === 24).to.be.true);
                    }),
                    new Promise((resolve, reject) => {
                        resolve(expect(finalResp[0].networks[0].applicationID === "8").to.be.true);
                    }),
                    new Promise((resolve, reject) => {
                        resolve(expect(finalResp[0].networks[0].devices.length === 1).to.be.true);
                    })
                ];
                Promise.all(resultPromises).then(() => {
                    done();
                    // Restore mocked function
                    AppNodeSessionMock.restore();
                }).catch((err) => {
                    done(err);
                    // Restore mocked function
                    AppNodeSessionMock.restore();
                });
            }
        };
        // Call the function to get the response of the /existingdevices endpoint
        getExistingDevFuncs.getUserAppForExistingDev(req, res, next);
    })
});
