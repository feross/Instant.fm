// All views should extend this one!
var View = Base.extend({
    constructor: function(config) {
        this.config = config;
    },
    
    // Called after content is added to DOM but before animation.
    willSlide: function() {
        $('#browser').scrollTop(0);
        browser._updateHeader();
    },

    // Called after content is fully slid into view.
    didSlide: function() {
        nowplaying.updateOpenButtonText(this.config.title);
    },

    // Called before we push a new view (hiding this one) or pop the current one.
    willSleep: function() {
        $('input, textarea', this.content).blur();
    },

    // Called when another view gets popped and before this one re-appears.
    willAwake: function() {
        $('#browser').scrollTop(0);
        browser._updateHeader();
    },

    // Called when another view was popped and this one has re-appeared.
    didAwake: function() {
        nowplaying.updateOpenButtonText(this.config.title);
    },

    // Called immediately before the view is popped.
    willPop: function() {
    }
    
});


var SearchView = View.extend({
    constructor: function(config) {
        this.base(config);
        
        this.prevSearchString = ''; // Used to prevent repeating identical searches
        this.delaySearch = false; // Used to force a delay between searches
        
        // When it reaches 3, we know that there are no song, artist, or album results
        this.noResults = 0;

        // Force title to change depending on user state
        this.config.title = {mustOwn: 'Add Songs', mustNotOwn: 'Search'};
    },
    
    willSlide: function() {
        this.base();
        this._addSearchHandlers();
    },

    didSlide: function() {
        this.base();
        $('.searchBox input.search', this.content).focus();
    },

    didAwake: function() {
        this.base();
        $('.searchBox input.search', this.content).focus();
    },

    // Private function that adds handlers to the search box
    _addSearchHandlers: function() {
        var searchInput = $('.searchBox input.search', this.content);

        // Hits enter to submit form
        var that = this;
        $('.searchBox', this.content).submit(function(event) {
            event.preventDefault();
    		that.search(searchInput.val(), false);
        });

        // Pushes a key
        searchInput.keyup(function(event) {
            var searchString = $.trim(searchInput.val());
            if (that.prevSearchString == searchString) {
                return;
            }
            that.prevSearchString = searchString;    

            that.search(searchString, true);
        });

        // Clicks search button
        $('.searchBox input.submit', this.content).click(function(event) {
            event.preventDefault();
    		that.search(searchInput.val(), false);
        });
    },

    // Perform a search for given search string
    search: function(searchString, delay) {
        searchString = $.trim(searchString);

        var timeout = delay ? 150 : 0;

        $('.songResults, .artistResults, .albumResults', this.content).addClass('loading');

        var that = this;
        window.setTimeout(function() {

            $('.start', that.content).fadeOut();

            var searchInput = $('.searchBox input.search', that.content);
            if (searchString != $.trim(searchInput.val())) {
                return; // don't perform search since user kept typing
            }

            // Reset the noResult count
            that.noResults = 0;
            $('.noResults', this.content).fadeOut();

            if (!searchString.length) {
                $('.songResults', that.content).slideUp();
    	        $('.artistResults', that.content).slideUp();
    			$('.albumResults', that.content).slideUp();
    			$('.start', that.content).fadeIn();
    			return;
            }

            model.lastfm.track.search(
            {
                track: searchString,
                limit: 50
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
                    that._incNoResults();
                }
            });

            model.lastfm.artist.search({
                artist: searchString,
                limit: 3
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
                    that._incNoResults();
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
                    that._incNoResults();
                }
            });
        }, timeout);
    },

    _handleSongSearchResults: function(data) {
        var tracks = [];
        var trackResults = data && data.results && data.results.trackmatches;
        var songs = Player._songsFromTrackList(data.results.trackmatches);

        if (!songs || !songs.length) {
            $('.songResults', this.content).slideUp();
            this._incNoResults();
            return;
        }

        var playlist = {songs: songs};
        var songlist = new SongList(playlist);

        $('.songResults ul', this.content).remove();
        var $songResults = $('.songResults', this.content);
        songlist.render($songResults);
        $songResults.slideDown();
    },

    _handleArtistSearchResults: function(data) {
        var artists = [];
        var artistResults = data && data.results && data.results.artistmatches && data.results.artistmatches.artist;

        if (!artistResults || !artistResults.length) {
            $('.artistResults', this.content).slideUp();
            this._incNoResults();
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
    },

    _handleAlbumSearchResults: function(data) {
        var albums = [];
        var albumResults = data && data.results && data.results.albummatches && data.results.albummatches.album;

        if (!albumResults || !albumResults.length) {
            $('.albumResults', this.content).slideUp();
            this._incNoResults();
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
    },

    // Increment the no results count. When 3, show 'no results' message.
    _incNoResults: function() {
        this.noResults++;
        if (this.noResults >= 3) {
            $('.noResults', this.content)
                .text('No results for "'+this.prevSearchString+'".')
                .fadeIn();
        }
    }
    
});


var ArtistView = View.extend({
    constructor: function(config) {
    	this.base(config);
    	
    	this.name = config.title;
    	this.songlist;
    },
    
    willSlide: function() {
        this.base();
    	this._fetchData();
    },

    didSlide: function() {
        this.base();

        var that = this;
        $('.playAll', this.content).click(function(event) {
            event.preventDefault();
            that.songlist && that.songlist.playAll();
        });
    },

    _fetchData: function() {
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
    },

    _handleInfo: function(data) {
        var artist = data && data.artist;

    	// TODO: show similar artists
    	// TODO: show tags

    	if (!artist) {
            $('.artistDesc article', this.content)
                .html('<p>No artist named "' + this.name + '" was found.</p>')
                .fadeIn();
            return;
        }

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

     	$('.artistDesc', this.content).fadeIn();
    },

    _handleTopSongs: function(data) {
        this.songlist = new SongList(Player.playlistFromArtistTracks(data.toptracks));

        var $songResults = $('.songResults', this.content);
        this.songlist.render($songResults);

        $songResults.fadeIn();
    },

    _handleTopAlbums: function(data) {
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
            .fadeIn(); 
    },

    _updateArtistImg: function(src, alt) {
    	if (src) {
            var imgBlock = $('<a class="artistImg reflect" href="#"><img alt="'+alt+'" src="'+src+'"><span class="zoomIcon"></span></a>')
                .colorbox({
                    href: src,
                    photo: true,
                    returnFocus: false,
                    title: '&nbsp;' // don't show a title
                });
            $('.artistImg', this.content).replaceWith(imgBlock);

        } else {
            $('.artistImg', this.content).replaceWith($('<span class="artistImg reflect"></span>'));
        }
    }
    
});


var AlbumView = View.extend({
    constructor: function(config) {
        this.base(config);
        
        this.albumName = config.title;
    	this.artistName = config.linkElem.attr('data-artist');
    	this.songlist;
    },
    
    willSlide: function() {
        this.base();
    	this._fetchData();
    },

    didSlide: function() {
        this.base();

        var that = this;
        $('.playAll', this.content).click(function(event) {
            event.preventDefault();
            that.songlist && that.songlist.playAll();
        });
    },

    _fetchData: function() {
    	that = this;
        model.lastfm.album.getInfo({
            album: this.albumName,
            artist: this.artistName,
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
    },

    _handleInfo: function(data) {
        var album = data && data.album;

    	if (!album) {
            $('.albumDesc article', this.content)
                .html('<p>No album named "' + this.name + '" were found.</p>')
                .fadeIn();
            return;
        }

        var albumSummary = album.wiki && album.wiki.summary;
        var albumLongDesc = album.wiki && album.wiki.content;

    	// Update album summary
        var shortContent;
        if (albumSummary) {                  
            shortContent = cleanHTML(albumSummary);
            $('.albumDesc article', this.content)
                .html(shortContent);
        }

        // Add link to longer description
        if (albumSummary && albumLongDesc) {
            var longContent = cleanHTML(albumLongDesc); 

            $('.albumDesc article', this.content)
                .data('longContent', longContent)
                .data('shortContent', shortContent);

            var link = makeSeeMoreLink(onShowMoreText);
            $('.albumDesc article', this.content).append(' ').append(link);
        }

        var image = album.image[album.image.length - 1]['#text'];
     	this._updateAlbumImg(image, name);

     	$('.albumDesc', this.content).fadeIn();

        this.playlist = Player.playlistFromAlbum(data.album);
        this.songlist = new SongList(this.playlist);

        var $songResults = $('.songResults', this.content)
        this.songlist.render($songResults);

        $songResults.fadeIn();
    },

    _updateAlbumImg: function(src, alt) {
    	if (src) {    
            var imgBlock = $('<a class="albumImg reflect" href="#"><img alt="'+alt+'" src="'+src+'"><span class="zoomIcon"></span></a>')
                .colorbox({
                    href: src,
                    photo: true,
                    returnFocus: false,
                    title: '&nbsp;' // don't show a title
                });
            $('.albumImg', this.content).replaceWith(imgBlock);

        } else {
            $('.albumImg', this.content).replaceWith($('<span class="albumImg reflect"></span>'));
        }
    }
    
});

var ProfileView = View.extend({
    constructor: function(config) {
        this.base(config);
    },
    
    willSlide: function() {
        this.base();
        this._fetchData();
    },
    
    _fetchData: function() {
        var profile = this.config.path.split('/')[2];
        var that = this;
        instantfm.get_playlists_for_user({
            params: [profile],
            onSuccess: function(data) {
                that._handlePlaylists(data);
            }
        });
    },

    _handlePlaylists: function(playlists) {
        for (var i = 0; i < playlists.length; i++) {
            var playlist = playlists[i];
            var songList = new SongList(playlist);
            var container = $('<div>').addClass('songResults');
            if (playlist.songs.length > 0) {
                container.append($('<h1>').text(playlist.title));
                container.append($('<span>').text(playlist.songs.length + ' songs'));
                var helper = function(songList) {
                   return function(event) {
                       event.preventDefault();
                       songList.playAll();
                   };
                };
                container.append($('<a>').text('Play')
                                         .addClass('playAll')
                                         .attr('href', '#playAll')
                                         .click(helper(songList)));

                songList.render(container);
                $(this.content).append(container);
            }
        }
    }

});

