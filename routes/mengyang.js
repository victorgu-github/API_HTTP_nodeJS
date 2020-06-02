let express = require("express");
let router = express.Router();

let auth = require("../common/authentication.js");
let track = reqFile("./common/globalUsageTracking.js"); // "track" == global usage tracking

let sheepFunctions = require("./mengyangFunctions/sheepFunctions.js");
let sheepVaccinationFunctions = require("./mengyangFunctions/sheepVaccinationFunctions.js");
let sheepClinicFunctions = require("./mengyangFunctions/sheepClinicFunctions.js");
let pastureFunctions = require("./mengyangFunctions/pastureFunctions.js");
let pastureNewsFunctions = require("./mengyangFunctions/pastureNewsFunctions.js");
let sheepHybridFunctions = require("./mengyangFunctions/sheepHybridFunctions.js");

router.get("/pasture/:pastureID/sheep",     auth.authenticate, sheepFunctions.getAllSheepInfo, track.logUsage);
router.post("/pasture/:pastureID/sheep",    auth.authenticate, sheepFunctions.saveSheepInfo, track.logUsage);
router.put("/pasture/:pastureID/sheep",     auth.authenticate, sheepFunctions.updateSheepInfo, track.logUsage);
router.delete("/pasture/:pastureID/sheep",  auth.authenticate, sheepFunctions.deleteSheepInfo, track.logUsage);
router.post("/pasture/:pastureID/sheep/csvregister", auth.authenticate, sheepFunctions.saveSheepInfoBatch, track.logUsage);

router.get("/pasture/:pastureID/sheepvaccination",  auth.authenticate,  sheepVaccinationFunctions.getSheepVaccinationInfo, track.logUsage);
router.post("/pasture/:pastureID/sheepvaccination", auth.authenticate,  sheepVaccinationFunctions.saveSheepVaccinationInfo, track.logUsage);
router.put("/pasture/:pastureID/sheepvaccination",  auth.authenticate,  sheepVaccinationFunctions.updateSheepVaccinationInfo, track.logUsage);
router.delete("/pasture/:pastureID/sheepvaccination", auth.authenticate, sheepVaccinationFunctions.deleteSheepVaccinationRecord, track.logUsage);
router.post("/pasture/:pastureID/sheepvaccination/csvregister", auth.authenticate, sheepVaccinationFunctions.saveSheepVaccineInfoCsv, track.logUsage);

router.get("/pasture/:pastureID/sheepclinic",   auth.authenticate,  sheepClinicFunctions.getSheepClinicInfo, track.logUsage);

router.get("/pasture/general",  auth.authenticate,  pastureFunctions.getGeneralPasture, track.logUsage);

router.get("/news",     auth.authenticate, pastureNewsFunctions.getNewsRecords, track.logUsage);
router.post("/news",    auth.authenticate, pastureNewsFunctions.saveNewsRecord, track.logUsage);
router.put("/news",     auth.authenticate, pastureNewsFunctions.updateNewsRecord, track.logUsage);
router.delete("/news",  auth.authenticate, pastureNewsFunctions.deleteNewsRecords, track.logUsage);

router.get("/pasture/:pastureID/sheephybridization",     auth.authenticate, sheepHybridFunctions.getSheepHybridInfo, track.logUsage);
module.exports = router;
