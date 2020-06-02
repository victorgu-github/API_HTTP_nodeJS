var mongoose = require("mongoose");
mongoose.Promise = global.Promise;

let errorResp = require("../../common/errorResponse.js");
let dataFormat = require("../../common/dataFormat.js");
let loraGwValidation = require("../../common/loraGatewayValidation.js");
let defaultValues = require("../../config/loraGatewayDefaultValues.js");
let consts = require("../../config/constants.js");

let obj = {};

obj.getLoRaGatewayModel = require("../../models/loraGateway.js");
obj.LoRaGateway = obj.getLoRaGatewayModel();

// - GET "/lora_gw/config"
obj.getLoRaGateways = function(req, res, next) {
    let LoRaGateway = obj.getLoRaGatewayModel();
    LoRaGateway.find(getSearchQuery(req)).then((resp, err) => {
        if (err) {
            errorResp.send(res, "Error encountered while trying to query database: " + err);
            next();
        } else if (resp === undefined || resp === null) {
            errorResp.send(res, "Server Error", "Mongo query response is " + resp, 500);
            next();
        } else {
            let cleanedResp = [];
            resp.forEach((gw) => {
                let cleanedDoc = dataFormat.enforceSchemaOnDocument(LoRaGateway, gw, true);
                removeFloatingPointErrorsFromDisplayedLoRaGwDocument(cleanedDoc);
                cleanedResp.push(cleanedDoc);
            });
            res.send({ result: cleanedResp });
            next();
        }
    }).catch((mongooseErr) => {
        errorResp.send(res, "Mongoose Error", mongooseErr.message, 500);
        next();
    });
};

function getSearchQuery(req) {
    if (req.query.gwMAC) {
        let gwMAC = req.query.gwMAC;
        
        if (gwMAC.includes(",")) { // Find many
            let gwMACs = gwMAC.split(",");
            for (let i in gwMACs) {
                gwMACs[i] = gwMACs[i].toUpperCase();
            }
            return { GatewayMAC: { $in: gwMACs } };
        } else // Find one
            return { GatewayMAC: gwMAC.toUpperCase() };
    } // else find all
}

function removeFloatingPointErrorsFromDisplayedLoRaGwDocument(doc) {
    if (doc.GpsRefLon !== undefined)
        doc.GpsRefLon = dataFormat.removeFloatingPointError(doc.GpsRefLon);
    if (doc.GpsRefLat !== undefined)
        doc.GpsRefLat =dataFormat.removeFloatingPointError(doc.GpsRefLat);
    if (doc.GpsRefAlt !== undefined)
        doc.GpsRefAlt =dataFormat.removeFloatingPointError(doc.GpsRefAlt);
    if (doc.GpsGeoJSON !== undefined)
        doc.GpsGeoJSON.coordinates[0]= dataFormat.removeFloatingPointError(doc.GpsGeoJSON.coordinates[0]);
    if (doc.GpsGeoJSON !== undefined)
        doc.GpsGeoJSON.coordinates[1]= dataFormat.removeFloatingPointError(doc.GpsGeoJSON.coordinates[1]);
    if (doc.AntennaGain !== undefined)
        doc.AntennaGain =dataFormat.removeFloatingPointError(doc.AntennaGain);
    if (doc.BeaconPeriod !== undefined)
        doc.BeaconPeriod =dataFormat.removeFloatingPointError(doc.BeaconPeriod);
    if (doc.BeaconFreq !== undefined)
        doc.BeaconFreq =dataFormat.removeFloatingPointError(doc.BeaconFreq);
    if (doc.BeaconFreqNum !== undefined)
        doc.BeaconFreqNum =dataFormat.removeFloatingPointError(doc.BeaconFreqNum);
    if (doc.BeaconFreqStep !== undefined)
        doc.BeaconFreqStep =dataFormat.removeFloatingPointError(doc.BeaconFreqStep);
    if (doc.BeaconDataRate !== undefined)
        doc.BeaconDataRate =dataFormat.removeFloatingPointError(doc.BeaconDataRate);
    if (doc.BeaconBandwidth !== undefined)
        doc.BeaconBandwidth =dataFormat.removeFloatingPointError(doc.BeaconBandwidth);
    if (doc.BeaconPower !== undefined)
        doc.BeaconPower =dataFormat.removeFloatingPointError(doc.BeaconPower);
    if (doc.BeaconInfoDesc !== undefined)
        doc.BeaconInfoDesc =dataFormat.removeFloatingPointError(doc.BeaconInfoDesc);
    if (doc.ClkDrift !== undefined)
        doc.ClkDrift =dataFormat.removeFloatingPointError(doc.ClkDrift);
    if (doc.ClkBias !== undefined)
        doc.ClkBias =dataFormat.removeFloatingPointError(doc.ClkBias);
    if (doc.NtpLatency !== undefined)
        doc.NtpLatency =dataFormat.removeFloatingPointError(doc.NtpLatency);
    if (doc.CoverageInKM !== undefined)
        doc.CoverageInKM = dataFormat.removeFloatingPointError(doc.CoverageInKM);
}

// - POST "/lora_gw/config"
obj.saveLoRaGateway = function(req, res, next) {
    let gatewayMAC = ("" + req.body.GatewayMAC).toUpperCase();
    // Check if LoRa gateway exists first
    obj.LoRaGateway.findOne({ GatewayMAC: gatewayMAC }).then((findResp) => {
        if (findResp === null || findResp === undefined) { // I.e.: GatewayMAC doesn't already exist, so proceed
            // BandID validation is done dynamically from the contents of the current
            // environment, so we need to make our async request first:
            let BandID = require("../../models/lora/bandID.js")();
            BandID.distinct("bandID").then((acceptedBandIDs) => {
                let dbData = { bandID: acceptedBandIDs };
                let validationErrors = loraGwValidation.validateInput(req.body, "save", dbData);
                if (validationErrors === null) {
                    let preppedInput = prepLoRaGatewayInput(res, req.body, "save");
                    (new obj.LoRaGateway(preppedInput)).save().then((saveResp) => {
                        let saveRespCleaned = dataFormat.enforceSchemaOnDocument(obj.LoRaGateway, saveResp, false);
                        removeFloatingPointErrorsFromDisplayedLoRaGwDocument(saveRespCleaned);
                        res.send({ result: saveRespCleaned });
                        next();
                    }).catch((err) => {
                        logger.error(err);
                        errorResp.send(res, consts.error.serverErrorLabel, err + "", 500);
                        next();
                    });
                } else {
                    errorResp.send(res, consts.error.badRequestLabel, validationErrors, 400);
                    next();
                }
            }).catch((err) => {
                logger.error(err);
                errorResp.send(res, consts.error.serverErrorLabel, err + "", 500);
                next();
            });
        } else {
            let errMsg = "GatewayMAC '" + gatewayMAC + "' already exists in database";
            errorResp.send(res, consts.error.badRequestLabel, errMsg, 400);
            next();
        }
    }).catch((err) => {
        logger.error(err);
        errorResp.send(res, consts.error.serverErrorLabel, err + "", 500);
        next();
    });
};

function prepLoRaGatewayInput(res, body, operationType) {
    let output = {
        GatewayMAC: body.GatewayMAC.toUpperCase()
    };

    if (operationType === "save") {
        // Required:
        output.GatewaySN =          body.GatewaySN;
        output.CoreBoardVersion =   body.CoreBoardVersion;
        output.BandID =             body.BandID;
        output.MotherboardVersion = body.MotherboardVersion;

        // Optional:
        output.Description =        body.Description;
        output.SiteID =             body.SiteID;
        output["4gModule"] =        body["4gModule"];
        output["4gSimCardID"] =     body["4gSimCardID"];
        output.ReverseTunnelPort =  body.ReverseTunnelPort;
        output.InstallationNumber = body.InstallationNumber;
        output.InstallationDate =   body.InstallationDate;
        output.WiredNetwork =       body.WiredNetwork;
        output.WiFi =               body.WiFi;
        output["4gLTE"] =           body["4gLTE"];
        output.SiteName =          body.SiteName;
        output.SiteAddress =       body.SiteAddress;
        output.SiteRegion =        body.SiteRegion;
        output.SiteType =          body.SiteType;
        output.SiteDescription =   body.SiteDescription;
        output.SiteCondition =     body.SiteCondition;
        output.SiteSource =        body.SiteSource;
        output.Comments =           body.Comments;
        output.CoverageInKM =       body.CoverageInKM;

        // Not modifiable (i.e.: given default values):
        output.UplinkChan =         defaultValues.UplinkChan;
        output.DownlinkChan =       defaultValues.DownlinkChan;
        output.LoRaWanPublic =      defaultValues.LoRaWanPublic;
        
        output.LgsIP =              defaultValues.LgsIP;
        output.LgsPort =            defaultValues.LgsPort;
        
        output.KeepAliveInternal =  defaultValues.KeepAliveInternal;
        
        output.GpsEnable =          defaultValues.GpsEnable;
        output.GpsRefLon =  (body.GpsRefLon !== undefined) ? dataFormat.enforceFloat(body.GpsRefLon) : defaultValues.GpsRefLon;
        output.GpsRefLat =  (body.GpsRefLat !== undefined) ? dataFormat.enforceFloat(body.GpsRefLat) : defaultValues.GpsRefLat;
        output.GpsRefAlt =  (body.GpsRefAlt !== undefined) ? dataFormat.enforceFloat(body.GpsRefAlt) : defaultValues.GpsRefAlt;
        output.GpsGeoJSON = {
            type: "Point",
            coordinates: [
                output.GpsRefLon,
                output.GpsRefLat
            ]
        };
        
        output.AntennaGain =        defaultValues.AntennaGain;
        output.FskEnable =          defaultValues.FskEnable;
        
        output.BeaconPeriod =       defaultValues.BeaconPeriod;
        output.BeaconFreq =         defaultValues.BeaconFreq;
        output.BeaconFreqNum =      defaultValues.BeaconFreqNum;
        output.BeaconFreqStep =     defaultValues.BeaconFreqStep;
        output.BeaconDataRate =     defaultValues.BeaconDataRate;
        output.BeaconBandwidth =    defaultValues.BeaconBandwidth;
        output.BeaconPower =        defaultValues.BeaconPower;
        output.BeaconInfoDesc =     defaultValues.BeaconInfoDesc;
        
        output.SoftwareVersion =    defaultValues.SoftwareVersion;

        output.RfPktReceived =      defaultValues.RfPktReceived;
        output.RfPktSent =          defaultValues.RfPktSent;
        output.BeaconSent =         defaultValues.BeaconSent;
        output.CrcCheckOk =         defaultValues.CrcCheckOk;

        output.ClkDrift =           defaultValues.ClkDrift;
        output.ClkBias =            defaultValues.ClkBias;
        output.PpsLevel =           defaultValues.PpsLevel;
        output.NtpLevel =           defaultValues.NtpLevel;
        output.NtpLatency =         defaultValues.NtpLatency;

        output.CreatedBy =          res.locals.username;
        output.CreatorAccessRole =  res.locals.accessRole;
    } else if (operationType === "update") {
        if (body.UplinkChan !== undefined)       { output.UplinkChan =      body.UplinkChan; }
        if (body.DownlinkChan !== undefined)     { output.DownlinkChan =    body.DownlinkChan; }
        if (body.LoRaWanPublic !== undefined)    { output.LoRaWanPublic =   body.LoRaWanPublic; }

        if (body.LgsIP !== undefined)            { output.LgsIP =           body.LgsIP; }
        if (body.LgsPort !== undefined)          { output.LgsPort =         body.LgsPort; }
        if (body.KeepAliveInternal !== undefined) { output.KeepAliveInternal =  body.KeepAliveInternal; }

        if (body.GpsEnable !== undefined)        { output.GpsEnable =       body.GpsEnable; }
        if (body.GpsRefLon !== undefined)        { output.GpsRefLon =       dataFormat.enforceFloat(body.GpsRefLon); }
        if (body.GpsRefLat !== undefined)        { output.GpsRefLat =       dataFormat.enforceFloat(body.GpsRefLat); }
        if (body.GpsRefAlt !== undefined)        { output.GpsRefAlt =       dataFormat.enforceFloat(body.GpsRefAlt); }

        if (body.AntennaGain !== undefined)      { output.AntennaGain =     dataFormat.enforceFloat(body.AntennaGain); }
        if (body.FskEnable !== undefined)        { output.FskEnable =       body.FskEnable; }

        if (body.BeaconPeriod !== undefined)     { output.BeaconPeriod =    dataFormat.enforceFloat(body.BeaconPeriod); }
        if (body.BeaconFreq !== undefined)       { output.BeaconFreq =      dataFormat.enforceFloat(body.BeaconFreq); }
        if (body.BeaconFreqNum !== undefined)    { output.BeaconFreqNum =   dataFormat.enforceFloat(body.BeaconFreqNum); }
        if (body.BeaconFreqStep !== undefined)   { output.BeaconFreqStep =  dataFormat.enforceFloat(body.BeaconFreqStep); }
        if (body.BeaconDataRate !== undefined)   { output.BeaconDataRate =  dataFormat.enforceFloat(body.BeaconDataRate); }
        if (body.BeaconBandwidth !== undefined)  { output.BeaconBandwidth = dataFormat.enforceFloat(body.BeaconBandwidth); }
        if (body.BeaconPower !== undefined)      { output.BeaconPower =     dataFormat.enforceFloat(body.BeaconPower); }
        if (body.BeaconInfoDesc !== undefined)   { output.BeaconInfoDesc =  dataFormat.enforceFloat(body.BeaconInfoDesc); }

        if (body.CoreBoardVersion !== undefined) { output.CoreBoardVersion =    body.CoreBoardVersion; }
        if (body.SoftwareVersion !== undefined)  { output.SoftwareVersion =     body.SoftwareVersion; }

        if (body.ClkDrift !== undefined)         { output.ClkDrift =    dataFormat.enforceFloat(body.ClkDrift); }
        if (body.ClkBias !== undefined)          { output.ClkBias =     dataFormat.enforceFloat(body.ClkBias); }
        if (body.PpsLevel !== undefined)         { output.PpsLevel =    body.PpsLevel; }
        if (body.NtpLevel !== undefined)         { output.NtpLevel =    body.NtpLevel; }
        if (body.NtpLatency !== undefined)       { output.NtpLatency =  dataFormat.enforceFloat(body.NtpLatency); }

        if (body.BandID !== undefined)               { output.BandID =              body.BandID; }
        if (body.MotherboardVersion !== undefined)   { output.MotherboardVersion =  body.MotherboardVersion; }
        if (body.Description !== undefined)          { output.Description =         body.Description; }
        if (body.SiteID !== undefined)               { output.SiteID =              body.SiteID; }
        if (body["4gModule"] !== undefined)          { output["4gModule"] =         body["4gModule"]; }
        if (body["4gSimCardID"] !== undefined)       { output["4gSimCardID"] =      body["4gSimCardID"]; }
        if (body.ReverseTunnelPort !== undefined)    { output.ReverseTunnelPort =   body.ReverseTunnelPort; }
        if (body.InstallationNumber !== undefined)   { output.InstallationNumber =  body.InstallationNumber; }
        if (body.InstallationDate !== undefined)     { output.InstallationDate =    body.InstallationDate; }
        if (body.WiredNetwork !== undefined)         { output.WiredNetwork =        body.WiredNetwork; }
        if (body.WiFi !== undefined)                 { output.WiFi =                body.WiFi; }
        if (body["4gLTE"] !== undefined)             { output["4gLTE"] =            body["4gLTE"]; }

        // Next, we must add an automatically-generated GpsGeoJSON field to our update:
        if (body.GpsRefLon !== undefined || body.GpsRefLat !== undefined) {
            if (body.GpsRefLon !== undefined) {
                output["GpsGeoJSON.coordinates.0"] = body.GpsRefLon;
            }
            if (body.GpsRefLat !== undefined) {
                output["GpsGeoJSON.coordinates.1"] = body.GpsRefLat;
            }
        }

        if (body.SiteName !== undefined)               { output.SiteName =              body.SiteName; }
        if (body.SiteAddress !== undefined)            { output.SiteAddress =           body.SiteAddress; }
        if (body.SiteRegion !== undefined)             { output.SiteRegion =            body.SiteRegion; }
        if (body.SiteType !== undefined)               { output.SiteType =              body.SiteType; }
        if (body.SiteDescription !== undefined)        { output.SiteDescription =       body.SiteDescription; }
        if (body.SiteCondition !== undefined)          { output.SiteCondition =         body.SiteCondition; }
        if (body.SiteSource !== undefined)             { output.SiteSource =            body.SiteSource; }
        if (body.Comments !== undefined)                { output.Comments =               body.Comments; }
        if (body.CoverageInKM !== undefined)            { output.CoverageInKM =           dataFormat.enforceFloat(body.CoverageInKM); }
    }

    return output;
}

// - PUT "/lora_gw/config"
// Main entry point for PUT operations. This function first checks whether the document to update
// exists, and, if frontend wants to update the GatewayMAC, if the new GatewayMAC is already taken.
obj.updateLoRaGateway = function(req, res, next) {
    let gatewayMAC = ("" + req.body.GatewayMAC).toUpperCase();
    // Check if LoRa gateway exists first
    obj.LoRaGateway.findOne({ GatewayMAC: gatewayMAC }).then((findResp) => {
        if (findResp !== null && findResp !== undefined) { // I.e.: GatewayMAC *DOES* exist, so proceed
            // BandID validation is done dynamically from the contents of the current
            // environment, so we need to make our async request first:
            let BandID = require("../../models/lora/bandID.js")();
            BandID.distinct("bandID").then((acceptedBandIDs) => {
                let dbData = { bandID: acceptedBandIDs };
                let validationErrors = loraGwValidation.validateInput(req.body, "update", dbData);
                if (validationErrors === null) {
                    let preppedInput = prepLoRaGatewayInput(res, req.body, "update");
                    let query = { GatewayMAC: preppedInput.GatewayMAC };
                    obj.LoRaGateway.findOneAndUpdate(query, preppedInput, { new: true })
                        .exec()
                        .then((updateResp, err) => {
                            if (err === null || err === undefined) {
                                let updateRespCleaned = dataFormat.enforceSchemaOnDocument(obj.LoRaGateway, updateResp, false);
                                removeFloatingPointErrorsFromDisplayedLoRaGwDocument(updateRespCleaned);
                                res.send({ result: updateRespCleaned });
                                next();
                            } else {
                                errorResp.send(res, consts.error.serverErrorLabel, err, 500);
                                next();
                            }
                        }).catch((err) => {
                            logger.error(err);
                            errorResp.send(res, consts.error.serverErrorLabel, (err + ""), 500);
                            next();
                        });
                } else {
                    errorResp.send(res, consts.error.badRequestLabel, validationErrors, 400);
                    next();
                }
            }).catch((err) => {
                logger.error(err);
                errorResp.send(res, consts.error.serverErrorLabel, err + "", 500);
                next();
            });
        } else {
            errorResp.send(res, consts.error.badRequestLabel, "GatewayMAC '" + gatewayMAC + "' does not exist in database", 400);
            next();
        }
    }).catch((err) => {
        errorResp.send(res, consts.error.serverErrorLabel, (err + ""), 500);
        next();
    });
};

// - DELETE "/lora_gw/config/:gwMAC"
obj.deleteLoRaGateway = function(req, res, next) {
    let gatewayMAC = ("" + req.params.gwMAC).toUpperCase();
    obj.LoRaGateway.remove({ GatewayMAC: gatewayMAC }).then((resp, err) => {
        if (err === null || err === undefined) {
            if (resp.result.n > 0) {
                res.send(
                    {
                        result:     "success",
                        idDeleted:  gatewayMAC
                    }
                );
                next();
            } else {
                errorResp.send(res, "Bad Request", "GatewayMAC '" + gatewayMAC + "' does not match any record in database", 400);
                next();
            }
        } else {
            errorResp.send(res, "Server Error", err, 500);
            next();
        }
    }).catch((mongooseErr) => {
        errorResp.send(res, "Mongoose Error", mongooseErr.message, 500);
        next();
    });
};

module.exports = obj;
