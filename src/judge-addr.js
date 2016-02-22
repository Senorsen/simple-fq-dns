// Copyright 2015, 2016 Senorsen <senorsen.zhang@gmail.com>
// 

let geoip = require('geoip-lite');
let Netmask = require('netmask').Netmask;
let logger = require('./logger')('judge-addr');
let netmasks_config = require('../internal-netmasks.json');

let netmasks = [];

netmasks_config.forEach(function(v) {
    netmasks.push(new Netmask(v));
});

logger.info('info', `loaded ${netmasks.length} netmasks`);

module.exports = {
    judge_zju_addr: function (addr) {
        for (var i in netmasks) {
            if (netmasks[i].contains(addr))
                return true;
        }
        return false;
    },
    judge_cn_addr: function (addr) {
        let geo = geoip.lookup(addr);
        if (geo && geo.country == 'CN')
            return true;
        else
            return false;
    }
};

