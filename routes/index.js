'use strict';
const express = require('express');

// for Schema
const Message = require('../schema/Message');

// for timezone
const moment = require('moment-timezone');
moment.tz.setDefault('Asia/Tokyo');

const router = express.Router();

router.get('/', (req, res, next)=> {
  // 新しい投稿を前に。
  // 最初は最大10件。
  Message.find({}).sort({_id: -1}).limit(10).exec((err, msgs)=> {
    if(err) throw err;
    return res.render('index', {
      messages: msgs,
      user: req.session && req.session.user ? req.session.user : null,
      moment: moment
    });
  });
});

module.exports = router;