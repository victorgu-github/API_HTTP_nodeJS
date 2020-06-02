let mongoose = require("mongoose");
mongoose.Promise = global.Promise;	// Set the Promise library to native ES6 promises

let config = require("../config/config.js");
let logger = require("../common/tracer.js");

let ActiveNode = require("../models/activeNode.js")(config.runApeSimOn);
let ApeRecord = require("../models/apeRecord.js")(config.runApeSimOn);
let GatewayRecord = require("../models/gatewayRecord.js")(config.runApeSimOn);

// Array of fake latitde and longitude data
let FakeActiveNodes = require("./fakeActiveNodes.js");
let TestLatLong = require("./fakeApeData.js");
let gwMacsArr = require("./realGwMacs.js");

// Utilities
let macLookup = {};
let objIdLookup = {};

buildMacObjIdMap(config.runApeSimOn).then((macObjIdMap) => {
    for (let i in macObjIdMap) {
        macLookup[macObjIdMap[i]._id] = macObjIdMap[i].name;
    }
    for (let i in macObjIdMap) {
        objIdLookup[macObjIdMap[i].name] = macObjIdMap[i]._id;
    }
});

// Global node simulation variables
let simNodes = [];
let testDataCounters = [];
// Global gateway simulation variables
let simGws = [];

let obj = {};

logger.info( "Running simulator on", (require("../db/dbConnections.js")(config.dbNames.ape, config.runApeSimOn, config.agtsDbServer)).name);

function genFakeMACAddr() {
    var macAddr = "";
    var digitValues = "0123456789ABCDEF";
    
    for (var i = 0; i < 6; i++) {
        macAddr += digitValues.charAt(Math.round(Math.random() * 15));
        macAddr += digitValues.charAt(Math.round(Math.random() * 15));
        if (i != 5)
            macAddr += ":";
    }

    return macAddr;
}

obj.startApeSimulation = function() {
    console.log( "Starting simulation for " + FakeActiveNodes.length + " nodes... (inserting one APE record every 1 sec)");
    ActiveNode.find().then((activeNodes) => {
        for (var i = 0; i < activeNodes.length; i++) {
            // Set our offsets first
            //console.log("Setting offset.");
            simNodes.push({
                simNode:	activeNodes[i],
                offset:		(i * (TestLatLong.length / activeNodes.length))
            });
            testDataCounters.push(Math.round(i * (TestLatLong.length / activeNodes.length)));
        }
        //console.log("Starting simulation for:\n", simNodes);
        //console.log("testDataCounters =", testDataCounters);
        setTimeout(simulationLoop, 1000);
    });
};

function simulationLoop() {
    try {
        for (var i = 0; i < simNodes.length; i++) {
            var latLonVals = TestLatLong[testDataCounters[i]].split(/[\t ]+/);
            if (latLonVals.length != 6) return;

            var simRecord = new ApeRecord(
                {
                    node_mac:			stringMacToBuffer(simNodes[i].simNode.node_mac),
                    curr_scenario:		config.runApeSimOn,
                    objId:          	new mongoose.Types.ObjectId(objIdLookup[simNodes[i].simNode.node_mac]),
                    setupId:        	config.runApeSimOn,
                    date:           	new Date().getTime(),
                    mode:           	0,
                    rssChannel:     	1,
                    spatial_info: {
                        pos_lat:		latLonVals[2],
                        pos_lon:		latLonVals[1],
                        pos_hgt:		latLonVals[3],
                        pos_std_e:		1,
                        pos_std_n:		1,
                        pos_std_u:		0,
                        pix_x:			latLonVals[4],
                        pix_y:			latLonVals[5],
                        pix_std_x:		0,
                        pix_std_y:		0
                    },              	
                    sensor_info: {   	
                        acc_mode:		0,
                        acc_x:			0,
                        acc_y:			0,
                        acc_z:			0,
                        mag_mode:		0,
                        mag_x:			0,
                        mag_y:			0,
                        mag_z:			0,
                        gyro_mode:		0,
                        gyro_x:			0,
                        gyro_y:			0,
                        gyro_z:			0
                    },              	
                    num_resv_sens:  	1,
                    resv_sensors: [{  	
                        sensor_type:	"Type 1",
                        resv_mode:  	2,
                        value:      	13,
                        unit:       	"C"
                    }],
                    valid_gateways:     1,
                    gateways: [{	
                        gw_mac: 		genFakeMACAddr(),
                        gw_id: 			Math.round(Math.random() * 2).toString(),
                        rssi: 			0
                    }]
                });
            testDataCounters[i] = ((testDataCounters[i] + 1) >= TestLatLong.length) ? 0 : (testDataCounters[i] + 1);
            simRecord.save();
        }
        setTimeout(simulationLoop, 1000);
    } catch (e) {
        logger.error("Error:", e);
    }
}

obj.startGwSimulation = function() {
    addGwRecords();
    simGws = [];

    var findPromises = [];
    GatewayRecord.distinct("gw_mac").exec((err, uniqueGwMacs) => {
        console.log( "Starting simulation for " + uniqueGwMacs.length + " gateways... (inserting one gateway record every 15 sec)");
        for (var i = 0; i < uniqueGwMacs.length; i++) {
            findPromises.push(GatewayRecord.findOne(
                {
                    gw_mac: uniqueGwMacs[i]
                }
            ));
        }
        Promise.all(findPromises).then((findPromisesContents) => {
            // console.log("findPromisesContents =\n", findPromisesContents);
            for (var i = 0; i < findPromisesContents.length; i++) {
                // console.log("i =", i);
                // console.log("findPromisesContents[", i, "] = ", findPromisesContents[i]);
                simGws.push(findPromisesContents[i]);
            }
            // console.log("simGws.length =", simGws.length);
            setTimeout(gwSimLoop, 0);
        });
    });
};

function addGwRecords() {
    var savePromises = [];
    
    for (var i = 0; i < gwMacsArr.length; i++) {
        var fakeGwRecord = new GatewayRecord(
            {
                gw_mac:				gwMacsArr[i],
                name:		 		"Gateway " + (i + 1),
                description:		"Insert description here.",
                curr_scenario:      1,
                sensor_info:		{
                    acc_mode:	0,
                    acc_x:      0,
                    acc_y:      0,
                    acc_z:      0,
                    mag_mode:   0,
                    mag_x:      0,
                    mag_y:      0,
                    mag_z:      0,
                    gyro_mode:  0,
                    gyro_x:     0,
                    gyro_y:     0,
                    gyro_z:     0
                },
                resv_sensors:		[{
                    sensor_type:	"temp_sensor",
                    resv_mode:		0,
                    value:			((Math.random() * 40) - 20).toFixed(2),
                    unit:			"C"
                }, {
                    sensor_type:	"humid_sensor",
                    resv_mode:		0,
                    value:			(100 - (Math.random() * 30)).toFixed(2),
                    unit:			"%"
                }, {
                    sensor_type:	"qual_sensor",
                    resv_mode:		0,
                    value:			(Math.random() * 3).toFixed(2),
                    unit:			"mg/m^3"
                }],
                date:				new Date(new Date().getTime())
            }
        );
        savePromises.push(fakeGwRecord.save());
    }

    return Promise.all(savePromises);
}

function gwSimLoop() {
    try {
        var savePromises = [];
        for (var i = 0; i < simGws.length; i++) {
            // Will generate some better random values later
            var fakeGwRecord = new GatewayRecord(
                {
                    gw_mac:				simGws[i].gw_mac,
                    name:		 		simGws[i].name,
                    description:		simGws[i].description,
                    curr_scenario:      1,
                    sensor_info:		{
                        acc_mode:	0,
                        acc_x:      0,
                        acc_y:      0,
                        acc_z:      0,
                        mag_mode:   0,
                        mag_x:      0,
                        mag_y:      0,
                        mag_z:      0,
                        gyro_mode:  0,
                        gyro_x:     0,
                        gyro_y:     0,
                        gyro_z:     0
                    },
                    resv_sensors:		[{
                        sensor_type:	"temp_sensor",
                        resv_mode:		0,
                        value:			((Math.random() * 40) - 20).toFixed(2),
                        unit:			"C"
                    }, {
                        sensor_type:	"humid_sensor",
                        resv_mode:		0,
                        value:			(100 - (Math.random() * 30)).toFixed(2),
                        unit:			"%"
                    }, {
                        sensor_type:	"qual_sensor",
                        resv_mode:		0,
                        value:			(Math.random() * 3).toFixed(2),
                        unit:			"mg/m^3"
                    }],
                    date:				new Date(new Date().getTime())
                }
            );
            savePromises.push(fakeGwRecord.save());
        }
        Promise.all(savePromises).then(() => {
            setTimeout(gwSimLoop, 15000);
        });
    } catch (e) {
        logger.error(e);
    }
}

function stringMacToBuffer(input) {
    var inputCleaned = input.replace(/:/gi, "");
    // console.log("stringMacToBuffer input =", inputCleaned);
    var output = new Buffer(6);
    for (var i = 0; i < 6; i++) {
        output[i] = parseInt("0x" + inputCleaned[i * 2] + inputCleaned[i * 2 + 1]);
    }

    // console.log("stringMacToBuffer output =", output);
    return output;
}

function buildMacObjIdMap(scenario) {
    let ApeObjects = require("../models/apeObject.js")(scenario);
    if (ApeObjects !== undefined && ApeObjects !== null) {
        return ApeObjects.find().then((resp) => {
            if (resp !== undefined && resp !== null) {
                let respClean = [];
                for (let i in resp) {
                    let temp = JSON.parse(JSON.stringify(resp[i]));
                    temp.name = temp.name.replace(/-/gi, ":");
                    respClean.push(temp);
                }
                // console.log("buildMacObjIdMap respClean =", respClean);
                return respClean;
            } else {
                logger.error("buildMacObjIdMap(): resp is", resp);
                return { };
            }
        });
    } else {
        logger.error("ApeObjects is", ApeObjects);
        return { };
    }
}

obj.startApeSimulation();
obj.startGwSimulation();

module.exports = obj;
