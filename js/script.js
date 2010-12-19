// TODO
// Auto-advance to next song
// Add 'play' buttons

var controller;
var ytplayer;

$(function() {
    controller = new Controller([{t:"Replay", a:"Iyaz"}, {t:"Sweet Talking Woman", a:"ELO"}, {t:"Wavin Flag", a:"Knaan"}, {t:"Still Alive", a:"Glados"}]);
    controller.playlist.render();
    controller.playlist.playSong(0); // Auto-play
    
    // new uploader('drop', 'status', 'http://dev.instant.fm:8000/upload', null);    
});

// Automatically called when player is ready
function onYouTubePlayerReady(playerId) {
    ytplayer = document.getElementById("ytPlayer");
    ytplayer.addEventListener("onStateChange", "onPlayerStateChange");
}

/**
 * Instant.fm Controller
 */
var Controller = function(playlist) {
    this.isPlayerInitialized = false; // have we called initPlayer?
    this.playlist = new Playlist(playlist);
}
/**
 * Controller.initPlayer() - Initialize the YouTube player
 */
Controller.prototype.initPlayer = function(firstVideoId) {
    this.isPlayerInitialized = true;
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
    "videoDiv", "360", "215", "8", null, null, params, atts);
}

/**
 * Controller.playVideoBySearch(q) - Play top video for given search query
 * @q - search query
 */
Controller.prototype.playVideoBySearch = function(q) {
    // Restrict search to embeddable videos with &format=5.
    var the_url = 'http://gdata.youtube.com/feeds/api/videos?q=' + encodeURIComponent(q) + '&format=5&max-results=1&v=2&alt=jsonc';

    $.ajax({
        type: "GET",
        url: the_url,
        dataType: "jsonp",
        success: function(responseData, textStatus, XMLHttpRequest) {
            if (responseData.data.items) {
                var videos = responseData.data.items;
                controller.playVideoById(videos[0].id);
            } else {
                log('No results for "' + q + '"');
            }
        }
    });
}

/**
 * Controller.playVideoById(q) - Play video with given Id
 * @id - video id
 */
Controller.prototype.playVideoById = function(id) {
    if (ytplayer) {
        ytplayer.loadVideoById(id);
    } else {
        if (!this.isPlayerInitialized) {
            this.initPlayer(id);
        }
    }
}

/**
 * Instant.fm Playlist
 */
var Playlist = function(songs) {
    this.songs = songs || [];
}

/**
 * Playlist.playSong(i) - Play a song by index
 * @i - song index
 */
Playlist.prototype.playSong = function(i) {
    var s = this.songs[i];
    var q = s.t + ' ' + s.a;
    controller.playVideoBySearch(q);
 
    $('.playing').removeClass('playing');
    $('#song' + i).children().first().addClass('playing');
}

/**
 * Playlist.render() - Updates the playlist table
 */
Playlist.prototype.render = function() {
    $('.song').remove();
    
    $.each(this.songs, function(i, v) {
        $('<tr class="song pointer" id="song'+i+'"><td>&nbsp;</td> <td>'+v.t+'</td><td>'+v.a+'</td></tr>').appendTo($('#playlist'));
    });
    
    $('.song:odd').addClass('odd');
    
    $('.song').bind('click', function(e) {
        controller.playlist.playSong(parseInt(e.currentTarget.id.charAt(4)));
    });
}