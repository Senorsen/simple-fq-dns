// Copyright 2015 Senorsen <sen@senorsen.com>
// 

var geoip = require('geoip-lite');
var Netmask = require('netmask').Netmask;
var logger = global.logger;
var netmasks_config = require('./internal-netmasks.json');

var netmasks = [];

netmasks_config.forEach(function(v) {
    netmasks.push(new Netmask(v));
});

logger.log('info', `loaded ${netmasks.length} netmasks`);

module.exports = {
    judge_zju_addr: function (addr) {
        for (var i in netmasks) {
            if (netmasks[i].contains(addr))
                return true;
        }
        return false;
    },
    judge_cn_addr: function (addr) {
        var geo = geoip.lookup(addr);
        if (geo && geo.country == 'CN')
            return true;
        else
            return false;
    }
};

