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
    
    updateDisplay();
    $(window).resize(updateDisplay);
    window.onpopstate = onPopState;
    
    setupKeyboardShortcuts();
    setupFBML(initial_playlist);
    setupPlaylistActionButtons();
    setupRegistration();
    setupLogin();
    setupLogout();
    $('#helpLink').fancyZoom(appSettings.fancyZoom);
   
    setupDragDropUploader('p', player.loadPlaylist);
    
    
    /* Setup minibrowser with flipping */
    
    browser.pushPartial('/search', 'partial search', 'Add Songs');
    
    $('#nowPlayingHeader .right').click(function(event) {
        event.preventDefault();
        event.stopPropagation();
		$('#browserDisplay').addClass('flip');
		log('add');
	});
	$('#browserHeader .right').click(function() {
	    event.preventDefault();
        event.stopPropagation();
		$('#browserDisplay').removeClass('flip');
		log('remove');
	});
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
                    width = 380;
                    break;
                case 'curPlaylistDesc':
                    width = 470;
                    break;
                default:
                    width = $(this).width();
                    break;
            }
            $('textarea', this).width(width).autogrow(settings.autogrow);
        }
    });
}

// Set up keyboard shortcuts in a cross-browser manner
// Tested in Firefox, Chrome, Safari.
// Keyboard events are a mess: http://www.quirksmode.org/js/keys.html
function setupKeyboardShortcuts() {
    $('input, textarea').live('focus', function(event) {
        keyEvents = false; 
    });
    $('input, textarea').live('blur', function(event) {
        keyEvents = true;
    });
    
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
                case 86: // v
                    player.toggleVideo();
                    break;
                case 83: // s
                    player.toggleShuffle();
                    
                    break;
                case 82: // r
                    player.toggleRepeat();
                    break;

                // Playlist editing
                case 65: // a
                    browser.pushPartial('/search', 'partial search', 'Add Songs');
                    break;
                case 74: // j
                    player.moveSongDown(songIndex);
                    break;
                case 75: // k
                    player.moveSongUp(songIndex);
                    break;

                // Navigation
                case 191: // ?
                    $('#helpLink').trigger('click');
                    break;
                case 76: // l
                    player.highlightSong('.playing');
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
          //appId: '114871205247916', // 'Instant.fm' API Key
          appId: '186788488008637',   // 'Wikileaks: The Musical' API Key
          status: true,
          cookie: true,
          xfbml: true
        });
        
        $('#fbConnectButton').click(function(event) {
          FB.login(function(login_response) {
            if (login_response.session) {
              log('FB login succesful.');
              FB.api('/me', function(response) {
                // Check if already registered
                $.ajax({
                  'url': '/signup/fb-check',
                  'method': 'GET',
                  'data': {'fb_id': response.id},
                  'dataType': 'json',
                  'success': function(response) {
                    if (response === true) {
                      $('#alreadyRegistered').show();
                    } else {
                      $('#alreadyRegistered').hide();
                    }
                  }
                });
                
                var form = $('#fbAccountCreation');
                $('input[name=name]', form).val(response.name);
                $('input[name=email]', form).val(response.email);
                $('input[name=fb_user_id]', form).val(response.id);
                $('input[name=auth_token]', form).val(login_response.session.access_token);
                $('img#fbProfileImage').attr('src', 'http://graph.facebook.com/' + response.id + '/picture?type=large');
                $('#fbConnectButton').hide();
                form.show();
              });
            } else {
              // user cancelled login
              log('FB login failed.');
            }
          });
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

function setupRegistration() {
    $('#registrationLink').colorbox({inline: true, href: "#registrationBox"});
     
    // adds an effect called "wall" to the validator
    // TODO: Feross, I just copied and pasted this from JQuery Tools's page.
    //       I'm not sure what effect we want here, but this is how the error
    //       effects are implemented.
    $.tools.validator.addEffect("wall", function(errors, event) {
        // get the message wall
        var wall = $(this.getConf().container).fadeIn();
        
        // remove all existing messages
        wall.find("p").remove();
        
        // add new ones
        $.each(errors, function(index, error) {
            wall.append(
                "<p><strong>" +error.input.attr("name")+ "</strong> " +error.messages[0]+ "</p>"
            );    
        });
  
    // the effect does nothing when all inputs are valid  
    }, function(inputs)  {
    });
    
    // initialize validator and add a custom form submission logic
    $("form#fbRegistration").validator({
        effect: 'wall', 
        container: '#registrationErrors',
   
        // do not validate inputs when they are edited
        errorInputEvent: null
    }).submit(function(e) {
    
        var form = $(this);
      
        // client-side validation OK.
        if (!e.isDefaultPrevented()) {
      
            // submit with AJAX
            $.ajax({
                url: '/signup/fb',
                data: form.serialize(), 
                type: 'POST',
                dataType: 'json',
                success: function(json) {
                    // everything is ok. (server returned true)
                    if (json && json === true)  {
                        log('Registration succeeded.');
                        loginStatusChanged();
                    // server-side validation failed. use invalidate() to show errors
                    } else {
                        if (json && json.success === false && json.errors) {
                            form.data("validator").invalidate(json.errors);
                            log('Registration failt.');
                        }
                    }
                },
                error: function() { log('Error posting form ;_;'); },
            });
            
            // prevent default form submission logic
            e.preventDefault();
        }
    });
}

function setupLogin() {
  
}

function setupLogout() {
  $('a[href="#logout"]').click(function(event) {
      $.post('/logout', function() {
              loginStatusChanged();
              log('Logged out.');
      });
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
    
    // Get top playlist artists
    var topArtists = [];
    $.each(model.songs, function(index, value) {
       var artist = value.a;
       if (artist && $.inArray(artist, topArtists) == -1) {
          topArtists.push(artist);
       }
       if (topArtists.length >= 4) {
           return false; // end the $.each() iteration
       }
    });
    
    FB.ui(
      {
        method: 'feed',
        name: model.title,
        link: 'http://instant.fm/p/'+model.playlistId,
        picture: bestAlbumImg || 'http://instant.fm/images/unknown.png',
        caption: 'Instant.fm Playlist',
        description: model.description + '\n',
        properties: {'Artists in this playlist': topArtists.join(', ')},
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
        
        $('<a href="/search" id="addSongs" rel="partial search" title="Add Songs"><span>Add Songs</span></a>')
            .appendTo('#playlistToolbar .right');
    }
    // TODO: END ---- This shouldn't be in Player.renderPlaylist()
    
    $('#playlist').mouseup(function(event) {
        player.reorderedSong = null; // we're done dragging now
    });

    player.renderRowColoring();
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


/*--------------------- BROWSER EVENTS --------------------- */

// Shows more information about a song, album, or artist by expanding the text
// @event - the triggering event
function onShowMoreText(event) {
    event.preventDefault();

    var elem = $(this).parent();
    var newContent = elem.data('longContent') + ' ';
    var link = makeSeeMoreLink(onShowLessText, 'less');

    elem.html(newContent)
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

function updateDisplay() {
    /* window - (header + footer + good measure) */
    var mainHeight = $(window).height() - (50 + 50 + 5);
    $('#main').height((mainHeight > 0) ? mainHeight : 0);
    
    /* - player - playlist toolbar*/
    var playlistDivHeight = mainHeight - $('#videoDiv').height() - 27;
    $('#playlistDiv').height((playlistDivHeight > 0) ? playlistDivHeight : 0);
    
    /* + enough to hide the jittery toggleVideo resize */
    var playlistDisplayHeight = mainHeight - 6;
    $('#playlistDisplay').height(playlistDisplayHeight);
    
    /* - toolbar */
    var browserHeight = mainHeight - 45;
    browserHeight = (browserHeight > 0) ? browserHeight : 0;
    $('#browser').height(browserHeight);
    $('#nowPlayingContainer').height(browserHeight);
    
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

/* ------------------------ LOGIN ------------------------------*/

/* The following three functions are from QuirksMode.org */
function createCookie(name,value,days) {
  if (days) {
    var date = new Date();
    date.setTime(date.getTime()+(days*24*60*60*1000));
    var expires = "; expires="+date.toGMTString();
  }
  else var expires = "";
  document.cookie = name+"="+value+expires+"; path=/";
}

function readCookie(name) {
  var nameEQ = name + "=";
  var ca = document.cookie.split(';');
  for(var i=0;i < ca.length;i++) {
    var c = ca[i];
    while (c.charAt(0)==' ') c = c.substring(1,c.length);
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
  }
  return null;
}

function eraseCookie(name) {
  createCookie(name,"",-1);
}

/* Call this right after the user is logged in or out to update
 * display. 
 */
function loginStatusChanged() {
    var user_id = readCookie('user_id');
    var user_name = readCookie('user_name');
    if (user_id && user_name) {
        $('html').addClass('loggedIn');
        $('html').removeClass('loggedOut');
        $('.username').html(unescape(user_name));
    } else {
        $('html').addClass('loggedOut');
        $('html').removeClass('loggedIn');
    }
}

function logout() {
    eraseCookie('user_id');
    eraseCookie('user_name');
    eraseCookie('session_id');
    loginStatusChanged();
}


/* --------------------------- MODEL --------------------------- */

function Model(playlist) {
    playlist && this.updatePlaylist(playlist);
    
    var cache = new LastFMCache();
  	this.lastfm = new LastFM({
		apiKey    : '414cf82dc17438b8c880f237a13e5c09',
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
