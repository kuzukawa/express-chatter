var http = require('http');
var path = require('path');
var morgan = require('morgan');
var express = require('express');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var fileUpload = require('express-fileupload');
var passport = require('passport');
var session = require('express-session')
var logger = require('./lib/logger');
var MongoStore = require('connect-mongo')(session);
require('dotenv').config();

// for authentication
//var LocalStrategy = require('passport-local').Strategy;
var TwitterStrategy = require('passport-twitter').Strategy;

// for timezone
var moment = require('moment-timezone');
moment.tz.setDefault("Asia/Tokyo");

// for security
var helmet = require('helmet');

// for csrf
var csrf = require('csurf');

// for cors
var cors = require('cors');
var corsOption = {
  "origin": "www.example.com",
  "methods": "GET,HEAD,POST"
};

var child_process = require('child_process');

//MongoDB Schema
var Message = require('./schema/Message');
var User = require('./schema/User');
const { toNamespacedPath } = require('path');

var app = express();

app.use(morgan("combined"));
app.use(bodyParser.urlencoded({ extended: false }));

// apply helmet
var cps = helmet.contentSecurityPolicy.getDefaultDirectives();
cps["img-src"] = ["*", "data"];
app.use(helmet({
  contentSecurityPolicy:{directives: cps},
}));

// apply csrf
var csrfProtection = csrf();

app.use("/static", express.static(path.join(__dirname, "static")));
app.use("/image", express.static(path.join(__dirname, "image")));
app.use("/avatar", express.static(path.join(__dirname, "avatar")));
app.use("/css", express.static(path.join(__dirname, "css")));

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
mongoose.connect('mongodb://localhost:27017/chatapp', function(err) {
  if(err){
    console.error(err);
  } else {
    console.log("successfully connected to MongodB");
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
var twitterConfig = {
  consumerKey: process.env.TWITTER_CONSUMER_KEY,
  consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
  callbackURL: process.env.TWITTER_CALLBACK_URL,
};

// view設定
app.set('views', path.join(__dirname,'templates'));
app.set('view engine', 'pug');

// ---------- Routing ---------------
//Root
app.get("/", function(req, res, next) {
  //return res.send("Hello World");
  //return res.render("index", {title: "Hello World"});
  //logger.warn(req.session.user);
  Message.find({}, function(err, msgs){
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

passport.use(new TwitterStrategy(twitterConfig,function(token, tokenSecret, profile, done){
  User.findOne({ twitter_profile_id: profile.id }, function(err,user) {
    if(err) {
      return done(err);
    } else if(!user) {
      var _user = {
        username: profile.displayName,
        twitter_profile_id: profile.id,
        avatar_path: profile.photos[0].value
      };
      var newUser = new User(_user);
      newUser.save(function(err){
        if(err) throw err;
        return done(null, newUser);
      });
    } else {
      return done(null, user);
    }
  })
}));
app.get('/oauth/twitter', passport.authenticate('twitter'));
app.get('/oauth/twitter/callback', passport.authenticate('twitter'),function(req, res, next){
  User.findOne({_id: req.session.passport.user}, function(err, user){
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
passport.serializeUser(function(user, done) {
  done(null, user._id);
});

passport.deserializeUser(function(id, done) {
  User.findOne({_id: id}, function(err, user) {
    done(err, user);
  })
});

app.get("/update", csrfProtection, function(req, res) {
  return res.render("update", {
    user: req.session && req.session.user ? req.session.user : null, 
    csrf: req.csrfToken()});
});

app.post("/update", checkAuth, fileUpload(), csrfProtection, function(req, res) {

  if(req.files && req.files.image) {    
    req.files.image.mv('./image/' + req.files.image.name, function(err) {
      if(err) throw err;
    });   
    var newMessage = new Message({
      username: req.body.username,
      avatar_path: req.session.user.avatar_path,
      message: req.body.message,
      image_path: '/image/' + req.files.image.name
    });
  } else {
    var newMessage = new Message({
      username: req.body.username,
      avatar_path: req.session.user.avatar_path,
      message: req.body.message
    });
  }
  newMessage.save((err)=> {
    if(err) throw err;
    return res.redirect("/");
  });
});

app.get("/form", function(req,res){
  return res.render("form");
});

app.post("/form", function(req, res) {
  return res.render("result", { username: req.body.username,
    message: req.body.message});
});

app.get("/logout", function(req, res, next){
  req.logout();
  delete req.session.user;
  return res.redirect("/");
});

// test for error handling( FOR TEST ONLY.)
app.get("/error", function(req, res, next) {
  return next(new Error("error"));
}); 

// test for OS Cmd injection(FOR TEST ONLY.)
app.get("/whois", function(req, res, next) {
  child_process.execFile('whois', [req.query.url], function(error, stdout, stderr){
    if(error){
      throw error;
    }
    return res.send(stdout);
  });
});

// error handling
app.use(function(err, req, res, next) {
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
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  return res.render('error', {
    status: err.status,
  })
});

var server = http.createServer(app);
server.listen(3000);