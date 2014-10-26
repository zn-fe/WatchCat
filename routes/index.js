var express = require('express');
var router = express.Router();

var google = require('googleapis');
var calendar = google.calendar('v3');

var async = require('async');
var moment = require('moment');
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

router.get('/room/available', function (req, res) {
    async.waterfall([function (callback) {
        var debug = false;
        debug = true;

        if (!!debug) {
            return callback(null, require('../config/available.json'));
        }

        var roomIds = _.map(meetingRooms, function (room) {
            return {
                id: room.id
            };
        });

        calendar.freebusy.query({
            auth: authClient,
            fields: 'calendars',
            resource: {
                calendarExpansionMax: roomIds.length,
                items: roomIds,
                // timeMin: '2014-10-24T14:00:00+08:00',
                // timeMax: '2014-10-24T16:00:00+08:00',
                timeMin: moment().format(),
                timeMax: moment().add(1, 'h').format(),
                timeZone: 'Asia/Shanghai'
            }
        }, function (error, resp) {
            console.log(resp);

            if (error) {
                return callback(error.message);
            }

            callback(null, resp.calendars);
        });
    }, function (calendars, callback) {
        var roomReindex = {};
        var result = [];

        _.each(meetingRooms, function (room) {
            roomReindex[room.id] = room;
        });

        _.each(calendars, function (room, key) {
            if (room.busy.length === 0) {
                result.push(roomReindex[key]);
            }
        });

        var rooms = _.sortBy(result, function (room) {
            return room.name;
        });

        callback(null, rooms);
    }], function (error, rooms) {
        if (error) {
            var err = new Error(error);
            err.status = 404;
            return next(err);
        }

        res.render('available', {
            title: 'Available within one hour',
            rooms: rooms
        });
    });
});

router.get('/room/:name', function (req, res, next) {
    var name = req.params.name.toLowerCase();
    var room = meetingRooms[name];

    if (!room) {
        var err = new Error('Not Found');
        err.status = 404;
        return next(err);
    }

    async.waterfall([function (callback) {
        var debug = false;
        debug = true;

        if (debug) {
            return callback(null, require('../config/events.json'));
        }

        calendar.events.list({
            auth: authClient,
            calendarId: room.id,
            fields: 'items(end,organizer,start,summary)',
            orderBy: 'startTime',
            singleEvents: true,
            // timeMin: '2014-10-24T00:00:00+08:00',
            // timeMax: '2014-10-25T00:00:00+08:00',
            timeMin: moment().format(),
            timeMax: moment().format('YYYY-MM-DDT23:59:59+08:00'),
            timeZone: 'Asia/Shanghai'
        }, function (error, resp) {
            if (error) {
                return callback(error.message);
            }

            // require('fs').writeFile('config/events.json', JSON.stringify(resp.items), function (fsError) {
            //     if (fsError) {
            //         return callback(fsError);
            //     }
            // });

            callback(null, resp.items);
        });
    }], function (error, events) {
        if (error) {
            var err = new Error(error);
            err.status = 404;
            return next(err);
        }

        res.render('room', {
            title: room.name,
            events: events
        });
    });
});

router.get('/book/:name', function (req, res, next) {
    var name = req.params.name.toLowerCase();
    var room = meetingRooms[name];

    if (!room) {
        var err = new Error('Not Found');
        err.status = 404;
        return next(err);
    }

    return res.render('book', {
        title: 'Booking ' + room.name
    });
});

module.exports = router;
