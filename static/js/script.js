var model;
var view;
var controller;
var browser;

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
};
// jQuery.fx.off = true;


/* --------------------------- ON LOAD --------------------------- */

function addFocusHandlers(elem) {
    elem.focus(function() {
        controller.keyEvents = false;
    })
    .blur(function() {
        controller.keyEvents = true;
    }); 
}

function onloadHome() {
    controller = new Controller();
    
    $('.file').change(function(event) {
        var val = $(this).val();
        if (val.length) {
            $('#uploadForm').submit();
        }
    });
    
    setupDragDropUploader('home', controller.redirectToPlaylist);
}


function onloadPlaylist() {
    view = new View();
    model = new Model();
    controller = new Controller();
    browser = new MiniBrowser();
    
    setupAutogrowInputType();
    controller.loadPlaylist(initial_playlist);
    
    setupPlaylistDisplay();
    setupKeyboardListeners();
    setupFBML(initial_playlist);
    setupPlaylistActionButtons();

    $('#helpLink').fancyZoom(appSettings.fancyZoom);
    
    window.onpopstate = controller.onPopState;
    $(window).resize(setupPlaylistDisplay);
    
    setupDragDropUploader('p', controller.loadPlaylist);
}


/* --------------------------- SETUP  --------------------------- */

prevSearchString = '';
delaySearch = false;
function setupSearch(searchElem) {
    var searchInput = $('#searchBox input.search');
    
    var doSearch = function(searchString) {        
        if (!delaySearch && (prevSearchString != searchString)) {
            prevSearchString = searchString;
            controller.search(searchString);
            
            delaySearch = true;            
            window.setTimeout(function() {
                delaySearch = false;
                
                if (searchInput.val() != searchString) {
                    doSearch(searchInput.val());
                }
            }, 500);
        }
    };
    
    // Hit enter
    $('#searchBox', searchElem).submit(function(event) {
        event.preventDefault();
        doSearch(searchInput.val());
    });
    
    // Enters key
    searchInput.keyup(function() {
        doSearch(searchInput.val());
    });
    addFocusHandlers(searchInput);
    
    // Clicks search button
    $('#searchBox input.submit', searchElem).click(function() {
        event.preventDefault();
        doSearch(searchInput.val());
    });
}

/* NOTE: Unused right now. */
function setupArtistAutocomplete() {
    var artistSearch = $("#searchBox");
    artistSearch.autocomplete({
      source: '/suggest', 
      minLength: 2,        
      select: function( event, ui ) {
        var value = ui.item ? ui.item.value : this.value;
        log( ui.item ? 
          "Selected: " + ui.item.value + " aka " + ui.item.id :
          "Nothing selected, input was " + this.value );
        loadArtistTracks(value);
      }
    });
    addFocusHandlers(artistSearch);
}

function setupPlaylistDisplay() {
    var maxPlaylistHeight = $(window).height() - (50 + 295); /* header, player */
    var newHeight = Math.min($('#playlist').height(), maxPlaylistHeight);
    $('#playlistDiv').height(newHeight);
}

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

// Set up keyboard shortcuts in a cross-browser manner
// Tested in Firefox, Chrome, Safari.
// Keyboard events are a mess: http://www.quirksmode.org/js/keys.html
function setupKeyboardListeners() {
    
    // Convenience function for doing key events
    var doKeyEvent = function(func) {
        if (controller.keyEvents) {
            event.preventDefault(); // prevent default event
            func();
        }
    }
    
    // Detect key codes
    $(window).keydown(function(event) {
        var k = event.which;
        switch(k) {
            // Playback control
            case 39: case 40: // down, right
                doKeyEvent(controller.playNextSong);
                break;
            case 37: case 38: // up, left
                doKeyEvent(controller.playPrevSong);
                break;
            case 32: // space
                doKeyEvent(view.playPause);
                break;
            case 187: // +
                doKeyEvent(view.increaseVolume);
                break;
            case 189: // -
                doKeyEvent(view.decreaseVolume);
                break;
            case 191: // ?
                doKeyEvent(function() {
                    $('#helpLink').trigger('click');
                });
                break;
                
            // Playlist editing
            case 65: // a
                doKeyEvent(view.showSearch);
                break;
            case 74: // j
                doKeyEvent(function() {
                    controller.moveSongDown(controller.songIndex)
                });
                break;
            case 75: // k
                doKeyEvent(function() {
                    controller.moveSongUp(controller.songIndex);
                })
                break;
            
            // Navigation
            case 8: // backspace
                doKeyEvent(browser.pop);
                break;
            case 27: // escape
                // We're not using the doKeyEvent() wrapper since we always want to
                // capture the escape button (even when focused in text boxes)
                event.preventDefault();
                
                // Turn keyboard shortcuts back on, in case we deleted a focused form during the pop.
                controller.keyEvents = true;
                
                browser.pop();
                break;
            
            // Share playlists
            case 70: // f
                doKeyEvent(function() {
                    $('#fbShare').trigger('click');
                });
                break;
            case 84: // t
                doKeyEvent(function() {
                    $('#twShare').trigger('click'); 
                });
                break;
            case 66:
                doKeyEvent(shareOnBuzz);
                break;
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
        
        view.tryLoadComments(playlist.playlist_id, playlist.title);
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
        if (!$('#commentsDiv').data('loaded')) {
            return;
        }
        
        // This is a workaround for a JQuery bug where the Facebook comment box
        // animation is jumpy. (http://goo.gl/so18k)
        if ($('#commentsDiv').is(':visible')) {
            $('#addComment').html('Add a comment +');
            $('#commentsDiv').animate({height: 0}, {duration: 'slow', complete: function() {
                $('#commentsDiv').hide();
            }});
        } else {
            $('#addComment').html('Close comments');
            $('#commentsDiv')
                .show()
                .animate({height: controller.commentsHeight}, {duration: 'slow'});
        }
    });
    
    $('#fbShare').click(function(event) {
        event.preventDefault();
        
        FB.ui(
          {
            method: 'feed',
            name: model.title,
            link: 'http://instant.fm/p/'+model.playlistId,
            picture: view.bestAlbumImg || 'http://instant.fm/images/unknown.png',
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
    });
    
    $('#twShare').click(function(event) {
        event.preventDefault();
        
        var tweetText = encodeURIComponent('♫ I\'m listening to "'+model.title+'"');
        var url = 'http://twitter.com/share'+
                  '?url=http://instant.fm/p/'+model.playlistId+
                  '&text='+tweetText;
        view.showPop(url, 'twitterShare');
    });
}

function setupDragDropUploader(dropId, callback) {
    new uploader(dropId, null, '/upload', null, callback); // HTML5 dragdrop upload
}


function shareOnBuzz() {
    var url = 'http://www.google.com/buzz/post?url='+window.location;
    view.showPop(url, 'buzzShare', 420, 700);
}



/* --------------------------- MINI BROWSER --------------------------- */

// Animated image slider code from: http://goo.gl/t3vPZ
var MiniBrowser = function() {
  
    // Setup vendor prefix
    this.vP = '';
    if ($.browser.webkit) {
    	this.vP = "-webkit-";
    } else if ($.browser.msie) {
    	this.vP = "-ms-";
    } else if ($.browser.mozilla) {
    	this.vP = "-moz-";
    } else if ($.browser.opera) {
    	this.vP = "-o-";
    }

    this.refreshContents();
};

MiniBrowser.prototype.refreshContents = function() {
    // width of slide + margin-right of slide
    this.sliderWidth = $('#FS_slider').width() + 50;
    this.numSlides = $('#FS_holder .slide').length;
    
    // $("#FS_slider #FS_holder").width(this.sliderWidth * this.numSlides);
    // $("#FS_slider #FS_holder").height($("#FS_slider .slide").height());
};

MiniBrowser.prototype.push = function(elem) {
    $(elem)
        .addClass('slide')
        .appendTo('#FS_holder');

    this.refreshContents();
    this.slideTo(this.numSlides);
};

MiniBrowser.prototype.pop = function() {
    if (browser.numSlides <= 1) {
        return;
    }
    browser.slideTo(browser.numSlides - 1);
    window.setTimeout(function() {
        $('#FS_holder .slide').last().remove();
        browser.refreshContents();
    }, 800);
};

MiniBrowser.prototype.slideTo = function(slide) {
    
	var pixels = this.sliderWidth * (slide - 1);

	if (Modernizr.csstransforms3d && Modernizr.csstransforms && Modernizr.csstransitions) {

		$("#FS_holder").css(this.vP+"transform","translate3d(-"+pixels+"px, 0px, 0px)");
		   $("#FS_holder").css("transform","translate3d(-"+pixels+"px, 0px, 0px)");			

	} else if (Modernizr.csstransforms && Modernizr.csstransitions) {

		$("#FS_holder").css(this.vP+"transform","translate(-"+pixels+"px, 0px)");
		   $("#FS_holder").css("transform","translate(-"+pixels+"px, 0px)");		

	} else if (Modernizr.csstransitions) {

		$("#FS_holder").css("margin-left","-"+pixels+"px");

	} else {

		$("#FS_holder").animate({"margin-left":"-"+pixels+"px"},600); // If you animate left, IE breaks.

	}		
};

MiniBrowser.prototype.makeBackButton = function(text) {
    text = text || 'Back';
    
    var button = $('<a href="#back" class="backButton awesome">'+text+'</a>');
    button.click(function(event) {
        event.preventDefault();
        browser.pop();
    });
    
    return button;
};


/* --------------------------- CONTROLLER --------------------------- */

function Controller() {
    this.songIndex; // Current position in the playlist
    this.queuedVideo;
        
    this.keyEvents = true; // Used to disable keyboard shortuts
    this.commentsHeight; // Height of Facebook comment box. Used to smooth the animation.
};
    
Controller.prototype.search = function(string) {
    if (!string) {
        return;
    }

    prevSearchString = string;

    model.lastfm.artist.search({
        artist: string,
        limit: 3,
    }, 
    {
        success: controller.handleArtistSearchResults,
        error: function(code, message) {
            log(code + ' ' + message);
            view.renderArtists([]);
    	}
    });

    model.lastfm.album.search(
    {
      album: string,
      limit: 3,
    },
    {
    	success: controller.handleAlbumSearchResults,
        error: function(code, message) 
        {
            log(code + ' ' + message);
            view.renderAlbums([]);
        }
    });
  
  model.lastfm.track.search(
    {
      track: string,
      limit: 15,
    },
    {
 	    success: controller.handleTrackSearchResults,
 	    error: function(code, message) 
	    {
        log(code + ' ' + message);
        view.renderTracks([]);
	    }	    
    }
  )
};

Controller.prototype.handleTrackSearchResults = function(data) {
  var tracks = [];
  var trackResults = data && data.results && data.results.trackmatches && data.results.trackmatches.track;
  
  if (!trackResults) {
    view.renderTracks([]);
    return;
  }
  
  for (var i = 0; i < trackResults.length; i++) {
    var trackResult = trackResults[i];
    var track = {};
    
    track.name = trackResult.name;
    track.artist = trackResult.artist;
    
    if (trackResult.image) {
        track.image =  trackResult.image[0]['#text'];
    } else {
        track.image = '';
    }
    
    tracks.push(track);
  };
  
  view.renderTracks(tracks);
};


Controller.prototype.handleAlbumSearchResults = function(data) {
  var albums = [];
  var albumResults = data && data.results && data.results.albummatches && data.results.albummatches.album;
  
  if (!albumResults) {
    view.renderAlbums([]);
    return;
  }
  
  for (var i = 0; i < albumResults.length; i++) {
    var albumResult = albumResults[i];
    var album = {};
    
    album.name = albumResult.name;
    album.artist = albumResult.artist;
    album.image = albumResult.image[2]['#text'];
    
    albums.push(album);
  };
  
  view.renderAlbums(albums);
};

Controller.prototype.handleArtistSearchResults = function(data) {
    var artists = [];
    var artistResults = data && data.results && data.results.artistmatches && data.results.artistmatches.artist;

    if (!artistResults) {
        view.renderArtists([]);
        return;
    }

    for (var i = 0; i < artistResults.length; i++) {
        var artistResult = artistResults[i];
        var artist = {};

        artist.name = artistResult.name;
        artist.image = '';
        artist.image = artistResult.image[2]['#text'];
        artist.image = artist.image.replace('serve/126', 'serve/126s');    

        artists.push(artist);
    };

    view.renderArtists(artists);
};

// Load a playlist based on the xhr response or the initial embedded playlist
// @response - response body
Controller.prototype.loadPlaylist = function(response) {
    if ($.isPlainObject(response)) { // playlist is embedded in html
        var playlist = response;
        if(Modernizr.history) {
            window.history.replaceState({playlistId: playlist.playlist_id}, playlist.title, '/p/'+playlist.playlist_id);
        }

    } else { // playlist is from xhr response      
        var playlist = $.parseJSON(response);
        if(playlist.status != 'ok') {
            log('Error loading playlist: ' + playlist.status);
            return;
        }
        if(Modernizr.history) {
            window.history.pushState({playlistId: playlist.playlist_id}, playlist.title, '/p/'+playlist.playlist_id);
        }
        view.tryLoadComments(playlist.playlist_id, playlist.title);
        $('#infoDisplay').effect('pulsate');
    }

    model.updatePlaylist(playlist);
    view.renderPlaylist(playlist);

    controller.playSong(0);
    log('Loaded playlist: ' + playlist.playlist_id);
};

// Redirect to playlist with the given id
Controller.prototype.redirectToPlaylist = function(response) {
    var playlist = $.parseJSON(response);
    if(playlist.status != 'ok') {
        log('Error loading playlist: ' + playlist.status);
        return;
    }
    var id = playlist.playlist_id;
    window.location = '/p/'+id;
};

// Load a playlist with the given id
Controller.prototype.loadPlaylistById = function(id) {
    var the_url = '/p/'+id+'/json';
    $.ajax({
        dataType: 'json',
        type: 'GET',
        url: the_url,
        success: function(responseData, textStatus, XMLHttpRequest) {
            controller.loadPlaylist(responseData);
        }
    });
};

// Play a song at the given playlist index
Controller.prototype.playSong = function(i) {
    this.songIndex = i;
    var song = model.songs[i];
    var title = cleanSongTitle(song.t);
    var artist = song.a;

    var q = title + ' ' + artist;
    this.playSongBySearch(q);

    $('.playing').toggleClass('playing');
    $('#song' + i).toggleClass('playing');

    this.updateCurPlaying(title, artist, this.songIndex);
};

// Play next song in the playlist
Controller.prototype.playNextSong = function() {
    if (controller.songIndex == model.songs.length - 1) {
        return;
    }
    controller.playSong(++controller.songIndex);
};

// Play prev song in the playlist
Controller.prototype.playPrevSong = function() {
    if (controller.songIndex == 0) {
        return;
    }
    controller.playSong(--controller.songIndex);
};

// Manually move the current song up
Controller.prototype.moveSongUp = function(oldId) {
    if (oldId <= 0) {
        return;
    }
    var songItem = $('#song'+oldId);
    songItem.prev().before(songItem);
    
    view.onReorder(null, {item: songItem});
}

// Manually move the current dong down
Controller.prototype.moveSongDown = function(oldId) {
    if (oldId >= model.songs.length - 1) {
        return;
    }
    var songItem = $('#song'+oldId);
    songItem.next().after(songItem);
    
    view.onReorder(null, {item: songItem});
}

// Play top video for given search query
Controller.prototype.playSongBySearch = function(q) {
    var the_url = 'http://gdata.youtube.com/feeds/api/videos?q=' + encodeURIComponent(q) + '&format=5&max-results=1&v=2&alt=jsonc'; // Restrict search to embeddable videos with &format=5.
    $.ajax({
        dataType: 'jsonp',
        type: 'GET',
        url: the_url,
        success: function(responseData, textStatus, XMLHttpRequest) {
            if (responseData.data.items) {
                var videos = responseData.data.items;
                controller.playSongById(videos[0].id)
            } else {
                controller.playNextSong();
                log('No songs found for: ' + q);
            }
        }
    });
};

// Attempts to play the video with the given ID. If the player is in a loading state,
// we queue up the video. We don't want to interrupt the player since that causes the
// "An error occurred, please try again later" message.
Controller.prototype.playSongById = function(id) {
    if (view.player && view.player.getPlayerState() == 3) { // Don't interrupt player while it's loading
        this.queuedVideo = id;
    
    } else { // Play it immediately
        view.playVideoById(id); 
    }
};

// Gets called when there is a browser history change event (details: http://goo.gl/rizNN)
// If there is saved state, load the correct playlist.
Controller.prototype.onPopState = function(event) {
    var state = event.state;
    if (state && state.playlistId != model.playlistId) {
        controller.loadPlaylistById(state.playlistId);
    }
};

// Update the currently playing song with Last.fm data
// @t - song title
// @a - song artist
// @songIndex - Song index that generated this Last.fm request. We'll check that the song
//              hasn't changed before we update the DOM.
// TODO: Find a way to decompose this monstrous function
Controller.prototype.updateCurPlaying = function(t, a, songIndex) {
    // Hide old values with animation
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

    // 1. Search for track.
	model.lastfm.track.search({
	    artist: a,
	    limit: 1,
	    track: t
	}, {

	    success: function(data){
	        if (controller.songIndex != songIndex) {
	            return; // The request was too slow. We don't need it anymore.
	        }
            if (!data.results || !data.results.trackmatches || !data.results.trackmatches.track) {
                this.error('track.search', 'Empty set.');
                return;
            }
        
            hide(); 
        
            var track = data.results.trackmatches.track;
            var trackName = track.name || t;
            var artistName = track.artist || a;
            var albumImg = track.image && track.image[track.image.length - 1]['#text'];
        
            // Update song title, artist name
            $('#curSong h4').text(trackName);
            $('#curArtist h4').text(artistName);
        
            // Update album art
            // We'll set alt text once we know album name
            view.updateAlbumImg(albumImg, ''); 
        
            // 2. Get detailed track info
            trackName && artistName && model.lastfm.track.getInfo({
        	    artist: artistName,
        	    autocorrect: 1,
        	    track: trackName
        	}, {
    	    
        	    success: function(data){
        	        if (controller.songIndex != songIndex) {
        	            return; // The request was too slow. We don't need it anymore.
        	        }
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
                
                    // Update album image alt text
                    var albumAlt = albumName;
                    albumAlt += artistName ? (' by ' + artistName) : '';
                    albumName && $('#curAlbumImg').attr('alt', albumAlt);
                
                    // Update song summary
                    var shortContent;
                    if (trackSummary) {       
                        shortContent = cleanHTML(trackSummary);                 
                        $('#curSongDesc article').html(shortContent);
                        $('#curSongDesc h4').text('About '+track.name);
                        $('#curSongDesc').fadeIn('fast');
                    }
                
                    // Add link to longer description
                    if (trackSummary && trackLongDesc) {
                        var longContent = cleanHTML(trackLongDesc);
                        
                        $('#curSongDesc article')
                            .data('longContent', longContent)
                            .data('shortContent', shortContent);
                        
                        var link = makeSeeMoreLink(view.showMoreText);
                        $('#curSongDesc article').append(' ').append(link);
                    }
        	    },

        	    error: function(code, message) {
        	        log(code + ' ' + message);
        		}
        	});
    	
        	// 3. Get detailed artist info (proceeds simultaneously with 2)
        	artistName && model.lastfm.artist.getInfo({
        	    artist: artistName,
        	    autocorrect: 1
        	}, {
    	    
        	    success: function(data){
        	        if (controller.songIndex != songIndex) {
        	            return; // The request was too slow. We don't need it anymore.
        	        }
                    if (!data.artist) {
                        this.error('track.getInfo', 'Empty set.');
                        return;
                    }
                                    
                    var artist = data.artist;
                    var artistSummary = artist.bio && artist.bio.summary;
                    var artistLongDesc = artist.bio && artist.bio.content;
                    var artistImg = artist.image && artist.image[artist.image.length - 1]['#text'];
                
                    // Update artist image
                    view.updateArtistImg(artistImg, artistName);
                
                    // Update artist summary
                    var shortContent;
                    if (artistSummary) {                  
                        shortContent = cleanHTML(artistSummary);
                        $('#curArtistDesc article').html(shortContent);
                        $('#curArtistDesc h4').text('About '+artistName);
                        $('#curArtistDesc').fadeIn('fast');
                    }
                
                    // Add link to longer description
                    if (artistSummary && artistLongDesc) {
                        var longContent = cleanHTML(artistLongDesc); 
                        
                        $('#curArtistDesc article')
                            .data('longContent', longContent)
                            .data('shortContent', shortContent);
                                                                       
                        var link = makeSeeMoreLink(view.showMoreText);
                        $('#curArtistDesc article').append(' ').append(link);
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
            view.updateAlbumImg(null);
            hide();
		}
	});
};


/* --------------------------- VIEW --------------------------- */

function View() {
    this.isPlayerInit = false; // have we initialized the player?
    this.player; // YouTube DOM element
    this.volume = 100;
    this.reorderedSong = false; // Used to distinguish between dragging and clicking
    this.renderPlaylistChunkSize = 400; // Render playlist in chunks so we don't lock up
    this.renderPlaylistTimeout = 100; // Time between rendering each chunk
    
    this.bestAlbumImg; // Use first non-blank album as share image
}

/* Rendering search results */

/* Takes an array of objects with properties 'name', 'artist', 'image' 
 * If there is no image, image will be the empty string. 
 */
View.prototype.renderAlbums = function(albums) {
    if (!albums.length) {
        $('#albumResults').hide();
    } else {
        $('.albumResult').remove();
        $('#albumResults').show();
    }

    for (var i = 0; i < albums.length; i++) {
        var album = albums[i];

        if (!album.image) {
            album.image = '/images/unknown.png';
        }

        // No alt text. Want to avoid alt-text flash while img loads
        var img = $('<img src="' + album.image + '">');

        $('<div class="albumResult"></div>')
        .append('<div>' + album.name + '<span>' + album.artist + '</span></div>')
        .append(img)
        .appendTo('#albumResults');
    }
}

/* Takes an array of objects with properties 'name', 'image' 
 * If there is no image, image will be the empty string. 
 */
View.prototype.renderArtists = function(artists) {
    if(!artists.length) {
        $('#artistResults').hide();
    } else {
        $('.artistResult').remove();
        $('#artistResults').show();
    }
    
    for (var i = 0; i < artists.length; i++) {
        var artist = artists[i];
        
        if (!artist.image) {
            artist.image = '/images/anonymous.png';
        }
        
        // No alt text. Want to avoid alt-text flash while img loads
        var img = $('<img src="'+artist.image+'">');
        
        $('<div class="artistResult"></div>')
            .append('<div>'+artist.name+'</div>')
            .append(img)
            .appendTo('#artistResults');
    }
}

/* Takes an array of objects with properties 'name', 'artist', 'image' 
 * If there is no image, image will be the empty string. 
 */
View.prototype.renderTracks = function(tracks) {
    if(!tracks.length) {
        $('#trackResults').hide();
    } else {
        $('.trackResult').remove();
        $('#trackResults').show();
    }
    
    for (var i = 0; i < tracks.length; i++) {
        var track = tracks[i];
        
        if (!track.image) {
            track.image = '/images/unknown.png';
        }
        
        // No alt text. Want to avoid alt-text flash while img loads
        var img = $('<img src="'+track.image+'">');
        
        $('<div class="trackResult clearfix"></div>')
            .append(img)
            .append('<div>'+track.name+'<span>'+track.artist+'</span></div>')
            .appendTo('#trackResults');
    }
}

/* Info Display */

// Update album art to point to given src url
// @src - Image src url. Pass null to show the Unknown Album image.
// @alt - Image alt text. (required, when src != null)
View.prototype.updateAlbumImg = function(src, alt) {
    view.bestAlbumImg = view.bestAlbumImg || src;
    
    if (!src) {
        src = '/images/unknown.png';
        alt = 'Unknown album';
    }
    var imgBlock = makeFancyZoomImg('curAlbumImg', src, alt);
    $('#curAlbumImg').replaceWith(imgBlock);
};

// Update artist img to point to given src url
// @src - Image src url. Pass null to show nothing.
// @alt - Image alt text. (required, when src != null)
View.prototype.updateArtistImg = function(src, alt) {    
    if (src) {
        var imgBlock = makeFancyZoomImg('curArtistImg', src, alt);  
        $('#curArtistImg').replaceWith(imgBlock);
    
    } else {
        $('#curArtistImg').replaceWith($('<span id="curArtistImg"></span>'));
    }
};

// Shows more information about a song, album, or artist by expanding the text
// @event - the triggering event
View.prototype.showMoreText = function(event) {
    event.preventDefault();

    var elem = $(this).parent();
    var newContent = elem.data('longContent') + ' ';
    var link = makeSeeMoreLink(view.showLessText, 'show less');

    elem
        .html(newContent)
        .append(link);
};

// Shows less information about a song, album, or artist by shrinking the text
// @event - the triggering event
View.prototype.showLessText = function(event) {
    event.preventDefault();

    var elem = $(this).parent();
    var newContent = elem.data('shortContent') + ' ';
    var link = makeSeeMoreLink(view.showMoreText);

    elem
        .html(newContent)
        .append(link);
};


/* Playlist */

// Updates the playlist table
View.prototype.renderPlaylist = function(playlist, start) {
    
    if (!start) { // only run this the first time
        start = 0;
    
        $('.editLink').remove();
        $('#curPlaylistTitle')
            .text(playlist.title);
        $('#curPlaylistDesc')
            .text(playlist.description);
        
        if (playlist.editable) {
            view.makeEditable($('#curPlaylistTitle'), model.updateTitle);
            view.makeEditable($('#curPlaylistDesc'), model.updateDesc);
            
            $('<a href="#addSongs" id="addSongs" class="forwardButton awesome">Add songs +</a>')
                .click(view.showSearch)
                .prependTo('#curPlaylistInfo header');
        }
        
        $('#playlist li').remove(); // clear the playlist
    }

    if (start >= playlist.songs.length) { // we're done
        if (playlist.editable) {
            $('body').addClass('editable');
            $('#playlist')
                .sortable({
                    axis: 'y',
                    scrollSensitivity: 25,
                    start: function(event, ui) {
                        $('body').toggleClass('sorting', true);
                    },
                    stop: function(event, ui) {
                        view.onReorder(event, ui);
                        $('body').toggleClass('sorting', false);
                    },
                    tolerance: 'pointer'
                })
        }
            
        $('#playlist').disableSelection().mouseup(function(event) {
            view.reorderedSong = null; // we're done dragging now
        });

        view.renderRowColoring();
        return;
    }

    var end = Math.min(start + view.renderPlaylistChunkSize, playlist.songs.length);

    for (var i = start; i < end; i++) {
        var v = playlist.songs[i];
        $('<li id="song'+i+'"><span class="title">'+v.t+'</span><span class="artist">'+v.a+'</span><span class="handle">&nbsp;</span></li>')
            .appendTo('#playlist')
            .click(function(event) {
                var songId = parseInt($(this).attr('id').substring(4));
                view.reorderedSong || controller.playSong(songId);
            });
    }

    window.setTimeout(function() {
        view.renderPlaylist(playlist, start + view.renderPlaylistChunkSize);
    }, view.renderPlaylistTimeout);
};

// Makes the given element editable by adding an edit link.
// @elem - the element to make editable
// @updateCallback - the function to call when the value is modified
View.prototype.makeEditable = function(elem, updateCallback) {    
    var elemId = elem.attr('id');
    var buttonClass, autogrowSettings;
    switch (elemId) {
        case 'curPlaylistTitle':
            autogrowSettings = {
                expandTolerance: 0.05,
                lineHeight: 30,
                minHeight: 30,
            };
            buttonClass = 'large awesome';
            break;
        default:
            autogrowSettings = {
                expandTolerance: 0.1,
                lineHeight: 16,
                minHeight: 16,
            };
            buttonClass = 'small awesome';
            break;
    }
    
    elem.after(makeEditLink(function(event) {
            event.preventDefault();
            $.extend(appSettings.jeditable.autogrow, autogrowSettings);

            $(this).prev().trigger('editable');
            $(this).hide();
            
            if($(this).prev().attr('id') == 'curPlaylistTitle') {
                $('#addSongs').hide();
            }
            
            // disable key events while textarea is focused
            controller.keyEvents = false;
            addFocusHandlers($('textarea', $(this).parent()));
        }))
        .editable(function(value, settings) {
            $(this).next().show();
            
            if($(this).attr('id') == 'curPlaylistTitle') {
                $('#addSongs').show();
            }
            
            updateCallback(value);
            return value;
        }, $.extend({}, appSettings.jeditable, {buttonClass: buttonClass}));
};

// Recolors the playlist rows
View.prototype.renderRowColoring = function() {
    $('#playlist li')
        .removeClass('odd')
        .filter(':odd')
        .addClass('odd');
};

// Called by JQuery UI "Sortable" when a song has been reordered
// @event - original browser event
// @ui - prepared ui object (see: http://jqueryui.com/demos/sortable/)
View.prototype.onReorder = function(event, ui) {
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
                $(element).attr('id', 'song' + (newId+index+1) );
            });
        
    } else { // Moved down
        songItem
            .prevUntil('#song'+(oldId-1))
            .each(function(index, element) {
                $(element).attr('id', 'song' + (newId-index-1) );
            });
    }

    songItem.attr('id', 'song'+newId); // Add back the reordered song's id

    // If we move the current song, keep our position in the playlist up to date
    if (oldId == controller.songIndex) {
        controller.songIndex = newId;
    }

    this.renderRowColoring();
};

// Optimization: Don't load Facebook comments until video is playing
View.prototype.tryLoadComments = function(playlist_id, title) {
    if (view.isPlaying()) {
        view.loadComments(playlist_id, title);
    } else {
        window.setTimeout(function() {
            view.tryLoadComments(playlist_id, title);
        }, 1000);
    }
};

View.prototype.loadComments = function(playlist_id, title) {
    $('#commentsDiv').remove();
    $('<div id="commentsDiv"><section id="comments"></section></div>')
        .appendTo('#devNull');
    $('#addComment').html('Add a comment +');
    
    // Load Facebook comment box
    $('#comments')
        .html('<h4>Add a comment...</h4><fb:comments numposts="5" width="485" simple="1" publish_feed="true" css="http://instant.fm/fbcomments.css?53" notify="true" title="'+title+'" xid="playlist_'+playlist_id+'"></fb:comments>');
    FB.XFBML.parse(document.getElementById('comments'), function(reponse) {
        controller.commentsHeight = $('#commentsDiv').height();
        $('#commentsDiv')
            .hide()
            .css({height: 0});
        $('#commentsDiv')
            .data('loaded', true)
            .appendTo('#curPlaylistInfo');
    });
    
    // Resize comment box on comment
    FB.Event.subscribe('comments.add', function(response) {
        $('#commentsDiv').height('auto'); // default
        
        // Update the stored height of the comment box after it's had time to resize
        // (I think that Facebook autoresizes the iframe)
        window.setTimeout(function() {
            controller.commentsHeight = $('#commentsDiv').height();
        }, 1000);
    });
}


/* Player */

// Initialize the YouTube player
View.prototype.initPlayer = function(firstVideoId) {
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
    '&version=3&hd=1&color1=0xFFFFFF&color2=0xFFFFFF',
    'player', '480', '295', '8', null, null, params, atts);
};

// Play video with given id
View.prototype.playVideoById = function(id) {
    if (this.player) {
        view.player.loadVideoById(id, 0, 'hd720');
        view.player.setVolume(view.volume);
    } else {
        if (!this.isPlayerInit) {
            this.initPlayer(id);
        }
    }
};

View.prototype.play = function() {
    view.player && view.player.playVideo();
};

View.prototype.pause = function() {
    view.player && view.player.pauseVideo();
};

View.prototype.playPause = function() {
    if (!view.player) {
        return;
    }
    if (view.isPlaying()) {
        view.pause();
    } else {
        view.play();
    }
};

View.prototype.isPlaying = function() {
    return this.player && (this.player.getPlayerState() == 1);
};

View.prototype.isPaused = function() {
    return this.player && (this.player.getPlayerState() == 2);
};

View.prototype.increaseVolume = function() {
    if (view.player.isMuted()) {
        view.player.unMute();
    }
    view.volume += 20;
    view.volume = (view.volume <= 100) ? view.volume : 100;
    
    view.player.setVolume(view.volume);
}

View.prototype.decreaseVolume = function() {
    view.volume -= 20;
    view.volume = (view.volume >= 0) ? view.volume : 0;
    
    view.player.setVolume(view.volume);
}

View.prototype.showSearch = function(event) {
    event && event.preventDefault();
    
    var backButton = browser.makeBackButton();
    
    var header = $('<header class="clearfix buttonHeader"></header>')
        .append(backButton)
        .append('<h2>Add Songs</h2>');
    
    var searchElem = $('<section id="search"></section>')
        .append(header)
        .append('<form id="searchBox"><input type="text" class="search" name="search"><input type="submit" class="submit" name="submit" value="Search"></form>')
        .append('<div id="artistResults" class="clearfix" style="display: none;"><h3>Artists</h3></div><div id="albumResults" class="clearfix" style="display: none;"><h3>Albums</h3></div><div id="trackResults" class="clearfix" style="display: none;"><h3>Songs</h3></div>');
    browser.push(searchElem);
    setupSearch(searchElem);
    
    window.setTimeout(function() {
        $('#searchBox .search').focus();
    }, 500);
        
    window.setTimeout(function() {
        $('.buttonHeader h2')
            .css('left', -1 * $('.backButton').width());
    }, 0);
}

View.prototype.showPop = function(url, name, height, width) {
    name = name || 'name';
    height = height || 450;
    width = width || 550;
    newwindow = window.open(url, name, 'height='+height+',width='+width);
    if (window.focus) {
        newwindow.focus();
    }
}


/* Misc */

// Open dialog that shows keyboard shortcuts
View.prototype.showHelpDialog = function() {
    event.preventDefault();
    controller.showDialog($('#help'), 'Keyboard Shortcuts');
};


/* Player Events */

function onYouTubePlayerReady(playerId) {
    view.player = document.getElementById(playerId);
    view.player.addEventListener("onStateChange", "onYouTubePlayerStateChange");
    
    // If the user manually changes the volume in the YouTube player,
    // we want to know about the change.
    window.setInterval(function() {
        view.volume = view.player.getVolume();
    }, 2000);
}

function onYouTubePlayerStateChange(newState) {
    switch(newState) {
        case 0: // just finished a video
            controller.playNextSong();
            break;
        case 1: // playing
        
            // Bugfix: Force first video play to be HD
            view.player.setPlaybackQuality('hd720');
            
            $('.playing').toggleClass('paused', false);
            if (controller.queuedVideo) {
                controller.playSongById(controller.queuedVideo);
                controller.queuedVideo = null;
            }
            break;
        case 2: // paused
            $('.playing').toggleClass('paused', true);
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
};
    
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
    
    this.savePlaylist('&songs='+encodeURIComponent(JSON.stringify(model.songs)));
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
}

Model.prototype.updateDesc = function(newDesc) {
    model.description = $.trim(newDesc);
    
    model.savePlaylist('&description='+model.description);
}

Model.prototype.savePlaylist = function(data) {
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
}



/* -------------------- UTILITY FUNCTIONS ----------------------- */


// Make an image that opens a fancyzoom lightbox when clicked on
// @thumbId - id of the thumbnail image
// @src - src of the image (is same for thumbnail and large)
// @alt - image alt text
// Note: This function expects an empty div in the page with the id thumbId+'Zoom'
function makeFancyZoomImg(thumbId, src, alt) {
    var imgZoom = $('<img alt="'+alt+'" src="'+src+'" />');
    $('#'+thumbId+'Zoom').empty().append(imgZoom);
    
    return $('<a class="reflect" href="#'+thumbId+'Zoom" id="'+thumbId+'"></a>')
               .append('<img alt="'+alt+'" src="'+src+'">')
               .append('<span class="zoomIcon"></span>')
               .fancyZoom($.extend({}, appSettings.fancyZoom, {closeOnClick: true, scaleImg: true}));
}

function makeSeeMoreLink(onclick, _text) {
    _text = _text || 'see more';
    return $('<a class="seeMore" href="#seeMore">('+_text+')</a>').click(onclick);
}

function makeEditLink(onclick) {
    return $('<a class="editLink" href="#edit">Edit</a>')
        .click(onclick);
}

function showThrobber(show) {
    if (show) {
        $('<div id="throbber"><img src="/images/throbber.gif"></div>')
            .appendTo('#uploadDiv');
    } else {
        $('#throbber').remove();
    }
}

// Remove unecessary parenthesized text from song titles. It messes up YouTube/Last.fm searches.
function cleanSongTitle(title) {
    return title.replace(/[\(\[]((feat|ft|produce|dirty|clean)|.*?(version|edit)).*?[\)\]]/gi, '');
};

// Prepare Remove all html tags
function cleanHTML(html) {
    var r = new RegExp('</?\\w+((\\s+\\w+(\\s*=\\s*(?:".*?"|\'.*?\'|[^\'">\\s]+))?)+\\s*|\\s*)/?>', 'gi');   
    return html
        .replace(r, '') // Remove HTML tags (http://bit.ly/DdoNo)
        .replace(new RegExp('[\n\r]', 'g'), '<br>'); // Convert newlines to <br>
};

function getCookie(name) {
    var r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
    return r ? r[1] : undefined;
};

function htmlEncode(value){ 
  return $('<div/>').text(value).html(); 
} 

function htmlDecode(value){ 
  return $('<div/>').html(value).text(); 
}