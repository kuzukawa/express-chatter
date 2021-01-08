'use strict';
const express = require('express');
const router = express.Router();

router.get('/', (req, res, next)=> {
  req.logout();
  delete req.session.user;
  return res.redirect('/');
});

module.exports = router;