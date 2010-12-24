var playlist; // view
var controller;
// TODO: refactor model out of the playlist.
// TODO: move youtube player methods into Playlist.

var ytplayer;
var pressedKeys = [];

/* Onload Event */
$(function() {
    controller = new Controller();
    
    controller.loadPlaylist($.extend(initial_playlist, {status: 'ok'}));
    
    setupScrollingListeners();
    setupKeyboardListeners();
    
    $('#keyboardShortcutsAvailable').click(controller.showHelpDialog);
    
    // Respond to a popstate event.
    window.onpopstate = onPopState;
    
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
    $(window).keydown(function(event) {
        var k = event.keyCode;
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
        event.preventDefault(); // prevent default event
    });
    $(window).keyup(function(e) {
        $.grep(pressedKeys, function(value) {
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
    this.playlistId; // The currently loaded playlist
    this.songIndex; // The current position in the playlist
    this.openDialog; // The currently open dialog, so we don't open 2 at once

    var cache = new LastFMCache();
	this.lastfm = new LastFM({
		apiKey    : '414cf82dc17438b8c880f237a13e5c09',
		apiSecret : '02cf123c38342b2d0b9d3472b65baf82',
		cache     : cache
	});
};

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
    "&fs=1&hd=1&showsearch=0&showinfo=0&iv_load_policy=3&cc_load_policy=1" +
    "&color1=0xFFFFFF&color2=0xFFFFFF",
    "player", "480", "295", "8", null, null, params, atts);
};

/**
 * Controller.loadPlaylist() - Change the playlist based on the xhr response in response
 * @response - response body
 */
Controller.prototype.loadPlaylist = function(responseJSON) {
    
    if ($.isPlainObject(responseJSON)) { // initial playlist (embedded)
        var response = responseJSON;
        
    } else { // loaded dynamically
        var response = $.parseJSON(responseJSON);
    
        if(response.status != 'ok') {
            log('Error loading playlist: ' + response.status);
            return;
        }
        
        setState({playlistId: response.id}, response.title, '/p/'+response.id);
        $('#infoDisplay').effect('pulsate');
        
    }
    
    playlist = new Playlist(response);
    controller.playSong(0);
    log('Loaded playlist: ' + controller.playlistId);
};

Controller.prototype.loadPlaylistById = function(playlistId) {
    
};

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
};

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
};

/**
 * Play a song by index
 * @i - song index
 */
Controller.prototype.playSong = function(i) {
    if (i < 0 || i >= playlist.songs.length) {
        return;
    }
    this.songIndex = i;
    var s = playlist.songs[i];
    var q = cleanSongTitle(s.t) + ' ' + s.a;
    this.playVideoBySearch(q);
 
    $('.playing').toggleClass('playing');
    $('#song' + i).toggleClass('playing');
    
    this.updateCurPlaying(cleanSongTitle(s.t), s.a);
};

/**
 * Play next song in the playlist
 */
Controller.prototype.playNextSong = function() {
    this.playSong(++this.songIndex);
};

/**
 * Play prev song in the playlist
 */
Controller.prototype.playPrevSong = function() {
    this.playSong(--this.songIndex);
};

/**
 * Update the currently playing song with Last.fm data
 */
Controller.prototype.updateCurPlaying = function(t, a) {
    var hide = function() {
        if ($('#curAlbum').css('display') != '0') {
            $('#curAlbum').fadeOut('fast');
        }
        if ($('#curSongDesc').css('display') != '0') {
            $('#curSongDesc').fadeOut('fast');
        }
        if ($('#curArtistDesc').css('display') != '0') {
            $('#curArtistDesc').fadeOut('fast');
        }
    };
    
    // 1. Search for track
    that = this;
	this.lastfm.track.search({
	    artist: a,
	    limit: 1,
	    track: t
	}, {

	    success: function(data){
            if (!data.results || !data.results.trackmatches || !data.results.trackmatches.track) {
                this.error('track.search', 'Empty set.');
                return;
            }
            
            var track = data.results.trackmatches.track;
            var trackName = track.name || t;
            var artistName = track.artist || a;
            var albumImg = track.image && track.image[track.image.length - 1]['#text'];
            
            // Update song title, artist name
            $('#curSong h4').text(trackName);
            $('#curArtist h4').text(artistName);
            
            // Update album art
            if (albumImg) {
                // We'll set the alt text once we know the album name
                controller.updateAlbumImg(albumImg, '');
            } else {
                controller.updateAlbumImg(null);
            }
            
            // Hide old values with animation
            hide();
            
            // 2. Get detailed track info
            trackName && artistName && that.lastfm.track.getInfo({
        	    artist: artistName,
        	    autocorrect: 1,
        	    track: trackName
        	}, {
        	    
        	    success: function(data){
                    if (!data.track) {
                        this.error('track.getInfo', 'Empty set.');
                        return;
                    }
                                        
                    var track = data.track;
                    var artistName = track.artist && track.artist.name;
                    var albumName = track.album && track.album.title;
                    var trackSummary = track.wiki && track.wiki.summary;
                    var trackLongDesc = track.wiki && track.wiki.content;
                                        
                    // Update album name
                    albumName && $('#curAlbum h4').text(albumName) && $('#curAlbum').fadeIn('fast');
                    
                    // Update album art alt text
                    var albumAlt = albumName;
                    albumAlt += artistName ? (' by ' + artistName) : '';
                    albumName && $('#curAlbumArt').attr('alt', albumAlt);
                    
                    // Update song summary
                    if (trackSummary) {                        
                        $('#curSongDesc div').html(cleanHTML(trackSummary));
                        $('#curSongDesc h4').text('About ' + track.name);
                        $('#curSongDesc').fadeIn('fast');
                    }
                    
                    // Add link to longer description
                    if (trackLongDesc) {
                        var content = cleanHTML(trackLongDesc);
                        content = highlight(content, [artistName, albumName, track.name]);
                        
                        var link = that.makeSeeMoreLink(track.name, content);
                        link.appendTo('#curSongDesc div');
                    }
        	    },

        	    error: function(code, message) {
        	        log(code + ' ' + message);
        		}
        	});
        	
        	// 2. Get detailed artist info
        	artistName && that.lastfm.artist.getInfo({
        	    artist: artistName,
        	    autocorrect: 1
        	}, {
        	    
        	    success: function(data){        	        
                    if (!data.artist) {
                        this.error('track.getInfo', 'Empty set.');
                        return;
                    }
                                        
                    var artist = data.artist;
                    var artistSummary = artist.bio && artist.bio.summary;
                    var artistLongDesc = artist.bio && artist.bio.content;
                    
                    var artistImg = artist.image && artist.image[artist.image.length - 1]['#text'];
                    
                    // Update artist image
                    if (artistImg) {
                        controller.updateArtistImg(artistImg);
                    } else {
                        controller.updateArtistImg(null);
                    }
                    
                    // Update artist summary
                    if (artistSummary) {                        
                        $('#curArtistDesc div').html(cleanHTML(artistSummary));
                        $('#curArtistDesc h4').text('About ' + artistName);
                        $('#curArtistDesc').fadeIn('fast');
                    }
                    
                    // Add link to longer description
                    if (artistLongDesc) {
                        var content = cleanHTML(artistLongDesc);
                        content = highlight(content, [artistName, trackName]);
                        
                        var link = that.makeSeeMoreLink(artistName, content);
                        link.appendTo('#curArtistDesc div');
                    }
        	    },

        	    error: function(code, message) {
        	        log(code + ' ' + message);
        		}
        	});
	    },
	    
	    error: function(code, message) {
	        log(code + ' ' + message);
	        $('#curSong h4').text(t);
            $('#curArtist h4').text(a);
            controller.updateAlbumImg(null);
            hide();
		}
	});
};

Controller.prototype.makeSeeMoreLink = function(title, content) {
    return $('<a class="seeMore" href="#seeMore"> (see more)</a>')
        .data('title', 'About ' + title)
        .data('content', content)
        .click(controller.showSeeMoreDialog);
};

/**
 * Update album art to point to given src url
 * @src - Image src url. Pass null to show the Unknown Album image.
 * @alt - Image alt text. Defaults to 
 */
Controller.prototype.updateAlbumImg = function(src, alt) {
    var imgSrc = src || '/images/unknown.png';
    var imgAlt = alt || 'Unknown album';
    
    var img = $('<img alt="'+imgAlt+'" id="curAlbumImg" src="'+imgSrc+'" />')
        .click(this.showImageDialog);
    
    $('#curAlbumImg')
        .replaceWith(img);
};

/**
 * Update artist img to point to given src url
 * @src - Image src url. Pass nothing for missing artist art image.
 * @alt - Image alt text
 */
Controller.prototype.updateArtistImg = function(src, alt) {
    if (src) {
        var img = $('<img alt="'+alt+'" id="curArtistImg" src="'+src+'" />')
            .click(this.showImageDialog);
        $('#curArtistImg')
            .replaceWith(img);
    } else {
        $('#curArtistImg')
            .replaceWith($('<span id="curArtistImg"></span>'));
    }
};

Controller.prototype.showDialog = function(contentElem, title, customSettings) {
    controller.openDialog && controller.openDialog.dialog('close');
    
    var settings = {
        autoOpen: false,
        close : function() { controller.openDialog = null; },
        draggable: false,
        resizable: false,
        title: title,
    }
    var dialog = contentElem.dialog($.extend(settings, customSettings));
    
    dialog.dialog('open');
    this.openDialog = dialog;
    
    return dialog;
};

Controller.prototype.showImageDialog = function(event) {
    event.preventDefault();
    
    var src = $(this).attr('src');
    var alt = $(this).attr('alt');
    
    var content = $('<div><img alt="'+alt+'" src="'+src+'" /></div>');
    controller.showDialog(content, 'Image');
};

/**
 * Open dialog that shows keyboard shortcuts
 */
Controller.prototype.showHelpDialog = function() {
    event.preventDefault();
    controller.showDialog($('#help'), 'Keyboard Shortcuts');
};

// Open dialog that shows more information about a song, album, or artist
// @event - the triggering event
Controller.prototype.showSeeMoreDialog = function(event) {
    event.preventDefault();

    var elem = $(this);
    var title = elem.data('title');
    var content = elem.data('content');
    
    controller.openDialog && controller.openDialog.dialog('close');
    var content = $('<div class="textDialog"></div>').html(content);
    
    controller.showDialog(content, title, { width: 600 });
};


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
    
    this.renderAll();
    controller.playlistId = this.id;
};

/**
 * Playlist.renderAll() - Updates the playlist table
 */
Playlist.prototype.renderAll = function() {
    $('#curPlaylistTitle').text(this.title);
    $('#curPlaylistDesc').text(this.description);
    // TODO: Insert a new Facebook Like button here using JS
    
    $('#playlist li').remove(); // clear the playlist
    
    $.each(this.songs, function(i, v) {
        $('<li id="song'+i+'"><span class="title">'+v.t+'</span><span class="artist">'+v.a+'</span><span class="handle">&nbsp;</span></li>').appendTo('#playlist');
    });
    
    var that = this;
    $('#playlist li').click(function(e) {
        var songId = parseInt(this.id.substring(4));
        
        that.reorderedSong || controller.playSong(songId);
    });
    
    $('#playlist').sortable({
        axis: 'y',
        stop: playlist.onReorder,
    }).disableSelection();
    
    $('#playlist').mouseup(function(e) {
        that.reorderedSong = null; // we're done dragging now
    });
    
    this.renderRowColoring();
};

/**
 * Playlist.renderRowColoring() - Recolors the playlist rows
 */
Playlist.prototype.renderRowColoring = function() {
    $('#playlist li')
        .removeClass('odd')
        .filter(':odd')
        .addClass('odd');
};

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
    if (oldId == controller.songIndex) {
        controller.songIndex = newId;
    }
    
    p.renderRowColoring();
};

/* Misc last.fm functions */

function cleanSongTitle(title) {
    var newTitle = title.replace(/[\(\[]((feat|ft|produce|instrument|dirty|clean)|.*?(version|edit|radio)).*?[\)\]]/gi, '');
    return newTitle;
}

// Prepare Remove all html tags
function cleanHTML(html) {
    var r = new RegExp('</?\\w+((\\s+\\w+(\\s*=\\s*(?:".*?"|\'.*?\'|[^\'">\\s]+))?)+\\s*|\\s*)/?>', 'gi');   
    return html
        .replace(r, '') // Remove HTML tags (http://bit.ly/DdoNo)
        .replace(new RegExp('[\n\r]', 'g'), '<br>'); // Convert newlines to <br>
}

function highlight(html, highlight) {
    $.each(highlight, function(i, e) {
        if (e) {
            html = html.replace(e, '<strong>'+e+'</strong>');
        }
    });
    return html;
}

// Push the state onto the history stack
function setState(state, title, url) {
  window.history.pushState(state, title || '', url || undefined);
}

/* Misc YouTube Functions */

// Automatically called when player is ready
function onYouTubePlayerReady(playerId) {
    ytplayer = document.getElementById("ytPlayer");
    ytplayer.addEventListener("onStateChange", "onStateChange");
}

function onStateChange(newState) {
    switch(newState) {
        case 0: // just finished a video
            controller.playNextSong();
            break;
        case 1: // playing
            $('.playing').toggleClass('paused', false);
            break;
        case 2: // paused
            $('.playing').toggleClass('paused', true);
            break;
    }
}

function onPopState(event) {
    var state = event.state;
    log(state);
    
    if (state) {
        controller.loadPlaylistById(parseInt(state.playlistId));
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
        if (isPlaying()) {
            pauseVideo();
        } else {
            playVideo();
        }
    }
}

function isPlaying() {
    if (ytplayer) {
        if (ytplayer.getPlayerState() == 1) {
            return true;
        }
    }
    return false;
}

function isPaused() {
    if (ytplayer) {
        if (ytplayer.getPlayerState() == 2) {
            return true;
        }
    }
    return false;
}