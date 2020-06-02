let mongoose = require("mongoose");
mongoose.Promise = global.Promise;
let sinon = require("sinon");
require("sinon-mongoose");
let chai = require("chai");
reqFile = require.main.require;
let expect = chai.expect;
let consts = require("../config/constants.js");
let parkingLotObj = require("../routes/anyueFunctions/parkingLotFunctions.js");
// Define fake req and next objects, which are to be passed into the 
// express router function to be tested. 
let req = {
    params: { applicationID: "5" }
};
let next = () => {};

// Define the MongoDb collections used in the express router function
let parkingLot = reqFile("./models/loraDevices/parkingLotSensor.js")(req.params.applicationID);
let appNodeSession = reqFile("./models/nodeSessionAppServ.js")(req.params.applicationID);

// Define logger so that they can be used in the functions to be tested
// later on.
let logger = reqFile("./common/tracer.js");

//-- Start to test the GET/api/anyue/5/charginglotstatus function. The number 5 is the mocked applicationID
describe("GET/api/anyue/5/charginglotstatus", () => {

    // Before running each it() test, we need to define the mocked MongoDB collection.
    beforeEach(() => {
        this.parkingLotMock = sinon.mock(parkingLot);
        this.appNodeSessionMock = sinon.mock(appNodeSession);
    });
    // After each test, we need to restore the MongoDB collection to their original status
    afterEach(() => {
        this.parkingLotMock.restore();
        this.appNodeSessionMock.restore();
    })
    // Fist scenario: when the zmq record does not contain parsed data
    // AKA, when the parsedData field was undefined
    it("If the latest ZMQ record available for a given device does not have parsed data, the status field will contain null.", (done) => {
        let res = {
            send: function (finalResp) {
                // Insert the expectation here
                let result = new Promise ((resolve, reject) => {
                    resolve(expect(finalResp[0].status === null).to.be.true);
                });
                result.then(() => done(), done);         
            }
        };

        let zmqResp = [{
            latest: {
                devEUI: "AABBCCDDAABBCC01",
                timestamp: new Date("2018-05-30T00:00:00Z"),
                parsedData: undefined,
                rawData: [
                    {
                        "parsePayload": true,
                        "fCntUp": 10,
                        "payload": "AB82E400AE",
                        "timeSecond": 46
                    }
                ]
            }
        }];

        let nsResp = [{ DevEUI: "AABBCCDDAABBCC01", Name: "test application" }];

        // Stub the Mongoose methods and have it resolve to an object defined by this test
        this.parkingLotMock.expects("aggregate").resolves(zmqResp);
        this.appNodeSessionMock.expects("find").resolves(nsResp);

        // Call the express function which takes three 'mocked' parameters.
        parkingLotObj.parkingLotFunction(req, res, next);
    
    });

    it("When the parking lot sensor zmq record contains one of the error code, the response status field will contain 'error'.", (done) => {
        let res = {
            send: function (finalResp) {
                // Insert the expectation here
                let result = new Promise ((resolve, reject) => {
                    resolve(expect(finalResp[0].status === "error").to.be.true);
                });
                result.then(() => done(), done);         
            }
        };

        let zmqResp = [{
            latest: {
                devEUI: "AABBCCDDAABBCC01", 
                timestamp: new Date("2018-05-30T00:00:00Z"), 
                parsedData: [
                    {
                        "timeSecond": 46,
                        "battLevel": 100,
                        "parkFlag": "occupied",
                        "statusCode": "5",
                        "fCount": 8
                    }
                ], rawData: [
                    {
                        "parsePayload": true,
                        "fCntUp": 10,
                        "payload": "AB82E400AE",
                        "timeSecond": 46
                    }
                ]
            }
        }];

        let nsResp = [{ DevEUI: "AABBCCDDAABBCC01", Name: "test application" }];

        // Stub the Mongoose methods and have it resolve to an object defined by this test
        this.parkingLotMock.expects("aggregate").resolves(zmqResp);
        this.appNodeSessionMock.expects("find").resolves(nsResp);

        // Call the express function which takes three 'mocked' parameters.
        parkingLotObj.parkingLotFunction(req, res, next);
        
    });

    it("If there is no error detected in the statusCode, this field contains either \"available\" or \"occupied\"", (done) => {
        let res = {
            send: function (finalResp) {
                // Insert the expectation here
                let result = new Promise ((resolve, reject) => {
                    resolve(expect(finalResp[0].status === ("occupied" || "available")).to.be.true);
                });
                result.then(() => done(), done);         
            }
        };
        let zmqResp = [{
            latest: {
                devEUI: "AABBCCDDAABBCC01",
                timestamp: new Date("2018-05-30T00:00:00Z"),
                parsedData: [
                    {
                        "timeSecond": 46,
                        "battLevel": 100,
                        "parkFlag": "occupied",
                        "statusCode": "2",
                        "fCount": 8
                    }
                ], rawData: [
                    {
                        "parsePayload": true,
                        "fCntUp": 10,
                        "payload": "AB82E400AE",
                        "timeSecond": 46
                    }
                ]
            }
        }];

        let nsResp = [{DevEUI: "AABBCCDDAABBCC01", Name: "test application"}];

        // Stub the Mongoose methods and have it resolve to an object defined by this test
        this.parkingLotMock.expects("aggregate").resolves(zmqResp);
        this.appNodeSessionMock.expects("find").resolves(nsResp);

        // Call the express function which takes three 'mocked' parameters.
        parkingLotObj.parkingLotFunction(req, res, next);
    });

    it("If there are more than one valid parkinglot sensors, and they contain various zmq statuses, each of them should have reasonable \"status\" field.", (done) => {
        let res = {
            send: function (finalResp) {
                // Insert the expectation here
                let resultPromises = [];
                resultPromises.push(
                    new Promise((resolve, reject) => {
                        resolve(expect(finalResp[0].status === "occupied").to.be.true);
                    }
                    )
                );
                resultPromises.push(
                    new Promise((resolve, reject) => {
                        resolve(expect(finalResp[1].status === null).to.be.true);
                    }
                    )
                );
                resultPromises.push(
                    new Promise((resolve, reject) => {
                        resolve(expect(finalResp[2].status === "error").to.be.true);
                    }
                    )
                );

                Promise.all(resultPromises).then((results) => { 
                    done(); }).catch((err) => {
                    done(err);
                });
            }
        };
        let zmqResp = [{
            latest: {
                devEUI: "AABBCCDDAABBCC01",
                timestamp: new Date("2018-05-30T00:00:01Z"),
                parsedData: [
                    {
                        "timeSecond": 46,
                        "battLevel": 100,
                        "parkFlag": "occupied",
                        "statusCode": "2",
                        "fCount": 8
                    }
                ], rawData: [
                    {
                        "parsePayload": true,
                        "fCntUp": 10,
                        "payload": "AB82E400AE",
                        "timeSecond": 46
                    }
                ]
            }
        }, {
            latest: {
                devEUI: "AABBCCDDAABBCC02",
                timestamp: new Date("2018-05-30T00:00:02Z"),
                parsedData: undefined, rawData: [
                    {
                        "parsePayload": true,
                        "fCntUp": 10,
                        "payload": "AB82E400AE",
                        "timeSecond": 46
                    }
                ]
            }
        }, {
            latest: {
                devEUI: "AABBCCDDAABBCC03",
                timestamp: new Date("2018-05-30T00:00:03Z"),
                parsedData: [
                    {
                        "timeSecond": 46,
                        "battLevel": 100,
                        "parkFlag": "occupied",
                        "statusCode": "5",
                        "fCount": 8
                    }
                ], rawData: [
                    {
                        "parsePayload": true,
                        "fCntUp": 10,
                        "payload": "AB82E400AE",
                        "timeSecond": 46
                    }
                ]
            }
        }];

        let nsResp = [
            {DevEUI: "AABBCCDDAABBCC01", Name: "test application01"},
            {DevEUI: "AABBCCDDAABBCC02", Name: "test application02"},
            {DevEUI: "AABBCCDDAABBCC03", Name: "test application03"}
        ];

        // Stub the Mongoose methods and have it resolve to an object defined by this test
        this.parkingLotMock.expects("aggregate").resolves(zmqResp);
        this.appNodeSessionMock.expects("find").resolves(nsResp);

        // Call the express function which takes three 'mocked' parameters.
        parkingLotObj.parkingLotFunction(req, res, next);
    });
});