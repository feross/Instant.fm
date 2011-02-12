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
    nowplaying.updateOpenButtonText(config.title);
};

// Called when another view was popped and this one has re-appeared.
BaseView.prototype.didAwake = function(config) {
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
    searchString = $.trim(searchString);
    if (!this.delaySearch && (this.prevSearchString != searchString)) {
        this.prevSearchString = searchString;
        if (searchString.length) {
            this.search(searchString);
        } else {
            $('.songResults', this.content).hide();
	        $('.artistResults', this.content).hide();
			$('.albumResults', this.content).hide();
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
        $('.songResults', this.content).hide();
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
            player.playSongBySearch(song.t, song.a);
        },
        buttons: buttons || [],
    });
    
    var $songResults = $('.songResults', this.content);
    songlist.render($songResults);
    $songResults.show();
};

SearchView.prototype._handleArtistSearchResults = function(data) {
    var artists = [];
    var artistResults = data && data.results && data.results.artistmatches && data.results.artistmatches.artist;
    
    if (!artistResults || !artistResults.length) {
        $('.artistResults', this.content).hide();
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
        .show();
};

SearchView.prototype._handleAlbumSearchResults = function(data) {
    var albums = [];
    var albumResults = data && data.results && data.results.albummatches && data.results.albummatches.album;

    if (!albumResults || !albumResults.length) {
        $('.albumResults', this.content).hide();
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
        .show();
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
	$('.name', this.content).text(this.name);
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
            className: 'awesome small white',
            text: 'Add to Playlist'
        }],
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


/* ------------------- LYRIC VIEW -------------------- */

function LyricView(config) {
    this.config = config;
	this.title = config.linkElem.attr('data-title');
	this.artist = config.linkElem.attr('data-artist');
}
copyPrototype(LyricView, BaseView);

LyricView.prototype.willSlide = function() {
    this.BaseView.prototype.willSlide(this.config);
    this._fetchData();
};

LyricView.prototype.didSlide = function() {
    this.BaseView.prototype.didSlide(this.config);
};

LyricView.prototype.willSleep = function() {
    this.BaseView.prototype.willSleep(this.config);
};

LyricView.prototype.willAwake = function() {
    this.BaseView.prototype.willAwake(this.config);
};

LyricView.prototype.didAwake = function() {
    this.BaseView.prototype.didAwake(this.config);
};

LyricView.prototype.willPop = function() {
    this.BaseView.prototype.willPop(this.config);
};

LyricView.prototype._fetchData = function() {
    var url = '/lyric/?a='+encodeURIComponent(this.artist)+'&t='+encodeURIComponent(this.title);
    $.ajax({
       type: 'GET',
       url: url,
       dataType: 'xml',
       success: function(data, textStatus, xhr) {
           alert(data);
       }
     });
};