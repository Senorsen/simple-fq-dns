// Copyright 2015 Senorsen <sen@senorsen.com>
// 
// A simple DNS server to fq in LAN
//

var logger = require('./setlogger.js');
var dns = require('native-dns');
var util = require('util');
var config = require('./config.json');
var judge_addr = require('./judge-addr.js');
judge_zju_addr = judge_addr.judge_zju_addr;
judge_cn_addr = judge_addr.judge_cn_addr;

var cache_zone = {};

var server_udp = dns.createServer();
var server_tcp = dns.createTCPServer();
server_udp.serve(config.port, config.listen);
server_tcp.serve(config.port, config.listen);
logger.log('info', `simple-fq-dns started at ${config.listen}:${config.port}`);

var on_req = function(request, response) {
    var is_cache, cache;
    var name = request.question[0].name;
    if (typeof cache_zone[name] != 'undefined') {
        cache = cache_zone[name];
        if (Date.now() - cache.time < 10 * 1000) {
            is_cache = true;
        }
    }
    logger.log('info', `client req: ${name}` + (cache ? (is_cache ? ' - cache hit' : ' - cache expired') : ''));
    var is_sent, counter = 0;
    var ans1, ans2;
    if (is_cache) {
        response.answer = cache.answer;
        response.send();
        is_sent = true;
    }
    var req1 = dns.Request({
        question: request.question[0],
        server: { address: '10.10.0.21', port: 53, type: 'tcp' },
        timeout: 3000
    });
    var req2 = dns.Request({
        question: request.question[0],
        server: { address: '8.8.8.8', port: 53, type: 'tcp' },
        timeout: 3000
    });
    req1.on('message', function (err, answer) {
        counter++;
        ans1 = answer.answer;
        var some_ip;
        ans1.forEach(function(v) {
            if (!some_ip && v.type == 1 && typeof v.address == 'string') {
                some_ip = v.address;
                return;
            }
        });
        var is_zju, is_cn;
        if (some_ip) {
            is_zju = judge_zju_addr(some_ip);
            is_cn = judge_cn_addr(some_ip);
        }
        if ((is_zju || is_cn) 
                    || (!some_ip && (counter >= 2))) {
            logger.log('info', `${name}: is_zju = ${is_zju}, is_cn = ${is_cn}, some_ip = ${some_ip}, counter = ${counter}`);
            response.answer = ans1;
            cache_zone[name] = {
                type: 'ans1',
                answer: ans1,
                time: Date.now()
            };
            if (is_sent) return;
            is_sent = true;
            response.send();
            try {
                response.send();
            } catch (e) {
                logger.log('error', 'error on req1 response.send()');
            }
        }
    });
    req1.on('timeout', function() {
        counter++;
        if (ans2) {
            logger.log('warn', `${name}: req1 timeout, use ans2`);
            is_sent = true;
            response.answer = ans2;
            cache_zone[name] = {
                type: 'ans2',
                answer: ans2,
                time: Date.now()
            };
            try {
                response.send();
            } catch (e) {
                logger.log('error', 'error on req1 response.send()');
            }
        }
    });
    req2.on('message', function (err, answer) {
        counter++;
        ans2 = answer.answer;
        var some_ip;
        ans2.forEach(function(v) {
            if (!some_ip && v.type == 1 && typeof v.address == 'string') {
                some_ip = v.address;
                return;
            }
        });
        var is_zju, is_cn;
        if (some_ip) {
            is_zju = judge_zju_addr(some_ip);
            is_cn = judge_cn_addr(some_ip);
        }
        if (!ans1) {
            cache_zone[name] = {
                type: 'ans2',
                answer: ans2,
                time: Date.now()
            };
        }
        if (is_cn || counter < 2) return;
        logger.log('info', `${name}: use ans2`);
        response.answer = ans2;
        cache_zone[name] = {
            type: 'ans2',
            answer: ans2,
            time: Date.now()
        }; 
        if (is_sent) return;
        is_sent = true;
        try {
            response.send();
        } catch (e) {
            logger.log('error', 'error on req2 response.send()');
        }
    });
    req2.on('timeout', function() {
        counter++;
        if (ans1) {
            logger.log('warn', `${name}: req2 timeout, use ans1`);
            is_sent = true;
            response.answer = ans1;
            cache_zone[name] = {
                type: 'ans1',
                answer: ans1,
                time: Date.now()
            };
            try {
                response.send();
            } catch (e) {
                logger.log('error', 'error on req2 response.send()');
            }
        }
    });
    try {
        req1.send();
    } catch (e) {
        counter++;
        logger.log('error', 'error on req1.send()');
    }
    try {
        req2.send();
    } catch (e) {
        counter++;
        logger.log('error', 'error on req2.send()');
    }
};
server_udp.on('request', on_req);
server_tcp.on('request', on_req);


