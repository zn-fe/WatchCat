var express = require('express');
var router = express.Router();

var google = require('googleapis');

var config = require('../config');

var authClient = new google.auth.JWT(
    config.serviceAccount.email,
    config.serviceAccount.keyFilePath,
    config.serviceAccount.key,
    config.serviceAccount.scopes,
    'netputer@wandoujia.com'
);

authClient.authorize(function (error, tokens) {
    if (error) {
        console.error('Authorize Error', error);
        return;
    }
});

router.get('/', function (req, res) {
    //

    res.render('index', {
        title: 'Express'
    });
});

module.exports = router;
