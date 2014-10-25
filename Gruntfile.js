module.exports = function (grunt) {
    var fs = require('fs');
    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

    grunt.initConfig({
        'concurrent': {
            dev: {
                tasks: [
                    'nodemon',
                    'node-inspector',
                    'watch'
                ],
                options: {
                    logConcurrentOutput: true
                }
            }
        },
        'nodemon': {
            dev: {
                script: 'app.js',
                options: {
                    nodeArgs: ['--debug'],
                    env: {
                        PORT: '5455'
                    },
                    callback: function (nodemon) {
                        nodemon.on('log', function (event) {
                            console.log(event.colour);
                        });

                        nodemon.on('restart', function () {
                            setTimeout(function() {
                                fs.writeFileSync('.rebooted', 'rebooted');
                            }, 1000);
                        });
                    }
                }
            }
        },
        'node-inspector': {
            dev: {}
        },
        'watch': {
            server: {
                files: ['.rebooted'],
                options: {
                    livereload: true
                }
            }
        }
    });

    grunt.registerTask('serve', [
        'concurrent:dev'
    ]);
};
