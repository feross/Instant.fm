var playlist; // view
var controller;

var ytplayer;
var pressedKeys = [];

//var sample = {title: 'Feross\'s Running Playlist', description: 'This is my favorite running playlist. You see, life is rough and complicated. But, when you\'re running, that all goes away. When I run with this playlist, I feel like a well-oiled machine. Everything just falls into place and all my problems disappear.', songs: [{t:"Through the Fire and Flames", a:"DragonForce"}, {t:"Poker Face", a:"Lady Gaga"}, {t:"Hello, Dolly", a:"Frank Sinatra"}, {t:"Replay", a:"Iyaz"}, {t:"Buddy Holly", a:"Weezer"}, {t:"Walid Toufic", a:"La T'awedny Aleik"}, {t:"Stylo", a:"Gorillaz"}, {t:"Smells Like Teen Spirit", a:"Nirvana"}, {t:"Eenie Meenie", a:"Justin Bieber"}, {t:"Sweet Talking Woman", a:"Electric Light Orchestra"}, {t:"Evil Woman", a:"ELO"}, {t:"Wavin Flag", a:"K'naan"}, {t:"Still Alive", a:"Glados"}]};

/* Onload Event */
$(function() {
    controller = new Controller();
    playlist = new Playlist(initial_playlist);
    
    playlist.renderAll();
    controller.playSong(0); // Auto-play
    
    setupScrollingListeners();
    setupKeyboardListeners();
    
    $('#keyboardShortcutsAvailable').click(controller.showHelpDialog);
    
    new uploader('container', null, '/upload', null, controller.loadPlaylist);    
});

function setupScrollingListeners() {
    var videoDiv = $('#videoDiv');
    var videoDivOffset = $('#outerVideoDiv').offset().top;
    $(window).scroll(function(){
        if ($(window).scrollTop() > videoDivOffset) {
            videoDiv.css('top', 0);
        } else {
            videoDiv.css('top', videoDivOffset - $(window).scrollTop());
        }        
    });
}

function setupKeyboardListeners() {
    var SHIFT = 16;
    $(window).keydown(function(e) {
        var k = e.keyCode;
        pressedKeys.push(k);
        
        
        if (k == 39 || k == 40) { // down, right
            controller.playNextSong();
        } else if (k == 37 || k == 38) { // up, left
            controller.playPrevSong();
        } else if (k == 32) { // space
            playPause();
        } else if (k == 191 && $.inArray(SHIFT, pressedKeys) > -1) { // ?
            controller.showHelpDialog();
        } else {
            return true; // default event
        }
        return false; // prevent default event
    });
    $(window).keyup(function(e) {
        jQuery.grep(pressedKeys, function(value) {
            return value != e.keyCode;
        });
    });
}

/**
 * ---------------------
 * Instant.fm Controller
 * ---------------------
 */
var Controller = function() {
    this.isPlayerInitialized = false; // true, after we've called Controller.initPlayer()
    this.curSongIndex = 0; // Used to track our current position in the playlist
        
    var cache = new LastFMCache();
	this.lastfm = new LastFM({
		apiKey    : '414cf82dc17438b8c880f237a13e5c09',
		apiSecret : '02cf123c38342b2d0b9d3472b65baf82',
		cache     : cache
	});
}

/**
 * Initialize the YouTube player
 */
Controller.prototype.initPlayer = function(firstVideoId) {
    this.isPlayerInitialized = true;
    var params = {
        allowScriptAccess: "always",
        wmode : 'opaque' // Allow JQuery dialog to cover YT player
    };
    var atts = {
        id: "ytPlayer",
        allowFullScreen: "true"
    };
    swfobject.embedSWF("http://www.youtube.com/v/" + firstVideoId +
    "&enablejsapi=1&playerapiid=ytplayer&rel=0&autoplay=1&egm=0&loop=0" +
    "&fs=1&hd=0&showsearch=0&showinfo=0&iv_load_policy=3&cc_load_policy=1",
    "player", "480", "274", "8", null, null, params, atts);
}

/**
 * Play top video for given search query
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
                controller.playNextSong();
            }
        }
    });
}

/**
 * Play video with given Id
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
 * Play a song by index
 * @i - song index
 */
Controller.prototype.playSong = function(i) {
    if (i < 0 || i >= playlist.songs.length) {
        return;
    }
    this.curSongIndex = i;
    var s = playlist.songs[i];
    var q = s.t + ' ' + s.a;
    this.playVideoBySearch(q);
 
    $('.playing').toggleClass('playing');
    $('#song' + i).toggleClass('playing');
    
    $('#curSong').text(s.t);
    $('#curArtist').text(s.a);
    
    // Fetch data from Last.fm
	this.lastfm.track.getInfo({
	    track: s.t,
	    artist: s.a,
	    autocorrect: 1 }, {

	    success: function(data){
		    var t = data.track;
    		if (t && t.album && t.album.image) {
    		    imgSrc = t.album.image[t.album.image.length - 1]['#text'];
    		    controller.showAlbumArt(imgSrc, t.album.title);
    		} else {
    		    controller.showAlbumArt(null);
    		}
	    },
	    
	    error: function(code, message) {
		    controller.showAlbumArt(null);
		}
	});
}

/**
 * Play next song in the playlist
 */
Controller.prototype.playNextSong = function() {
    this.playSong(++this.curSongIndex);
}

/**
 * Play prev song in the playlist
 */
Controller.prototype.playPrevSong = function() {
    this.playSong(--this.curSongIndex);
}

/**
 * Update album art to point to given src url
 * @src - Image src url. Pass nothing for missing album art image.
 * @alt - Image alt text
 */
Controller.prototype.showAlbumArt = function(src, alt) {
    var imgSrc = src || '/images/unknown.png';
    var imgAlt = alt || 'Album art';
    
    $('#curAlbumArt')
        .replaceWith($('<img alt="'+imgAlt+'" id="curAlbumArt" src="'+imgSrc+'" />'));
}

/**
 * Open dialog that shows keyboard shortcuts
 */
Controller.prototype.showHelpDialog = function() {
    var dialog = $('#help').dialog({
        autoOpen: false,
        draggable: false,
        resizable: false,
        title: 'Keyboard Shortcuts',
    });
    dialog.dialog('open');
}

/**
 * Controller.loadPlaylist() - Change the playlist based on the xhr response in response
 * @response - response body
 */
Controller.prototype.loadPlaylist = function(response) {
    var responseJSON = JSON.parse(response);
    
    if(responseJSON.status != 'ok') {
        log('Error loading playlist: ' + responseJSON.status);
        return;
    }
    
    log('New playlist created with ID: ' + responseJSON.id);

    playlist = new Playlist(responseJSON);
    playlist.renderAll();
    controller.playSong(0);
}


/**
 * Instant.fm Playlist
 */
var Playlist = function(p) {
    if (!p.id || !p.title || !p.description || !p.songs) {
        log('Can\'t load invalid playlist');
        return;
    }
    
    this.id          = p.id || -1;
    this.title       = p.title;
    this.description = p.description;
    this.songs       = p.songs || [];
    
    this.reorderedSong = false; // Used to distinguish between dragging and clicking
    
    var that = this;
    $('#playlist').mouseup(function(e) {
        that.reorderedSong = null; // we're done dragging now
    });
}

/**
 * Playlist.renderAll() - Updates the playlist table
 */
Playlist.prototype.renderAll = function() {
    $('#curPlaylistTitle').text(this.title);
    $('#curPlaylistDesc').text(this.description);
    // TODO: Insert a new Facebook Like button here using JS
    
    $('#playlist li').remove(); // clear the playlist
    
    $.each(this.songs, function(i, v) {
        $('<li id="song'+i+'"><span class="title">'+v.t+'</span><span class="artist">'+v.a+'</span><span class="handle">&nbsp;</span></li>')
            .appendTo('#playlist');
    });
    
    var that = this;
    $('#playlist li').click(function(e) {
        var songId = parseInt(e.currentTarget.id.substring(4));
        
        that.reorderedSong || controller.playSong(songId);
    });
    
    $('#playlist').sortable({
        axis: 'y',
        stop: playlist.onReorder, // drop is finished
    }).disableSelection();
    
    this.renderRowColoring();
}

/**
 * Playlist.renderRowColoring() - Recolors the playlist rows
 */
Playlist.prototype.renderRowColoring = function() {
    $('#playlist li')
        .removeClass('odd')
        .filter(':odd')
        .addClass('odd');
}

/**
 * Playlist.onReorder() - Called by JQuery UI "Sortable" when a song has been reordered
 * @event - original browser event
 * @ui - prepared ui object (see: http://jqueryui.com/demos/sortable/)
 */
Playlist.prototype.onReorder = function(event, ui) {
    // this is 
    var p = playlist;
    
    p.reorderedSong = true; // mark the song as reordered so we don't think it was clicked
    
    var oldId = parseInt(ui.item.attr('id').substring(4));
    var songItem = $('#song'+oldId);
    var newId = songItem.prevAll().length;
    
    if (newId == oldId) {
        return;
    }

    // Update model
    var songData = p.songs[oldId];
    p.songs.splice(oldId, 1);
    p.songs.splice(newId, 0, songData);
    
    songItem.attr('id', ''); // Remove the reordered song's id to avoid overlap during update
    
    // Update all DOM ids to be sequential
    
    if (newId < oldId) { // Moved up
        songItem
            .nextUntil('#song'+(oldId+1))
            .each(function(i, e) {
                $(e).attr('id', 'song' + (newId+i+1) );
            });
            
    } else { // Moved down
        songItem
            .prevUntil('#song'+(oldId-1))
            .each(function(i, e) {
                $(e).attr('id', 'song' + (newId-i-1) );
            });
    }
    
    songItem.attr('id', 'song'+newId); // Add back the reordered song's id
    
    // If we move the current song, keep our position in the playlist up to date
    if (oldId == p.curSongIndex) {
        p.curSongIndex = newId;
    }
    
    p.renderRowColoring();
};


/* Misc YouTube Functions */

// Automatically called when player is ready
function onYouTubePlayerReady(playerId) {
    ytplayer = document.getElementById("ytPlayer");
    ytplayer.addEventListener("onStateChange", "onPlayerStateChange");
}

function onPlayerStateChange(newState) {
    controller.playerState = newState;
    if (newState == 0) { // finished a video
        playlist.playNextSong();
    }
}

function playVideo() {
    if (ytplayer) {
        ytplayer.playVideo();
    }
}

function pauseVideo() {
    if (ytplayer) {
        ytplayer.pauseVideo();
    }
}

function playPause() {
    if (ytplayer) {
        if (controller.playerState == 1) { // playing
            pauseVideo();
            // $('#playlistWrapper').removeClass('pauseButton').addClass('playButton');
        } else if (controller.playerState == 2) { // paused
            playVideo();
            // $('#playlistWrapper').removeClass('playButton').addClass('pauseButton');
        }
    }
}