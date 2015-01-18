$(function () {
    var returnFalse = function () { return false; };
    var storage = window.localStorage = window.localStorage || {
        getItem: returnFalse,
        setItem: returnFalse
    };

    var $inputUsername = $('#js-input-username');
    var $inputDescription = $('#js-input-description');
    var $btnBook = $('#js-btn-book');
    var $modalStatus = $('#js-modal-status');

    $('input').on('keyup', function (e) {
        $btnBook.toggleClass('disabled', !$inputUsername.val() || !$inputDescription.val());
    });

    $btnBook.on('touchend', function (e) {
        if ($btnBook.hasClass('disabled')) {
            e.preventDefault();
            return;
        }

        var regexResult = location.pathname.match(/\/book\/(.*)/) || [];
        var roomName = regexResult[1];
        var userName = $inputUsername.val();
        var eventSummary = $inputDescription.val();
        var $modalContent = $modalStatus.find('.content-padded');

        window.localStorage.setItem('username', userName);

        $modalStatus.addClass('active wc-modal-loading');
        $modalContent.html('Please wait...');

        $.ajax({
            type: 'POST',
            url: '/api/book/' + roomName,
            data: {
                username: userName,
                summary: eventSummary
            },
            success: function (data) {
                $modalContent.html('<span class="icon icon-check"></span> Enjoy your meeting :-)');
            },
            error: function (xhr, errorType, error) {
                var data = JSON.parse(xhr.response);
                $modalContent.html('<span class="icon icon-close"></span>' + data.message);
            },
            complete: function (xhr, status) {
                $modalStatus.removeClass('wc-modal-loading');
            }
        });
    });

    if (storage.getItem('username')) {
        $inputUsername.val(storage.getItem('username'));
    }

    $btnBook.toggleClass('disabled', !$inputUsername.val() || !$inputDescription.val());
    $modalStatus.show();

    // jshint ignore:start
    setTimeout(function () {
        (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)})(window,document,'script','//www.google-analytics.com/analytics.js','ga');

        ga('create', 'UA-15790641-63', 'auto');
        ga('send', 'pageview');
    }, 200);
    // jshint ignore:end
});
