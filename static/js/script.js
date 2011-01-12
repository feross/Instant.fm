var player;
var browser;
var model;

var playlistview;
var viewStack = [];

// jQuery.fx.off = true;

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
};

/* ------------------------- INHERITANCE ------------------------- */
// A bizarre function to make Javascrip's inheritance less incomprehensible
function copyPrototype(descendant, parent) {
    var sConstructor = parent.toString();
    var aMatch = sConstructor.match( /\s*function (.*)\(/ );
    if ( aMatch != null ) { descendant.prototype[aMatch[1]] = parent; }
    for (var m in parent.prototype) {
        descendant.prototype[m] = parent.prototype[m];
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
    
    setupPlaylistDisplay();
    setupPlayerHoverButtons();
    setupKeyboardShortcuts();
    setupFBML(initial_playlist);
    setupPlaylistActionButtons();
    setupNavigationLinks();

    $('#helpLink').fancyZoom(appSettings.fancyZoom);
    
    window.onpopstate = onPopState;
    $(window).resize(setupPlaylistDisplay);
    
    setupDragDropUploader('p', player.loadPlaylist);
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
    $('#showHideVideo').click(function(event) {
        event.preventDefault();
        player.showHideVideo();
    });
}

function setupPlaylistDisplay() {
    var maxPlaylistHeight = $(window).height() - (50 + $('#videoDiv').height()); /* header, player */
    var newHeight = Math.min($('#playlist').height(), maxPlaylistHeight);
    $('#playlistDiv').height(newHeight);
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
                    player.showHideVideo();
                    break;

                // Playlist editing
                case 65: // a
                    (new SearchView()).push();
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
                    player.showCurrentSong();
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
            log('blocked default event');
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

function setupNavigationLinks() {
    $('#signUp').click(function(event) {
        event.preventDefault();
        browser.pushStatic('signup.html', 'Sign Up', {});
    });
}

function setupDragDropUploader(dropId, callback) {
    new uploader(dropId, null, '/upload', null, callback); // HTML5 dragdrop upload
}


/* --------------------------- SOCIAL FEATURES ----------------------------- */

function shareOnFacebook() {
    FB.ui(
      {
        method: 'feed',
        name: model.title,
        link: 'http://instant.fm/p/'+model.playlistId,
        picture: playlistview.bestAlbumImg || 'http://instant.fm/images/unknown.png',
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

function getTopView() {
  return viewStack[viewStack.length-1];
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

// Re-calculate the browser's slide width and number of slides
MiniBrowser.prototype.refreshContents = function() {
    // width of slide + margin-right of slide
    this.sliderWidth = $('#FS_slider').width() + 50;
    this.numSlides = $('#FS_holder .slide').length;
};

// Push a new element onto the browser. If a title is specified, then we'll show
// a title header with a back button.
MiniBrowser.prototype.push = function(elem, _title, context) {
    context.content = elem;
    
    var title = _title || '';
    var backButton = browser._makeBackButton();

    var header = $('<header class="clearfix buttonHeader"></header>')
        .append(backButton)
        .append('<h2>'+title+'</h2>');
    $(elem).prepend(header);
    
    $(elem).appendTo('#FS_holder');

    window.setTimeout(function() {
        $('.buttonHeader h2', elem)
            .css('left', -1 * $('.backButton', elem).width());
        context.willSlide();
    }, 0);
    
    window.setTimeout(function() {
      // Tell context to do anything it has to now that content is in DOM
      context.didSlide();
    }, 550);
        
    this.refreshContents();
    this._slideTo(this.numSlides);
};

// Push a static HTML file onto the browser.
// Options:
//  beforeVisible - callback function to execute after we've received the partial from
//                  the server and pushed it onto the browser, but before it's visible
//  afterVisible  - callback function to execute after the partial is fully slided into view
MiniBrowser.prototype.pushStatic = function(path, _title, context, _options) {
    var options = _options || {};
    $.get(path, options.params, function(data, textStatus, xhr) {
        var slide = $(data);
        log(getTopView()); // Associate the element with its view controller
        browser.push(slide, _title, context);
        
        // Invoke the function and set 'this' to be context.
        options.beforeVisible && options.beforeVisible.apply(context);
        
        if (options.afterVisible) {
            window.setTimeout(function() {
                
                // Invoke the function and set 'this' to be context.
                options.afterVisible.apply(context);
            }, 550);
        }
    });
};

// Fetch a partial from the server, push it onto the minibrowser.
MiniBrowser.prototype.pushPartial = function(path, _title, context, _options) {
    this.pushStatic('/partial/' + path, _title, context, _options);
};

// Pop the top-most page off of the browser.
MiniBrowser.prototype.pop = function() {
    // Tell the view controller it's going to be popped, then pop it
    getTopView().willHide();
    getTopView().willPop();
    viewStack.pop();
    
    if (browser.numSlides <= 1) {
        return;
    }
    browser._slideTo(browser.numSlides - 1);
    window.setTimeout(function() {
        $('#FS_holder .slide').last().remove();
        browser.refreshContents();
    }, 800);
};

// Private function used to animate the transition between pages in the browser.
MiniBrowser.prototype._slideTo = function(slide) {
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
	    // If you animate left, IE breaks.
		$("#FS_holder").animate({"margin-left":"-"+pixels+"px"},600);
	}		
};

// Private function used to make a back button for browser navigation.
MiniBrowser.prototype._makeBackButton = function(text) {
    text = text || 'Back';
    
    var button = $('<a href="#back" class="backButton awesome">'+text+'</a>');
    button.click(function(event) {
        event.preventDefault();
        browser.pop();
    });
    
    return button;
};

/* ---------------------------- BASE VIEW ---------------------------- */

/* All views should extend this one! See SearchView for how to do that.*/
function BaseView() {};
BaseView.prototype.getNameOfPartial = function() {
    log('Must override getNameOfPartial() in view controller!');
    return '';
};
BaseView.prototype.getTitle = function() {
    log('Must override getTitle() in view controller!');
    return '';
};

/* Called before animation starts to either push a new view (hiding this 
 * one), or pop this one.
 */
BaseView.prototype.willHide = function() {};

/* Called after content is added to DOM but before animation. */
BaseView.prototype.willSlide = function() {};

/* Called after the content is added to the DOM */
BaseView.prototype.didSlide = function() {};
  
/* Called immediately before the view is popped.
 * I can't think of any circumstance when we'll use this, but might as 
 * well have it. 
 */
BaseView.prototype.willPop = function() {};
  
BaseView.prototype.push = function(event) {
    event && event.preventDefault();
    if (model.editable) {
      // Push onto view stack
      viewStack.push(this);
      browser.pushPartial(this.getNameOfPartial(), this.getTitle(), this); 
    }
};

/* --------------------------- SEARCH VIEW --------------------------- */


function SearchView() {
    this.prevSearchString = ''; // Used to prevent repeating identical searches
    this.delaySearch = false; // Used to force a delay between searches
};
copyPrototype(SearchView, BaseView);

SearchView.prototype.getNameOfPartial = function() {
    return 'search';
}

SearchView.prototype.getTitle = function() {
    return 'Add Songs';
}

SearchView.prototype.willSlide = function() {
    this._addSearchHandlers();
}

SearchView.prototype.didSlide = function() {
    $('.searchBox input.search', this.content).focus();
}

// Perform a search for given search string
SearchView.prototype.search = function(searchString) {
    log('Searching for "' + searchString + '"');
    if (!searchString) {
        return;
    }

    this.prevSearchString = searchString;

    var that = this;
    model.lastfm.artist.search({
        artist: searchString,
        limit: 3,
    },
    {
        success: function(data) {
            that.handleArtistSearchResults(data);
        },
        error: function(code, message) {
            log(code + ' ' + message);
            that.renderArtists([]);
        }
    });

    model.lastfm.album.search(
    {
        album: searchString,
        limit: 3,
    },
    {
        success: function(data) {
            that.handleAlbumSearchResults(data);
        },
        error: function(code, message)
        {
            log(code + ' ' + message);
            that.renderAlbums([]);
        }
    });

    model.lastfm.track.search(
    {
        track: searchString,
        limit: 10,
    },
    {
        success: function(data) {
            that.handleSongSearchResults(data);
        },
        error: function(code, message)
        {
            log(code + ' ' + message);
            that.renderSongs([]);
        }
    }
    )
};


SearchView.prototype.handleArtistSearchResults = function(data) {
    var artists = [];
    var artistResults = data && data.results && data.results.artistmatches && data.results.artistmatches.artist;
    
    if (!artistResults) {
        this.renderArtists([]);
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
    }

    this.renderArtists(artists);
};

/* Takes an array of objects with properties 'name', 'image' 
 * If there is no image, image will be the empty string. 
 */
SearchView.prototype.renderArtists = function(artists) {
    if(!artists.length) {
        $('.artistResults', this.content).hide();
    } else {
        $('.artistResult', this.content).remove();
        $('.artistResults', this.content).show();
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
            .appendTo($('.artistResults', this.content));
    }
};

SearchView.prototype.handleAlbumSearchResults = function(data) {
  var albums = [];
  var albumResults = data && data.results && data.results.albummatches && data.results.albummatches.album;
  
  if (!albumResults) {
    this.renderAlbums([]);
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
  
  this.renderAlbums(albums);
};

/* Takes an array of objects with properties 'name', 'artist', 'image' 
 * If there is no image, image will be the empty string. 
 */
SearchView.prototype.renderAlbums = function(albums) {
    if (!albums.length) {
        $('.albumResults', this.content).hide();
    } else {
        $('.albumResult', this.content).remove();
        $('.albumResults', this.content).show();
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
        .appendTo($('.albumResults', this.content));
    }
};

SearchView.prototype.handleSongSearchResults = function(data) {
  var tracks = [];
  var trackResults = data && data.results && data.results.trackmatches && data.results.trackmatches.track;
  
  if (!trackResults) {
    this.renderSongs([]);
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
  
  this.renderSongs(tracks);
};

/* Takes an array of objects with properties 'name', 'artist', 'image' 
 * If there is no image, image will be the empty string. 
 */
SearchView.prototype.renderSongs = function(tracks) {
    if(!tracks.length) {
        $('.trackResults', this.content).hide();
    } else {
        $('.trackResult', this.content).remove();
        $('.trackResults', this.content).show();
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
            .click(function() {
                player.addSongToPlaylist(track.name, track.artist);
            })
            .appendTo($('.trackResults', this.content));
    }
};

// Private function that adds handlers to the search box and makes it all work
SearchView.prototype._addSearchHandlers = function() {
    var searchInput = $('.searchBox input.search', this.content);
    
    // Hits enter to submit form
    var that = this;
    $('.searchBox', this.content).submit(function(event) {
        event.preventDefault();
        that._handleSearch(searchInput.val());
    });
    
    // Pushes a key
    searchInput.keyup(function() {
        that._handleSearch.apply(that, [searchInput.val()]);
    });
    addFocusHandlers(searchInput);
    
    // Clicks search button
    $('.searchBox input.submit', this.content).click(function(event) {
        event && event.preventDefault();
        that._handleSearch(searchInput.val());
    });
};

SearchView.prototype._handleSearch = function(searchString) {
    log('called handlesearch');
    if (!this.delaySearch && (this.prevSearchString != searchString)) {
        log('Handling a search');
        this.prevSearchString = searchString;
        this.search(searchString);
        
        // Don't allow another search for 500ms.
        this.delaySearch = true;
        var that = this;
        window.setTimeout(function() {
            that.delaySearch = false;
            
            var searchInput = $('.searchBox input.search', that.content);
            if (searchInput.val() != searchString) {
                that._handleSearch(searchInput.val());
            }
        }, 500);
    }
};


/* ------------------- CURRENTLY PLAYING VIEW -------------------- */

function PlaylistView() {
    this.bestAlbumImg; // Use first non-blank album as share image
    this.commentsHeight; // Height of Facebook comment box. Used to smooth the animation.
    
}


// Update the currently playing song with Last.fm data
// @t - song title
// @a - song artist
// @srcIndex - Song index that generated this Last.fm request. We'll check that the song
//              hasn't changed before we update the DOM.
PlaylistView.prototype.updateCurPlaying = function(t, a, srcIndex) {

    // 1. Search for track.
	model.lastfm.track.search({
	    artist: a,
	    limit: 1,
	    track: t
	}, {
	    success: function(data) {
	      playlistview._handleSongResults(t, a, srcIndex, data);
	    },
	    error: function(code, message) {
	        log(code + ' ' + message);
	        $('#curSong h4').text(t);
            $('#curArtist h4').text(a);
            playlistview._updateAlbumImg(null);
            playlistview._hideCurPlayling();
		}
	});
};

// Private method to hide the currently playing info with animation
PlaylistView.prototype._hideCurPlayling = function() {
    if ($('#curAlbum').css('display') != '0') {
        $('#curAlbum').fadeOut('fast');
    }
    if ($('#curSongDesc').css('display') != '0') {
        $('#curSongDesc').fadeOut('fast');
    }
    if ($('#curArtistDesc').css('display') != '0') {
        $('#curArtistDesc').fadeOut('fast');
    }
}

// Private method to handle song search results from Last.fm
PlaylistView.prototype._handleSongResults = function(t, a, srcIndex, data) {
    if (songIndex != srcIndex) {
        return; // The request was too slow. We don't need it anymore.
    }
    if (!data.results || !data.results.trackmatches || !data.results.trackmatches.track) {
        this.error('track.search', 'Empty set.');
        return;
    }

    playlistview._hideCurPlayling(); 

    var track = data.results.trackmatches.track;
    var trackName = track.name || t;
    var artistName = track.artist || a;
    var albumImg = track.image && track.image[track.image.length - 1]['#text'];

    // Update song title, artist name
    $('#curSong h4').text(trackName);
    $('#curArtist h4').text(artistName);

    // Update album art
    // We'll set alt text once we know album name
    playlistview._updateAlbumImg(albumImg, ''); 

    // 2. Get detailed track info
    trackName && artistName && model.lastfm.track.getInfo({
	    artist: artistName,
	    autocorrect: 1,
	    track: trackName
	}, {
    
	    success: function(data){
	        playlistview._handleSongInfo(trackName, artistName, srcIndex, data);
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
	        playlistview._handleArtistInfo(artistName, srcIndex, data);
	    },
	    error: function(code, message) {
	        log(code + ' ' + message);
		}
	});
};

// Private method to handle song information from Last.fm
PlaylistView.prototype._handleSongInfo = function(trackName, artistName, srcIndex, data) {
    if (songIndex != srcIndex) {
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
        $('#curSongDesc h4').text(track.name);
        $('#curSongDesc').fadeIn('fast');
    }

    // Add link to longer description
    if (trackSummary && trackLongDesc) {
        var longContent = cleanHTML(trackLongDesc);
        
        $('#curSongDesc article')
            .data('longContent', longContent)
            .data('shortContent', shortContent);
        
        var link = makeSeeMoreLink(onShowMoreText);
        $('#curSongDesc article').append(' ').append(link);
    }
}

// Private method to handle artist information from Last.fm
PlaylistView.prototype._handleArtistInfo = function(artistName, srcIndex, data) {
    if (songIndex != srcIndex) {
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
    playlistview._updateArtistImg(artistImg, artistName);

    // Update artist summary
    var shortContent;
    if (artistSummary) {                  
        shortContent = cleanHTML(artistSummary);
        $('#curArtistDesc article').html(shortContent);
        $('#curArtistDesc h4').text(artistName);
        $('#curArtistDesc').fadeIn('fast');
    }

    // Add link to longer description
    if (artistSummary && artistLongDesc) {
        var longContent = cleanHTML(artistLongDesc); 
        
        $('#curArtistDesc article')
            .data('longContent', longContent)
            .data('shortContent', shortContent);
                                                       
        var link = makeSeeMoreLink(onShowMoreText);
        $('#curArtistDesc article').append(' ').append(link);
    }
}

// Private method to update album art to point to given src url
// @src - Image src url. Pass null to show the Unknown Album image.
// @alt - Image alt text. (required, when src != null)
PlaylistView.prototype._updateAlbumImg = function(src, alt) {
    playlistview.bestAlbumImg = playlistview.bestAlbumImg || src;
    
    if (!src) {
        src = '/images/unknown.png';
        alt = 'Unknown album';
    }
    var imgBlock = makeFancyZoomImg('curAlbumImg', src, alt);
    $('#curAlbumImg').replaceWith(imgBlock);
};

// Private method to update artist img to point to given src url
// @src - Image src url. Pass null to show nothing.
// @alt - Image alt text. (required, when src != null)
PlaylistView.prototype._updateArtistImg = function(src, alt) {    
    if (src) {
        var imgBlock = makeFancyZoomImg('curArtistImg', src, alt);  
        $('#curArtistImg').replaceWith(imgBlock);
    
    } else {
        $('#curArtistImg').replaceWith($('<span id="curArtistImg"></span>'));
    }
};

// Optimization: Don't load Facebook comments until video is playing
PlaylistView.prototype.tryLoadComments = function(playlist_id, title) {
    if (player.isPlaying()) {
        playlistview._loadComments(playlist_id, title);
    } else {
        window.setTimeout(function() {
            playlistview.tryLoadComments(playlist_id, title);
        }, 1000);
    }
};

// Private method to load playlist's comments
PlaylistView.prototype._loadComments = function(playlist_id, title) {
    $('#commentsDiv').remove();
    $('<div id="commentsDiv"><section id="comments"></section></div>')
        .appendTo('#devNull');
    $('#addComment').html('Add a comment +');
    
    // Load Facebook comment box
    $('#comments')
        .html('<h4>Add a comment...</h4><fb:comments numposts="5" width="485" simple="1" publish_feed="true" css="http://instant.fm/fbcomments.css?53" notify="true" title="'+title+'" xid="playlist_'+playlist_id+'"></fb:comments>');
    FB.XFBML.parse(document.getElementById('comments'), function(reponse) {
        playlistview.commentsHeight = $('#commentsDiv').height();
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
            playlistview.commentsHeight = $('#commentsDiv').height();
        }, 1000);
    });
};


// Makes the given element editable by adding an edit link.
// @elem - the element to make editable
// @updateCallback - the function to call when the value is modified
PlaylistView.prototype._makeEditable = function(elem, updateCallback) {    
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
            keyEvents = false;
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

PlaylistView.prototype.showHideComments = function() {
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
            .animate({height: playlistview.commentsHeight}, {duration: 'slow'});
    }
};


/* -------------------------- PLAYER CONTROL ------------------------ */

function Player() {
    this.isPlayerInit = false; // have we initialized the player?
    this.ytplayer = null; // YouTube DOM element
    this.renderPlaylistChunkSize = 400; // Render playlist in chunks so we don't lock up
    this.renderPlaylistTimeout = 100; // Time between rendering each chunk
    this.volume; // Player volume
    this.reorderedSong = false; // Used to distinguish between dragging and clicking
    this.queuedVideo; // Used when player is in loading state so we don't interrupt it.
    
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

    $('.playing').toggleClass('playing');
    $('#song' + i).toggleClass('playing');

    playlistview.updateCurPlaying(title, artist, songIndex);
    player.moveSongIntoView();
};

// Play next song in the playlist
Player.prototype.playNextSong = function() {
    if (songIndex == model.songs.length - 1) {
        return;
    }
    player.playSong(++songIndex);
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
        scrollTo('.playing', '#playlistDiv', false, true);
    } else if (relativeScrollDistance > $('#playlistDiv').height() - $('.playing').height()) {
        scrollTo('.playing', '#playlistDiv', true, true);
    }
}

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
                    if (songIndex == srcIndex) {
                        player.playNextSong();
                    }
                }, 4000);
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
        player.ytplayer.setVolume(player.volume);
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

Player.prototype.showHideVideo = function() {
    var $videoDiv = $('#videoDiv');
    if ($videoDiv.hasClass('noVideo')) {
        $('#videoDiv').removeClass('noVideo');
    } else {
        $('#videoDiv').addClass('noVideo');
    }
    if (Modernizr.csstransitions) {
        var animateResize = function(numCalls) {
            log('animate');
            if (numCalls < 80) {
                setupPlaylistDisplay();
                window.setTimeout(function() {
                    animateResize(++numCalls);
                }, 10);
            }
        }
        animateResize(0);
    } else {
        setupPlaylistDisplay();
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

Player.prototype.addSongToPlaylist = function(title, artist) {
    log(title + ' - ' + artist);
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
        $('#infoDisplay').effect('pulsate');
    }

    model.updatePlaylist(playlist);
    player.renderPlaylist(playlist);

    player.playSong(0);
    log('Loaded playlist: ' + playlist.playlist_id);
};

// Load a playlist with the given id
Player.prototype.loadPlaylistById = function(id) {
    var the_url = '/p/'+id+'/json';
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
Player.prototype.renderPlaylist = function(playlist, start) {
    if (!start) { // only run this the first time
        start = 0;
        
        $('#playlist li').remove(); // clear the playlist
        $('.editLink').remove(); // remove all edit links
        $('#addSong').remove(); // remove the add button (if it exists)
        
        $('#curPlaylistTitle')
            .text(playlist.title);
        $('#curPlaylistDesc')
            .text(playlist.description);
        
        if (playlist.editable) {
            playlistview._makeEditable($('#curPlaylistTitle'), model.updateTitle);
            playlistview._makeEditable($('#curPlaylistDesc'), model.updateDesc);
            
            $('<a href="#addSongs" id="addSongs" class="forwardButton awesome">Add songs +</a>')
                .click(function(event) { (new SearchView()).push(); event.preventDefault(); })
                .prependTo('#curPlaylistInfo header');
        }
        
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
                        player.onPlaylistReorder(event, ui);
                        $('body').toggleClass('sorting', false);
                    },
                    tolerance: 'pointer'
                })
        }
            
        $('#playlist').disableSelection().mouseup(function(event) {
            player.reorderedSong = null; // we're done dragging now
        });

        player.renderRowColoring();
        return;
    }

    var end = Math.min(start + player.renderPlaylistChunkSize, playlist.songs.length);

    for (var i = start; i < end; i++) {
        var v = playlist.songs[i];
        $('<li id="song'+i+'"><span class="title">'+v.t+'</span><span class="artist">'+v.a+'</span><span class="handle">&nbsp;</span></li>')
            .appendTo('#playlist')
            .click(function(event) {
                var songId = parseInt($(this).attr('id').substring(4));
                player.reorderedSong || player.playSong(songId);
            });
    }

    window.setTimeout(function() {
        player.renderPlaylist(playlist, start + player.renderPlaylistChunkSize);
    }, player.renderPlaylistTimeout);
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
Player.prototype.showCurrentSong = function() {
    scrollTo('.playing', '#playlistDiv');
    $('.playing').effect('pulsate');
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
            player.playNextSong();
            break;
        case 1: // playing
        
            // Bugfix: Force first video play to be HD
            player.ytplayer.setPlaybackQuality('hd720');
            
            $('.playing').toggleClass('paused', false);
            if (player.queuedVideo) {
                player.playSongById(player.queuedVideo);
                player.queuedVideo = null;
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

// Show a popup window
function showPop(url, _name, _height, _width) {
    var name = _name || 'name';
    var height = _height || 450;
    var width = _width || 550;
    var newwindow = window.open(url, name, 'height='+height+',width='+width);
    if (window.focus) {
        newwindow.focus();
    }
}

// Scroll element into view
function scrollTo(selectedElem, _container, _scrollAtBottom, _noAnimation) {
    var container = _container || 'html,body';
    
    var relativeScrollDistance = $(selectedElem).position().top - $(container).position().top;
    var absScrollTop = $(container).scrollTop() + relativeScrollDistance;
    
    if (_scrollAtBottom) {
        absScrollTop += ($(selectedElem).height() - $(container).height());
    }
    
    if (_noAnimation) {
        $(container).scrollTop(absScrollTop);
    } else {
        $(container).animate({scrollTop: absScrollTop}, 500);
    }
}

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