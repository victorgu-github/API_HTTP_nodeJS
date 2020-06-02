// This file contains route-specific validation functions that should instead live
// in their route function files, as they aren't generic enough to be reused by any
// other web services.
// For the time being, though, we will leave this file here as moving it to its
// correct location is not of high importance.

let dataValidation = require("./dataValidation.js");
let loraDataValidation = require("./loraDataTypesValidation.js");

let obj = {};

// In order to guarantee a certain level of data validation, we separate it into
// two categories: is the data present (i.e.: defined) when we expect it to be,
// and when it's present, is it valid? Thus we do two "passes" to validate our
// data sets. If it fails the "undefined" check, the function returns with the
// appropriate error messages. If it passes the first check, it then goes on to
// the second check, and if it fails there, the error messages are once again
// returned.
obj.validateInput = function(body, operationType, dbData) {
    let errors = [];
    // First pass validation
    errors = errors.concat(checkThatRequiredFieldsAreDefined(body, operationType, dbData));
    errors = errors.concat(checkThatFieldsAreValid(body, operationType, dbData));

    return (errors.length !== 0) ? errors : null;
};

// This function checks for fields that *must* be present, for each operation type.
// For "save" operations, we need all of the following fields to be present. For
// "update" operations, we only need the first two below (i.e.: it's possible to
// update anywhere from 0 to (N-2) fields).
function checkThatRequiredFieldsAreDefined(body, operationType, dbData) {
    let errors = [];
    
    // Fields that are mandatory at all times
    if (body.GatewayMAC === undefined) {
        errors.push("A valid GatewayMAC is required for save and update operations");
    }
    
    // Fields that are required only during save operations
    if (operationType === "save") {
        if (body.GatewaySN === undefined) {
            errors.push("A valid GatewaySN is required for " + operationType + " operations");
        }
        if (body.CoreBoardVersion === undefined) {
            errors.push("Must specify a valid 'CoreBoardVersion' parameter containing a string representing the version number");
        }
        if (body.BandID === undefined) {
            errors.push("Must specify a valid 'BandID' parameter containing one of the following integers: " +
                        (dbData.bandID + "").replace(/,/g, ", "));
        }
        if (body.MotherboardVersion === undefined) {
            errors.push("Must specify a valid 'MotherboardVersion' parameter containing a string representing the version number");
        }
    }

    return errors;
}

// This function starts with first checking if each field is defined, and if it is,
// it checks its contents for validity and fails the test if the data does meet the
// pass criteria.
function checkThatFieldsAreValid(body, operationType, dbData) {
    let errors = [];
    
    // Required Fields:
    if (body.GatewayMAC !== undefined)
        if (dataValidation.isValidHexString(body.GatewayMAC, 16) === false)
            errors.push("Invalid GatewayMAC. Please provide a valid 16-character hexadecimal string (e.g.: 'B827EBFFFEA5188E')");
    if (body.GatewaySN !== undefined)
        if (typeof body.GatewaySN !== "string")
            errors.push("'GatewaySN' parameter must contain a valid string" +
                        " (you gave " + (typeof body.GatewaySN) + " " + body.GatewaySN + ")");
    if (body.CoreBoardVersion !== undefined)
        if (typeof body.CoreBoardVersion !== "string")
            errors.push("Invalid CoreBoardVersion. Please provide a valid string input");
    if (body.BandID !== undefined)
        errors = errors.concat(loraDataValidation.getDynamicBandIdValidation("BandID", body.BandID, dbData.bandID));
    if (body.MotherboardVersion !== undefined)
        if (typeof body.MotherboardVersion !== "string")
            errors.push("'MotherboardVersion' parameter must contain a string representing the version number" +
                        " (you gave " + (typeof body.MotherboardVersion) + " " + body.MotherboardVersion + ")");

    // Optional
    if (body.Description !== undefined)
        if (typeof body.Description !== "string")
            errors.push("'Description' parameter must contain a string" +
                        " (you gave " + (typeof body.Description) + " " + body.Description + ")");
    if (body.SiteID !== undefined)
        if (typeof body.SiteID !== "string")
            errors.push("'SiteID' parameter must contain a string" +
                        " (you gave " + (typeof body.SiteID) + " " + body.SiteID + ")");
    if (body["4gModule"] !== undefined)
        if (typeof body["4gModule"] !== "string")
            errors.push("'4gModule' parameter must contain a string" +
                        " (you gave " + (typeof body["4gModule"]) + " " + body["4gModule"] + ")");
    if (body["4gSimCardID"] !== undefined)
        if (typeof body["4gSimCardID"] !== "string")
            errors.push("'4gSimCardID' parameter must contain a string" +
                        " (you gave " + (typeof body["4gSimCardID"]) + " " + body["4gSimCardID"] + ")");
    if (body.ReverseTunnelPort !== undefined)
        if (dataValidation.isInteger(body.ReverseTunnelPort) === false ||
            body.ReverseTunnelPort < 0 || body.ReverseTunnelPort > 65535)
            errors.push("'ReverseTunnelPort' parameter must contain a positive integer number between 0 and 65,535, inclusive" +
                        " (you gave " + (typeof body.ReverseTunnelPort) + " " + body.ReverseTunnelPort + ")");
    if (body.InstallationNumber !== undefined)
        if (typeof body.InstallationNumber !== "string")
            errors.push("'InstallationNumber' parameter must contain a string" +
                        " (you gave " + (typeof body.InstallationNumber) + " " + body.InstallationNumber + ")");
    if (body.InstallationDate !== undefined)
        if (dataValidation.isValidUtcIsoDateString(body.InstallationDate) === false)
            errors.push("'InstallationDate' parameter must contain a UTC ISO date string in the format 'yyyy-mm-ddThh-mm-ssZ'" +
                        " (you gave " + (typeof body.InstallationDate) + " " + body.InstallationDate + ")");
    if (body.WiredNetwork !== undefined)
        if (typeof body.WiredNetwork !== "boolean")
            errors.push("'WiredNetwork' parameter must contain a boolean" +
                        " (you gave " + (typeof body.WiredNetwork) + " " + body.WiredNetwork + ")");
    if (body.WiFi !== undefined)
        if (typeof body.WiFi !== "boolean")
            errors.push("'WiFi' parameter must contain a boolean" +
                        " (you gave " + (typeof body.WiFi) + " " + body.WiFi + ")");
    if (body["4gLTE"] !== undefined)
        if (typeof body["4gLTE"] !== "boolean")
            errors.push("'4gLTE' parameter must contain a boolean" +
                        " (you gave " + (typeof body["4gLTE"]) + " " + body["4gLTE"] + ")");
    if (body.GpsRefLat !== undefined)
        if (typeof body.GpsRefLat !== "number")
            errors.push("'GpsRefLat' parameter must be of type number (you gave " +
                        (typeof body.GpsRefLat) + " " + body.GpsRefLat + ")");
    if (body.GpsRefLon !== undefined)
        if (typeof body.GpsRefLon !== "number")
            errors.push("'GpsRefLon' parameter must be of type number (you gave " +
                        (typeof body.GpsRefLon) + " " + body.GpsRefLon + ")");
    if (body.GpsRefAlt !== undefined)
        if (typeof body.GpsRefAlt !== "number")
            errors.push("'GpsRefAlt' parameter must be of type number (you gave " +
                        (typeof body.GpsRefAlt) + " " + body.GpsRefAlt + ")");
    //New optional fields
    if (body.SiteName !== undefined)
        if (typeof body.SiteName !== "string")
            errors.push("'SiteName' parameter must contain a string" +
                " (you gave " + (typeof body.SiteName) + " " + body.SiteName + ")");

    if (body.SiteAddress !== undefined)
        if (typeof body.SiteAddress !== "string")
            errors.push("'SiteAddress' parameter must contain a string" +
                " (you gave " + (typeof body.SiteAddress) + " " + body.SiteAddress + ")");

    if (body.SiteRegion !== undefined)
        if (typeof body.SiteRegion !== "string")
            errors.push("'SiteRegion' parameter must contain a string" +
                " (you gave " + (typeof body.SiteRegion) + " " + body.SiteRegion + ")");

    if (body.SiteType !== undefined)
        if (typeof body.SiteType !== "string")
            errors.push("'SiteType' parameter must contain a string" +
                " (you gave " + (typeof body.SiteType) + " " + body.SiteType + ")");

    if (body.SiteDescription !== undefined)
        if (typeof body.SiteDescription !== "string")
            errors.push("'SiteDescription' parameter must contain a string" +
                " (you gave " + (typeof body.SiteDescription) + " " + body.SiteDescription + ")");

    if (body.SiteCondition !== undefined)
        if (typeof body.SiteCondition !== "string")
            errors.push("'SiteCondition' parameter must contain a string" +
                " (you gave " + (typeof body.SiteCondition) + " " + body.SiteCondition + ")");

    if (body.SiteSource !== undefined)
        if (typeof body.SiteSource !== "string")
            errors.push("'SiteSource' parameter must contain a string" +
                " (you gave " + (typeof body.SiteSource) + " " + body.SiteSource + ")");

    if (body.Comments !== undefined)
        if (typeof body.Comments !== "string")
            errors.push("'Comments' parameter must contain a string" +
                " (you gave " + (typeof body.Comments) + " " + body.Comments + ")");

    if (body.CoverageInKM !== undefined)
        if (typeof body.CoverageInKM !== "number")
            errors.push("'CoverageInKM' parameter must contain a number" +
                " (you gave " + (typeof body.CoverageInKM) + " " + body.CoverageInKM + ")");

    if (operationType === "update") {
        if (body.UplinkChan !== undefined)
            if (typeof body.UplinkChan !== "string")
                errors.push("'UplinkChan' parameter must be of type string (you gave " +
                            (typeof body.UplinkChan) + " " + body.UplinkChan + ")");
        if (body.DownlinkChan !== undefined)
            if (typeof body.DownlinkChan !== "string")
                errors.push("'DownlinkChan' parameter must be of type string (you gave " +
                            (typeof body.DownlinkChan) + " " + body.DownlinkChan + ")");
        if (body.LoRaWanPublic !== undefined)
            if (typeof body.LoRaWanPublic !== "boolean")
                errors.push("'LoRaWanPublic' parameter must be of type boolean (you gave " +
                            (typeof body.LoRaWanPublic) + " " + body.LoRaWanPublic + ")");

        if (body.LgsIP !== undefined)
            if (typeof body.LgsIP !== "string" || dataValidation.isValidIpAddress(body.LgsIP) === false)
                errors.push("'LgsIP' parameter must be a valid IP address in the form 255.255.255.255 (you gave " +
                            (typeof body.LgsIP) + " " + body.LgsIP + ")");
        if (body.LgsPort !== undefined)
            if (dataValidation.isInteger(body.LgsPort) === false ||
                body.LgsPort < 0 || body.LgsPort > 65535)
                errors.push("'LgsPort' parameter must contain a positive integer number between 0 and 65,535, inclusive" +
                            " (you gave " + (typeof body.LgsPort) + " " + body.LgsPort + ")");

        if (body.KeepAliveInternal !== undefined)
            if (typeof body.KeepAliveInternal !== "number")
                errors.push("'KeepAliveInternal' parameter must be of type number (you gave " +
                            (typeof body.KeepAliveInternal) + " " + body.KeepAliveInternal + ")");

        if (body.GpsEnable !== undefined)
            if (typeof body.GpsEnable !== "boolean")
                errors.push("'GpsEnable' parameter must be of type boolean (you gave " +
                            (typeof body.GpsEnable) + " " + body.GpsEnable + ")");

        if (body.AntennaGain !== undefined)
            if (typeof body.AntennaGain !== "number")
                errors.push("'AntennaGain' parameter must be of type number (you gave " +
                            (typeof body.AntennaGain) + " " + body.AntennaGain + ")");
        if (body.FskEnable !== undefined)
            if (typeof body.FskEnable !== "boolean")
                errors.push("'FskEnable' parameter must be of type boolean (you gave " +
                            (typeof body.FskEnable) + " " + body.FskEnable + ")");

        if (body.BeaconPeriod !== undefined)
            if (typeof body.BeaconPeriod !== "number")
                errors.push("'BeaconPeriod' parameter must be of type number (you gave " +
                            (typeof body.BeaconPeriod) + " " + body.BeaconPeriod + ")");
        if (body.BeaconFreq !== undefined)
            if (typeof body.BeaconFreq !== "number")
                errors.push("'BeaconFreq' parameter must be of type number (you gave " +
                            (typeof body.BeaconFreq) + " " + body.BeaconFreq + ")");
        if (body.BeaconFreqNum !== undefined)
            if (typeof body.BeaconFreqNum !== "number")
                errors.push("'BeaconFreqNum' parameter must be of type number (you gave " +
                            (typeof body.BeaconFreqNum) + " " + body.BeaconFreqNum + ")");
        if (body.BeaconFreqStep !== undefined)
            if (typeof body.BeaconFreqStep !== "number")
                errors.push("'BeaconFreqStep' parameter must be of type number (you gave " +
                            (typeof body.BeaconFreqStep) + " " + body.BeaconFreqStep + ")");
        if (body.BeaconDataRate !== undefined)
            if (typeof body.BeaconDataRate !== "number")
                errors.push("'BeaconDataRate' parameter must be of type number (you gave " +
                            (typeof body.BeaconDataRate) + " " + body.BeaconDataRate + ")");
        if (body.BeaconBandwidth !== undefined)
            if (typeof body.BeaconBandwidth !== "number")
                errors.push("'BeaconBandwidth' parameter must be of type number (you gave " +
                            (typeof body.BeaconBandwidth) + " " + body.BeaconBandwidth + ")");
        if (body.BeaconPower !== undefined)
            if (typeof body.BeaconPower !== "number")
                errors.push("'BeaconPower' parameter must be of type number (you gave " +
                            (typeof body.BeaconPower) + " " + body.BeaconPower + ")");
        if (body.BeaconInfoDesc !== undefined)
            if (typeof body.BeaconInfoDesc !== "number")
                errors.push("'BeaconInfoDesc' parameter must be of type number (you gave " +
                            (typeof body.BeaconInfoDesc) + " " + body.BeaconInfoDesc + ")");

        if (body.SoftwareVersion !== undefined)
            if (typeof body.SoftwareVersion !== "string")
                errors.push("'SoftwareVersion' parameter must be of type string (you gave " +
                            (typeof body.SoftwareVersion) + " " + body.SoftwareVersion + ")");

        if (body.ClkDrift !== undefined)
            if (typeof body.ClkDrift !== "number")
                errors.push("'ClkDrift' parameter must be of type number (you gave " +
                            (typeof body.ClkDrift) + " " + body.ClkDrift + ")");
        if (body.ClkBias !== undefined)
            if (typeof body.ClkBias !== "number")
                errors.push("'ClkBias' parameter must be of type number (you gave " +
                            (typeof body.ClkBias) + " " + body.ClkBias + ")");
        if (body.PpsLevel !== undefined)
            if (typeof body.PpsLevel !== "number")
                errors.push("'PpsLevel' parameter must be of type number (you gave " +
                            (typeof body.PpsLevel) + " " + body.PpsLevel + ")");
        if (body.NtpLevel !== undefined)
            if (typeof body.NtpLevel !== "number")
                errors.push("'NtpLevel' parameter must be of type number (you gave " +
                            (typeof body.NtpLevel) + " " + body.NtpLevel + ")");
        if (body.NtpLatency !== undefined)
            if (typeof body.NtpLatency !== "number")
                errors.push("'NtpLatency' parameter must be of type number (you gave " +
                            (typeof body.NtpLatency) + " " + body.NtpLatency + ")");
    }

    return errors;
}

module.exports = obj;
