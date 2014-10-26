var express = require('express');
var router = express.Router();

var google = require('googleapis');

var _ = require('lodash');

var config = require('../config');
var meetingRooms = require('../config/meetingrooms.json');

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
    res.render('index', {
        title: 'Wandou Meetings',
        rooms: _.sortBy(meetingRooms, function (room) {
            return room.name;
        })
    });
});

module.exports = router;
