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
    this.songIndex; // Current position in the playlist
    
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
    player.volume += 15;
    player.volume = (player.volume <= 100) ? player.volume : 100;
    
    player.ytplayer.setVolume(player.volume);
};

Player.prototype.decreaseVolume = function() {
    player.volume -= 15;
    player.volume = (player.volume >= 0) ? player.volume : 0;
    
    player.ytplayer.setVolume(player.volume);
};

// Play a song at the given playlist index
// @i - song index
// @isUserInitiated - was the song selection initiated by the user (click, keyboard)?
Player.prototype.playSong = function(i, isUserInitiated) {
    player.songIndex = i;
    var song = model.playlist.songs[i];
    
    // Empty playlist?
    if (!song) {
        if (isOwner()){
            $('#navSearch').click(); // show search for empty playlists
        }
        return;
    }
        
    var title = cleanSongTitle(song.t);
    var artist = song.a;
    
    log(isUserInitiated);
    if (!isUserInitiated) {
        showDesktopNotification(song.i, title, artist);
    } else {
        window.webkitNotifications && window.webkitNotifications.requestPermission();
    }

    player.playSongBySearch(title, artist, player.songIndex);

    $('.playing').removeClass('playing');
    $('#song' + i).addClass('playing');

    player.moveSongIntoView();
};

// Play next song in the playlist
Player.prototype.playNextSong = function(isUserInitiated) {
    if (player.shuffle) {
        var randomSong = Math.floor(Math.random()*model.playlist.songs.length);
        player.playSong(randomSong, isUserInitiated);
    } else if (player.songIndex < model.playlist.songs.length - 1) {
        player.playSong(++player.songIndex, isUserInitiated);
    }
};

// Play prev song in the playlist
Player.prototype.playPrevSong = function(isUserInitiated) {
    if (player.songIndex == 0) {
        return;
    }
    player.playSong(--player.songIndex, isUserInitiated);
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
Player.prototype.playSongBySearch = function(title, artist, _songNum) {
    var q = title+' '+artist;
    var the_url = 'http://gdata.youtube.com/feeds/api/videos?q=' + encodeURIComponent(q) + '&format=5&max-results=1&v=2&alt=jsonc'; // Restrict search to embeddable videos with &format=5.
    
    document.title = title+' by '+artist+' - '+model.playlist.title+' - Instant.fm';
    
    var srcIndex = player.songIndex;
    $.ajax({
        dataType: 'jsonp',
        type: 'GET',
        url: the_url,
        success: function(responseData, textStatus, XMLHttpRequest) {
            if (responseData.data.items) {
                var videos = responseData.data.items;
                player.playSongById(videos[0].id);
                nowplaying.updateCurPlaying(title, artist, videos[0].id, _songNum);
            } else {
                player.pause();
                tts('Not found');
                // Go to next song in a few seconds
                // (to give users using keyboard shortcuts a chance to scroll up past this song)
                window.setTimeout(function() {
                    $('.playing')
                        .removeClass('paused')
                        .addClass('missing')
                        .removeClass('playing');
                    if (player.songIndex == srcIndex) {
                        player.playNextSong(false);
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
Player.prototype.moveCurSongUp = function() {
    if (!model.isEditable() ||
        player.songIndex <= 0) {
        return;
    }
    var songItem = $('#song'+player.songIndex);
    songItem.prev().before(songItem);
    
    player.onPlaylistReorder(null, {item: songItem});
};

// Manually move the current dong down
Player.prototype.moveCurSongDown = function() {
    if (!model.isEditable() ||
        player.songIndex >= model.playlist.songs.length - 1) {
        return;
    }
    var songItem = $('#song'+player.songIndex);
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

Player.prototype.addSongToPlaylist = function(song, event) {
    this.songlist.add(song, '#playlist');
    this.highlightSong('#playlist li:last', '#playlistDiv');
    model.addSong(song);
    updateDisplay(); // resizes short playlists
    
    // If playlist was empty and nothing was playing, then play the song that was
    // just added.
    if (model.playlist.songs.length == 1 &&
        (!player.ytplayer ||
            (player.ytplayer && player.ytplayer.getPlayerState() != 1))) {
        
        player.playSong(0, true);
    } 
    if (player.ytplayer && player.ytplayer.getPlayerState() == 0) { // player is stopped
        player.playSong(model.playlist.songs.length - 1, true);
    }
};

Player.prototype.removeSongFromPlaylist = function(songNum) {
    var nextElems = $('#song'+songNum).nextAll();
    
    this.songlist.remove(songNum, {
        before: function() {
            nextElems.addClass('transition-background-color');
        },
        after: function() {
            nextElems.each(function(index, element) {
                var num = songNum+index;
                $(element)
                    .attr('id', 'song' + num)
                    .find('.num').animate({opacity: 0}, 'fast', function() {
                        $(this).text(num+1);
                        $(this).animate({opacity: 1}, 'fast', function() {
                            $(this).parent().removeClass('transition-background-color');
                        });
                    });
            });
        }
    });
    model.removeSong(songNum);
    updateDisplay(); // resizes short playlists
    
    if (player.songIndex == songNum) { // removed currently playing song
        player.songIndex--; // go to the correct next song
    }
};


/* Playlist related functions */

Player.prototype.loadPlaylist = function(playlist) {
    if (!playlist) {
        log('Attempted to load null playlist.');
        return;
    }
    
    if (window.location.href.indexOf('share=1') == -1) {
        if((!Modernizr.history && window.location != playlist.url) ||
           ($('html').attr('id') == 'home')) {
            window.location = playlist.url;
        }

        // Replace history if initial page load, otherwise push.
        if (model.playlist == null) {
            window.history.replaceState(
                playlist,
                playlist.title,
                playlist.url
            );
        } else {
            window.history.pushState(
                playlist,
                playlist.title,
                playlist.url
            );
        }
    }
 
    model.updatePlaylist(playlist);
    player.renderPlaylistInfo(playlist);

    player.playSong(0, true);
    ownershipStatusChanged();
        
    nowplaying.tryLoadComments(playlist.url); // update the comment widget
    log('Loaded playlist: ' + playlist.url);
};

// Load a playlist with the given id
Player.prototype.loadPlaylistByUrl = function(url) {
    $.ajax({
        dataType: 'json',
        data: {'json': true},
        type: 'GET',
        url: url,
        success: function(responseData, textStatus, XMLHttpRequest) {
            player.loadPlaylist(responseData);
        }
    });
};


// Retrieves an artist's top songs from Last.fm and loads them as a playlist
Player.prototype.loadPlaylistForArtist = function(artist_name) {
    var _this_player = this;
    model.lastfm.artist.getTopTracks({
        artist: artist_name,
        autocorrect: 1,
    },
    {
        success: function(data) {
            var playlist = Player.playlistFromArtistTracks(data.toptracks);
            _this_player.loadPlaylist(playlist);
        },
        error: function(code, message) {
            log(code + ' ' + message);
        }
    });
}; 


Player.prototype.loadPlaylistForAlbum = function(artist_name, album_title) {
    var _this_player = this;
    model.lastfm.album.getInfo({
        album: album_title,
        artist: artist_name,
        autocorrect: 1,
    },
    {
        success: function(data) {
            var playlist = Player.playlistFromAlbum(data.album);
            _this_player.loadPlaylist(playlist);
        },
        error: function(code, message) {
            log(code + ' ' + message);
        }
    });
};

// Updates the playlist table
Player.prototype.renderPlaylistInfo = function(playlist) {
    
    // Render Playlist
    $('#playlist').remove(); // clear the playlist
    
    this.songlist = new SongList(playlist, {
        startingLen: null,
        onClick: player._onClickSong,
        buttons: [{
            action: $.noop,
            className: 'drag ir',
            text: 'Drag song to reorder it'
        },
        {
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
            action: function(event, song) {
                var songItem = $(this).closest('.songListItem');
                var songId = parseInt(songItem.attr('id').substring(4));
                player.removeSongFromPlaylist(songId);
            },
            className: 'kill ir',
            text: 'Delete song'
        },
        ],
        id: 'playlist',
        listItemIdPrefix: 'song',
        isNumbered: true,
    });
    
    this.songlist.render('#playlistDiv', function() {
        $('#playlist')
            .sortable($.extend({}, appSettings.sortable, {
                start: function(event, ui) {
                    $('body').toggleClass('sorting', true);
                },
                stop: function(event, ui) {
                    player.onPlaylistReorder(event, ui);
                    $('body').toggleClass('sorting', false);
                },
                disabled: true
            }));
        
        if (model.isEditable()) {
            $('#playlist').sortable('enable');
            
            window.setTimeout(function() {
                player.songlist.fetchAlbumImgs.apply(player.songlist);
            }, 4000);
        }
    });
       
    $('#playlist').mouseup(function(event) {
        player.reorderedSong = null; // we're done dragging now
    });
    
    nowplaying.renderPlaylistInfo(playlist);
    $('#altPlaylistTitle').text(playlist.title);
};

Player.prototype._onClickSong = function() {
    var songId = parseInt($(this).attr('id').substring(4));
    player.reorderedSong || player.playSong(songId, true);
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
    this.songIndex = parseInt(playingItem.attr('id').substring(4));
};

// Show currently playing song
// @selector - element to scroll to
// @container - element with the scrollbar
Player.prototype.highlightSong = function(selector, container, _effect, _effectOptions) {
    var effect = _effect || 'pulsate',
	    effectOptions = _effectOptions || {times: 1};
	
	scrollTo(selector, container, {
        callback: function() {
			$(selector).effect(effect, effectOptions);
        }
    });
};


Player.playlistFromArtistTracks = function(trackList) {
    var playlist = {};
    playlist.artist = trackList['@attr'].artist;
    playlist.title = playlist.artist + "'s Top Songs";
    playlist.url = '/' + canonicalize(playlist.artist);
    playlist.songs = Player._songsFromTrackList(trackList);   
    return playlist;
};


Player.playlistFromAlbum = function(album) {
    var playlist = {};
    playlist.artist = album.artist;
    playlist.title = '"' + album.name + '" by ' + album.artist;
    playlist.url = '/' + canonicalize(album.artist) + '/' + canonicalize(album.name);
    playlist.songs = Player._songsFromTrackList(album.tracks);
    if (album.wiki && album.wiki.summary) {
        playlist.description = album.wiki.summary;
    }
    if (album.image && album.image[0]) {
        for (var i = 0; i < playlist.songs.length; i++) {
            playlist.songs[i].i = album.image[0]['#text'];
        }
    }
    return playlist;
}


Player._songsFromTrackList = function(trackList) {
    if (trackList === undefined || trackList.track === undefined) {
        return [];
    }
    
    // It's possible for "track" to be a single track instead of array.
    // If it's a single track, make it an array. This is maybe not the best.
    if (trackList.track.length === undefined) {
        trackList.track = [trackList.track];
    }
    
    var songs = [];
    for (var i = 0; i < trackList.track.length; i++) {
        var songResult = trackList.track[i];
        var song = {};

        song.t = songResult.name;
        song.a = (songResult.artist.name ? songResult.artist.name : songResult.artist);
        var image = songResult.image && songResult.image[2]['#text'];
        if (image !== undefined) {
            song.i = image;
        } else {
            song.i = null;
        }

        songs.push(song);
    };
    return songs;
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
                player.playSong(songIndex, false);
            } else {
                player.playNextSong(false);
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