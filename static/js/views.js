/* ---------------------------- BASE VIEW ---------------------------- */

// All views should extend this one!
function BaseView() {
};

// Called after content is added to DOM but before animation.
BaseView.prototype.willSlide = function(config) {
    $('#browser').scrollTop(0);
    browser._updateHeader();
};

/* Called after the content is slid fully into view */
BaseView.prototype.didSlide = function(config) {
    nowplaying.updateOpenButtonText(config.title);
};

/* Called before animation starts to either push a new view (hiding this 
 * one), or pop this one.
 */
BaseView.prototype.willSleep = function(config) {
    $('input, textarea', this.content).blur();
};

// Called when another view gets popped and before this one re-appears.
BaseView.prototype.willAwake = function(config) {
    $('#browser').scrollTop(0);
    browser._updateHeader();
};

// Called when another view was popped and this one has re-appeared.
BaseView.prototype.didAwake = function(config) {
    nowplaying.updateOpenButtonText(config.title);
};
  
// Called immediately before the view is popped.
BaseView.prototype.willPop = function(config) {
};


/* --------------------------- SEARCH VIEW --------------------------- */

function SearchView(config) {
    this.config = config;
    this.prevSearchString = ''; // Used to prevent repeating identical searches
    this.delaySearch = false; // Used to force a delay between searches
    
    // Force title to change depending on user state
    this.config.title = {mustOwn: 'Add Songs', mustNotOwn: 'Search'};
}
copyPrototype(SearchView, BaseView);

SearchView.prototype.willSlide = function() {
    this.BaseView.prototype.willSlide(this.config);
    this._addSearchHandlers();
};

SearchView.prototype.didSlide = function() {
    this.BaseView.prototype.didSlide(this.config);
    $('.searchBox input.search', this.content).focus();
};

SearchView.prototype.willSleep = function() {
    this.BaseView.prototype.willSleep(this.config);
};

SearchView.prototype.willAwake = function() {
    this.BaseView.prototype.willAwake(this.config);
};

SearchView.prototype.didAwake = function() {
    this.BaseView.prototype.didAwake(this.config);
    $('.searchBox input.search', this.content).focus();
};

SearchView.prototype.willPop = function() {
    this.BaseView.prototype.willPop(this.config);
};

// Private function that adds handlers to the search box
SearchView.prototype._addSearchHandlers = function() {
    var searchInput = $('.searchBox input.search', this.content);
    
    // Hits enter to submit form
    var that = this;
    $('.searchBox', this.content).submit(function(event) {
        event.preventDefault();
        log('submit');
		that.search.apply(that, [searchInput.val(), false]);
    });
    
    // Pushes a key
    searchInput.keyup(function(event) {
        var searchString = $.trim(searchInput.val());
        if (that.prevSearchString == searchString) {
            return;
        }
        that.prevSearchString = searchString;    
        
        that.search.apply(that, [searchString, true]);
    });
    
    // Clicks search button
    $('.searchBox input.submit', this.content).click(function(event) {
        event.preventDefault();
        log('click');
		that.search.apply(that, [searchInput.val(), false]);
    });
};

// Perform a search for given search string
SearchView.prototype.search = function(searchString, delay) {
    searchString = $.trim(searchString);
    
    if (delay) {
        var timeout = 250;
    } else {
        var timeout = 0;
    }
    
    $('.songResults, .artistResults, .albumResults', this.content).addClass('loading');
    
    var that = this;
    window.setTimeout(function() {
        
        var searchInput = $('.searchBox input.search', this.content);
        if (searchString != searchInput.val()) {
            return; // don't perform search since user kept typing
        }
        
        if (!searchString.length) {
            $('.songResults', that.content).slideUp();
	        $('.artistResults', that.content).slideUp();
			$('.albumResults', that.content).slideUp();
			return;
        }
        
        model.lastfm.track.search(
        {
            track: searchString,
            limit: 5,
        },
        {
            success: function(data) {
                $('.songResults', that.content).removeClass('loading');
                
                if (searchString == that.prevSearchString) { // result is still relevant
                    that._handleSongSearchResults(data);
                }
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
                $('.artistResults', that.content).removeClass('loading');
                
                if (searchString == that.prevSearchString) { // result is still relevant
                    that._handleArtistSearchResults(data);
                }
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
                $('.albumResults', that.content).removeClass('loading');
                
                if (searchString == that.prevSearchString) { // result is still relevant
                    that._handleAlbumSearchResults(data);
                }
            },
            error: function(code, message) {
                log(code + ' ' + message);
                that.renderAlbums([]);
            }
        });
    }, timeout);
};

SearchView.prototype._handleSongSearchResults = function(data) {
    var tracks = [];
    var trackResults = data && data.results && data.results.trackmatches && data.results.trackmatches.track;

    if (!trackResults || !trackResults.length) {
        $('.songResults', this.content).slideUp();
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
    
    var songlist = new SongList({
        songs: tracks,
        onClick: function(song) {
            $('.playing').removeClass('playing');
            $(this).addClass('playing');
            player.playSongBySearch(song.t, song.a);
        },
        buttons: [{
            action: function(event, song) {
                player.addSongToPlaylist(song);
            },
            className: 'awesome small white mustOwn',
            text: 'Add to Playlist'
        }],
    });
    
    var $songResults = $('.songResults', this.content);
    songlist.render($songResults);
    $songResults.slideDown();
};

SearchView.prototype._handleArtistSearchResults = function(data) {
    var artists = [];
    var artistResults = data && data.results && data.results.artistmatches && data.results.artistmatches.artist;
    
    if (!artistResults || !artistResults.length) {
        $('.artistResults', this.content).slideUp();
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
        .slideDown();
};

SearchView.prototype._handleAlbumSearchResults = function(data) {
    var albums = [];
    var albumResults = data && data.results && data.results.albummatches && data.results.albummatches.album;

    if (!albumResults || !albumResults.length) {
        $('.albumResults', this.content).slideUp();
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
        .slideDown();
};


/* --------------------------- ARTIST VIEW --------------------------- */

function ArtistView(config) {
    this.config = config;
    this.BaseView.prototype.constructor(this);
	this.name = config.title;
}
copyPrototype(ArtistView, BaseView);

ArtistView.prototype.willSlide = function() {
    this.BaseView.prototype.willSlide(this.config);
	this._fetchData();
};

ArtistView.prototype.didSlide = function() {
    this.BaseView.prototype.didSlide(this.config);
};

ArtistView.prototype.willSleep = function() {
    this.BaseView.prototype.willSleep(this.config);
};

ArtistView.prototype.willAwake = function() {
    this.BaseView.prototype.willAwake(this.config);
};

ArtistView.prototype.didAwake = function() {
    this.BaseView.prototype.didAwake(this.config);
};

ArtistView.prototype.willPop = function() {
    this.BaseView.prototype.willPop(this.config);
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
        limit: 10
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
        limit: 6
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
            .show();
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
 	
 	$('.artistDesc', this.content).show();
};

ArtistView.prototype._handleTopSongs = function(data) {
    var songResults = data && data.toptracks && data.toptracks.track;
    if (!songResults || !songResults.length) {
        $('.songResults', this.content).hide();
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
    
    var songlist = new SongList({
        songs: songs,
        onClick: function(song) {
            $('.playing').removeClass('playing');
            $(this).addClass('playing');
            player.playSongBySearch(song.t, song.a);
        },
        buttons: [{
            action: function(event, song) {
                player.addSongToPlaylist(song);
            },
            className: 'awesome small white mustOwn',
            text: 'Add to Playlist'
        }],
        isNumbered: true
    });
    
    var $songResults = $('.songResults', this.content)
    $songResults.find('div').remove();
    songlist.render($songResults);
    
    $songResults.show();
};

ArtistView.prototype._handleTopAlbums = function(data) {
    var albumResults = data && data.topalbums && data.topalbums.album;
    if (!albumResults || !albumResults.length) {
        $('.albumResults', this.content).hide();
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
        .show(); 
};

ArtistView.prototype._updateArtistImg = function(src, alt) {
	if (src) {
        var imgBlock = $('<img alt="'+alt+'" src="'+src+'" />');
        $('.artistImg', this.content).empty().append(imgBlock);
    
    } else {
        $('.artistImg', this.content).replaceWith($('<span class="artistImg reflect"></span>'));
    }
};


/* --------------------------- ALBUM VIEW --------------------------- */

function AlbumView(config) {
    this.config = config;
    this.BaseView.prototype.constructor(this);
	this.name = config.title;
}
copyPrototype(ArtistView, BaseView);

AlbumView.prototype.willSlide = function() {
    this.BaseView.prototype.willSlide(this.config);
	this._fetchData();
};

AlbumView.prototype.didSlide = function() {
    this.BaseView.prototype.didSlide(this.config);
};

AlbumView.prototype.willSleep = function() {
    this.BaseView.prototype.willSleep(this.config);
};

AlbumView.prototype.willAwake = function() {
    this.BaseView.prototype.willAwake(this.config);
};

AlbumView.prototype.didAwake = function() {
    this.BaseView.prototype.didAwake(this.config);
};

AlbumView.prototype.willPop = function() {
    this.BaseView.prototype.willPop(this.config);
};

AlbumView.prototype._fetchData = function() {
	that = this;
    model.lastfm.album.getInfo({
        album: this.name,
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
};

AlbumView.prototype._handleInfo = function(data) {
    log(data);
    var artist = data && data.artist;
	
    // log(artist);
	// TODO: show similar artists
	// TODO: show tags
    
	if (!artist) {
        $('.artistDesc article', this.content)
            .html('<p>No artist named "' + this.name + '" were found.</p>')
            .show();
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
 	
 	$('.artistDesc', this.content).show();
};

AlbumView.prototype._updateAlbumImg = function(src, alt) {
	if (src) {
        var imgBlock = $('<img alt="'+alt+'" src="'+src+'" />');
        $('.artistImg', this.content).empty().append(imgBlock);
    
    } else {
        $('.artistImg', this.content).replaceWith($('<span class="artistImg reflect"></span>'));
    }
};