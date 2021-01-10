/*!
 * Logger
 */

'use strict';

/**
 * Module dependencies.
 * @private
 */
const winston = require('winston');
const format = winston.format;

/**
 * Add stack trace to logging format.
 */
const enumerateErrorFormat = format(info => {
  if (info.message instanceof Error) {
    info.message = Object.assign({
      message: info.message.message,
      stack: info.message.stack
    }, info.message);
  }

  if (info instanceof Error) {
    return Object.assign({
      message: info.message,
      stack: info.stack
    }, info);
  }

  return info;
});

/**
 * Create logger.
 */
function Logger() {
 const logger = winston.createLogger({
  level: 'debug',
  format: format.combine(
    format.timestamp(),
    enumerateErrorFormat(),
    format.json()
   ),
   transports: [
    new winston.transports.File(
      {
        filename: 'log/error.log', 
        level: 'error', 
        maxsize: 1048576
      }
    ),
    new winston.transports.File(
      {
        filename: 'log/debug.log', 
        level: 'debug', 
        maxsize: 1048576
      }
    ),
    new winston.transports.Console(
      {
        level: 'debug'
      }
    ),
   ],
 });
 
 //morganとの連携用のwrite関数
 logger.stream = {
   write: function(message) {
     logger.info(message);
   }
 };
 return logger;
}

/**
 * Module exports.
 * @public
 */
module.exports = new Logger();
