var player;
var browser;
var model;

var playlistview; // TODO: Generalize this so it is part of the view stack 
var viewStack = [];

var songIndex; // Current position in the playlist
var keyEvents = true; // Used to disable keyboard shortuts

var appSettings = {
    fancyZoom: {directory: '/images/fancyzoom'},
    jeditable: {
        event: 'editable', // custom jQuery event
        onblur: 'ignore',
        submit: 'Update',
        tooltip: 'Click to edit',
        type: 'autogrow',
        autogrow: {
            maxHeight: 512
        }
    },
    sortable: {
        axis: 'y',
        scrollSensitivity: 25,
        tolerance: 'pointer'
    }
};


/* --------------------------- ON LOAD --------------------------- */

function onloadHome() {
    $('.file').change(function(event) {
        var val = $(this).val();
        if (val.length) {
            $('#uploadForm').submit();
        }
    });
    setupDragDropUploader('home', redirectToPlaylist);
}


function onloadPlaylist() {
    model = new Model();
    player = new Player();
    browser = new MiniBrowser();
    playlistview = new PlaylistView();
    
    setupAutogrowInputType();
    player.loadPlaylist(initial_playlist);
    player.updateDisplay();
    
    setupPlayerHoverButtons();
    setupKeyboardShortcuts();
    setupFBML(initial_playlist);
    setupPlaylistActionButtons();

    $('#helpLink').fancyZoom(appSettings.fancyZoom);
    
    window.onpopstate = onPopState;
    $(window).resize(player.updateDisplay);
    
    setupDragDropUploader('p', player.loadPlaylist);
    addLinkHandlers();
    
    // If the page starts with a view controller on the stack (which it should),
    // we need to call methods on it
    if (viewStack.length > 0) {
      getTopView().willSlide();
      getTopView().didSlide();
    }
}


/* --------------------------- ADD HANDLER FUNCTIONS -------------------------- */

function addFocusHandlers(elem) {
    elem.focus(function() {
        keyEvents = false;
    })
    .blur(function() {
        keyEvents = true;
    }); 
}

function addLinkHandlers() {
    // Link handlers for loading partials.
    $('a[rel="partial"]').live('click', function(event) {
        event.preventDefault();
        browser.pushPartial($(this).attr('href'), $(this).attr('title'));
    });
    
    // Link handlers for the back button.
    $('a.backButton').live('click', function(event) {
        event.preventDefault();
        browser.pop();
    })
}


/* --------------------------- SETUP  --------------------------- */

function setupAutogrowInputType() {
    $.editable.addInputType('autogrow', {
        element: function(settings, original) {
            var textarea = $('<textarea />');
            if (settings.rows) {
                textarea.attr('rows', settings.rows);
            } else {
                textarea.height(settings.height);
            }
            if (settings.cols) {
                textarea.attr('cols', settings.cols);
            } else {
                textarea.width(settings.width);
            }
            $(this).append(textarea);
            return(textarea);
        },
        plugin: function(settings, original) {
            var elemId = $(this).parent().attr('id');
            var width;
            switch(elemId) {
                case 'curPlaylistTitle':
                    width = 390;
                    break;
                case 'curPlaylistDesc':
                    width = 480;
                    break;
                default:
                    width = $(this).width();
                    break;
            }
            $('textarea', this).width(width).autogrow(settings.autogrow);
        }
    });
}

function setupPlayerHoverButtons() {
    $('#toggleShuffle').click(function(event) {
        event.preventDefault();
        player.toggleShuffle();
    });
    $('#toggleRepeat').click(function(event) {
        event.preventDefault();
        player.toggleRepeat();
    });
    $('#toggleVideo').click(function(event) {
        event.preventDefault();
        player.toggleVideo();
    });
}

// Set up keyboard shortcuts in a cross-browser manner
// Tested in Firefox, Chrome, Safari.
// Keyboard events are a mess: http://www.quirksmode.org/js/keys.html
function setupKeyboardShortcuts() {
    $(window).keydown(function(event) {
        var k = event.which;
        var pressed1 = true;
        var pressed2 = true;

        // Disablable events
        if (keyEvents && !event.altKey && !event.ctrlKey && !event.metaKey) {
            switch(k) {
                // Playback control
                case 39: case 40: // down, right
                    player.playNextSong();
                    break;
                case 37: case 38: // up, left
                    player.playPrevSong();
                    break;
                case 32: // space
                    player.playPause();
                    break;
                case 187: // +
                case 61: // + on Fx
                    player.increaseVolume();
                    break;
                case 189: // -
                case 109: // - on Fx
                    player.decreaseVolume();
                    break;
                case 86:
                    player.toggleVideo();
                    break;
                case 83:
                    player.toggleShuffle();
                    break;
                case 82:
                    player.toggleRepeat();
                    break;

                // Playlist editing
                case 65: // a
                    browser.pushPartial('/search', 'Add Songs');
                    break;
                case 74: // j
                    player.moveSongDown(songIndex);
                    break;
                case 75: // k
                    player.moveSongUp(songIndex);
                    break;

                // Navigation
                case 67: // c
                    $('#addComment').trigger('click');
                    break;
                case 8: // backspace
                    browser.pop();
                    break;
                case 191: // ?
                    $('#helpLink').trigger('click');
                    break;
                case 76: // l
                    player.highlightSong('.playing');
                    break;

                // Share playlists
                case 70: // f
                    $('#fbShare').trigger('click');
                    break;
                case 84: // t
                    $('#twShare').trigger('click'); 
                    break;
                case 66: // b
                    shareOnBuzz();
                    break;
                default:
                    pressed1 = false;
                    break;
            }

        } else {
            pressed1 = false;
        }

        // Non-disablable events
        // These keyboard events will always get captured (even when textboxes are focused)
        switch (k) {
            case 27: // escape
                // Turn keyboard shortcuts back on, in case we deleted a focused form during the pop.
                keyEvents = true;

                browser.pop();
                break;
            default:
                pressed2 = false;
                break;
        }

        // If we executed a keyboard shortcut, prevent the browser default event from happening
        if (pressed1 || pressed2) {
            event.preventDefault();
        }
    });
}

function setupFBML(playlist) {
    
    window.fbAsyncInit = function() {
        FB.init({
          appId: '114871205247916',
          status: true,
          cookie: true,
          xfbml: true
        });
        
        playlist && playlistview.tryLoadComments(playlist.playlist_id, playlist.title);
    };
    
    (function() {
      var e = document.createElement('script');
      e.type = 'text/javascript';
      e.src = document.location.protocol +
        '//connect.facebook.net/en_US/all.js';
      e.async = true;
      document.getElementById('fb-root').appendChild(e);
    }());
}

function setupPlaylistActionButtons() {
    
    $('#addComment').click(function(event) {
        event.preventDefault();
        playlistview.showHideComments();
    });
    
    $('#fbShare').click(function(event) {
        event.preventDefault();
        shareOnFacebook();
    });
    
    $('#twShare').click(function(event) {
        event.preventDefault();
        shareOnTwitter();
    });
}

function setupDragDropUploader(dropId, callback) {
    new uploader(dropId, null, '/upload', null, callback); // HTML5 dragdrop upload
}


/* --------------------------- SOCIAL FEATURES ----------------------------- */

function shareOnFacebook() {
    // Use first non-blank album as share image
    var bestAlbumImg;
    for (var i = 0; i < model.songs.length; i++) {
        var image = model.songs[i].i;
        if (image) {
            bestAlbumImg = image.replace('serve/34s', 'serve/126s');
            break;
        }
    }
    FB.ui(
      {
        method: 'feed',
        name: model.title,
        link: 'http://instant.fm/p/'+model.playlistId,
        picture: bestAlbumImg || 'http://instant.fm/images/unknown.png',
        caption: 'Instant.fm Playlist',
        description: model.description + '\n',
        properties: {'Artists in this playlist': model.getTopArtists(4).join(', ')},
        actions: {name: 'Create new playlist', link: 'http://instant.fm/'}
      },
      function(response) {
        if (response && response.post_id) {
            // TODO: show status message in UI
          log('Post was published.');
        } else {
          log('Post was not published.');
        }
      }
    );
}

function shareOnTwitter() {
    var tweetText = encodeURIComponent("♫ I'm listening to "+model.title);
    var url = 'http://twitter.com/share'+
              '?url=http://instant.fm/p/'+model.playlistId+
              '&text='+tweetText+'&via=instantDOTfm';
    showPop(url, 'instantfmTwitterShare');
}

function shareOnBuzz() {
    var url = 'http://www.google.com/buzz/post?url=http://instant.fm/p/'+model.playlistId;
    showPop(url, 'instantfmBuzzShare', 420, 700);
}


/* -------------------------- HOME PAGE FUNCTIONS --------------------- */

// Redirect to playlist with the given id
function redirectToPlaylist(response) {
    var playlist = $.parseJSON(response);
    if(playlist.status != 'ok') {
        log('Error loading playlist: ' + playlist.status);
        return;
    }
    var id = playlist.playlist_id;
    window.location = '/p/'+id;
}


/* -------------------------- PLAYER CONTROL ------------------------ */

function Player() {
    this.isPlayerInit = false; // have we initialized the player?
    this.ytplayer; // YouTube DOM element
    this.volume; // Player volume
    this.reorderedSong = false; // Used to distinguish between dragging and clicking
    this.queuedVideo; // Used when player is in loading state so we don't interrupt it.
    this.songlist; // Playlist's SongView instance
    this.shuffle = false;
    this.repeat = false;
}

Player.prototype.play = function() {
    player.ytplayer && player.ytplayer.playVideo();
};

Player.prototype.pause = function() {
    player.ytplayer && player.ytplayer.pauseVideo();
};

Player.prototype.playPause = function() {
    if (!player.ytplayer) {
        return;
    }
    if (player.isPlaying()) {
        player.pause();
    } else {
        player.play();
    }
};

Player.prototype.isPlaying = function() {
    return player.ytplayer && (player.ytplayer.getPlayerState() == 1);
};

Player.prototype.isPaused = function() {
    return player.ytplayer && (player.ytplayer.getPlayerState() == 2);
};

Player.prototype.increaseVolume = function() {
    if (player.ytplayer.isMuted()) {
        player.ytplayer.unMute();
    }
    player.volume += 20;
    player.volume = (player.volume <= 100) ? player.volume : 100;
    
    player.ytplayer.setVolume(player.volume);
};

Player.prototype.decreaseVolume = function() {
    player.volume -= 20;
    player.volume = (player.volume >= 0) ? player.volume : 0;
    
    player.ytplayer.setVolume(player.volume);
};

// Play a song at the given playlist index
Player.prototype.playSong = function(i) {
    songIndex = i;
    var song = model.songs[i];
    var title = cleanSongTitle(song.t);
    var artist = song.a;

    var q = title + ' ' + artist;
    player.playSongBySearch(q);

    $('.playing').removeClass('playing');
    $('#song' + i).addClass('playing');

    playlistview.updateCurPlaying(title, artist, songIndex);
    player.moveSongIntoView();
};

// Play next song in the playlist
Player.prototype.playNextSong = function() {
    if (player.shuffle) {
        var randomSong = Math.floor(Math.random()*model.songs.length);
        player.playSong(randomSong);
    } else if (songIndex < model.songs.length - 1) {
        player.playSong(++songIndex);
    }
};

// Play prev song in the playlist
Player.prototype.playPrevSong = function() {
    if (songIndex == 0) {
        return;
    }
    player.playSong(--songIndex);
};

Player.prototype.moveSongIntoView = function() {
    var relativeScrollDistance = $('.playing').position().top - $('#playlistDiv').position().top;
    if (relativeScrollDistance <= 0) {
        scrollTo('.playing', '#playlistDiv', {
            noAnimation: true
        });
    } else if (relativeScrollDistance > $('#playlistDiv').height() - $('.playing').height()) {
        scrollTo('.playing', '#playlistDiv', {
            scrollAtBottom: true,
            noAnimation: true
        });
    }
};

// Play top video for given search query
Player.prototype.playSongBySearch = function(q) {
    var the_url = 'http://gdata.youtube.com/feeds/api/videos?q=' + encodeURIComponent(q) + '&format=5&max-results=1&v=2&alt=jsonc'; // Restrict search to embeddable videos with &format=5.
    
    var srcIndex = songIndex;
    $.ajax({
        dataType: 'jsonp',
        type: 'GET',
        url: the_url,
        success: function(responseData, textStatus, XMLHttpRequest) {
            if (responseData.data.items) {
                var videos = responseData.data.items;
                player.playSongById(videos[0].id)
            } else {
                player.pause();
                // Go to next song in a few seconds
                // (to give users using keyboard shortcuts a chance to scroll up past this song)
                window.setTimeout(function() {
                    $('#song'+srcIndex)
                        .removeClass('paused')
                        .addClass('missing');
                    if (songIndex == srcIndex) {
                        player.playNextSong();
                    }
                }, 2000);
                log('No songs found for: ' + q);
            }
        }
    });
};

// Attempts to play the video with the given ID. If the player is in a loading state,
// we queue up the video. We don't want to interrupt the player since that causes the
// "An error occurred, please try again later" message.
Player.prototype.playSongById = function(id) {
    if (player.ytplayer && player.ytplayer.getPlayerState() == 3) { // Don't interrupt player while it's loading
        player.queuedVideo = id;
    
    } else { // Play it immediately
        player._playVideoById(id); 
    }
};

// Private method to play video with given id
Player.prototype._playVideoById = function(id) {
    if (this.ytplayer) {
        player.ytplayer.loadVideoById(id, 0, 'hd720');
    } else {
        if (!this.isPlayerInit) {
            this._initPlayer(id);
        }
    }
};

// Initialize the YouTube player
Player.prototype._initPlayer = function(firstVideoId) {
    this.isPlayerInit = true;

    var params = {
        allowScriptAccess: "always",
        wmode : 'opaque' // Allow lightboxes to cover player
    };
    var atts = {
        id: 'ytPlayer',
        allowFullScreen: 'true'
    };
    swfobject.embedSWF('http://www.youtube.com/v/' + firstVideoId +
    '&enablejsapi=1&playerapiid=ytPlayer&rel=0&autoplay=1&egm=0&loop=0' +
    '&fs=1&showsearch=0&showinfo=0&iv_load_policy=3&cc_load_policy=0' +
    '&version=3&hd=1&color1=0xFFFFFF&color2=0xFFFFFF&disablekb=1',
    'player', '480', '295', '8', null, null, params, atts);
};

Player.prototype.toggleVideo = function() {
    var $videoDiv = $('#videoDiv');
    if ($videoDiv.hasClass('noVideo')) {
        $('#videoDiv').removeClass('noVideo');
    } else {
        $('#videoDiv').addClass('noVideo');
    }
    if (Modernizr.csstransitions) {
        var animateResize = function(numCalls) {
            if (numCalls < 80) {
                player.updateDisplay();
                window.setTimeout(function() {
                    animateResize(++numCalls);
                }, 10);
            }
        }
        animateResize(0);
    } else {
        player.updateDisplay();
    }
};

Player.prototype.toggleShuffle = function(force) {
    this.shuffle = force !== undefined ? force : !this.shuffle;
    
    if (this.shuffle) {
        $('#toggleShuffle').addClass('red');
    } else {
        $('#toggleShuffle').removeClass('red');
    }
};

Player.prototype.toggleRepeat = function(force) {
    this.repeat = force !== undefined ? force : !this.repeat;
    
    if (this.repeat) {
        $('#toggleRepeat').addClass('red');
    } else {
        $('#toggleRepeat').removeClass('red');
    }
};


/* Playlist editing */

// Manually move the current song up
Player.prototype.moveSongUp = function(oldId) {
    if (oldId <= 0) {
        return;
    }
    var songItem = $('#song'+oldId);
    songItem.prev().before(songItem);
    
    player.onPlaylistReorder(null, {item: songItem});
};

// Manually move the current dong down
Player.prototype.moveSongDown = function(oldId) {
    if (oldId >= model.songs.length - 1) {
        return;
    }
    var songItem = $('#song'+oldId);
    songItem.next().after(songItem);
    
    player.onPlaylistReorder(null, {item: songItem});
};

Player.prototype.addSongToPlaylist = function(song) {
    this.songlist.add(song, '#playlist');
    this.highlightSong('#playlist li:last');
    model.addSong(song);
};


/* Playlist related functions */

// Load a playlist based on the xhr response or the initial embedded playlist
// @response - response body
Player.prototype.loadPlaylist = function(response) {
    if (response == null) {
      return;
    } else if ($.isPlainObject(response)) { // playlist is embedded in html
        var playlist = response;
        if(Modernizr.history) {
            window.history.replaceState({playlistId: playlist.playlist_id}, playlist.title, '/p/'+playlist.playlist_id);
        }

    } else { // playlist is from xhr response      
        var playlist = $.parseJSON(response);
        if(!playlist && playlist.status != 'ok') {
            log('Error loading playlist: ' + playlist.status);
            return;
        }
        if(Modernizr.history) {
            window.history.pushState({playlistId: playlist.playlist_id}, playlist.title, '/p/'+playlist.playlist_id);
        }
        playlistview.tryLoadComments(playlist.playlist_id, playlist.title);
        $('#infoDisplay').effect('pulsate', {times: 2});
    }

    model.updatePlaylist(playlist);
    player.renderPlaylist(playlist);

    player.playSong(0);
    log('Loaded playlist: ' + playlist.playlist_id);
};

// Load a playlist with the given id
Player.prototype.loadPlaylistById = function(id) {
    var the_url = '/p/'+id+'?json=true';
    $.ajax({
        dataType: 'json',
        type: 'GET',
        url: the_url,
        success: function(responseData, textStatus, XMLHttpRequest) {
            player.loadPlaylist(responseData);
        }
    });
};

// Updates the playlist table
Player.prototype.renderPlaylist = function(playlist) {
    
    $('#playlist').remove(); // clear the playlist
    $('.editLink').remove(); // remove all edit links
    $('#addSongs').remove(); // remove the add button (if it exists)
    
    // Render Playlist
    this.songlist = new SongList({
        songs: playlist.songs,
        onClick: player._onClickSong,
        buttons: [],
        id: 'playlist',
        listItemIdPrefix: 'song',
        numberList: true,
    });
    
    this.songlist.render('#playlistDiv', function() {
        if (model.editable) {
            $('body').addClass('editable');
            $('#playlist')
                .sortable($.extend({}, appSettings.sortable, {
                    start: function(event, ui) {
                        $('body').toggleClass('sorting', true);
                    },
                    stop: function(event, ui) {
                        player.onPlaylistReorder(event, ui);
                        $('body').toggleClass('sorting', false);
                    }
                }));
            window.setTimeout(function() {
                player.songlist.fetchAlbumImgs.apply(player.songlist);
            }, 4000);
        }
    });
    
    // TODO: START ---- This shouldn't be in Player.renderPlaylist()
    $('#curPlaylistTitle')
        .text(playlist.title);
    $('#curPlaylistDesc')
        .text(playlist.description);
    
    if (model.editable) {
        playlistview._makeEditable($('#curPlaylistTitle'), model.updateTitle);
        playlistview._makeEditable($('#curPlaylistDesc'), model.updateDesc);
        
        $('<a href="/search" rel="partial" title="Add Songs" id="addSongs" class="forwardButton awesome">Add songs +</a>')
            .appendTo('#curPlaylistInfo header');
    }
    // TODO: END ---- This shouldn't be in Player.renderPlaylist()
    
    $('#playlist').disableSelection().mouseup(function(event) {
        player.reorderedSong = null; // we're done dragging now
    });

    player.renderRowColoring();
};

Player.prototype._onClickSong = function(song, songNum) {
    player.reorderedSong || player.playSong(songNum);
};

// Called by JQuery UI "Sortable" when a song has been reordered
// @event - original browser event
// @ui - prepared ui object (see: http://jqueryui.com/demos/sortable/)
Player.prototype.onPlaylistReorder = function(event, ui) {
    this.reorderedSong = true; // mark the song as reordered so we don't think it was clicked

    var oldId = parseInt(ui.item.attr('id').substring(4));
    var songItem = $('#song'+oldId);
    var newId = songItem.prevAll().length;

    if (newId == oldId) {
        return; // song didn't move
    }

    model.moveSong(oldId, newId);

    songItem.attr('id', ''); // Remove the reordered song's id to avoid overlap during update

    // Update all DOM ids to be sequential

    if (newId < oldId) { // Moved up
        songItem
            .nextUntil('#song'+(oldId+1))
            .each(function(index, element) {
                var num = newId+index+1;
                $(element)
                    .attr('id', 'song' + num)
                    .find('.num').text(num+1);
            });
        
    } else { // Moved down
        songItem
            .prevUntil('#song'+(oldId-1))
            .each(function(index, element) {
                var num = newId-index-1;
                $(element)
                    .attr('id', 'song' + num)
                    .find('.num').text(num+1);
            });
    }

    songItem
    .attr('id', 'song'+newId) // Add back the reordered song's id
    .find('.num').text(newId+1);
    
    // If we move the current song, keep our position in the playlist up to date
    if (oldId == songIndex) {
        songIndex = newId;
    }

    this.renderRowColoring();
};

// Recolors the playlist rows
Player.prototype.renderRowColoring = function() {
    $('#playlist li')
        .removeClass('odd')
        .filter(':odd')
        .addClass('odd');
};

// Show currently playing song
Player.prototype.highlightSong = function(selector) {
    scrollTo(selector, '#playlistDiv', {
        callback: function() {
            $(selector).effect('pulsate', {times: 2});
        }
    });
};

Player.prototype.updateDisplay = function() {
    var maxPlaylistHeight = $(window).height() - (50 + $('#videoDiv').height()); /* header, player */
    var newHeight = Math.min($('#playlist').height(), maxPlaylistHeight);
    $('#playlistDiv').height(newHeight);
};


/*--------------------- BROWSER EVENTS --------------------- */

// Shows more information about a song, album, or artist by expanding the text
// @event - the triggering event
function onShowMoreText(event) {
    event.preventDefault();

    var elem = $(this).parent();
    var newContent = elem.data('longContent') + ' ';
    var link = makeSeeMoreLink(onShowLessText, 'show less');

    elem
        .html(newContent)
        .append(link);
}

// Shows less information about a song, album, or artist by shrinking the text
// @event - the triggering event
function onShowLessText(event) {
    event.preventDefault();

    var elem = $(this).parent();
    var newContent = elem.data('shortContent') + ' ';
    var link = makeSeeMoreLink(onShowMoreText);

    elem
        .html(newContent)
        .append(link);
}

// Gets called when there is a browser history change event (details: http://goo.gl/rizNN)
// If there is saved state, load the correct playlist.
function onPopState(event) {
    var state = event.state;
    if (state && state.playlistId != model.playlistId) {
        player.loadPlaylistById(state.playlistId);
    }
}

function onYouTubePlayerReady(playerId) {
    player.ytplayer = document.getElementById(playerId);
    player.ytplayer.addEventListener("onStateChange", "onYouTubePlayerStateChange");
    
    if (player.volume === undefined) {
        player.volume = player.ytplayer.getVolume() || 100; // if the player is muted, let's unmute it for the first video
        player.ytplayer.setVolume(player.volume);
    }
}

function onYouTubePlayerStateChange(newState) {
    switch(newState) {
        case 0: // just finished a video
            if (player.repeat) {
                player.playSong(songIndex);
            } else {
                player.playNextSong();
            }
            break;
        case 1: // playing
        
            // Bugfix: Force first video play to be HD
            player.ytplayer.setPlaybackQuality('hd720');
            
            $('.playing').removeClass('paused');
            if (player.queuedVideo) {
                player.playSongById(player.queuedVideo);
                player.queuedVideo = null;
            }
            break;
        case 2: // paused
            $('.playing').addClass('paused');
            break;
    }
}


/* --------------------------- MODEL --------------------------- */

function Model(playlist) {
    playlist && this.updatePlaylist(playlist);
    
    var cache = new LastFMCache();
	this.lastfm = new LastFM({
		apiKey    : '414cf82dc17438b8c880f237a13e5c09',
		apiSecret : '02cf123c38342b2d0b9d3472b65baf82',
		cache     : cache
	});
}
    
Model.prototype.updatePlaylist = function(playlist) {
    this.playlistId  = playlist.playlist_id || -1;
    this.title       = playlist.title;
    this.description = playlist.description;
    this.songs       = playlist.songs || [];
    this.editable    = playlist.editable || false;
};

// Move song in the playlist
// @oldIndex - old playlist position
// @newIndex - new playlist position
Model.prototype.moveSong = function(oldIndex, newIndex) {
    var songData = model.songs[oldIndex];
    this.songs.splice(oldIndex, 1);
    this.songs.splice(newIndex, 0, songData);
    this.saveSongs();
};

Model.prototype.addSong = function(song) {
    this.songs.push(song);
    this.saveSongs();
};

Model.prototype.saveSongs = function() {
    model.savePlaylist('&songs='+encodeURIComponent(JSON.stringify(model.songs)));
};

Model.prototype.getTopArtists = function(numArtists) {
    var artists = [];
    $.each(this.songs, function(index, value) {
       var artist = value.a;
       if (artist && $.inArray(artist, artists) == -1) {
           artists.push(artist);
       }
       if (artists.length >= numArtists) {
           return false; // end the $.each() iteration
       }
    });
    return artists;
};

Model.prototype.updateTitle = function(newTitle) {
    model.title = $.trim(newTitle);
    
    model.savePlaylist('&title='+model.title);
};

Model.prototype.updateDesc = function(newDesc) {
    model.description = $.trim(newDesc);
    
    model.savePlaylist('&description='+model.description);
};

Model.prototype.updateAlbumImg = function(index, albumImg) {
    model.songs[index].i = albumImg;
    model.saveSongs();
};

Model.prototype.savePlaylist = function(data) {
    if (!model.editable) {
        log('Playlist not saved. Playlist is uneditable.');
        return;
    }
    
    var the_url = '/p/'+model.playlistId+'/edit';
    $.ajax({
        data: data,
        dataType: 'json',
        type: 'POST',
        url: the_url,
        success: function(responseData, textStatus, XMLHttpRequest) {
            // TODO: Show a throbber while request is being sent.
            log('Server received updated playlist.');
        }
    });
};
