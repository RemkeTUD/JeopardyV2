const WebSocket = require('ws');
var express = require("express");
const enableWs = require('express-ws')
var cors = require('cors');
var app = express();
enableWs(app);
app.use(express.static(__dirname));
var path = require('path');

const bodyParser = require("body-parser");
bodyParser.limit = '5mb';
const router = express.Router();
app.use(bodyParser({limit: '50mb',
extended: true}));
app.use(bodyParser.urlencoded({ 
    parameterLimit: 100000,
    limit: '50mb',
    extended: true
}));
app.use(bodyParser.json());

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE, OPTIONS');
       next();
 });
app.use(express.static('public'));

allWS = [];

adminWS = [];

wsToNameDict = {};
wsToCodeDict = {};

points = {};

app.ws('/echo', (ws, req) => {

    

    ws.on('message', msg => {
        json = JSON.parse(msg);
        console.log("WebSocket used: " + msg);
        if(json.MessageType == "AddConnection") {
            console.log("ws Client Added");
            allWS.push(ws);
            ws.id = (Math.floor(Math.random() * 1000000000)).toString();
            wsToCodeDict[ws.id] = json.code;
        }
        if(json.MessageType == "AddAdmin") {
            console.log("ws Admin Added");
            allWS.push(ws);
            adminWS.push(ws);
            console.log(wsToNameDict);
            ws.id = (Math.floor(Math.random() * 1000000000)).toString();
            wsToCodeDict[ws.id] = json.code;
            adminWS.forEach(socket => {
                if(socket.readyState == WebSocket.OPEN && wsToCodeDict[ws.id] == wsToCodeDict[socket.id])
                socket.send(JSON.stringify({MessageType: "UpdateNames", names:Object.values((json.code in wsToNameDict) ? wsToNameDict[json.code] : {})}));
            });
        }
        if(json.MessageType == "AddName") {
            
            console.log("ws new Name " + json.name);
            if(!(json.code in wsToNameDict)){
                wsToNameDict[json.code] = {};
            }
            wsToNameDict[json.code][ws.id] = json.name;
            allWS.forEach(socket => {
                console.log(wsToCodeDict[ws.id] +", " +  wsToCodeDict[socket.id]);
                if(socket.readyState == WebSocket.OPEN && wsToCodeDict[ws.id] == wsToCodeDict[socket.id])
                    socket.send(JSON.stringify({MessageType: "UpdateNames", names:Object.values((json.code in wsToNameDict) ? wsToNameDict[json.code] : {})}));
            });
        }
        if(json.MessageType == "OpenQuestion" ||json.MessageType == "CloseQuestion" || json.MessageType == "RevealAnswer" || json.MessageType == "UpdatePoints") {
            console.log(msg);
            allWS.forEach(socket => {
                if(socket.readyState == WebSocket.OPEN && wsToCodeDict[ws.id] == wsToCodeDict[socket.id] && socket!=ws) {
                    socket.send(msg);
                }
            });
        }
        
        if(json.MessageType == "buzz") {
            adminWS.forEach(socket => {
                if(socket.readyState == WebSocket.OPEN && wsToCodeDict[ws.id] == wsToCodeDict[socket.id])
                socket.send(JSON.stringify({MessageType: json.MessageType, name:wsToNameDict[json.code][ws.id]}));
            });
        }

        if(json.MessageType == "guess") {
            adminWS.forEach(socket => {
                if(socket.readyState == WebSocket.OPEN && wsToCodeDict[ws.id] == wsToCodeDict[socket.id])
                socket.send(JSON.stringify({MessageType: json.MessageType, value:json.value, name:wsToNameDict[json.code][ws.id]}));
            });
        }

        if(json.MessageType == "location") {
            console.log(msg);
            adminWS.forEach(socket => {
                if(wsToCodeDict[ws.id] == wsToCodeDict[socket.id]) {
                    console.log("send Location");
                    socket.send(JSON.stringify({MessageType: json.MessageType, value:json.value, name:wsToNameDict[json.code][ws.id]}));
                }
            });
        }


    })

    ws.on('close', () => {
        console.log('WebSocket was closed')
        console.log("ws Deleted");
        allWS.splice(allWS.indexOf(ws),1);
        if(adminWS.includes(ws))
            adminWS.splice(adminWS.indexOf(ws),1);
        if(ws.id in wsToCodeDict && wsToCodeDict[ws.id] in wsToNameDict)
            delete wsToNameDict[wsToCodeDict[ws.id]][ws.id];
        
        console.log("New Names: " + Object.values(wsToNameDict));
        allWS.forEach(socket => {
            if(socket.readyState == WebSocket.OPEN && wsToCodeDict[ws.id] == wsToCodeDict[socket.id])
            socket.send(JSON.stringify({MessageType: "UpdateNames", names:Object.values((json.code in wsToNameDict) ? wsToNameDict[json.code] : {})}));
        });
        delete wsToCodeDict[ws.id];
    })
});

app.put("/createGame", cors(), (req, res, next) => {
    console.log(req.body);
    const idNum= (Math.floor(Math.random() * 1000000)).toString();
    const id = './games/' + idNum;
    console.log(id);
    var fs = require('fs');
    fs.mkdirSync(id);

    fs.writeFileSync(id +  "/data.json", JSON.stringify(req.body));
    const json = '{"code": ' + idNum + '}';
    const obj = JSON.parse(json);
    res.send(obj);
   });

app.put("/createGame/:id", cors(), (req, res, next) => {
    console.log(req.body);
    const idNum= req.params.id;
    const id = './games/' + idNum;
    console.log(id);
    var fs = require('fs');

    fs.writeFileSync(id +  "/data.json", JSON.stringify(req.body));
    const json = '{"code": ' + idNum + '}';
    const obj = JSON.parse(json);
    res.send(obj);
   });

app.get("/getGame/:id", function(req, res) {
    console.log("Send Game JSON");
    res.sendFile(path.join(__dirname + '/games/' + req.params.id + '/data.json'));
});

app.get('/GameCreator', function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});
app.get('/GameView/:id', function(req, res) {
    res.sendFile(path.join(__dirname + '/game.html'));
});
app.get('/GameViewAdmin/:id', function(req, res) {
    res.sendFile(path.join(__dirname + '/gameAdmin.html'));
});

app.get('/:id', function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

var server = require('http').Server(app);
//server.listen(8080,"0.0.0.0");
app.listen(8080, () => {
 console.log("Server running on port 8080");
});