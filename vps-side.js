// Copyright 2015 Senorsen <sen@senorsen.com>
// 

var logger = require('./setlogger.js');
var dns = require('native-dns');
var util = require('util');
var express = require('express');
var config = require('./config.json');

var app = express();
app.set('trust proxy', 'loopback, 127.0.0.1');
app.get('/', function(req, res) {
    var name = req.query.name;
    var ip = req.ip;
    logger.log('info', 'client ' + ip + ' query: ' + name);
    if (typeof name == 'undefined') {
        return res.json({
            err: 2,
            msg: 'parameter error'
        });
    }
    var question = dns.Question({
        name: name,
        type: 'A'
    });
    var dnsreq = dns.Request({
        question: question,
        server: { address: '8.8.8.8', port: 53, type: 'tcp' },
        timeout: 2000
    });
    dnsreq.on('timeout', function () {
        logger.log('warn', 'name: ' + name + ' lookup timeout');
        res.json({
            err: 1,
            msg: 'timeout'
        });
    });
    dnsreq.on('message', function (err, answer) {
        logger.log('info', 'name: ' + name + ', query reached.');
        res.json({
            err: err ? 1 : 0,
            msg: err ? 'error' : 'success',
            obj: answer.answer
        });
    });
    dnsreq.send();
});

app.listen(config.vps_port);
logger.log('info', 'http server listen at ' + config.vps_port);

