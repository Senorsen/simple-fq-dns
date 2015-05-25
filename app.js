// Copyright 2015 Senorsen <sen@senorsen.com>
// 
// A simple DNS server to fq in LAN
//

var logger = require('./setlogger.js');
var dns = require('native-dns');
var util = require('util');
var config = require('./config.json');
var judge_addr = require('./judge-addr.js');
var request = require('request');
judge_zju_addr = judge_addr.judge_zju_addr;
judge_cn_addr = judge_addr.judge_cn_addr;

var cache_zone = {};

var server_udp = dns.createServer();
var server_tcp = dns.createTCPServer();
server_udp.serve(config.port, config.listen);
server_tcp.serve(config.port, config.listen);
logger.log('info', `simple-fq-dns started at ${config.listen}:${config.port}`);

var fs = require('fs');
var whitelist_str = fs.readFileSync('white-lists.txt').toString();
var whitelist_p = whitelist_str.split('\n');
var whitelist = [];
for (var i in whitelist_p) {
    if (whitelist_p[i].trim() != '')
        whitelist.push(whitelist_p[i].trim());
}
console.log(whitelist);
logger.log('info', `read ${whitelist.length} whitelists`);
var blacklist_str = fs.readFileSync('black-lists.txt').toString();
var blacklist_p = blacklist_str.split('\n');
var blacklist = [];
for (var i in blacklist_p) {
    if (blacklist_p[i].trim() != '')
        blacklist.push(blacklist_p[i].trim());
}
console.log(blacklist);
logger.log('info', `read ${blacklist.length} blacklists`);


var on_req = function(drequest, response) {
    var is_cache, cache;
    var name = drequest.question[0].name;
    if (typeof cache_zone[name] != 'undefined') {
        cache = cache_zone[name];
        if (Date.now() - cache.time < 10 * 1000) {
            is_cache = true;
        }
    }
    logger.log('info', `client ${drequest.address.address} req: ${name}` + (cache ? (is_cache ? ' - cache hit' : ' - cache expired') : ''));
    var is_sent, counter = 0;
    var ans1, ans2;
    if (is_cache) {
        response.answer = cache.answer;
        response.send();
        is_sent = true;
        return;
    }
    var whiteflag = false, blackflag = false;
    for (var i in whitelist) {
        if (name.indexOf(whitelist[i]) != -1) {
            whiteflag = true;
            break;
        }
    }
    for (var i in blacklist) {
        if (name.indexOf(blacklist[i]) != -1) {
            blackflag = true;
            break;
        }
    }
    if (blackflag)
        logger.log('info', 'in blacklist: ' + name);
    if (whiteflag)
        logger.log('info', 'in whitelist: ' + name);
    var req1 = dns.Request({
        question: drequest.question[0],
        server: { address: '10.10.0.21', port: 53, type: 'tcp' },
        timeout: 800
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
        if (blackflag || (is_zju || is_cn) 
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
    if (whiteflag || !blackflag) {
        request(config.vps_addr + name, function(error, req_response, body) {
            counter++;
            try {
                var data = JSON.parse(body);
            } catch (e) {
                logger.log('error', 'json parse error, ', e);
                return;
            }
            if (error || data.err) {
                logger.log('warn', `${name}: req2 error ${data.err} ${data.msg}`);
                if (ans1) {
                    logger.log('warn', 'fallback to ans1');
                    response.answer = ans1;
                    cache_zone[name] = {
                        type: 'ans1',
                        answer: ans1,
                        time: Date.now()
                    };
                    try {
                        response.send();
                    } catch (e) {
                        logger.log('error', 'req2 response.send() error');
                    }
                }
                return;
            }
            ans2 = data.obj;
            var some_ip;
            ans2.forEach(function(v) {
                if (!some_ip && v.type == 1 && typeof v.address == 'string') {
                    some_ip = v.address;
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
            if (is_cn && ans1 || counter < 2) return;
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
    }
    try {
        req1.send();
    } catch (e) {
        counter++;
        logger.log('error', 'error on req1.send()');
    }
};
server_udp.on('request', on_req);
server_tcp.on('request', on_req);


