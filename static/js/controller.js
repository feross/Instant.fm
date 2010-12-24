var Controller = function() {
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
// @response - response body
Controller.prototype.loadPlaylist = function(response) {
    if ($.isPlainObject(response)) { // playlist is embedded in html
        var playlist = response;
        window.history.replaceState({playlistId: playlist.id}, playlist.title, '/p/'+playlist.id);

    } else { // playlist is from xhr response      
        var playlist = $.parseJSON(response);
        if(playlist.status != 'ok') {
            log('Error loading playlist: ' + playlist.status);
            return;
        }
        window.history.pushState({playlistId: playlist.id}, playlist.title, '/p/'+playlist.id);
        $('#infoDisplay').effect('pulsate');        
    }
    
    model.updatePlaylist(playlist);
    view.renderPlaylist(playlist);
    
    controller.playSong(0);
    log('Loaded playlist: ' + playlist.id);
};

// Load a playlist with the given id
Controller.prototype.loadPlaylistById = function(id) {
    var the_url = '/p/'+id+'/json';
    $.ajax({
        dataType: 'json',
        type: 'GET',
        url: the_url,
        success: function(responseData, textStatus, XMLHttpRequest) {
            controller.loadPlaylist(responseData);
        }
    });
};

// Play a song at the given playlist index
Controller.prototype.playSong = function(i) {
    this.songIndex = i;
    var song = model.songs[i];
    var title = Controller.cleanSongTitle(song.t);
    var artist = song.a;
    
    var q = title + ' ' + artist;
    this.playSongBySearch(q);
 
    $('.playing').toggleClass('playing');
    $('#song' + i).toggleClass('playing');
    
    this.updateCurPlaying(title, artist);
};

// Play next song in the playlist
Controller.prototype.playNextSong = function() {
    if (this.songIndex == model.songs.length - 1) {
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
        dataType: 'jsonp',
        type: 'GET',
        url: the_url,
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

// Move song in the playlist
// @oldIndex - old playlist position
// @newIndex - new playlist position
Controller.prototype.moveSong = function(oldIndex, newIndex) {
    model.moveSong(oldIndex, newIndex);
    
    var the_url = '/p/'+model.playlistId+'/edit';
    $.ajax({
        data: '&songs='+encodeURIComponent(JSON.stringify(model.songs)),
        dataType: 'json',
        type: 'POST',
        url: the_url,
        success: function(responseData, textStatus, XMLHttpRequest) {
            log(responseData);
        }
    });
}

// Gets called when there is a browser history change event (details: http://goo.gl/rizNN)
// If there is saved state, load the correct playlist.
Controller.prototype.onPopState = function(event) {
    var state = event.state;
    if (state && state.playlistId != model.playlistId) {
        controller.loadPlaylistById(state.playlistId);
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
                    albumName && $('#curAlbumImg').attr('alt', albumAlt);
                    
                    // Update song summary
                    if (trackSummary) {                        
                        $('#curSongDesc article').html(Controller.cleanHTML(trackSummary));
                        $('#curSongDesc h4').text('About ' + track.name);
                        $('#curSongDesc').fadeIn('fast');
                    }
                    
                    // Add link to longer description
                    if (trackLongDesc) {
                        var content = Controller.cleanHTML(trackLongDesc);                        
                        var link = Controller.makeSeeMoreLink(track.name, content);
                        link.appendTo('#curSongDesc article');
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
                        $('#curArtistDesc article').html(Controller.cleanHTML(artistSummary));
                        $('#curArtistDesc h4').text('About ' + artistName);
                        $('#curArtistDesc').fadeIn('fast');
                    }
                    
                    // Add link to longer description
                    if (artistLongDesc) {
                        var content = Controller.cleanHTML(artistLongDesc);                        
                        var link = Controller.makeSeeMoreLink(artistName, content);
                        link.appendTo('#curArtistDesc article');
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
    view.player = document.getElementById(playerId);
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


/* Static functions */

// Remove unecessary parenthesized text from song titles. It messes up YouTube/Last.fm searches.
Controller.cleanSongTitle = function(title) {
    return title.replace(/[\(\[]((feat|ft|produce|dirty|clean)|.*?(version|edit)).*?[\)\]]/gi, '');
};

// Prepare Remove all html tags
Controller.cleanHTML = function(html) {
    var r = new RegExp('</?\\w+((\\s+\\w+(\\s*=\\s*(?:".*?"|\'.*?\'|[^\'">\\s]+))?)+\\s*|\\s*)/?>', 'gi');   
    return html
        .replace(r, '') // Remove HTML tags (http://bit.ly/DdoNo)
        .replace(new RegExp('[\n\r]', 'g'), '<br>'); // Convert newlines to <br>
};

Controller.makeSeeMoreLink = function(title, content) {
    return $('<span> </span><a class="seeMore" href="#seeMore">(see more)</a>')
        .data('content', content)
        .click(view.showSeeMoreText);
}