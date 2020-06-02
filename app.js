reqFile = require.main.require; // eslint-disable-line no-unused-vars

// ---------------------------- TRACER LOGGING --------------------------------
// Need to declare this up front so other modules can use it
var clic = require("cli-color");
// "colors" is used by the 'tracer.js' module to format its output in various colours,
// as seen in the "<text>".colourName usages below.
require("colors");
var conf = {
    format:     "{{timestamp}}".bold.cyan + " {{file}}:{{line}}".bold.blue + " {{message}}",
    dateformat: "yyyy-mm-dd - HH:MM:ss",
	filters: {
		// log:     clic.blue,
		trace:  clic.magentaBright,
		debug:  clic.cyanBright.bold.bgXterm(232),
		// info:   clic.greenBright,
		warn:   clic.xterm(202),
		error:  clic.red.bold
	},
    level:      parseInt((process.argv[2]) ? process.argv[2] : 3)
};
logger = require("tracer").colorConsole(conf);

// "tracer" module logging levels. Setting your logging level to "N" will output every
// message that is "N" or higher. "debug" should be used whenever a piece of information
// would be useful for debugging but isn't relevant for regular operation. These can
// therefore be shown or hidden by setting the logging level to "2" or "3", respectively.
// logger.log("Level 0: log");       // Level 0
// logger.trace("Level 1: trace");   // Level 1
// logger.debug("Level 2: debug:");  // Level 2
// logger.info("Level 3: info");     // Level 3
// logger.warn("Level 4: warn");     // Level 4
// logger.error("Level 5: error");   // Level 5
// ----------------------------------------------------------------------------

let config = require("./config/config.js");
let consts = require("./config/constants.js");
let errorResp = require("./common/errorResponse.js");
let globalUsageTracking = reqFile("./common/globalUsageTracking.js");

var fs = require("fs");
var express = require("express");
let path = require("path");
let https = require("https");
let http = require("http");
let sslOptions = config.httpsPortNum?{
    key: fs.readFileSync(config.ssl.key),
    cert: fs.readFileSync( config.ssl.cert)
} : {};
var fileUpload = require("express-fileupload");
var compression = require("compression");
let favicon = require("serve-favicon");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");
var cors = require("cors");

var api = require("./routes/api.js");
let apiV2 = require("./v2/routes/api.js");
let anyue = require("./routes/anyue.js");
let mengyang = require("./routes/mengyang.js");

// --------------------------- EXPRESS APP SETUP ------------------------------
var app = express();

app.use(compression());
app.use(fileUpload());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors());
app.use(favicon(path.join(__dirname, "public/assets/img", "favicon.ico")));

// // ---------------------------- MORGAN LOGGING ---------------------------------

// var morgan; // For logging
// // Custom formatting callback
// morgan = require('morgan');
// app.use(morgan((tokens, req, res) => {
//     var reqURL = "";
//     if(tokens.url(req, res) !== undefined && tokens.url !== null) {
//         reqURL = tokens.url(req, res).toString();
//     } else {
//         logger.error("Error: Morgan received tokens.url(req, res) = " + tokens.url(req, res));
//     }

//     // console.log("Remote IP: " + req.ip.toString().length, true);
//     // Format to IPv4 for now
//     var ipAddr = "";
//     if(req.ip !== undefined && req.ip !== null) {
//         ipAddr = req.ip.toString();
//         var doubleColon = ipAddr.indexOf("::");
//         if(doubleColon >= 0) {
//             ipAddr = ipAddr.substr(doubleColon + 2, ipAddr.length);
//             // console.log(ipAddr, true);
//             if(ipAddr.length == 1 && ipAddr == "1")
//                 ipAddr = "127.0.0.1";
//             else if(ipAddr.indexOf(":") > 0) {
//                 ipAddr = ipAddr.substr(ipAddr.indexOf(":") + 1, ipAddr.length);
//             } else {
//                 // Leave it as is
//             }
//         }
//     } else {
//         logger.error("Error: Morgan received req.ip = " + req.ip);
//     }


//     // Format response times
//     var redThreshold = 600;
//     var magentaThreshold = 100;
//     var respTime = parseInt(tokens["response-time"](req, res));
//     var respTimeStr = respTime + "ms";
//     var respTimeFmtd = (respTime >= redThreshold) ? respTimeStr.bold.red : ((respTime > magentaThreshold && respTime < redThreshold) ? respTimeStr.bold.magenta : respTimeStr);

//     var reqStatus = tokens.status(req, res) + "";
//     if(tokens.status(req, res) === undefined || tokens.status(req, res) === null) {
//         logger.error("Error: Morgan received tokens.status(req, res) = " + tokens.status(req, res));
//     }

//     return [
//         tokens.method(req, res),
//         ipAddr.bold.blue,
//         ((reqURL.length > 91 - ipAddr.length) ? reqURL.substr(0, 91 - ipAddr.length) + "...".bold : reqURL),
//         ((reqStatus.substr(0, 1) == "2" || reqStatus.substr(0, 1) == "3") ? reqStatus.green : reqStatus.red),
//         respTimeFmtd
//     ].join(" ");
// }));

// ------------------- SERVE UP HTML PAGE CONTAINING INDEX OF WEB SERVICES --------------------

let apiIndexPage = require("./routes/apiIndexPage.js");
let apiIndexPageV2 = require("./v2/routes/apiIndexPage.js");
app.get("/", (req, res, next) => {
    apiIndexPage.serveView(req, res, next, api, mengyang, anyue);
});
app.get("/v2", (req, res, next) => {
    apiIndexPageV2.serveView(req, res, next, apiV2);
});
app.use("/api", api);
app.use("/api/v2", apiV2);
app.use("/api/anyue", anyue);
app.use("/api/mengyang", mengyang);

app.use("/static/mengyang", express.static(path.join(__dirname, "content/mengyang")));

// Catch 404s and forward to the default error handler (below this function):
app.use((req, res, next) => {
    let err = new Error("Invalid URL. Please consult the API index page at http://" +
                        config.serverHost + ":" + config.displayedPortNum + "/.");
    err.status = 404;
    next(err);
});

// Default error handler:
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    logger.error(err); // So we can get the full stack trace in the console
    errorResp.send(res, consts.error.serverErrorLabel, err.message, err.status || 500);
    next();
}, globalUsageTracking.logUsage);

app.set("view engine", "ejs");

http.createServer(app).listen(config.expressPortNum, function(){
    logger.info("http server running at port: " + config.expressPortNum + "...");
});
if (config.httpsPortNum) {
    https.createServer(sslOptions, app).listen(config.httpsPortNum, function(){
        logger.info("https server running at port: " + config.httpsPortNum + "...");
    });
}
logger.info("Starting web API server");
logger.info("Environment:", config.environment);

process.on("unhandledRejection", (reason, promise) => {
    logger.info("Unhandled Rejection at", promise);
});

module.exports = app;
