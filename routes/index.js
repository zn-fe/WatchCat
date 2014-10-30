var express = require('express');
var router = express.Router();

var google = require('googleapis');
var calendar = google.calendar('v3');

var async = require('async');
var moment = require('moment');
var _ = require('lodash');

var config = require('../config');
var meetingRooms = require('../config/meetingrooms.json');

var getAuthClient = function (email) {
    return new google.auth.JWT(
        config.serviceAccount.email,
        config.serviceAccount.keyFilePath,
        config.serviceAccount.key,
        config.serviceAccount.scopes,
        email
    );
};

var authClient = getAuthClient('noreply@wandoujia.com');
var authTokens = {};

var debug = false;
// debug = true;

router.use(function (req, res, next) {
    if (debug) {
        return next();
    }

    var now = Date.now();

    if (authTokens.expiry_date && authTokens.expiry_date - 300 > Date.now()) {
        return next();
    }

    authClient.authorize(function (error, tokens) {
        if (error) {
            var err = new Error(error.error);
            err.status = 400;
            return next(err);
        }

        authTokens = tokens;
        next();
    });
});

router.get('/', function (req, res) {
    res.render('index', {
        title: 'All',
        rooms: _.sortBy(meetingRooms, function (room) {
            return room.name;
        })
    });
});

router.get('/room/available', function (req, res, next) {
    async.waterfall([function (callback) {
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
            if (!room.errors && room.busy.length === 0) {
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

router.post('/api/book/:name', function (req, res, next) {
    var name = req.params.name.toLowerCase();
    var room = meetingRooms[name];

    if (!room) {
        return res.status(404).json({
            message: 'Not Found',
            status: 404
        });
    }

    if (!req.params.username || !req.params.summary) {
        return res.status(403).json({
            message: 'Missing parameters',
            status: 403
        });
    }

    var email = req.params.username.split('@')[0] + '@' + config.fetcher.domain;
    var summary = req.params.summary;
    var timeStart = moment().format();
    var timeEnd = moment().add(30, 'm').format();

    async.waterfall([function (callback) {
        calendar.freebusy.query({
            auth: authClient,
            fields: 'calendars',
            resource: {
                items: [{
                    id: room.id
                }],
                timeMin: timeStart,
                timeMax: timeEnd,
                timeZone: 'Asia/Shanghai'
            }
        }, function (error, resp) {
            if (error) {
                return callback(error.message);
            }

            var calendars = resp.calendars;

            if (calendars[room.id].busy.length > 0) {
                return callback('Meeting room has been reserved');
            }

            callback(null);
        });
    }, function (callback) {
        var personalAuthClient = getAuthClient(email);

        personalAuthClient.authorize(function (error, tokens) {
            if (error) {
                return callback(error.error);
            }

            callback(null, personalAuthClient);
        });
    }, function (personalAuthClient, callback) {
        calendar.events.insert({
            auth: personalAuthClient,
            calendarId: email,
            fields: 'attendees,end,organizer,start,summary',
            sendNotifications: true,
            resource: {
                summary: summary,
                location: room.name,
                attendees: [{
                    email: room.id
                }, {
                    email: email,
                    responseStatus: 'accepted'
                }],
                start: {
                    dateTime: timeStart,
                    timeZone: 'Asia/Shanghai'
                },
                end: {
                    dateTime: timeEnd,
                    timeZone: 'Asia/Shanghai'
                }
            },
        }, function (error, resp) {
            if (error) {
                return callback(error);
            }

            callback(null, resp);
        });
    }], function (error, resp) {
        if (error) {
            return res.status(500).json({
                message: error,
                status: 500
            });
        }

        res.json(resp);
    });
});

module.exports = router;
