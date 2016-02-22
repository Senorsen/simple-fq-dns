// Copyright 2015, 2016 Senorsen <senorsen.zhang@gmail.com>
// 

let logger = require('./logger')('vps-side');
let dns = require('native-dns-rogerc');
let util = require('util');
let express = require('express');
let config = require('../config.json');

let app = express();
app.set('trust proxy', 'loopback, 127.0.0.1');
app.get('/', function(req, res) {
    let name = req.query.name;
    let ip = req.ip;
    logger.log('info', 'client ' + ip + ' query: ' + name);
    if (typeof name == 'undefined') {
        return res.json({
            err: 2,
            msg: 'parameter error'
        });
    }
    let question = dns.Question({
        name: name,
        type: 'A'
    });
    let dnsreq = dns.Request({
        question: question,
        server: { address: '8.8.8.8', port: 53, type: 'udp' },
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
        if (answer.answer.length == 0) {
            return res.json({
                err: 4,
                msg: 'empty'
            });
        }
        res.json({
            err: err ? 1 : 0,
            msg: err ? 'error' : 'success',
            obj: answer.answer
        });
    });
    try {
        dnsreq.send();
    } catch (e) {
        logger.log('error', 'resolv error', e);
        res.json({
            err: 2,
            msg: 'error'
        });
    }
});

app.listen(config.vps_port);
logger.log('info', 'http server listen at ' + config.vps_port);

