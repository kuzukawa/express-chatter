'use strict';
const express = require('express');
const router = express.Router();
const path = require('path');

// for file upload
const fileUpload = require('express-fileupload');

// for s3 upload
const s3_Upload = require('../lib/s3_upload');

// for uuid(use for uploaded file name)
const uuid = require('uuid');

// apply csrf
const csrf = require('csurf');
const csrfProtection = csrf();

// Schema
const Message = require('../schema/Message');


// check if logged in
function checkAuth(req, res, next) {
  if(req.isAuthenticated()){
    return next();
  } else {
    return res.redirect('/oauth/twitter');
  }
}

router.get('/', csrfProtection, (req, res)=> {
  return res.render('update', {
    user: req.session && req.session.user ? req.session.user : null, 
    csrf: req.csrfToken()});
});

router.post('/', checkAuth, fileUpload(), csrfProtection, (req, res)=> {
  if(req.files && req.files.image) {
    const fname = uuid.v4() + path.extname(req.files.image.name);
    const url = `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${fname}`;
    /*
    req.files.image.mv('./image/' + fname, (err)=> {
      if(err) throw err;
    });
    */
    s3_Upload(fname, req.files.image.data);

    const newMessage = new Message({
      username: req.body.username,
      avatar_path: req.session.user.avatar_path,
      message: req.body.message,
      image_path: url,
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

module.exports = router;