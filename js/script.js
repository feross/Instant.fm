var controller;
var ytplayer;

$(document).ready(function() {
    controller = new Controller();
    controller.loadPlaylist(playlist);
    new uploader('drop', 'status', 'http://dev.instant.fm:8888/upload', null);
    
    $('#playlist tr').click(function(e) {
        var searchTerm = '';
        $(this).children().not('th').each(function() {
            searchTerm += $(this).html() + ' ';
        });
        if (searchTerm) {
            controller.playVideoBySearchTerm(searchTerm); 
        }
    });    
    
    // Autoload first song
    $('#playlist td').first().click();
});

// Automatically called when player is ready
function onYouTubePlayerReady(playerId) {
    ytplayer = document.getElementById("ytPlayer");
    ytplayer.addEventListener("onStateChange", "onPlayerStateChange");
}

var Controller = function() {
    this.isPlayerInitialized = false; // have we called initPlayer?
}

Controller.prototype.loadPlaylist = function(playlist) {
    alert(playlist);
}

Controller.prototype.initPlayer = function(firstVideoId) {
    this.isPlayerInitialized = true;
    if (!firstVideoId) {
        firstVideoId = '_2c5Fh3kfrI';
    }
    var params = {
        allowScriptAccess: "always"
    };
    var atts = {
        id: "ytPlayer",
        allowFullScreen: "true"
    };
    swfobject.embedSWF("http://www.youtube.com/v/" + firstVideoId +
    "&enablejsapi=1&playerapiid=ytplayer&rel=0&autoplay=1&egm=0&loop=0" +
    "&fs=1&hd=0&showsearch=0&showinfo=0&iv_load_policy=3&cc_load_policy=1",
    "videoDiv", "720", "405", "8", null, null, params, atts);
}

Controller.prototype.playVideoBySearchTerm = function(keyword) {
    // Restrict search to embeddable videos with &format=5.
    var the_url = 'http://gdata.youtube.com/feeds/api/videos?q=' + encodeURIComponent(keyword) + '&format=5&max-results=1&v=2&alt=jsonc';

    $.ajax({
        type: "GET",
        url: the_url,
        dataType: "jsonp",
        success: function(responseData, textStatus, XMLHttpRequest) {
            if (responseData.data.items) {
                var videos = responseData.data.items;
                controller.loadAndPlayVideo(videos[0].id);
            } else {
                console.log('No results for "' + keyword + '"');
            }
        }
    });
}

Controller.prototype.loadAndPlayVideo = function(videoId) {
    if (ytplayer) {
        ytplayer.loadVideoById(videoId);
    } else {
        console.log('Initing player...');
        if (!this.isPlayerInitialized) {
            this.initPlayer(videoId);
        }
        window.setTimeout(function() {
            controller.loadAndPlayVideo(videoId);
        }, 500);
    }
}

function parseResponse(playlist) {
    controller.loadPlaylist(playlist);
}