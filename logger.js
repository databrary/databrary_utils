// logger.js
const log4js = require('log4js')
const fs = require('fs')

const log_file_name = 'all.log'

// delete previous logs
fs.stat('logs/' + log_file_name, function (err, stats) {
    if (err) {
        return;
    }

    fs.unlink('logs/' + log_file_name, function (err) {
        if (err) return;
    });
});

log4js.configure({
    appenders: {
        log: {
            type: 'file',
            filename: 'logs/' + log_file_name
        },
        out: {
            type: 'stdout'
        }
    },
    categories: {
        default: {
            appenders: ['out', 'log'],
            level: 'debug'
        }
    }
});

const logger = log4js.getLogger('log')

module.exports = logger;