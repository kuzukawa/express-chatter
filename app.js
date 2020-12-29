var http = require('http');
var path = require('path');
var morgan = require('morgan');
var express = require('express');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var fileUpload = require('express-fileupload');
var passport = require('passport');
var session = require('express-session')
var LocalStrategy = require('passport-local').Strategy;

//MongoDB Schema
var Message = require('./schema/Message');
var User = require('./schema/User');

var app = express();

app.use(morgan("combined"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use("/static", express.static(path.join(__dirname, "static")));
app.use("/image", express.static(path.join(__dirname, "image")));
app.use("/avatar", express.static(path.join(__dirname, "avatar")));

//認証用ミドルウェアの追加
app.use(session({ secret: 'HogeFuga'}));
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

// view設定
app.set('views', path.join(__dirname,'templates'));
app.set('view engine', 'pug');

// ---------- Routing ---------------
//Root
app.get("/", function(req, res, next) {
  //return res.send("Hello World");
  //return res.render("index", {title: "Hello World"});
  Message.find({}, function(err, msgs){
    if(err) throw err;
    return res.render('index', {
      messages: msgs,
      user: req.session && req.session.user ? req.session.user : null});
  });
});

//Signin
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

passport.serializeUser(function(user, done) {
  done(null, user._id);
});

passport.deserializeUser(function(id, done) {
  User.findOne({_id: id}, function(err, user) {
    done(err, user);
  })
});

app.get("/update", function(req, res) {
  return res.render("update");
});

app.post("/update", fileUpload(), function(req, res) {

  if(req.files && req.files.image) {    
    req.files.image.mv('./image/' + req.files.image.name, function(err) {
      if(err) throw err;
    });   
    var newMessage = new Message({
      username: req.body.username,
      message: req.body.message,
      image_path: '/image/' + req.files.image.name
    });
  } else {
    var newMessage = new Message({
      username: req.body.username,
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

var server = http.createServer(app);
server.listen(3000);