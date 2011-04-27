// All views should extend this one!
var View = Base.extend({
    constructor: function(config) {
        this.config = config;
    },
    
    // Path to the static HTML for this view (ex: /view/artist.html)
    // Note: This is usually different from path in this.config.path (ex: /lady-gaga)
    //       except when we have a static view (ex: /view/meetTheTeam.html)
    getStaticPath: function() {
        return this.config.path;
    },
    
    // Called after content is added to DOM but before animation.
    willSlide: function() {
        browser.updateHeader(this.config.title);
    },

    // Called after content is fully slid into view.
    didSlide: function() {
    },

    // Called before we push a new view (hiding this one) or pop the current one.
    willSleep: function() {
        $('input, textarea', this.content).blur();
    },
    
    // Called after we push a new view (hiding this one) or pop the current one.
    didSleep: function() {
        this.content.css({visibility: 'hidden'});
    },

    // Called when another view gets popped and before this one re-appears.
    willAwake: function() {
        this.content.css({visibility: 'visible'});
        browser.updateHeader(this.config.title);
    },

    // Called when another view was popped and this one has re-appeared.
    didAwake: function() {
    },

    // Called before the view is popped.
    willPop: function() {
        $('input, textarea', this.content).blur();
    },
    
    // Called after the view is popped.
    didPop: function() {
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
    
    getStaticPath: function() {
        return '/view/search.html';
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
            
            if (searchString.length) {
                $('.start', that.content).fadeOut();
            }

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
    
    getStaticPath: function() {
        return '/view/artist.html';
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
                .colorbox($.extend({
                    href: src,
                    photo: true,
                    title: '&nbsp;' // don't show a title
                }, appSettings.colorbox));
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
    
    getStaticPath: function() {
        return '/view/album.html';
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
        this.songlist = new SongList(this.playlist, {startingLen: 100});

        var $songResults = $('.songResults', this.content)
        this.songlist.render($songResults);

        $songResults.fadeIn();
    },

    _updateAlbumImg: function(src, alt) {
    	if (src) {    
            var imgBlock = $('<a class="albumImg reflect" href="#"><img alt="'+alt+'" src="'+src+'"><span class="zoomIcon"></span></a>')
                .colorbox($.extend({
                    href: src,
                    photo: true,
                    title: '&nbsp;' // don't show a title
                }, appSettings));
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
    
    getStaticPath: function() {
        return '/view/profile.html';
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


var PlaylistView = View.extend({
    constructor: function(config) {
        this.base(config);
    },
    
    getStaticPath: function() {
        return '/view/playlist.html';
    },
    
    willSlide: function() {
        this.base();
        
        var that = this;
        $('#fbShare').click(function(event) {
            event.preventDefault();
            that.shareOnFacebook();
        });

        $('#twShare').click(function(event) {
            event.preventDefault();
            that.shareOnTwitter();
        });
        
        this._renderPlaylistInfo(this.config.playlist);
    },

    // Update the currently playing song with Last.fm data
    // @t - song title, @a - artist, @ytId - yt video id (used for Like button song share)
    // @srcIndex - Song index that generated this Last.fm request. We'll check that the song
    //             hasn't changed before we update the DOM.
    updateCurPlaying: function(t, a, ytId, _srcIndex) {
        var that = this;
    	model.lastfm.track.search({
    	    artist: a || '',
    	    limit: 1,
    	    track: t || ''
    	}, {
    	    success: function(data) {
    	        that._handleSongResults(t, a, ytId, _srcIndex, data);
    	    },
    	    error: function(code, message) {
    	        log(code + ' ' + message);
    	        that.renderAlbumBlock({
                    albumImg: undefined,
                    trackName: t,
                    artistName: a,
                    ytId: ytId
                });
    		}
    	});
    },

    // Private method to handle song search results from Last.fm
    _handleSongResults: function(t, a, ytId, srcIndex, data) {
        if (srcIndex && srcIndex != player.songIndex) {
            return; // The request was too slow. We don't need it anymore.
        }
        if (!data.results || !data.results.trackmatches || !data.results.trackmatches.track) {
            this.renderSongDesc(false);
            this.renderArtistDesc(false);
            this.renderAlbumBlock({
                albumImg: undefined,
                trackName: t,
                artistName: a,
                ytId: ytId
            });
            return;
        }

        var track = data.results.trackmatches.track;
        var trackName = track.name || t;
        var artistName = track.artist || a;
        var albumImg = track.image && track.image[track.image.length - 1]['#text'];

        this.renderAlbumBlock({
            albumImg: albumImg,
            trackName: trackName,
            artistName: artistName,
            ytId: ytId,
            callback: function() {
                // Add colorbox to album image
                if (albumImg) {
                    $('#curAlbumImg').colorbox($.extend({
                        href: albumImg,
                        photo: true,
                        title: '&nbsp;' // don't show a title
                    }, appSettings.colorbox));
                } else {
                    $('#curAlbumImg').click(function(event) {
                        event.preventDefault();
                    });
                }
            }
        });

        // Get detailed track info
        var that = this;
        trackName && artistName && model.lastfm.track.getInfo({
    	    artist: artistName || '',
    	    autocorrect: 1,
    	    track: trackName || ''
    	}, {
    	    success: function(data){
    	        that._handleSongInfo(trackName, artistName, albumImg, srcIndex, data);
    	    },
    	    error: function(code, message) {
    	        log(code + ' ' + message);
    	        that.renderSongDesc(false);
    		}
    	});

    	// Get detailed artist info (proceeds simultaneously with previous req)
    	artistName && model.lastfm.artist.getInfo({
    	    artist: artistName || '',
    	    autocorrect: 1
    	}, {
    	    success: function(data){
    	        that._handleArtistInfo(artistName, srcIndex, data);
    	    },
    	    error: function(code, message) {
    	        that.renderArtistDesc(false);
    	        log(code + ' ' + message);
    		}
    	});
    },

    // Private method to handle song information from Last.fm
    _handleSongInfo: function(trackName, artistName, albumImg, srcIndex, data) {
        if (srcIndex && srcIndex != player.songIndex) {
            return; // The request was too slow. We don't need it anymore.
        }
        if (!data.track) {
            this.renderSongDesc(false);
            return;
        }

        var track = data.track;
        var albumName = track.album && track.album.title;
        var trackSummary = track.wiki && track.wiki.summary;
        var trackLongDesc = track.wiki && track.wiki.content;

        if (albumName) {
            var albumHref = '/'+canonicalize(artistName)+'/'+canonicalize(albumName);
            $('#curAlbum h4').html('<a href="'+albumHref+'" title="'+albumName+'" data-artist="'+artistName+'" rel="view album">'+albumName+'</a>');
            $('#curAlbum').fadeIn('fast');
        }

        // Update song summary
        var shortContent;
        if (trackSummary) {
            shortContent = cleanHTML(trackSummary);
            $('#curSongDesc article').html(shortContent);

            this.renderSongDesc({
                trackName: track.name,
                trackDescription: shortContent,
                callback: function() {
                    // Add link to longer description
                    if (trackLongDesc) {
                        var longContent = cleanHTML(trackLongDesc);

                        $('#curSongDesc article')
                            .data('longContent', longContent)
                            .data('shortContent', shortContent);

                        var link = makeSeeMoreLink(onShowMoreText);
                        $('#curSongDesc article').append(' ').append(link);
                    }
                }
            });
        } else {
            this.renderSongDesc(false);
        }

    },

    // Private method to handle artist information from Last.fm
    _handleArtistInfo: function(artistName, srcIndex, data) {
        if (srcIndex && srcIndex != player.songIndex) {
            return; // The request was too slow. We don't need it anymore.
        }
        if (!data.artist) {
            this.renderArtistDesc(false);
            return;
        }

        var artist = data.artist;
        var artistSummary = artist.bio && artist.bio.summary;
        var artistLongDesc = artist.bio && artist.bio.content;
        var artistImg = artist.image && artist.image[artist.image.length - 1]['#text'];

        // Update artist summary
        var shortContent;
        if (artistSummary) {                  
            shortContent = cleanHTML(artistSummary);

            this.renderArtistDesc({
                artistName: artistName,
                artistImg: artistImg,
                artistDescription: shortContent,
                callback: function() {
                    // Add link to longer description
                    if (artistLongDesc) {
                        var longContent = cleanHTML(artistLongDesc); 

                        $('#curArtistDesc article')
                            .data('longContent', longContent)
                            .data('shortContent', shortContent);

                        var link = makeSeeMoreLink(onShowMoreText);
                        $('#curArtistDesc article').append(' ').append(link);
                    }

                    // Add colorbox to artist image
                    if (artistImg) {
                        $('#curArtistImg').colorbox($.extend({
                            href: artistImg,
                            photo: true,
                            title: '&nbsp;' // don't show a title
                        }, appSettings.colorbox));
                    }
                }
            });
        } else {
            this.renderArtistDesc(false);
        }
    },

    _renderPlaylistInfo: function(playlist) {
        var that = this;
        $('#curPlaylist').fadeOut('fast', function() {
            $('#curPlaylist').empty();
            $('#curPlaylistTemplate')
                .tmpl(playlist)
                .appendTo('#curPlaylist');

            if (model.playlist && model.playlist.user) {
                // Add byline
                var byline, bylineContainer = $('#byline').empty();
                if (model.playlist.user.profile_url) {
                    byline = $('<a/>').attr('href', model.playlist.user.profile_url)
                                      .attr('title', model.playlist.user.name)
                                      .attr('rel', 'view profile');
                } else {
                    byline = $('<span/>');
                }
                byline.text(model.playlist.user.name);
                bylineContainer.text('by ').append(byline);
            }

            $('.editLink').remove(); // remove all edit links

            that._makeEditable($('#curPlaylistTitle'), function(newTitle) {
                model.updateTitle(newTitle);
                that.config.title = newTitle;
            });
            that._makeEditable($('#curPlaylistDesc'), model.updateDesc);

            $('#curPlaylist').fadeIn('fast');
        });

        // Change the background image
        this.setBackground(playlist.bg_original);
    },

    renderAlbumBlock: function(data) {
        if (data.albumImg) {
            data.albumAlt = data.artistName ? ('Album by ' + data.artistName) : '';
        } else {
            // Need absolute URL for FB share
            data.albumImg = 'http://instant.fm/images/unknown.jpg';
            data.albumAlt = 'Unknown album';
        }

        if (data.artistName) {
            data.artistHref = '/'+canonicalize(data.artistName);
        }

        data.songHref = 'http://instant.fm'+model.playlist.url;
        if (data.ytId) {
            data.songHref += '?share=1&yt='+encodeURIComponent(data.ytId)+'&img='+encodeURIComponent(data.albumImg)+'&track='+encodeURIComponent(data.trackName)+'&artist='+encodeURIComponent(data.artistName);
        }

        $('#curAlbumBlock').fadeOut('fast', function() {
            $('#curAlbumBlock').empty();
            $('#curAlbumBlockTemplate')
                .tmpl(data)
                .appendTo('#curAlbumBlock');
            FB.XFBML.parse($('#curSongLike').get(0), function(reponse) {
                $('#curSongLike').fadeIn('fast');
            });
            data.callback && data.callback();
            $('#curAlbumBlock').fadeIn('fast');
        });
    },

    renderSongDesc: function(data) {    
        $('#curSongDesc').fadeOut('fast', function() {
            $('#curSongDesc').empty();
            if (data) {
                $('#curSongDescTemplate')
                    .tmpl(data)
                    .appendTo('#curSongDesc');

                data.callback && data.callback();
                $('#curSongDesc').fadeIn('fast');
            }
        });
    },

    renderArtistDesc: function(data) {
        if (data.artistName) {
            data.artistHref = '/'+canonicalize(data.artistName);
        }

        $('#curArtistDesc').fadeOut('fast', function() {
            $('#curArtistDesc').empty();
            if (data) {
                $('#curArtistDescTemplate')
                    .tmpl(data)
                    .appendTo('#curArtistDesc');

                    data.callback && data.callback();
                $('#curArtistDesc').fadeIn('fast');
            }
        });
    },

    setBackground: function(image_url) {
        // TODO: Make this a nice cross-fade animation.
        var bg_style_str = "";
        if (image_url && image_url != '') {
            bg_style_str = "background-image:url('" + image_url + "');";
        }
        $('body').attr('style', bg_style_str);
    },

    // Makes the given element editable by adding an edit link.
    // @elem - the element to make editable
    // @updateCallback - the function to call when the value is modified
    _makeEditable: function(elem, updateCallback) {    
        var elemId = elem.attr('id');
        var buttonClass, autogrowSettings;
        switch (elemId) {
            case 'curPlaylistTitle':
                autogrowSettings = {
                    expandTolerance: 0.05,
                    lineHeight: 30,
                };
                buttonClass = 'large awesome white';
                break;
            default:
                autogrowSettings = $.extend({}, appSettings.autogrow);
                buttonClass = 'small awesome white';
                break;
        }

        elem.after($('<a class="editLink mustOwn" href="#edit"> Edit</a>')
                .click(function(event) {
                    event.preventDefault();
                    $.extend(appSettings.jeditable.autogrow, autogrowSettings);

                    $(this).prev().trigger('editable');
                    $(this).hide();
                })
            )
            .editable(function(value, settings) {
                $(this).next().show();

                updateCallback(value);
                return value;
            }, $.extend({}, appSettings.jeditable, {
                buttonClass: buttonClass,
                onreset: function() {
                    $(this).parent().next().show(); // Show the edit button again if the edit is canceled.
                }
            }));
    },

    shareOnFacebook: function() {
        // Use first non-blank album as share image
        var bestAlbumImg;
        for (var i = 0; i < model.playlist.songs.length; i++) {
            var image = model.playlist.songs[i].i;
            if (image) {
                bestAlbumImg = image.replace('serve/34s', 'serve/126s');
                break;
            }
        }

        // Get top playlist artists
        var topArtists = [];
        $.each(model.playlist.songs, function(index, value) {
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
            name: model.playlist.title,
            link: 'http://instant.fm' + model.playlist.url,
            picture: bestAlbumImg || 'http://instant.fm/images/unknown.jpg',
            caption: 'Instant.fm Playlist',
            description: model.playlist.description + '\n',
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
    },

    shareOnTwitter: function() {
        var tweetText = encodeURIComponent("#NowPlaying I'm listening to "+model.playlist.title);
        var url = 'http://twitter.com/share'+
                  '?url=http://instant.fm' + model.playlist.url +
                  '&text='+tweetText+'&via=instantDOTfm';
        showPop(url, 'instantfmTwitterShare');
    },

    shareOnBuzz: function() {
        var url = 'http://www.google.com/buzz/post?url=http://instant.fm' + model.playlist.url;
        showPop(url, 'instantfmBuzzShare', 420, 700);
    }
    
},
// Static methods
{
    updateCurPlaying: function(t, a, ytId, _srcIndex) {
        var topView = browser.getTopView();
        if (topView instanceof PlaylistView) {
            topView.updateCurPlaying(t, a, ytId, _srcIndex);
        }
    }
});






