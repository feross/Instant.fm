var Controller = function() {
    this.playlistId; // Current loaded playlist
    this.songIndex; // Current position in the playlist
    this.pressedKeys = []; // Current pressed keys

    // TODO: Move to model?
    var cache = new LastFMCache();
	this.lastfm = new LastFM({
		apiKey    : '414cf82dc17438b8c880f237a13e5c09',
		apiSecret : '02cf123c38342b2d0b9d3472b65baf82',
		cache     : cache
	});
};

// Load a playlist based on the xhr response or the initial embedded playlist
// @responseJSON - response body
Controller.prototype.loadPlaylist = function(responseJSON) {
    if ($.isPlainObject(responseJSON)) { // playlist is embedded in html        
        var response = responseJSON;
        window.history.replaceState({playlistId: response.id}, response.title, '/p/'+response.id);

    } else { // playlist is from xhr response      
        var response = $.parseJSON(responseJSON);
        if(response.status != 'ok') {
            log('Error loading playlist: ' + response.status);
            return;
        }
        window.history.pushState({playlistId: response.id}, response.title, '/p/'+response.id);
        $('#infoDisplay').effect('pulsate');        
    }
    
    playlist = new Playlist(response);
    controller.playSong(0);
    log('Loaded playlist: ' + controller.playlistId);
};

// Load a playlist with the given id
Controller.prototype.loadPlaylistById = function(id) {
    // TODO: Implement me.
};

// Play a song at the given playlist index
Controller.prototype.playSong = function(i) {
    this.songIndex = i;
    var song = playlist.songs[i];
    var title = cleanSongTitle(song.t);
    var artist = song.a;
    
    var q = title + ' ' + artist;
    this.playSongBySearch(q);
 
    $('.playing').toggleClass('playing');
    $('#song' + i).toggleClass('playing');
    
    this.updateCurPlaying(title, artist);
};

// Play next song in the playlist
Controller.prototype.playNextSong = function() {
    if (this.songIndex == playlist.songs.length - 1) {
        return;
    }
    this.playSong(++this.songIndex);
};

// Play prev song in the playlist
Controller.prototype.playPrevSong = function() {
    if (this.songIndex == 0) {
        return;
    }
    this.playSong(--this.songIndex);
};

// Play top video for given search query
Controller.prototype.playSongBySearch = function(q) {
    var the_url = 'http://gdata.youtube.com/feeds/api/videos?q=' + encodeURIComponent(q) + '&format=5&max-results=1&v=2&alt=jsonc'; // Restrict search to embeddable videos with &format=5.

    $.ajax({
        type: "GET",
        url: the_url,
        dataType: "jsonp",
        success: function(responseData, textStatus, XMLHttpRequest) {
            if (responseData.data.items) {
                var videos = responseData.data.items;
                view.playVideoById(videos[0].id);
            } else {
                controller.playNextSong();
            }
        }
    });
};

// Gets called when there is a browser history change event (details: http://goo.gl/rizNN)
// If there is saved state, load the correct playlist.
Controller.prototype.onPopState = function(event) {
    var state = event.state;
    if (state) {
        controller.loadPlaylistById(parseInt(state.playlistId));
    }
}

// Update the currently playing song with Last.fm data
// TODO: Find a way to decompose this monstrous function
Controller.prototype.updateCurPlaying = function(t, a) {
    
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
    that = this;
	this.lastfm.track.search({
	    artist: a,
	    limit: 1,
	    track: t
	}, {

	    success: function(data){
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
            view.updateAlbumImg(albumImg, ''); // We'll set alt text once we know album name
            
            // 2. Get detailed track info
            trackName && artistName && that.lastfm.track.getInfo({
        	    artist: artistName,
        	    autocorrect: 1,
        	    track: trackName
        	}, {
        	    
        	    success: function(data){
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
                    albumName && $('#curAlbumArt').attr('alt', albumAlt);
                    
                    // Update song summary
                    if (trackSummary) {                        
                        $('#curSongDesc div').html(cleanHTML(trackSummary));
                        $('#curSongDesc h4').text('About ' + track.name);
                        $('#curSongDesc').fadeIn('fast');
                    }
                    
                    // Add link to longer description
                    if (trackLongDesc) {
                        var content = cleanHTML(trackLongDesc);
                        content = highlightHTML(content, [artistName, albumName, track.name]);
                        
                        var link = makeSeeMoreLink(track.name, content);
                        link.appendTo('#curSongDesc div');
                    }
        	    },

        	    error: function(code, message) {
        	        log(code + ' ' + message);
        		}
        	});
        	
        	// 2. Get detailed artist info
        	artistName && that.lastfm.artist.getInfo({
        	    artist: artistName,
        	    autocorrect: 1
        	}, {
        	    
        	    success: function(data){        	        
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
                    if (artistSummary) {                        
                        $('#curArtistDesc div').html(cleanHTML(artistSummary));
                        $('#curArtistDesc h4').text('About ' + artistName);
                        $('#curArtistDesc').fadeIn('fast');
                    }
                    
                    // Add link to longer description
                    if (artistLongDesc) {
                        var content = cleanHTML(artistLongDesc);
                        content = highlightHTML(content, [artistName, trackName]);
                        
                        var link = makeSeeMoreLink(artistName, content);
                        link.appendTo('#curArtistDesc div');
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


/* Player Events */

function onYouTubePlayerReady(playerId) {
    view.player = document.getElementById("ytPlayer");
    view.player.addEventListener("onStateChange", "onYouTubePlayerStateChange");
}

function onYouTubePlayerStateChange(newState) {
    switch(newState) {
        case 0: // just finished a video
            controller.playNextSong();
            break;
        case 1: // playing
            $('.playing').toggleClass('paused', false);
            break;
        case 2: // paused
            $('.playing').toggleClass('paused', true);
            break;
    }
}