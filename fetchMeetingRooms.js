var async = require('async');
var request = require('request');
var parser = require('xml2json');
var _ = require('lodash');
var fs = require('fs');

var config = require('./config');

async.waterfall([
    function (callback) {
        request({
            method: 'POST',
            url: 'https://www.google.com/accounts/ClientLogin',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            form: {
                'accountType': 'HOSTED_OR_GOOGLE',
                'Email': config.fetcher.username + '@' + config.fetcher.domain,
                'Passwd': config.fetcher.password,
                'service': 'apps',
                'source': 'Wandou Meetings Fetcher',
            }
        }, function (error, response, body) {
            if (error || response.statusCode !== 200) {
                return callback(response);
            }

            var result = body.match(/^auth=(.*)$/im);
            var auth = result[1];

            callback(null, auth);
        });
    }, function (auth, callback) {
        request({
            method: 'GET',
            url: 'https://apps-apis.google.com/a/feeds/calendar/resource/2.0/' + config.fetcher.domain + '/',
            headers: {
                'Content-Type': 'application/atom+xml',
                'Authorization': 'GoogleLogin auth=' + auth
            }
        }, function (error, response, body) {
            if (error || response.statusCode !== 200) {
                return callback(response);
            }

            callback(null, body);
        });
    }, function (xml, callback) {
        var json = JSON.parse(parser.toJson(xml));
        var result = {};
        var processName = function (name) {
            name = name.toLowerCase().replace(/ /g, '').replace('zone-', '-');
            return name.split('(')[0].trim();
        };

        var list = _.map(json.feed.entry, function (item) {
            var properties = item['apps:property'];

            return _.object(_.map(properties, function (property){
                return [property.name, property.value];
            }));
        });

        _.each(list, function (item) {
            if (!item.resourceType) {
                return;
            }

            var name = processName(item.resourceCommonName);

            result[name] = {
                id: item.resourceEmail,
                key: name,
                name: item.resourceCommonName,
                desc: item.resourceDescription
            };
        });

        fs.writeFile('config/meetingrooms.json', JSON.stringify(result), function (error) {
            if (error) {
                return callback(error);
            }

            callback(null, 'Fetch meeting room list successful!');
        });
    }
], function (error, result) {
    if (error) {
        console.error('Error', error);
        return;
    }

    console.log(result);
});
