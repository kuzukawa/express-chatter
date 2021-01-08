'use strict';
const express = require('express');
const passport = require('passport');
const router = express.Router();

// for authentication
const TwitterStrategy = require('passport-twitter').Strategy;

// Twitter configuration
const twitterConfig = {
  consumerKey: process.env.TWITTER_CONSUMER_KEY,
  consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
  callbackURL: process.env.TWITTER_CALLBACK_URL,
};

//MongoDB Schema
const User = require('../schema/User');

//Signin
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
router.get('/twitter', passport.authenticate('twitter'));
router.get('/twitter/callback', passport.authenticate('twitter'),(req, res, next)=> {
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

module.exports = router;
