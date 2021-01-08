'use strict';
const express = require('express');

// for Schema
const Message = require('../schema/Message');

// for timezone
const moment = require('moment-timezone');
moment.tz.setDefault('Asia/Tokyo');

const router = express.Router();

router.get('/', (req, res, next)=> {
  Message.find({}, (err, msgs)=> {
    if(err) throw err;
    return res.render('index', {
      messages: msgs,
      user: req.session && req.session.user ? req.session.user : null,
      moment: moment
    });
  });
});

module.exports = router;