'use strict';
const http = require('http');
const path = require('path');
const morgan = require('morgan');
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const fileUpload = require('express-fileupload');
const passport = require('passport');
const session = require('express-session');
const logger = require('./lib/logger');
const MongoStore = require('connect-mongo')(session);
require('dotenv').config();

// for authentication
//var LocalStrategy = require('passport-local').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;

// for timezone
const moment = require('moment-timezone');
moment.tz.setDefault('Asia/Tokyo');

// for security
const helmet = require('helmet');

// for csrf
const csrf = require('csurf');

// for cors
/*
const cors = require('cors');
const corsOption = {
  "origin": "www.example.com",
  "methods": "GET,HEAD,POST"
};
*/

// for uuid(use for uploaded file name)
const uuid = require('uuid');

const child_process = require('child_process');

//MongoDB Schema
const Message = require('./schema/Message');
const User = require('./schema/User');
const { toNamespacedPath } = require('path');

const app = express();

app.use(morgan('combined'));
app.use(bodyParser.urlencoded({ extended: false }));

// apply helmet
const cps = helmet.contentSecurityPolicy.getDefaultDirectives();
cps['img-src'] = ['*', 'data'];
app.use(helmet({
  contentSecurityPolicy:{directives: cps},
}));

// apply csrf
const csrfProtection = csrf();

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

// check if logged in
function checkAuth(req, res, next) {
  if(req.isAuthenticated()){
    return next();
  } else {
    return res.redirect('/oauth/twitter');
  }
}

// Twitter configuration
const twitterConfig = {
  consumerKey: process.env.TWITTER_CONSUMER_KEY,
  consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
  callbackURL: process.env.TWITTER_CALLBACK_URL,
};

// view設定
app.set('views', path.join(__dirname,'view'));
app.set('view engine', 'pug');

// ---------- Routing ---------------
//Root
app.get('/', (req, res, next)=> {
  //return res.send("Hello World");
  //return res.render("index", {title: "Hello World"});
  //logger.warn(req.session.user);
  Message.find({}, (err, msgs)=> {
    if(err) throw err;
    return res.render('index', {
      messages: msgs,
      user: req.session && req.session.user ? req.session.user : null,
      moment: moment
    });
  });
});

//Signin
/*
app.get('/signin', function(req, res, next) {
  return res.render('signin');
});
app.post('/signin', fileUpload(), function(req, res, next) {
  var avatar = req.files.avatar;
  avatar.mv('./avatar/' + avatar.name, function(err) {
    if(err) throw err;
    var newUser = new User({
      username: req.body.username,
      password: req.body.password,
      avatar_path: '/avatar/' + avatar.name
    });
    newUser.save((err)=> {
      if(err) throw err;
      return res.redirect("/");
    });
  });
});

//Login
app.get('/login', function(req,res,next) {
  return res.render('login');
});
app.post('/login', passport.authenticate('local'), function(req, res, next) {
  console.log("****" + req.session.passport.user);
  User.findOne({_id: req.session.passport.user}, function(err, user){
    if(err||!user||!req.session){
      return res.render('/login');
    } else {
      req.session.user = {
        username: user.username,
        avatar_path: user.avatar_path
      };
      return res.redirect("/");
    }
  }) 
});

passport.use(new LocalStrategy(
  function(username, password, done) {
    User.findOne({username: username}, function(err, user){
      if(err) { return done(err); }
      if(!user) {
        return done(null, false, { message: 'Incorrect username.'});
      }
      if(user.password !== password) {
        return done(null, false, { message: 'Incorrect password.'});
      }
      return done(null, user);
    });
  }
));
*/

passport.use(new TwitterStrategy(twitterConfig,(token, tokenSecret, profile, done)=> {
  User.findOne({ twitter_profile_id: profile.id }, (err,user)=> {
    if(err) {
      return done(err);
    } else if(!user) {
      const _user = {
        username: profile.displayName,
        twitter_profile_id: profile.id,
        avatar_path: profile.photos[0].value
      };
      var newUser = new User(_user);
      newUser.save((err)=> {
        if(err) throw err;
        return done(null, newUser);
      });
    } else {
      return done(null, user);
    }
  });
}));
app.get('/oauth/twitter', passport.authenticate('twitter'));
app.get('/oauth/twitter/callback', passport.authenticate('twitter'),(req, res, next)=> {
  User.findOne({_id: req.session.passport.user}, (err, user)=> {
    if(err||!req.session) {
      return res.redirect('/oauth/twitter');
    }
    req.session.user = {
      username: user.username,
      avatar_path: user.avatar_path
    };
    return res.redirect('/');
  });
});
passport.serializeUser((user, done)=> {
  done(null, user._id);
});

passport.deserializeUser((id, done)=> {
  User.findOne({_id: id}, (err, user)=> {
    done(err, user);
  });
});

app.get('/update', csrfProtection, (req, res)=> {
  return res.render('update', {
    user: req.session && req.session.user ? req.session.user : null, 
    csrf: req.csrfToken()});
});

app.post('/update', checkAuth, fileUpload(), csrfProtection, (req, res)=> {
  if(req.files && req.files.image) {
    const fname = './image/' + uuid.v4() + path.extname(req.files.image.name);
    req.files.image.mv(fname, (err)=> {
      if(err) throw err;
    });   
    const newMessage = new Message({
      username: req.body.username,
      avatar_path: req.session.user.avatar_path,
      message: req.body.message,
      image_path: fname
    });
    newMessage.save((err)=> {
      if(err) throw err;
      return res.redirect('/');
    });  
  } else {
    const newMessage = new Message({
      username: req.body.username,
      avatar_path: req.session.user.avatar_path,
      message: req.body.message
    });
    newMessage.save((err)=> {
      if(err) throw err;
      return res.redirect('/');
    }); 
  }
});

app.get('/form', (req,res)=> {
  return res.render('form');
});

app.post('/form', (req, res)=> {
  return res.render('result', { username: req.body.username,
    message: req.body.message});
});

app.get('/logout', (req, res, next)=> {
  req.logout();
  delete req.session.user;
  return res.redirect('/');
});

// test for error handling( FOR TEST ONLY.)
app.get('/error', (req, res, next)=> {
  return next(new Error('error'));
}); 

// test for OS Cmd injection(FOR TEST ONLY.)
app.get('/whois', (req, res, next)=> {
  child_process.execFile('whois', [req.query.url], (error, stdout, stderr)=> {
    if(error){
      throw error;
    }
    return res.send(stdout);
  });
});

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