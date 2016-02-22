'use strict'; // Copyright 2015, 2016 Senorsen <senorsen.zhang@gmail.com>
// 

var geoip=require('geoip-lite');
var Netmask=require('netmask').Netmask;
var logger=require('./logger')('judge-addr');
var netmasks_config=require('../internal-netmasks.json');

var netmasks=[];

netmasks_config.forEach(function(v){
netmasks.push(new Netmask(v));});


logger.info('info','loaded '+netmasks.length+' netmasks');

module.exports={
judge_zju_addr:function judge_zju_addr(addr){
for(var i in netmasks){
if(netmasks[i].contains(addr))
return true;}

return false;},

judge_cn_addr:function judge_cn_addr(addr){
var geo=geoip.lookup(addr);
if(geo&&geo.country=='CN')
return true;else 

return false;}};