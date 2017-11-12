var express    = require('express');        // call express
var app        = express();                 // define our app using express
var bodyParser = require('body-parser');
var fs = require('fs');
var jsonfile = require('jsonfile')
var file = './data.json'
var lineReader = require('line-reader');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 3002;        // set our port
var router = express.Router();              // get an instance of the express Router
var db = [];

router.get('/', function(req, res) {
    res.json(db);  
});

router.get('/scan', function(req, res) {
    
    var barcode_no = req.query.barcode;
    
    console.log('URL Hit', barcode_no)
    var dataObj = {
        barcode_no: barcode_no,
        datetime: new Date(),
        scanned: 0
    };
    findUpdateScanCode(barcode_no, dataObj, res);
    
    
    
});
function findUpdateScanCode(barcodeNo, dataObj, res) {
    const tempDB = db;
    let output = 0;
    db = tempDB.map(item => {
        if (item.barcode_no === barcodeNo && item.scanned === 0) {
            item.scanned = 1;
            output = 1
        }
        else  if (item.barcode_no === barcodeNo && item.scanned === 1) {
            item.scanned = 2;
            output = 2;
        }
        else  if (item.barcode_no === barcodeNo && item.scanned === 2) {
            item.scanned = 2;
            output = 2;
        }
        return item;
    })
    if (output === 0) {
        db.push(dataObj); 
        writeJson(db, null);
        
        res.json({ message: 'BEEP' }); 
        
    }
    else {
        writeJson(db, null);
        if (output === 1) {
            res.json({ message: 'Scanned' });  
        }
        else if (output === 2) {
            res.json({ message: 'Expired' });  
        }
    
    }
}
function readJsonFileSync(){
    try {
        db = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    catch (e){
        console.log(e, 'readJsonFilesync')
    }
}

function writeJson(obj, callback) {
    fs.writeFileSync(file, JSON.stringify(obj) , 'utf-8'); 
}
function writeJsonFile(obj, callback) {
    jsonfile.writeFileSync(file, obj, {flag: 'a'}, callback); 
}
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Pass to next layer of middleware
    next();
});
app.use('/api', router);
app.listen(port);
console.log('Magic api happens on port ' + port);

readJsonFileSync();