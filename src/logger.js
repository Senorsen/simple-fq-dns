// Copyright 2015, 2016 Senorsen <senorsen.zhang@gmail.com>
// 

let winston = require('winston');

let createLogger = (label) => {
    winston.loggers.add(label, {
        console: {
            level: 'info',
            colorize: true,
            label: label
        }
    });
    let logger = winston.loggers.get(label);
    logger.info('init');
    return logger;
};

module.exports = createLogger;
