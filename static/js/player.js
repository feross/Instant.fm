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
    
    this.setupButtons();
}

Player.prototype.setupButtons = function() {
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
};

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

Player.prototype.toggleVideo = function(force) {
    var $videoDiv = $('#videoDiv');
    var videoOn = !$videoDiv.hasClass('noVideo');

    if (force !== undefined && force == videoOn) {
        return; // we're already in the desired state
    }

    if (videoOn) {
        $videoDiv.addClass('noVideo');
        $('#toggleVideo').removeClass('on');
        if (Modernizr.csstransitions) {
            $('#playlistDiv').animate({height: '+=265'}, 600, 'easeInOutQuad');
        } else {
            $('#playlistDiv').height($('#playlistDiv').height()+265);
        }
    } else {
        $videoDiv.removeClass('noVideo');
        $('#toggleVideo').addClass('on');
        if (Modernizr.csstransitions) {
            $('#playlistDiv').animate({height: '-=265'}, 600, 'easeInOutQuad');
        } else {
            $('#playlistDiv').height($('#playlistDiv').height()-265);
        }
    }
};

Player.prototype.toggleShuffle = function(force) {
    this.shuffle = (force !== undefined) ? force : !this.shuffle;
    
    if (this.shuffle) {
        $('#toggleShuffle').addClass('on');
    } else {
        $('#toggleShuffle').removeClass('on');
    }
};

Player.prototype.toggleRepeat = function(force) {
    this.repeat = (force !== undefined) ? force : !this.repeat;
    
    if (this.repeat) {
        $('#toggleRepeat').addClass('on');
    } else {
        $('#toggleRepeat').removeClass('on');
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

// Manually move a song
// NOTE: This method doesn't do any sanity checks! - make sure you pass it sane values!
Player.prototype.moveSong = function(oldId, newId) {
    var songItem = $('#song'+oldId);
    $('#song'+newId).before(songItem);
    
    player.onPlaylistReorder(null, {item: songItem});
};

Player.prototype.addSongToPlaylist = function(song) {
    this.songlist.add(song, '#playlist');
    this.highlightSong('#playlist li:last');
    model.addSong(song);
    updateDisplay(); // resizes short playlists
        
    if (player.ytplayer.getPlayerState() == 0) { // player is stopped
        player.playSong(model.songs.length - 1);
    }
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
        $('#main').effect('pulsate', {times: 2});
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
        buttons: [{
            action: function(event, song) {
                var songItem = $(this).closest('.songListItem');
                var songId = parseInt(songItem.attr('id').substring(4));
                if (songId == 0) {
                    return; // don't move the first song to the top, it breaks things
                }
                player.moveSong(songId, 0);
            },
            className: 'moveToTop ir',
            text: 'Move to top'
        },
        {
            action: $.noop,
            className: 'drag ir',
            text: 'Drag this song to reorder it'
        }],
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
    document.title = playlist.title + ' - Instant.fm - Share Music Playlists Instantly';
    
    if (model.editable) {
        playlistview._makeEditable($('#curPlaylistTitle'), model.updateTitle);
        playlistview._makeEditable($('#curPlaylistDesc'), model.updateDesc);
        
        $('<a href="/search" id="addSongs" rel="partial search" title="Search"><span>Add Songs</span></a>')
            .appendTo('#playlistToolbar .right');
    }
    // TODO: END ---- This shouldn't be in Player.renderPlaylist()
    
    $('#playlist').mouseup(function(event) {
        player.reorderedSong = null; // we're done dragging now
    });
};

Player.prototype._onClickSong = function() {
    var songId = parseInt($(this).attr('id').substring(4));
    player.reorderedSong || player.playSong(songId);
};

// Called by JQuery UI "Sortable" when a song has been reordered
// @event - original browser event
// @ui - prepared ui object (see: http://jqueryui.com/demos/sortable/)
Player.prototype.onPlaylistReorder = function(event, ui) {
    this.reorderedSong = true; // mark the song as reordered so we don't think it was clicked
    var oldId = parseInt(ui.item.attr('id').substring(4));
    var songItem = $('#song'+oldId);
    var newId = songItem.prevAll().length;
    var playingItem = $('.playing');

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
    
    // Keep our position in the playlist up to date in case we moved the current song
    songIndex = parseInt(playingItem.attr('id').substring(4));
};

// Show currently playing song
Player.prototype.highlightSong = function(selector) {
    scrollTo(selector, '#playlistDiv', {
        callback: function() {
            $(selector).effect('pulsate', {times: 2});
        }
    });
};

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