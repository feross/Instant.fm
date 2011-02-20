// TODO: Refactor this to use jQuery templates and clean it up.

/* ------------------- NOW PLAYING VIEW -------------------- */

function NowPlaying() {
    this.setupHandlers();
}

NowPlaying.prototype.setupHandlers = function() {
    $('#addComment').click(function(event) {
        event.preventDefault();
        if (!$('#commentsDiv').data('loaded')) {
            return;
        }
        if ($('#commentsDiv').is(':visible')) {
            $('#addComment').html('Add a Comment');
            $('#commentsDiv').slideUp('fast');
        } else {
            $('#addComment').html('Hide Comments');
            $('#commentsDiv').slideDown('fast');
        }
    });
    
    $('#fbShare').click(function(event) {
        event.preventDefault();
        nowplaying.shareOnFacebook();
    });
    
    $('#twShare').click(function(event) {
        event.preventDefault();
        nowplaying.shareOnTwitter();
    });  
};

// Update the currently playing song with Last.fm data
// @t - song title, @a - song artist
// @srcIndex - Song index that generated this Last.fm request. We'll check that the song
//             hasn't changed before we update the DOM.
NowPlaying.prototype.updateCurPlaying = function(t, a, _srcIndex) {
	model.lastfm.track.search({
	    artist: a || '',
	    limit: 1,
	    track: t || ''
	}, {
	    success: function(data) {
	      nowplaying._handleSongResults(t, a, _srcIndex, data);
	    },
	    error: function(code, message) {
	        log(code + ' ' + message);
	        this.renderAlbumBlock({
                albumImg: undefined,
                trackName: t,
                artistName: a,
            });
		}
	});
};

// Private method to handle song search results from Last.fm
NowPlaying.prototype._handleSongResults = function(t, a, srcIndex, data) {
    if (srcIndex && srcIndex != player.songIndex) {
        return; // The request was too slow. We don't need it anymore.
    }
    if (!data.results || !data.results.trackmatches || !data.results.trackmatches.track) {
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
        callback: function() {
            // Add colorbox to artist image
            if (albumImg) {
                $('#curAlbumImg').colorbox({
                    href: albumImg,
                    photo: true,
                    returnFocus: false,
                    title: '&nbsp;' // don't show a title
                });
            } else {
                $('#curAlbumImg').click(function(event) {
                    event.preventDefault();
                });
            }
        }
    });

    // Get detailed track info
    trackName && artistName && model.lastfm.track.getInfo({
	    artist: artistName || '',
	    autocorrect: 1,
	    track: trackName || ''
	}, {
	    success: function(data){
	        nowplaying._handleSongInfo(trackName, artistName, albumImg, srcIndex, data);
	    },
	    error: function(code, message) {
	        log(code + ' ' + message);
	        nowplaying.renderSongDesc(false);
		}
	});

	// Get detailed artist info (proceeds simultaneously with previous req)
	artistName && model.lastfm.artist.getInfo({
	    artist: artistName || '',
	    autocorrect: 1
	}, {
	    success: function(data){
	        nowplaying._handleArtistInfo(artistName, srcIndex, data);
	    },
	    error: function(code, message) {
	        this.renderArtistDesc(false);
	        log(code + ' ' + message);
		}
	});
};

// Private method to handle song information from Last.fm
NowPlaying.prototype._handleSongInfo = function(trackName, artistName, albumImg, srcIndex, data) {
    if (srcIndex && srcIndex != player.songIndex) {
        return; // The request was too slow. We don't need it anymore.
    }
    if (!data.track) {
        return;
    }
                    
    var track = data.track;
    var albumName = track.album && track.album.title;
    var trackSummary = track.wiki && track.wiki.summary;
    var trackLongDesc = track.wiki && track.wiki.content;
    
    if (albumName) {
        var albumHref = '/'+canonicalize(artistName)+'/album/'+canonicalize(albumName);
        $('#curAlbum h4').html('<a href="'+albumHref+'" title="'+albumName+'" data-artist="'+artistName+'" rel="partial album">'+albumName+'</a>');
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

};

// Private method to handle artist information from Last.fm
NowPlaying.prototype._handleArtistInfo = function(artistName, srcIndex, data) {
    if (srcIndex && srcIndex != player.songIndex) {
        return; // The request was too slow. We don't need it anymore.
    }
    if (!data.artist) {
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
                    $('#curArtistImg').colorbox({
                        href: artistImg,
                        photo: true,
                        returnFocus: false,
                        title: '&nbsp;' // don't show a title
                    });
                }
            }
        });
    } else {
        this.renderArtistDesc(false);
    }
};

NowPlaying.prototype.renderPlaylistInfo = function(data) {    
    $('#curPlaylist').fadeOut('fast', function() {
        $('#curPlaylist').empty();
        $('#curPlaylistTemplate')
            .tmpl(data)
            .appendTo('#curPlaylist');
        
        $('.editLink').remove(); // remove all edit links

        // TODO: Hide the editableness when we're not owner
        nowplaying._makeEditable($('#curPlaylistTitle'), model.updateTitle);
        nowplaying._makeEditable($('#curPlaylistDesc'), model.updateDesc);
        
        $('#curPlaylist').fadeIn('fast');
    });
};

NowPlaying.prototype.renderAlbumBlock = function(data) {
    if (data.albumImg) {
        data.albumAlt = data.artistName ? ('Album by ' + data.artistName) : '';
    } else {
        data.albumImg = '/images/unknown.png';
        data.albumAlt = 'Unknown album';
    }
    
    if (data.artistName) {
        data.artistHref = '/'+canonicalize(data.artistName);
        data.songHref = 'http://instant.fm/'+canonicalize(data.artistName)+'/'+canonicalize(data.trackName);
    }
    
    $('#curAlbumBlock').fadeOut('fast', function() {
        $('#curAlbumBlock').empty();
        $('#curAlbumBlockTemplate')
            .tmpl(data)
            .appendTo('#curAlbumBlock');
        FB.XFBML.parse(document.getElementById('curButtons'), function(reponse) {
            $('#curButtons').fadeIn('fast');
        });
        data.callback && data.callback();
        $('#curAlbumBlock').fadeIn('fast');
    });
};

NowPlaying.prototype.renderSongDesc = function(data) {    
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
};

NowPlaying.prototype.renderArtistDesc = function(data) {
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
};

NowPlaying.prototype.updateOpenButtonText = function(text) {
    $('#nowPlayingHeader .right')
        .empty()
        .append(
            renderConditionalText(text, 'span', function(elem) {
                elem.shorten({width: 125});
            })
        );  
};

// Optimization: Don't load Facebook comments until video is playing
NowPlaying.prototype.tryLoadComments = function(url, title) {    
    if (player.isPlaying()) {
        var xid = url.replace(new RegExp('/', 'gi'), '_');
        nowplaying._loadComments(xid, title);
    } else {
        window.setTimeout(function() {
            nowplaying.tryLoadComments(url, title);
        }, 2000);
    }
};

// Private method to load playlist's comments
NowPlaying.prototype._loadComments = function(xid, title) {
    $('#commentsDiv').remove();
    $('<div id="commentsDiv"><section id="comments"></section></div>')
        .appendTo('#devNull');
    $('#addComment').html('Add a Comment');
    
    // Load Facebook comment box
    $('#comments')
        .html('<fb:comments numposts="5" width="480" simple="1" publish_feed="true" css="http://instant.fm/css/fbcomments.css?58" notify="true" title="'+title+'" xid="'+xid+'"></fb:comments>');
    FB.XFBML.parse(document.getElementById('comments'), function(response) {
        $('#commentsDiv')
            .appendTo('#playlistActions')
            .hide()
            .data('loaded', true);
    });
    
    // Resize comment box on comment
    FB.Event.subscribe('comments.add', function(response) {
        $('#commentsDiv').height('auto'); // default
    });
};

// Makes the given element editable by adding an edit link.
// @elem - the element to make editable
// @updateCallback - the function to call when the value is modified
NowPlaying.prototype._makeEditable = function(elem, updateCallback) {    
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
    
    elem.after($('<a class="editLink mustOwn" href="#edit">Edit</a>')
        .click(function(event) {
            event.preventDefault();
            $.extend(appSettings.jeditable.autogrow, autogrowSettings);

            $(this).prev().trigger('editable');
            $(this).hide();
            
        }))
        .editable(function(value, settings) {
            $(this).next().show();
            
            updateCallback(value);
            return value;
        }, $.extend({}, appSettings.jeditable, {buttonClass: buttonClass}));
};


/* ------------------- SHARING -------------------- */

NowPlaying.prototype.shareOnFacebook = function() {
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
        picture: bestAlbumImg || 'http://instant.fm/images/unknown.png',
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
};

NowPlaying.prototype.shareOnTwitter = function() {
    var tweetText = encodeURIComponent("♫ I'm listening to "+model.playlist.title);
    var url = 'http://twitter.com/share'+
              '?url=http://instant.fm' + model.playlist.url +
              '&text='+tweetText+'&via=instantDOTfm';
    showPop(url, 'instantfmTwitterShare');
};

NowPlaying.prototype.shareOnBuzz = function() {
    var url = 'http://www.google.com/buzz/post?url=http://instant.fm' + model.playlist.url;
    showPop(url, 'instantfmBuzzShare', 420, 700);
};