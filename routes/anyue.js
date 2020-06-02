let express = require("express");
let router = express.Router();

let auth = reqFile("./common/authentication.js");
let track = reqFile("./common/globalUsageTracking.js"); // "track" == global usage tracking

let parkingLotFunctions = require("./anyueFunctions/parkingLotFunctions.js");

router.get("/lora/:applicationID/charginglotstatus", auth.authenticate, parkingLotFunctions.parkingLotFunction, track.logUsage);

module.exports = router;
