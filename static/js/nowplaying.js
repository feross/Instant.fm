// TODO: Refactor this to use jQuery templates and clean it up.

/* ------------------- NOW PLAYING VIEW -------------------- */

function PlaylistView() {
    $('#addComment').click(function(event) {
        event.preventDefault();
        playlistview.showHideComments();
    });
    
    $('#fbShare').click(function(event) {
        event.preventDefault();
        playlistview.shareOnFacebook();
    });
    
    $('#twShare').click(function(event) {
        event.preventDefault();
        playlistview.shareOnTwitter();
    });
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
        .html('<fb:comments numposts="5" width="480" simple="1" publish_feed="true" css="http://instant.fm/css/fbcomments.css?58" notify="true" title="'+title+'" xid="playlist_'+playlist_id+'"></fb:comments>');
    FB.XFBML.parse(document.getElementById('comments'), function(reponse) {
        $('#commentsDiv')
            .appendTo('#curPlaylist')
            .hide()
            .data('loaded', true);
    });
    
    // Resize comment box on comment
    FB.Event.subscribe('comments.add', function(response) {
        $('#commentsDiv').height('auto'); // default
    });
};

PlaylistView.prototype.showHideComments = function() {
    if (!$('#commentsDiv').data('loaded')) {
        return;
    }
    
    if ($('#commentsDiv').is(':visible')) {
        $('#addComment').html('Add a Comment');
        $('#commentsDiv').slideUp();
    } else {
        $('#addComment').html('Hide Comments');
        $('#commentsDiv').slideDown();
    }
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
    
    elem.after($('<a class="editLink" href="#edit">Edit</a>')
        .click(function(event) {
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


PlaylistView.prototype.shareOnFacebook = function() {
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
};

PlaylistView.prototype.shareOnTwitter = function() {
    var tweetText = encodeURIComponent("♫ I'm listening to "+model.title);
    var url = 'http://twitter.com/share'+
              '?url=http://instant.fm/p/'+model.playlistId+
              '&text='+tweetText+'&via=instantDOTfm';
    showPop(url, 'instantfmTwitterShare');
};

PlaylistView.prototype.shareOnBuzz = function() {
    var url = 'http://www.google.com/buzz/post?url=http://instant.fm/p/'+model.playlistId;
    showPop(url, 'instantfmBuzzShare', 420, 700);
};