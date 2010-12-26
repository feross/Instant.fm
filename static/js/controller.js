var model;
var view;
var controller;

var settings = {
    fancyZoom : { directory: '/images/fancyzoom' },
};
// jQuery.fx.off = true;

// Onload event
$(function() {
    view = new View();
    model = new Model();
    controller = new Controller();
    
    controller.loadPlaylist(initial_playlist);
    
    setupPlaylistDisplay();
    setupKeyboardListeners();

    $('#helpLink').fancyZoom(settings.fancyZoom);
    
    window.onpopstate = controller.onPopState;
    $(window).resize(setupPlaylistDisplay);
    
    new uploader('container', null, '/upload', null, controller.loadPlaylist); // HTML5 dragdrop upload
});

function setupPlaylistDisplay() {
    var maxPlaylistHeight = $(window).height() - (50 + 295 + 1); /* header, player, player border */
    var newHeight = Math.min($('#playlist').height(), maxPlaylistHeight);
    $('#playlistDiv').height(newHeight);
}

// Set up keyboard shortcuts in a cross-browser manner. (Tested in Firefox, Chrome, Safari)
// Keyboard events are a mess: http://www.quirksmode.org/js/keys.html
// TODO: Test in IE
function setupKeyboardListeners() {
    
    // Detect keys
    $(window).keydown(function(event) {
        var k = event.which;
        
        if (k == 39 || k == 40) { // down, right
            controller.playNextSong();
        } else if (k == 37 || k == 38) { // up, left
            controller.playPrevSong();
        } else if (k == 32) { // space
            view.playPause();
        } else {
            return true; // default event
        }
        
        event.preventDefault(); // prevent default event    
    });
    
    // Detect characters
    $(window).keypress(function(event) {
        var k = event.charCode || event.keyCode;
              
        if (k == 63) { // ? mark character
            $('#helpLink').click();
        } else {
            return true; // default event
        }
        
        event.preventDefault(); // prevent default event    
    });
}


function Controller() {
    this.songIndex; // Current position in the playlist
    this.queuedVideo;
    this.queuedLastfm = { title: null, artist: null };
    this.lastfmReqs = [false, false, false];

    // Load a playlist based on the xhr response or the initial embedded playlist
    // @response - response body
    this.loadPlaylist = function(response) {
        if ($.isPlainObject(response)) { // playlist is embedded in html
            var playlist = response;
            if(Modernizr.history) {
                window.history.replaceState({playlistId: playlist.id}, playlist.title, '/p/'+playlist.id);
            }

        } else { // playlist is from xhr response      
            var playlist = $.parseJSON(response);
            if(playlist.status != 'ok') {
                log('Error loading playlist: ' + playlist.status);
                return;
            }
            if(Modernizr.history) {
                window.history.pushState({playlistId: playlist.id}, playlist.title, '/p/'+playlist.id);
            }
            $('#infoDisplay').effect('pulsate');        
        }
    
        model.updatePlaylist(playlist);
        view.renderPlaylist(playlist);
    
        controller.playSong(0);
        log('Loaded playlist: ' + playlist.id);
    };

    // Load a playlist with the given id
    this.loadPlaylistById = function(id) {
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
    this.playSong = function(i) {
        this.songIndex = i;
        var song = model.songs[i];
        var title = cleanSongTitle(song.t);
        var artist = song.a;
    
        var q = title + ' ' + artist;
        this.playSongBySearch(q);
 
        $('.playing').toggleClass('playing');
        $('#song' + i).toggleClass('playing');
    
        this.updateCurPlaying(title, artist);
    };

    // Play next song in the playlist
    this.playNextSong = function() {
        if (this.songIndex == model.songs.length - 1) {
            return;
        }
        this.playSong(++this.songIndex);
    };

    // Play prev song in the playlist
    this.playPrevSong = function() {
        if (this.songIndex == 0) {
            return;
        }
        this.playSong(--this.songIndex);
    };

    // Play top video for given search query
    this.playSongBySearch = function(q) {
        var the_url = 'http://gdata.youtube.com/feeds/api/videos?q=' + encodeURIComponent(q) + '&format=5&max-results=1&v=2&alt=jsonc'; // Restrict search to embeddable videos with &format=5.
        $.ajax({
            dataType: 'jsonp',
            type: 'GET',
            url: the_url,
            success: function(responseData, textStatus, XMLHttpRequest) {
                if (responseData.data.items) {
                    var videos = responseData.data.items;
                    controller.playSongById(videos[0].id)
                } else {
                    controller.playNextSong();
                    log('No songs found for: ' + q);
                }
            }
        });
    };

    // Attempts to play the video with the given ID. If the player is in a loading state,
    // we queue up the video. We don't want to interrupt the player since that causes the
    // "An error occurred, please try again later" message.
    this.playSongById = function(id) {
        if (view.player && view.player.getPlayerState() == 3) { // Don't interrupt player while it's loading
            this.queuedVideo = id;
        
        } else { // Play it immediately
            view.playVideoById(id); 
        }
    };

    // Move song in the playlist
    // @oldIndex - old playlist position
    // @newIndex - new playlist position
    this.moveSong = function(oldIndex, newIndex) {
        model.moveSong(oldIndex, newIndex);
    
        var the_url = '/p/'+model.playlistId+'/edit';
        $.ajax({
            data: '&songs='+encodeURIComponent(JSON.stringify(model.songs)),
            dataType: 'json',
            type: 'POST',
            url: the_url,
            success: function(responseData, textStatus, XMLHttpRequest) {
                // TODO: Show a throbber while request is being sent.
                log('Server received move POST.');
            }
        });
    };

    // Gets called when there is a browser history change event (details: http://goo.gl/rizNN)
    // If there is saved state, load the correct playlist.
    this.onPopState = function(event) {
        var state = event.state;
        if (state && state.playlistId != model.playlistId) {
            controller.loadPlaylistById(state.playlistId);
        }
    };

    // Update the currently playing song with Last.fm data
    // TODO: Find a way to decompose this monstrous function
    this.updateCurPlaying = function(t, a) {
        
        if ($.inArray(true, controller.lastfmReqs) != -1) { // something is processing, so queue this request
            this.queuedLastfm.title = t;
            this.queuedLastfm.artist = a;
            return;
        } else { // lock and start processing request
            this.lastfmReqStarted(1);
        }
    
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
    	model.lastfm.track.search({
    	    artist: a,
    	    limit: 1,
    	    track: t
    	}, {

    	    success: function(data){
    	        controller.lastfmReqEnded(1);
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
                controller.lastfmReqStarted(2);
                trackName && artistName && model.lastfm.track.getInfo({
            	    artist: artistName,
            	    autocorrect: 1,
            	    track: trackName
            	}, {
        	    
            	    success: function(data){
            	        controller.lastfmReqEnded(2);
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
                            $('#curSongDesc article').html(cleanHTML(trackSummary));
                            $('#curSongDesc h4').text('About ' + track.name);
                            $('#curSongDesc').fadeIn('fast');
                        }
                    
                        // Add link to longer description
                        if (trackLongDesc) {
                            var content = cleanHTML(trackLongDesc);                        
                            var link = makeSeeMoreLink(track.name, content);
                            link.appendTo('#curSongDesc article');
                        }
            	    },

            	    error: function(code, message) {
            	        controller.lastfmReqEnded(2);
            	        log(code + ' ' + message);
            		}
            	});
        	
            	// 3. Get detailed artist info (proceeds simultaneously with 2)
            	controller.lastfmReqStarted(3);
            	artistName && model.lastfm.artist.getInfo({
            	    artist: artistName,
            	    autocorrect: 1
            	}, {
        	    
            	    success: function(data){
            	        controller.lastfmReqEnded(3);
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
                            $('#curArtistDesc article').html(cleanHTML(artistSummary));
                            $('#curArtistDesc h4').text('About ' + artistName);
                            $('#curArtistDesc').fadeIn('fast');
                        }
                    
                        // Add link to longer description
                        if (artistLongDesc) {
                            var content = cleanHTML(artistLongDesc);                        
                            var link = makeSeeMoreLink(artistName, content);
                            link.appendTo('#curArtistDesc article');
                        }
            	    },

            	    error: function(code, message) {
            	        controller.lastfmReqEnded(3);
            	        log(code + ' ' + message);
            		}
            	});
    	    },
	    
    	    error: function(code, message) {
    	        controller.lastfmReqEnded(1);
    	        log(code + ' ' + message);
    	        $('#curSong h4').text(t);
                $('#curArtist h4').text(a);
                view.updateAlbumImg(null);
                hide();
    		}
    	});
    };
    
    // Call this each time we make an xhr request to Last.fm.
    this.lastfmReqStarted = function(req) {
        log('started '+req);
        controller.lastfmReqs[req - 1] = true;
    };
    
    // Call this each time we receive an xhr response from Last.fm.
    this.lastfmReqEnded = function(req) {
        log('ended '+req);
        controller.lastfmReqs[req - 1] = false;
        
        if ($.inArray(true, controller.lastfmReqs) == -1) { // all requests are finished processing
            var title = controller.queuedLastfm.title;
            var artist = controller.queuedLastfm.artist;
            if (title || artist) {
                controller.queuedLastfm.title = null;
                controller.queuedLastfm.artist = null;
                controller.updateCurPlaying(title, artist);
            }
        }
    };
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
            if (controller.queuedVideo) {
                controller.playSongById(controller.queuedVideo);
                controller.queuedVideo = null;
            }
            break;
        case 2: // paused
            $('.playing').toggleClass('paused', true);
            break;
    }
}


/* Utility functions */

// Remove unecessary parenthesized text from song titles. It messes up YouTube/Last.fm searches.
function cleanSongTitle(title) {
    return title.replace(/[\(\[]((feat|ft|produce|dirty|clean)|.*?(version|edit)).*?[\)\]]/gi, '');
};

// Prepare Remove all html tags
function cleanHTML(html) {
    var r = new RegExp('</?\\w+((\\s+\\w+(\\s*=\\s*(?:".*?"|\'.*?\'|[^\'">\\s]+))?)+\\s*|\\s*)/?>', 'gi');   
    return html
        .replace(r, '') // Remove HTML tags (http://bit.ly/DdoNo)
        .replace(new RegExp('[\n\r]', 'g'), '<br>'); // Convert newlines to <br>
};