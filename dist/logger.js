'use strict'; // Copyright 2015, 2016 Senorsen <senorsen.zhang@gmail.com>
// 

var winston=require('winston');

var createLogger=function createLogger(label){
winston.loggers.add(label,{
console:{
level:'info',
colorize:true,
label:label}});


var logger=winston.loggers.get(label);
logger.info('init');
return logger;};


module.exports=createLogger;