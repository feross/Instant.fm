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

    this.setupHandlers();
    this.refreshContents();
};

MiniBrowser.prototype.setupHandlers = function() {
    // Link handlers for loading partials.
    $('a[rel~="partial"]').live('click', function(event) {
        event.preventDefault();
        browser.pushPartial($(this).attr('href'), $(this).attr('rel'), $(this).attr('title'), {link: $(this)});
    });
    
    // Link handlers for the back button.
    $('a.backButton').live('click', function(event) {
        event.preventDefault();
        browser.pop();
    });
};

// Re-calculate the browser's slide width and number of slides
MiniBrowser.prototype.refreshContents = function() {
    // width of slide + margin-right of slide
    this.sliderWidth = $('#FS_slider').width() + 50;
    this.numSlides = $('#FS_holder .slide').length;
};

// Fetch a partial from the server, push it onto the minibrowser.
MiniBrowser.prototype.pushPartial = function(path, type, title, _options) {
    	
	var delimeter = (path.indexOf('?') == -1) ? '?' : '&';
	var newPath = path + delimeter + 'partial=true';
	
	this.pushStatic(newPath, title, $.extend(_options, {createView: function() {
		// Push matching "view" onto minibrowser
		var view;
		switch(type) {
			case 'partial search':
				view = new SearchView();
				break;
			case 'partial artist':
				view = new ArtistView(title);
				break;
			case 'partial album':
				log('push album ' + title);
				break;
			case 'partial lyric':
			    var $link = $(_options.link);
			    view = new LyricView($link.attr('data-title'), $link.attr('data-artist'));
			    break;
		}
		return view;
	}}));
};

// Push a static HTML file onto the browser.
MiniBrowser.prototype.pushStatic = function(path, title, _options) {
    var options = _options || {};
    $.get(path, null, function(data, textStatus, xhr) {
        var slide = $(data);
        browser.push(slide, title, options.createView);
    });
};

// Push a new element onto the browser. If a title is specified, then we'll show
// a title header with a back button.
MiniBrowser.prototype.push = function(elem, _title, _createView) {
    var prevView = getTopView();
    prevView && prevView.willHide();

    $(elem).appendTo('#FS_holder');

	var view;
	if (_createView) {
		view = _createView();
		if (view) {
		    view.content = elem;
			viewStack.push(view);
			view.willSlide();  // Tell the view to do anything it has to now that content is in DOM
		} else {
			log('Warning: All partials must create a view and push it onto the viewStack. ('+_title+')')
		}
	} else {
		log('Warning: All partials must define a createView function. ('+_title+')')
	}

    // window.setTimeout(function() {
    //     $('.buttonHeader h2', elem)
    //         .css('left', -1 * $('.backButton', elem).width());
    // }, 0);
        
    this.numSlides++;
    this._slideTo(this.numSlides);
    
    this._updateToolbar(_title);
    
    window.setTimeout(function() {
      view && view.didSlide();
    }, 300);
};

// Pop the top-most page off of the browser.
MiniBrowser.prototype.pop = function() {
    if (!getTopView() || browser.numSlides <= 1) {
        return;
    }
    // Tell the view controller it's going to be popped, then pop it
	var view = getTopView();
    view.willHide();
    view.willPop();
    viewStack.pop();
    
	browser.numSlides--;
    browser._slideTo(browser.numSlides);
	window.setTimeout(function() {
		$(view.content).remove();
	}, 300);
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
		$("#FS_holder").animate({"margin-left":"-"+pixels+"px"}, 300);
	}		
};

// Private function used to make a back button for browser navigation.
MiniBrowser.prototype._makeBackButton = function(text) {
    text = text || 'Back';
    
    return $('<a href="#back" class="backButton awesome">'+text+'</a>')
		.click(function(event) {
	        event.preventDefault();
			event.stopPropagation(); // Not sure why, but without this, clicking back causes two pops.
	        browser.pop();
	    });
};

MiniBrowser.prototype._updateToolbar = function(_title) {
    var title = _title || '';
    $('#browserDisplay h1').text(title);
    
    // var backButton = browser._makeBackButton();
};


/* ---------------------------- BASE VIEW ---------------------------- */

/* All views should extend this one! */
function BaseView() {};

BaseView.prototype.getPartialName = function() {
    log('Must override getPartialName() in view controller!');
    return '';
};

/* Called after content is added to DOM but before animation. */
BaseView.prototype.willSlide = function() {
    
};

/* Called after the content is slid fully into view */
BaseView.prototype.didSlide = function() {};

/* Called before animation starts to either push a new view (hiding this 
 * one), or pop this one.
 */
BaseView.prototype.willHide = function() {
    $('input, textarea', this.content).blur();
};
  
/* Called immediately before the view is popped.
 * I can't think of any circumstance when we'll use this, but might as 
 * well have it. 
 */
BaseView.prototype.willPop = function() {};


function getTopView() {
  return viewStack[viewStack.length - 1];
}


/* --------------------------- SEARCH VIEW --------------------------- */

function SearchView() {
    this.prevSearchString = ''; // Used to prevent repeating identical searches
    this.delaySearch = false; // Used to force a delay between searches
}
copyPrototype(SearchView, BaseView);

SearchView.prototype.getPartialName = function() {
    return 'search';
};

SearchView.prototype.willSlide = function() {
    this._addSearchHandlers();
};

SearchView.prototype.didSlide = function() {
    $('.searchBox input.search', this.content).focus();
};

SearchView.prototype.willHide = function() {
    this.BaseView.prototype.willHide();
};

// Private function that adds handlers to the search box
SearchView.prototype._addSearchHandlers = function() {
    var searchInput = $('.searchBox input.search', this.content);
    
    // Hits enter to submit form
    var that = this;
    $('.searchBox', this.content).submit(function(event) {
        event.preventDefault();
        that._handleSearch(searchInput.val());
    });
    
    // Pushes a key
    searchInput.keyup(function(event) {
		that._handleSearch.apply(that, [searchInput.val()]);
    });
    
    // Clicks search button
    $('.searchBox input.submit', this.content).click(function(event) {
        event && event.preventDefault();
        that._handleSearch(searchInput.val());
    });
};

// Private function that handles search
SearchView.prototype._handleSearch = function(searchString) {
    if (!this.delaySearch && (this.prevSearchString != searchString)) {
        this.prevSearchString = searchString;
        if (searchString.length) {
            this.search(searchString);
        } else {
            $('.songResults', this.content).slideUp('fast');
	        $('.artistResults', this.content).slideUp('fast');
			$('.albumResults', this.content).slideUp('fast');
        }
        
        // Don't allow another search for a while.
        this.delaySearch = true;
        var that = this;
        window.setTimeout(function() {
            that.delaySearch = false;
            
            var searchInput = $('.searchBox input.search', that.content);
            if (searchInput.val() != searchString) {
                that._handleSearch(searchInput.val());
            }
        }, 800);
    }
};

// Perform a search for given search string
SearchView.prototype.search = function(searchString) {
    // log('Searching for "' + searchString + '".');
    if (!searchString) {
        return;
    }

    this.prevSearchString = searchString;

    var that = this;
    model.lastfm.track.search(
    {
        track: searchString,
        limit: 5,
    },
    {
        success: function(data) {
            that._handleSongSearchResults(data);
        },
        error: function(code, message) {
            log(code + ' ' + message);
            that.renderSongs([]);
        }
    });
    
    model.lastfm.artist.search({
        artist: searchString,
        limit: 3,
    },
    {
        success: function(data) {
            that._handleArtistSearchResults(data);
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
            that._handleAlbumSearchResults(data);
        },
        error: function(code, message) {
            log(code + ' ' + message);
            that.renderAlbums([]);
        }
    });
};

SearchView.prototype._handleSongSearchResults = function(data) {
    var tracks = [];
    var trackResults = data && data.results && data.results.trackmatches && data.results.trackmatches.track;

    if (!trackResults || !trackResults.length) {
        $('.songResults', this.content).slideUp('fast');
        return;
    }

    for (var i = 0; i < trackResults.length; i++) {
        var trackResult = trackResults[i];
        var track = {};

        track.t = trackResult.name;
        track.a = trackResult.artist;

        if (trackResult.image) {
            track.i = trackResult.image[0]['#text'];
        } else {
            track.i = '';
        }

        tracks.push(track);
    };

    $('.songResults ul', this.content).remove();
    
    var buttons;
    if (model.editable) {
        buttons = [{
            action: function(event, song) {
                player.addSongToPlaylist(song);
            },
            className: 'awesome small white',
            text: 'Add to Playlist'
        }];
    }
    var songlist = new SongList({
        songs: tracks,
        onClick: function(song) {
            $('.playing').removeClass('playing');
            $(this).addClass('playing');
            var q = song.t+' '+song.a;
            player.playSongBySearch(q);
        },
        buttons: buttons || [],
    });
    
    var $songResults = $('.songResults', this.content);
    songlist.render($songResults);
    $songResults.slideDown('fast');
};

SearchView.prototype._handleArtistSearchResults = function(data) {
    var artists = [];
    var artistResults = data && data.results && data.results.artistmatches && data.results.artistmatches.artist;
    
    if (!artistResults || !artistResults.length) {
        $('.artistResults', this.content).slideUp('fast');
        return;
    }

    for (var i = 0; i < artistResults.length; i++) {
        var artistResult = artistResults[i];
        var artist = {};

        artist.name = artistResult.name;
        artist.image = artistResult.image[2]['#text'];
        artist.image = artist.image.replace('serve/126', 'serve/126s');    

        artists.push(artist);
    }
    
    $('.artistResults div', this.content).remove();
    $('.artistResults', this.content)
        .append(makeArtistList(artists))
        .slideDown('fast');
};

SearchView.prototype._handleAlbumSearchResults = function(data) {
    var albums = [];
    var albumResults = data && data.results && data.results.albummatches && data.results.albummatches.album;

    if (!albumResults || !albumResults.length) {
        $('.albumResults', this.content).slideUp('fast');
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

    $('.albumResults div', this.content).remove();
    $('.albumResults', this.content)
        .append(makeAlbumList(albums))
        .slideDown('fast');
};


/* --------------------------- ARTIST VIEW --------------------------- */

function ArtistView(name) {
	this.name = name;
}
copyPrototype(ArtistView, BaseView);

ArtistView.prototype.getPartialName = function() {
    return 'artist';
};

ArtistView.prototype.willSlide = function() {
	this._fetchData();
	$('.name', this.content).text(this.name);
};

ArtistView.prototype.didSlide = function() {
};

ArtistView.prototype.willHide = function() {
    this.BaseView.prototype.willHide();
};

ArtistView.prototype._fetchData = function() {
	that = this;
    model.lastfm.artist.getInfo({
        artist: this.name,
        autocorrect: 1,
        limit: 1,
    },
    {
        success: function(data) {
            that._handleInfo(data);
        },
        error: function(code, message) {
            log(code + ' ' + message);
        }
    });
    model.lastfm.artist.getTopTracks({
        artist: this.name,
        autocorrect: 1,
    },
    {
        success: function(data) {
            that._handleTopSongs(data);
        },
        error: function(code, message) {
            log(code + ' ' + message);
        }
    });
    model.lastfm.artist.getTopAlbums({
        artist: this.name,
        autocorrect: 1,
    },
    {
        success: function(data) {
            that._handleTopAlbums(data);
        },
        error: function(code, message) {
            log(code + ' ' + message);
        }
    });
};

ArtistView.prototype._handleInfo = function(data) {
    var artist = data && data.artist;
	
    // log(artist);
	// TODO: show similar artists
	// TODO: show tags
    
	if (!artist) {
        $('.artistDesc article', this.content)
            .html('<p>No artist named "' + this.name + '" were found.</p>')
            .slideDown('fast');
        return;
    }
    
	var name = artist.name;
	$('.name', this.content).text(name);
	
    var artistSummary = artist.bio && artist.bio.summary;
    var artistLongDesc = artist.bio && artist.bio.content;
	
	// Update artist summary
    var shortContent;
    if (artistSummary) {                  
        shortContent = cleanHTML(artistSummary);
        $('.artistDesc article', this.content)
            .html(shortContent);
    }

    // Add link to longer description
    if (artistSummary && artistLongDesc) {
        var longContent = cleanHTML(artistLongDesc); 
        
        $('.artistDesc article', this.content)
            .data('longContent', longContent)
            .data('shortContent', shortContent);
                                                       
        var link = makeSeeMoreLink(onShowMoreText);
        $('.artistDesc article', this.content).append(' ').append(link);
    }
	
    var image = artist.image[artist.image.length - 1]['#text'];
 	this._updateArtistImg(image, name);
 	
 	$('.artistDesc', this.content).slideDown('fast');
};

ArtistView.prototype._handleTopSongs = function(data) {
    var songResults = data && data.toptracks && data.toptracks.track;
    log(songResults);
    if (!songResults || !songResults.length) {
        $('.songResults', this.content).slideUp('fast');
        return;
    }
    
    var songs = [];
    for (var i = 0; i < songResults.length; i++) {
        var songResult = songResults[i];
        var song = {};

        song.t = songResult.name;
        song.a = songResult.artist.name;
        song.i = songResult.image && songResult.image[2]['#text'];

        songs.push(song);
    };
    log(songs);
    
    var songlist = new SongList({
        songs: songs,
        onClick: function(song) {
            $('.playing').removeClass('playing');
            $(this).addClass('playing');
            var q = song.t+' '+song.a;
            player.playSongBySearch(q);
        },
        buttons: [{
            action: function(event, song) {
                player.addSongToPlaylist(song);
            },
            className: 'awesome small white',
            text: 'Add to Playlist'
        }],
    });
    
    var $songResults = $('.songResults', this.content)
    $songResults.find('div').remove();
    songlist.render($songResults);
    
    $songResults.slideDown('fast');
};

ArtistView.prototype._handleTopAlbums = function(data) {
    var albumResults = data && data.topalbums && data.topalbums.album;
    if (!albumResults || !albumResults.length) {
        $('.albumResults', this.content).slideUp('fast');
        return;
    }
    
    var albums = [];
    for (var i = 0; i < albumResults.length; i++) {
        var albumResult = albumResults[i];
        var album = {};

        album.name = albumResult.name;
        album.artist = albumResult.artist.name;
        album.image = albumResult.image[2]['#text'];

        albums.push(album);
    };
    $('.albumResults div', this.content).remove();
    $('.albumResults', this.content)
        .append(makeAlbumList(albums))
        .slideDown('fast'); 
};

ArtistView.prototype._updateArtistImg = function(src, alt) {
	if (src) {
        var imgBlock = $('<img alt="'+alt+'" src="'+src+'" />');
        $('.artistImg', this.content).empty().append(imgBlock);
    
    } else {
        $('.artistImg', this.content).replaceWith($('<span class="artistImg reflect"></span>'));
    }
};


/* ------------------- LYRIC VIEW -------------------- */

function LyricView(title, artist) {
	this.title = title;
	this.artist = artist;
}
copyPrototype(LyricView, BaseView);

LyricView.prototype.getPartialName = function() {
    return 'lyric';
};

LyricView.prototype.willSlide = function() {
    this._fetchData();
};

LyricView.prototype.didSlide = function() {
};

LyricView.prototype.willHide = function() {
    this.BaseView.prototype.willHide();
};

LyricView.prototype._fetchData = function() {
    var url = '/lyric/?a='+encodeURIComponent(this.artist)+'&t='+encodeURIComponent(this.title);
    log(url);
    $.ajax({
       type: 'GET',
       url: url,
       dataType: 'xml',
       success: function(data, textStatus, xhr) {
           alert(data);
       }
     });
};


/* ------------------- CURRENTLY PLAYING VIEW -------------------- */

function PlaylistView() {
    this.commentsHeight; // Height of Facebook comment box. Used to smooth the animation.
}


// Update the currently playing song with Last.fm data
// @t - song title
// @a - song artist
// @srcIndex - Song index that generated this Last.fm request. We'll check that the song
//              hasn't changed before we update the DOM.
PlaylistView.prototype.updateCurPlaying = function(t, a, srcIndex) {
	model.lastfm.track.search({
	    artist: a || '',
	    limit: 1,
	    track: t || ''
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
    if ($('.artistDesc', '#curPlaying').css('display') != '0') {
        $('.artistDesc', '#curPlaying').fadeOut('fast');
    }
};

// Private method to handle song search results from Last.fm
PlaylistView.prototype._handleSongResults = function(t, a, srcIndex, data) {
    if (songIndex != srcIndex) {
        return; // The request was too slow. We don't need it anymore.
    }
    if (!data.results || !data.results.trackmatches || !data.results.trackmatches.track) {
        return;
    }

    playlistview._hideCurPlayling(); 

    var track = data.results.trackmatches.track;
    var trackName = track.name || t;
    var artistName = track.artist || a;
    var albumImg = track.image && track.image[track.image.length - 1]['#text'];

    // Update song title, artist name
    $('#curSong h4').text(trackName);
    playlistview._updateArtist(artistName);
    // Update album art
    // We'll set alt text once we know album name
    playlistview._updateAlbumImg(albumImg, '');
    
    if (model.songs[srcIndex].i === undefined && albumImg) {
        var $playlistImg = $('#song'+srcIndex+' img');
        if ($playlistImg.attr('src') == '/images/unknown.png') {
            // log('updated image in playlist');
            $playlistImg.attr('src', albumImg)
        }
        model.updateAlbumImg(srcIndex, albumImg);
    }

    // Get detailed track info
    trackName && artistName && model.lastfm.track.getInfo({
	    artist: artistName || '',
	    autocorrect: 1,
	    track: trackName || ''
	}, {
    
	    success: function(data){
	        playlistview._handleSongInfo(trackName, artistName, srcIndex, data);
	    },

	    error: function(code, message) {
	        log(code + ' ' + message);
		}
	});

	// Get detailed artist info (proceeds simultaneously with previous req)
	artistName && model.lastfm.artist.getInfo({
	    artist: artistName || '',
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
        return;
    }
                    
    var track = data.track;
    var artistName = track.artist && track.artist.name;
    var albumName = track.album && track.album.title;
    var trackSummary = track.wiki && track.wiki.summary;
    var trackLongDesc = track.wiki && track.wiki.content;
                    
    // Update album name
    if (albumName) {
        playlistview._updateAlbum(albumName, artistName);
        $('#curAlbum').fadeIn('fast');
    }

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
    
    // Add link to lyric
    playlistview._updateLyricsLink(trackName, artistName);
};

// Private method to handle artist information from Last.fm
PlaylistView.prototype._handleArtistInfo = function(artistName, srcIndex, data) {
    if (songIndex != srcIndex) {
        return; // The request was too slow. We don't need it anymore.
    }
    if (!data.artist) {
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
        $('.artistDesc article', '#curPlaying').html(shortContent);
        $('.artistDesc h4', '#curPlaying').text(artistName);
        $('.artistDesc', '#curPlaying').fadeIn('fast');
    }

    // Add link to longer description
    if (artistSummary && artistLongDesc) {
        var longContent = cleanHTML(artistLongDesc); 
        
        $('.artistDesc article', '#curPlaying')
            .data('longContent', longContent)
            .data('shortContent', shortContent);
                                                       
        var link = makeSeeMoreLink(onShowMoreText);
        $('.artistDesc article', '#curPlaying').append(' ').append(link);
    }
};

PlaylistView.prototype._updateArtist = function(artist) {
    var link = $('<a></a>', {
            href: '/'+canonicalize(artist),
            rel: 'partial artist',
            title: artist,
        })
        .html(artist);
    $('#curArtist h4').html(link);
};

PlaylistView.prototype._updateAlbum = function(album, artist) {
    var link = $('<a></a>', {
            href: '/'+canonicalize(artist)+'/'+canonicalize(album),
            rel: 'partial album',
            title: album
        })
        .html(album);
    $('#curAlbum h4').html(link);
};

PlaylistView.prototype._updateLyricsLink = function(title, artist) {
    var link = $('<a></a>', {
        'data-artist': artist,
        'data-title': title,
        href: '/lyric/', // TODO: This is a hack.
        rel: 'partial lyric',
        title: title+' by '+artist
    })
        .html('Get Lyrics');

    $('#curLyric').html(link);
};

// Private method to update album art to point to given src url
// @src - Image src url. Pass null to show the Unknown Album image.
// @alt - Image alt text. (required, when src != null)
PlaylistView.prototype._updateAlbumImg = function(src, alt) {
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
        }, 2000);
    }
};

// Private method to load playlist's comments
PlaylistView.prototype._loadComments = function(playlist_id, title) {
    $('#commentsDiv').remove();
    $('<div id="commentsDiv"><section id="comments"></section></div>')
        .appendTo('#devNull');
    $('#addComment').html('Add a Comment');
    
    // Load Facebook comment box
    $('#comments')
        .html('<h4>Add a comment...</h4><fb:comments numposts="5" width="480" simple="1" publish_feed="true" css="http://instant.fm/fbcomments.css?53" notify="true" title="'+title+'" xid="playlist_'+playlist_id+'"></fb:comments>');
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
            buttonClass = 'large awesome white';
            break;
        default:
            autogrowSettings = {
                expandTolerance: 0.1,
                lineHeight: 16,
                minHeight: 16,
            };
            buttonClass = 'small awesome white';
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
        $('#addComment').html('Add a Comment');
        $('#commentsDiv').animate({height: 0}, {duration: 'slow', complete: function() {
            $('#commentsDiv').hide();
        }});
    } else {
        $('#addComment').html('Hide Comments');
        $('#commentsDiv')
            .show()
            .animate({height: playlistview.commentsHeight}, {duration: 'slow'});
    }
};


/* -------------------------- REUSABLE LIST COMPONENTS ------------------------ */

// Takes an array of objects with properties 't', 'a', 'i' 
function SongList(options) {
    this.renderChunkSize = 500; // Render playlist in chunks so we don't lock up
    this.renderTimeout = 100; // Time between rendering each chunk
    
    this.songs = options.songs;
    this.onClick = options.onClick;
    this.buttons = options.buttons;
    this.id = options.id
    this.listItemIdPrefix = options.listItemIdPrefix;
    this.numberList = !!options.numberList;
    
    var that = this;
    this.buttonHelper = function(i, song, _songNum) {
        return function(event) {
            event.preventDefault();
            event.stopPropagation();
            that.buttons[i].action.apply(this, [event, song]);
        };
    };
}

SongList.prototype.render = function(addToElem, _callback) {
    this.elem = $('<ul></ul>')
        .disableSelection()
        .appendTo(addToElem);
        
    if (this.id) {
        this.elem.attr('id', this.id);
    }
    
    this._renderHelper(0, _callback);
};

SongList.prototype._renderHelper = function(start, _callback) {
    if (start >= this.songs.length) { // we're done
        _callback && _callback();
        return;
    }
    
    var end = Math.min(start + this.renderChunkSize, this.songs.length);    	
    for (var i = start; i < end; i++) {
        var song = this.songs[i];    
        var $newSongItem = this._makeItem(song, i);
        this.elem.append($newSongItem);
    }
    
    var that = this;
    window.setTimeout(function() {
        that._renderHelper(start + that.renderChunkSize, _callback);
    }, that.renderTimeout);
};

SongList.prototype._makeItem = function(song, _songNum) {
    var $buttonActions = $('<div class="songActions"></div>');
    for (var i = 0; i < this.buttons.length; i++) {
        $('<div></div>')
            .addClass(this.buttons[i].className)
            .text(this.buttons[i].text || '')
            .click(this.buttonHelper(i, song))
            .appendTo($buttonActions);
    }
    
    var that = this;
    var imgSrc = song.i ? song.i : '/images/unknown.png';
    var $songListItem = $('<li class="songListItem clearfix"></li>')
        .append(this.numberList ? '<div class="num">'+(_songNum+1)+'</div>' : '')
        .append('<img src="'+ imgSrc +'">') // No alt text. Want to avoid alt-text flash while img loads
        .append('<div class="songInfo"><span class="title">'+song.t+'</span><span class="artist">'+song.a+'</span></div>')
        .append($buttonActions)
        .click(function(event) {
            event.preventDefault();
            that.onClick.apply(this, [song, _songNum]);
        });
        
    if (_songNum !== undefined && this.listItemIdPrefix) {
        $songListItem.attr('id', this.listItemIdPrefix + _songNum);
    }
            
    return $songListItem;
};

// Add a new song to this songlist instance.
// Song needs to have 't' and 'a' attributes.
SongList.prototype.add = function(song) {
    var songNum = this.songs.length;
    var that = this;
    this._makeItem(song, songNum)
        .click(function(event) {
            event.preventDefault();
            that.onClick.apply(this, [song, songNum]);
        })
        .appendTo(this.elem);
};

// Try to fetch all the album art we can.
SongList.prototype.fetchAlbumImgs = function() {
    this.concurrentReqs = 0;
    for (this.albumUpdateInd = 0;
         this.albumUpdateInd < this.songs.length && this.concurrentReqs < 2; // Max # of reqs to Last.fm
         this.albumUpdateInd++) {
        
        var song = this.songs[this.albumUpdateInd];
        if (song.i === undefined) {
            this._fetchAlbumImgsHelper(this.albumUpdateInd, song);
        	this.concurrentReqs++;
        }
    }
    this.albumUpdateInd--;
};

SongList.prototype._fetchAlbumImgsHelper = function(albumIndex, song) {
    var that = this;
    var continueFetching = function() {
        that.albumUpdateInd++;
        that._fetchAlbumImgsHelper(that.albumUpdateInd, that.songs[that.albumUpdateInd]);
    };
    
    if (albumIndex >= this.songs.length) { // we're done
        this.concurrentReqs--;
    
        if (!this.concurrentReqs) {
            this.albumUpdateFinished = true;
            model.saveSongs();
            // log('Finished fetching and saving all album art');
        }
        return;
    }
    
    if (albumIndex % 25 == 0) {
        model.saveSongs();
        // log('Saving newly fetched album art: ' + albumIndex);
    }
    
    // Don't try to refetch albums that already have art
    if (song.i !== undefined) {
        continueFetching();
        return;
    }
    
    model.lastfm.track.search({
	    artist: song.a || '',
	    limit: 1,
	    track: (song.t && cleanSongTitle(song.t)) || ''
	}, {
	    success: function(data) {
	        var track = data.results && data.results.trackmatches && data.results.trackmatches.track;
	        var albumImg = track && track.image && track.image[track.image.length - 1]['#text'];
            
            if (albumImg) {
                $('#song'+albumIndex+' img').attr('src', albumImg);
                that.songs[albumIndex].i = albumImg;
                // log('updated album image: ' + song.t + ' ' + song.a);
            } else {
                that.songs[albumIndex].i = null; // Mark songs without art so we don't try to fetch it in the future
                // log('update album image to null: ' + song.t + ' ' + song.a);
            }
            continueFetching();
	    },
	    error: function(code, message) {
	        log(code + ' ' + message);
		}
	});
};


// Takes an array of objects with properties 'name', 'image' 
function makeArtistList(artists) {
    var result = $('<div></div>');
    for (var i = 0; i < artists.length; i++) {
        var artist = artists[i];
        
        if (!artist.image) {
            artist.image = '/images/anonymous.png';
        }
        
        // No alt text. Want to avoid alt-text flash while img loads
        var img = $('<img src="'+artist.image+'">');
        
        $('<a></a>', {
			'class': 'artistResult',
			href: '/'+canonicalize(artist.name),
			rel: 'partial artist',
			title: artist.name
		})
            .append('<div>'+artist.name+'</div>')
            .append(img)
            .appendTo(result);
    }
    return result;
}


// Takes an array of objects with properties 'name', 'artist', 'image'
function makeAlbumList(albums) {
    var result = $('<div></div>');
    for (var i = 0; i < albums.length; i++) {
        var album = albums[i];

        if (!album.image) {
            album.image = '/images/unknown.png';
        }

        // No alt text. Want to avoid alt-text flash while img loads
        var img = $('<img src="' + album.image + '">');

        $('<a></a>', {
			'class': 'albumResult',
			href: '/'+canonicalize(album.artist)+'/'+canonicalize(album.name),
			rel: 'partial album',
			title: album.name
		})
        .append('<span class="mask"></span>'+'<div>' + album.name + '<span class="artistName">' + album.artist + '</span></div>')
        .append(img)
        .appendTo(result);
    }
    return result;
}