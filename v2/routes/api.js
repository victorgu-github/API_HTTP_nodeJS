let express = require("express");
let router = express.Router();

let reqFile = require.main.require;

let auth = reqFile("./common/authentication.js");
let track = reqFile("./common/globalUsageTracking.js"); // "track" == global usage tracking

let generalUserAppsFuncs = require("./routeFunctions/generalUserAppsFunctions.js");

router.get( "/generaluser/applications/existingdevices", auth.authenticate, generalUserAppsFuncs.getUserAppForExistingDev, track.logUsage);
router.get( "/generaluser/applications/datausage",  auth.authenticate, generalUserAppsFuncs.getDataUsage, track.logUsage);
router.get( "/generaluser/applications/createdby",  auth.authenticate, generalUserAppsFuncs.getUserAppByCreatedBy, track.logUsage);
router.get( "/generaluser/applications",            auth.authenticate, generalUserAppsFuncs.getUserApplication, track.logUsage);
router.post("/generaluser/applications",            auth.authenticate, generalUserAppsFuncs.saveUserApplication, track.logUsage);
router.put( "/generaluser/applications",            auth.authenticate, generalUserAppsFuncs.updateUserApplication, track.logUsage);
router.delete("/generaluser/applications",          auth.authenticate, generalUserAppsFuncs.deleteUserApplication, track.logUsage);

module.exports = router;
