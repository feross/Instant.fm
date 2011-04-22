// TODO: Refactor this to use jQuery templates and clean it up.

/* ------------------- NOW PLAYING VIEW -------------------- */

function NowPlaying() {
    this.setupHandlers();
}

NowPlaying.prototype.setupHandlers = function() {
    $('#addComment').click(function(event) {
        event.preventDefault();
        if (!$('#comments').data('loaded')) {
            return;
        }
        if ($('#comments').is(':visible')) {
            $('#addComment').html('Add a Comment');
            $('#comments').slideUp();
        } else {
            $('#addComment').html('Hide Comments');
            $('#comments').slideDown();
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
// @t - song title, @a - song artist, @ytId - yt video id (used for Like button song share)
// @srcIndex - Song index that generated this Last.fm request. We'll check that the song
//             hasn't changed before we update the DOM.
NowPlaying.prototype.updateCurPlaying = function(t, a, ytId, _srcIndex) {
	model.lastfm.track.search({
	    artist: a || '',
	    limit: 1,
	    track: t || ''
	}, {
	    success: function(data) {
	        nowplaying._handleSongResults(t, a, ytId, _srcIndex, data);
	    },
	    error: function(code, message) {
	        log(code + ' ' + message);
	        this.renderAlbumBlock({
                albumImg: undefined,
                trackName: t,
                artistName: a,
                ytId: ytId
            });
		}
	});
};

// Private method to handle song search results from Last.fm
NowPlaying.prototype._handleSongResults = function(t, a, ytId, srcIndex, data) {
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
        this.renderSongDesc(false);
        return;
    }
                    
    var track = data.track;
    var albumName = track.album && track.album.title;
    var trackSummary = track.wiki && track.wiki.summary;
    var trackLongDesc = track.wiki && track.wiki.content;
    
    if (albumName) {
        var albumHref = '/'+canonicalize(artistName)+'/'+canonicalize(albumName);
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

NowPlaying.prototype.renderPlaylistInfo = function(playlist) {    
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
                                  .attr('rel', 'partial profile');
            } else {
                byline = $('<span/>');
            }
            byline.text(model.playlist.user.name);
            bylineContainer.text('by ').append(byline);
            log(byline);
        }
        
        $('.editLink').remove(); // remove all edit links

        nowplaying._makeEditable($('#curPlaylistTitle'), function(newTitle) {
            model.updateTitle(newTitle);
            $('#altPlaylistTitle').text(newTitle);
        });
        nowplaying._makeEditable($('#curPlaylistDesc'), model.updateDesc);
        
        $('#curPlaylist').fadeIn('fast');
    });
    
    // Change the background image
    nowplaying.setBackground(playlist.bg_original);
};

NowPlaying.prototype.renderAlbumBlock = function(data) {
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
        log(data.songHref);
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

NowPlaying.prototype.setBackground = function(image_url) {
    // TODO: Make this a nice cross-fade animation.
    var bg_style_str = "";
    if (image_url && image_url != '') {
        bg_style_str = "background-image:url('" + image_url + "');";
    }
    $('#background').attr('style', bg_style_str);
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

NowPlaying.prototype.tryLoadComments = function(url) {    
    // Optimization: Don't load Facebook comments until video is playing
    // TODO: Determine if we actually need this check.
    if (player.isPlaying()) {
        nowplaying._loadComments(url);
    } else {
        window.setTimeout(function() {
            nowplaying.tryLoadComments(url);
        }, 500);
    }
};

// Private method to load playlist's comments
NowPlaying.prototype._loadComments = function(url) {
    $('#addComment').html('Add a Comment');

    // Load Facebook comment box
    $('#comments')
        .empty()
        .html('<fb:comments href="http://instant.fm'+url+'" num_posts="3" width="480"></fb:comments>');
    FB.XFBML.parse($('#comments').get(0), function(response) {
        $('#comments')
            .appendTo('#playlistActions')
            .hide()
            .data('loaded', true);
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
            };
            buttonClass = 'large awesome white';
            break;
        default:
            autogrowSettings = $.extend({}, appSettings.autogrow);
            buttonClass = 'small awesome white';
            break;
    }
    
    elem.after($('<a class="editLink mustOwn" href="#edit">Edit</a>')
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