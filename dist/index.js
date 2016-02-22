'use strict';var _typeof=typeof Symbol==="function"&&typeof Symbol.iterator==="symbol"?function(obj){return typeof obj;}:function(obj){return obj&&typeof Symbol==="function"&&obj.constructor===Symbol?"symbol":typeof obj;}; // Copyright 2015, 2016 Senorsen <senorsen.zhang@gmail.com>
// 
// A simple DNS server to fq in LAN
//

var logger=require('./logger')('index');
var dns=require('native-dns-rogerc');
var dnsorg=require('dns');
var util=require('util');
var config=require('../config.json');
var hosts=require('../hosts.json');
var judge_addr=require('./judge-addr');

var judge_zju_addr=judge_addr.judge_zju_addr;
var judge_cn_addr=judge_addr.judge_cn_addr;

var cache_zone={};

var server_udp=dns.createServer();
var server_tcp=dns.createTCPServer();
server_udp.serve(config.port,config.listen);
server_tcp.serve(config.port,config.listen);
logger.log('info','simple-fq-dns started at '+config.listen+':'+config.port);

var fs=require('fs');
var path=require('path');
var whitelist_str=fs.readFileSync(path.join(__dirname,'..','white-lists.txt')).toString();
var whitelist_p=whitelist_str.split('\n');
var whitelist=[];
for(var i in whitelist_p){
if(whitelist_p[i].trim()!='')
whitelist.push(whitelist_p[i].trim());}

console.log(whitelist);
logger.log('info','read '+whitelist.length+' whitelists');
var blacklist_str=fs.readFileSync(path.join(__dirname,'..','black-lists.txt')).toString();
var blacklist_p=blacklist_str.split('\n');
var blacklist=[];
for(var i in blacklist_p){
if(blacklist_p[i].trim()!='')
blacklist.push(blacklist_p[i].trim());}

console.log(blacklist);
logger.log('info','read '+blacklist.length+' blacklists');

var cacheTime=config.cache;

var on_req=function on_req(drequest,response){
var is_cache=undefined,cache=undefined;
var name=drequest.question[0].name;
if(typeof hosts[name]=='string'){
logger.log('info','host '+name+' in hosts: '+hosts[name]);
response.answer=[
dns.A({
name:name,
address:hosts[name],
ttl:600})];


response.send();
return;}

if(cacheTime&&typeof cache_zone[name]!='undefined'){
cache=cache_zone[name];
if(Date.now()-cache.time<=cacheTime*1000){
is_cache=true;}}


logger.log('info','client '+drequest.address.address+' req: '+name+(cache?is_cache?' - cache hit':' - cache expired':''));
var is_sent=undefined,counter=0;
var ans1=undefined,ans2=undefined;
if(is_cache){
response.answer=cache.answer;
response.send();
is_sent=true;
return;}

var whiteflag=false,blackflag=false;
for(var i in whitelist){
if(name.indexOf(whitelist[i])!=-1){
whiteflag=true;
break;}}


for(var i in blacklist){
if(name.indexOf(blacklist[i])!=-1){
blackflag=true;
break;}}


if(blackflag)
logger.info('in blacklist: '+name);
if(whiteflag)
logger.info('in whitelist: '+name);

var req1=undefined,req2=undefined;
logger.info('question',drequest.question[0]);
req1=dns.Request({
question:drequest.question[0],
server:{address:'10.10.0.21',port:53,type:'tcp'},
timeout:1200});



req1.once('error',function(e){
logger.error('req1 on error',e);});


req1.once('message',function(err,answer){
counter++;
ans1=answer.answer;
logger.info('answer1',ans1);
if((typeof ans1==='undefined'?'undefined':_typeof(ans1))!='object'){
logger.log('error','Error: ans1 is not an object');
return;}

var some_ip=undefined;
ans1.forEach(function(v){
if(!some_ip&&v.type==1&&typeof v.address=='string'){
some_ip=v.address;}});


var is_zju=undefined,is_cn=undefined;
if(some_ip){
is_zju=judge_zju_addr(some_ip);
is_cn=judge_cn_addr(some_ip);}else 
{
response.answer=ans1;
is_sent=true;
if(req2)req2.cancel();
response.send();}

if(blackflag||is_zju||is_cn||
!some_ip&&counter>=2){
logger.info('req1 '+name+': is_zju = '+is_zju+', is_cn = '+is_cn+', some_ip = '+some_ip+', counter = '+counter);
response.answer=ans1;
cache_zone[name]={
type:'ans1',
answer:ans1,
time:Date.now()};

if(is_sent)return;
is_sent=true;
if(req2)req2.cancel();
response.send();
try{
response.send();}
catch(e){
logger.error('error on req1 response.send()');}}});



req1.once('timeout',function(){
counter++;
if(ans2){
logger.warn(name+': req1 timeout, use ans2');
is_sent=true;
response.answer=ans2;
cache_zone[name]={
type:'ans2',
answer:ans2,
time:Date.now()};

try{
response.send();}
catch(e){
logger.error('error on req1 response.send()');}}});



if(whiteflag||!blackflag){
req2=dns.Request({
question:drequest.question[0],
server:{address:'8.8.8.8',port:53,type:'udp'},
timeout:1200});


req2.once('error',function(e){
logger.error('req2 on error',e);});


req2.once('message',function(err,answer){
counter++;
ans2=answer.answer;
logger.info('answer2',ans2);
var some_ip=undefined;
ans2.forEach(function(v){
if(!some_ip&&v.type==1&&typeof v.address=='string'){
some_ip=v.address;}});


var is_cn=undefined;
if(some_ip){
is_cn=judge_cn_addr(some_ip);}

if(!ans1){
cache_zone[name]={
type:'ans2',
answer:ans2,
time:Date.now()};

if(is_sent)return;
is_sent=true;}

logger.info('req2 '+name+': is_cn = '+is_cn+', some_ip = '+some_ip+', counter = '+counter);
if(is_cn||counter<2)return;
logger.log('info',name+': use ans2');
response.answer=ans2;
cache_zone[name]={
type:'ans2',
answer:ans2,
time:Date.now()};

if(is_sent)return;
is_sent=true;
if(req1)req1.cancel();
response.send();});

req2.once('timeout',function(){
counter++;
if(ans1){
logger.warn(name+': req2 timeout, use ans1');
is_sent=true;
response.answer=ans1;
cache_zone[name]={
type:'ans1',
answer:ans1,
time:Date.now()};

try{
response.send();}
catch(e){
logger.error('error on req2 response.send()');}}});



req2.send();}

req1.send();};

server_udp.on('request',on_req);
server_tcp.on('request',on_req);