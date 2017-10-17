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
router.get('/new', function(req, res) {
    
    var barcode_no = req.query.barcode;
    var info = req.query.info;
    
    var dataObj = {
        barcode_no: barcode_no,
        status: 1,
        datetime: new Date(),
        scanned: 0,
        info: info || 'no information'
    };
    writeJsonFile(dataObj, function(err) {
        if (err) {
            res.status(404).send('JSON file error');
            return;
        }
         readJsonFileSync();
        res.json({ message: 'Barcode saved' });  
    }); 
    
});
router.get('/inactive', function(req, res) {
    
    var barcode_no = req.query.barcode;
    var info = req.query.info;
    
    var dataObj = {
        barcode_no: barcode_no,
        status: 0,
        scannedTime: new Date()
        
    };
    writeJsonFile(dataObj, function(err) {
        if (err) {
            res.status(404).send('JSON file error');
            return;
        }
        
        res.json({ message: 'Barcode saved' });  
        readJsonFileSync();
    }); 
    
});
router.get('/', function(req, res) {
    res.json(db);  
});
function readJsonFileSync(){
    
    db = [];
    lineReader.eachLine(file, function(line, last) {
        db.push(line)
    });
}

function writeJsonFile(obj, callback) {
        jsonfile.writeFile(file, obj, {flag: 'a'}, callback);
    
}

app.use('/api', router);
app.listen(port);
console.log('Magic api happens on port ' + port);

readJsonFileSync();