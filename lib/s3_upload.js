'use strict';
const aws = require('aws-sdk');
const mime = require('mime-types');
const logger = require('./logger');
require('dotenv').config();

const s3 = new aws.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.S3_REGION,
});

const uploadImage = (key, body) => {
  const contentType = mime.lookup(key);
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: body,
    ServerSideEncryption: 'AES256',
    ContentType: contentType,
    ACL: 'public-read',
  };
  logger.debug(key);
  s3.putObject(params).promise().then((data)=>{
    logger.info(data);
  }).catch((err) => {
    logger.error(err);
    throw err;
  });
};

module.exports = uploadImage;