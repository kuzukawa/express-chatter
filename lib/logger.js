const winston = require('winston');
const format = winston.format;

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


function Logger(){
 return winston.createLogger({
   level: 'debug',
   format: format.combine(
     enumerateErrorFormat(),
     format.json()
   ),
   transports: [
     new winston.transports.File(
       {
         filename: 'log/error.log', 
         level: 'error', 
         maxsize: 1048576
       }),
    new winston.transports.Console(
      {
        level: 'debug'
      },
    ),
   ],
 });
}

module.exports = new Logger();