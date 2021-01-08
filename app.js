'use strict';
const http = require('http');
const path = require('path');
const morgan = require('morgan');
const express = require('express');
const passport = require('passport');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const logger = require('./lib/logger');
const MongoStore = require('connect-mongo')(session);
require('dotenv').config();

// for security
const helmet = require('helmet');

const app = express();

app.use(morgan('combined'));
app.use(bodyParser.urlencoded({ extended: false }));

// apply helmet
const cps = helmet.contentSecurityPolicy.getDefaultDirectives();
cps['img-src'] = ['*', 'data'];
app.use(helmet({
  contentSecurityPolicy:{directives: cps},
}));

app.use('/static', express.static(path.join(__dirname, 'static')));
app.use('/image', express.static(path.join(__dirname, 'image')));
app.use('/avatar', express.static(path.join(__dirname, 'avatar')));
app.use('/css', express.static(path.join(__dirname, 'css')));

//認証用ミドルウェアの追加
app.use(session({
  secret: 'b87ef9fb4a152dbfe4cf4ea630444474',
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({
    mongooseConnection: mongoose.connection,
    db: 'session',
    ttl: 14 * 24 * 60 * 60,
  }),
  // cookie: { secure: true },
}));
app.use(passport.initialize());
app.use(passport.session());

// connect to mongodb
mongoose.connect(process.env.MONGODB_URI, function(err) {
  if(err){
    logger.error(err);
  } else {
    logger.info('successfully connected to MongodB');
  }
});

// view設定
app.set('views', path.join(__dirname,'view'));
app.set('view engine', 'pug');

// ---------- Routing ---------------
//Root
const route_index = require('./routes/index');
app.use('/', route_index);

// Update
const route_update = require('./routes/update');
app.use('/update', route_update);

// Logout
const route_logout = require('./routes/logout');
app.use('/logout', route_logout);

// Signin
const route_signin = require('./routes/signin');
app.use('/oauth', route_signin);

// for test
const route_test = require('./routes/for_test');
app.use('/', route_test);

// error handling
app.use((err, req, res, next)=> {
  logger.error(err);
  if(err.code === 'EBADCSRFTOKEN') {
    res.status(403);
  } else {
    res.status(err.status || 500);
  }

  return res.render('error', {
    message: err.message,
    status: err.status || 500
  });
});

// 404 handling
app.use((req, res, next)=> {
  const err = new Error('Not Found');
  err.status = 404;
  return res.render('error', {
    status: err.status,
  });
});

const server = http.createServer(app);
server.listen(process.env.PORT);