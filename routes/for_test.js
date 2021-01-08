'use strict';
const express = require('express');
const router = express.Router();
const child_process = require('child_process');

// test for error handling( FOR TEST ONLY.)
router.get('/error', (req, res, next)=> {
  return next(new Error('error'));
}); 

// test for OS Cmd injection(FOR TEST ONLY.)
router.get('/whois', (req, res)=> {
  child_process.execFile('whois', [req.query.url], (error, stdout, stderr)=> {
    if(error){
      throw error;
    }
    return res.send(stdout);
  });
});

module.exports = router;