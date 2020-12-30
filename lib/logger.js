var winston = require('winston');

function Logger(){
  /*
  return winston.add(winston.transports.File, {
    filename: "log/warning.log",
    maxsize: 1048576,
    level: "warn"
  });
  */
 return winston.createLogger({
   level: 'info',
   format: winston.format.json(),
   transports: [
     new winston.transports.File({ filename: 'log/warning.log', level: 'warn', maxsize: 1048576}),
   ],
 });
}

module.exports = new Logger();