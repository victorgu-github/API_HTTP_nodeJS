var fs = require("fs");

var fileUpFuncs = {};

fileUpFuncs.uploadFile = function(req, res, next) {
    var thefile = req.files.file;
    
    thefile.mv("./content/gateway/" + thefile.name, (err) => {
        if (err) {
            res.status(500).send(err);
            next();
        } else {
            console.log("Successfully uploaded", "./content/gateway/" + thefile.name);
        }
    });
    
    res.send({ filePath: "http://207.34.103.154:8000/api/content/gateway/" + thefile.name });
    next();
};

fileUpFuncs.getListOfFiles = function(req, res, next) {
    var serverFiles = [];
    fs.readdirSync("./content/gateway/").forEach(file => {
        //console.log(file);
        serverFiles.push(file);
    });
    res.send({ files: serverFiles });
    next();
};

fileUpFuncs.downloadFile = function(req, res, next) {
    var reqFilename = req.params.reqfilename;
    var path = "./content/gateway/" + reqFilename;
    var fileExists = false;
    fs.readdirSync("./content/gateway/").forEach(file => {
        if (file == reqFilename) {
            fileExists = true;
        }
    });
    if (fileExists) {
        res.download(path);
        next();
    } else {
        res.send({ error: "No file by that name on server." });
        next();
    }
};

fileUpFuncs.downloadBatchFile = function(req, res, next) {
    var reqFilename = req.params.reqfilename;
    var path = "./content/loraDevice/" + reqFilename;
    var fileExists = false;
    fs.readdirSync("./content/loraDevice/").forEach(file => {
        if (file == reqFilename) {
            fileExists = true;
        }
    });
    if (fileExists) {
        res.download(path);
        next();
    } else {
        res.send({ error: "No file by that name on server." });
        next();
    }
};

module.exports = fileUpFuncs;
