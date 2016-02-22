// Copyright 2015, 2016 Senorsen <senorsen.zhang@gmail.com>
// 
// A simple DNS server to fq in LAN
//

let logger = require('./logger')('index');
let dns = require('native-dns');
let util = require('util');
let config = require('../config.json');
let hosts = require('../hosts.json');
let judge_addr = require('./judge-addr');

let judge_zju_addr = judge_addr.judge_zju_addr;
let judge_cn_addr = judge_addr.judge_cn_addr;

let cache_zone = {};

let server_udp = dns.createServer();
let server_tcp = dns.createTCPServer();
server_udp.serve(config.port, config.listen);
server_tcp.serve(config.port, config.listen);
logger.log('info', `simple-fq-dns started at ${config.listen}:${config.port}`);

let fs = require('fs');
let whitelist_str = fs.readFileSync('../white-lists.txt').toString();
let whitelist_p = whitelist_str.split('\n');
let whitelist = [];
for (var i in whitelist_p) {
    if (whitelist_p[i].trim() != '')
        whitelist.push(whitelist_p[i].trim());
}
console.log(whitelist);
logger.log('info', `read ${whitelist.length} whitelists`);
let blacklist_str = fs.readFileSync('../black-lists.txt').toString();
let blacklist_p = blacklist_str.split('\n');
let blacklist = [];
for (var i in blacklist_p) {
    if (blacklist_p[i].trim() != '')
        blacklist.push(blacklist_p[i].trim());
}
console.log(blacklist);
logger.log('info', `read ${blacklist.length} blacklists`);

let on_req = function (drequest, response) {
    let is_cache, cache;
    let name = drequest.question[0].name;
    if (typeof hosts[name] == 'string') {
        logger.log('info', `host ${name} in hosts: ${hosts[name]}`);
        response.answer = [
            dns.A({
                name: name,
                address: hosts[name],
                ttl: 600
            })
        ];
        response.send();
        return;
    }
    if (typeof cache_zone[name] != 'undefined') {
        cache = cache_zone[name];
        if (Date.now() - cache.time <= 360 * 1000) {
            is_cache = true;
        }
    }
    logger.log('info', `client ${drequest.address.address} req: ${name}` + (cache ? (is_cache ? ' - cache hit' : ' - cache expired') : ''));
    let is_sent, counter = 0;
    let ans1, ans2;
    if (is_cache) {
        response.answer = cache.answer;
        response.send();
        is_sent = true;
        return;
    }
    let whiteflag = false, blackflag = false;
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
    let req1 = dns.Request({
        question: request.question[0],
        server: {address: '10.10.0.21', port: 53, type: 'tcp'},
        timeout: 3000
    });
    req1.on('message', function (err, answer) {
        counter++;
        ans1 = answer.answer;
        if (typeof ans1 != 'object') {
            logger.log('error', 'Error: ans1 is not an object');
            return;
        }
        let some_ip;
        ans1.forEach(function (v) {
            if (!some_ip && v.type == 1 && typeof v.address == 'string') {
                some_ip = v.address;
            }
        });
        let is_zju, is_cn;
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
    req1.on('timeout', function () {
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
        let req2 = dns.Request({
            question: request.question[0],
            server: {address: '8.8.8.8', port: 53, type: 'tcp'},
            timeout: 3000
        });
        req2.on('message', function (err, answer) {
            counter++;
            ans2 = answer.answer;
            let some_ip;
            ans2.forEach(function (v) {
                if (!some_ip && v.type == 1 && typeof v.address == 'string') {
                    some_ip = v.address;
                    return;
                }
            });
            let is_zju, is_cn;
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
                if (is_sent) return;
                is_sent = true;
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
        req2.on('timeout', function () {
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
            req2.send();
        } catch (e) {
            counter++;
            logger.log('error', 'error on req2.send()');
        }
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

