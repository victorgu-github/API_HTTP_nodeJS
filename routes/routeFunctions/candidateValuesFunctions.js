let mongoose = require("mongoose");
let errorResp = require("../../common/errorResponse.js");
mongoose.Promise = global.Promise;
//let SchemaTypes = mongoose.Schema.Types;

let logger = require("../../common/tracer.js");

let deviceRegFuncs = {};

// - "/lora_device/candidate_values"
deviceRegFuncs.getLoRaDeviceCandidateValues = function(req, res, next) {
    let DeviceType = require("../../models/lora/deviceInfo.js")();
    let BandID = require("../../models/lora/bandID.js")();
    let Class = require("../../models/lora/class.js")();

    let promises = [];
    promises.push(DeviceType.distinct("devType").exec((err, resp) => {
        return resp;
    }));
    promises.push(BandID.find({}).exec((err, resp) => {
        return resp;
    }));
    promises.push(Class.find({}).exec((err, resp) => {
        return resp;
    }));
    promises.push(DeviceType.find(
        {
            subTypes: { $exists: true }
        }).then((resp) => {
            let outArr = [];
            for (let i in resp) {
                outArr.push({
                    parentDeviceType:   resp[i].devType,
                    subDeviceTypes:     resp[i].subTypes
                });
            }
            return outArr;
        }));

    Promise.all(promises).then((response) => {
        let rawOutput = {
            DevType:        response[0],
            subDeviceTypes: response[3],
            BandID:         response[1],
            Class:          response[2]
        };
        let cleanedOutput = removeMongoIdFieldsFromCandidateOutput(rawOutput);
        if (response && response.length !== 0) {
            res.send({
                candidateValues: cleanedOutput
            });
            next();
        } else {
            res.send("There is no device info and bandID info in database");
            next();
        }
    }).catch((err) => {
        let msg = "" + err;
        logger.error(msg);
        errorResp.send(res, "Mongo Error", msg, 500);
        next();
    });
};

function removeMongoIdFieldsFromCandidateOutput(input) {
    let out = JSON.parse(JSON.stringify(input));
    for (let i in out.BandID) {
        delete out.BandID[i]._id;
    }
    for (let i in out.Class) {
        delete out.Class[i]._id;
    }
    return out;
}

module.exports = deviceRegFuncs;
