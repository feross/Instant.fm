function View() {
    this.isPlayerInit = false; // have we initialized the player?
    this.player; // YouTube DOM element
    this.reorderedSong = false; // Used to distinguish between dragging and clicking
    this.renderPlaylistChunkSize = 400; // Render playlist in chunks so we don't lock up the browser
    this.renderPlaylistTimeout = 40; // Time between rendering each chunk


    /* Info Display */

    // Update album art to point to given src url
    // @src - Image src url. Pass null to show the Unknown Album image.
    // @alt - Image alt text. (required, when src != null)
    this.updateAlbumImg = function(src, alt) {
        if (!src) {
            src = '/images/unknown.png';
            alt = 'Unknown album';
        }
        var imgBlock = makeFancyZoomImg('curAlbumImg', src, alt);

        $('#curAlbumImg').replaceWith(imgBlock);
    };

    // Update artist img to point to given src url
    // @src - Image src url. Pass null to show nothing.
    // @alt - Image alt text. (required, when src != null)
    this.updateArtistImg = function(src, alt) {    
        if (src) {
            var imgBlock = makeFancyZoomImg('curArtistImg', src, alt);  
            $('#curArtistImg').replaceWith(imgBlock);
        
        } else {
            $('#curArtistImg').replaceWith($('<span id="curArtistImg"></span>'));
        }
    };

    // Open dialog that shows more information about a song, album, or artist
    // @event - the triggering event
    this.showSeeMoreText = function(event) {
        event.preventDefault();

        var elem = $(this);
        var content = elem.data('content');
    
        $(this).parent().html(content);
    };


    /* Playlist */

    // Updates the playlist table
    this.renderPlaylist = function(playlist, start) {
        if (!start) {
            start = 0;
        
            $('#curPlaylistTitle').text(playlist.title);
            $('#curPlaylistDesc').text(playlist.description);

            $('#playlist li').remove(); // clear the playlist
        }
    
        if (start >= playlist.songs.length) { // we're done
            $('#playlist').sortable({
                axis: 'y',
                scrollSensitivity: 30,
                start: function(event, ui) { $('body').toggleClass('sorting', true); },
                stop: function(event, ui) {
                    view.onReorder(event, ui);
                    $('body').toggleClass('sorting', false);
                },
                tolerance: 'pointer'
            }).disableSelection();
        
            $('#playlist').mouseup(function(event) {
                view.reorderedSong = null; // we're done dragging now
            });

            view.renderRowColoring();
            return;
        }

        var end = Math.min(start + view.renderPlaylistChunkSize, playlist.songs.length);

        for (var i = start; i < end; i++) {
            var v = playlist.songs[i];
            $('<li id="song'+i+'">\
                 <span class="title">'+v.t+'</span><span class="artist">'+v.a+'</span><span class="handle">&nbsp;</span>\
               </li>')
                .appendTo('#playlist')
                .click(function(event) {
                    var songId = parseInt($(this).attr('id').substring(4));
                    view.reorderedSong || controller.playSong(songId);
                });
        }
    
        window.setTimeout(function() {
            view.renderPlaylist(playlist, start + view.renderPlaylistChunkSize);
        }, view.renderPlaylistTimeout);
    };


    // Recolors the playlist rows
    this.renderRowColoring = function() {
        $('#playlist li')
            .removeClass('odd')
            .filter(':odd')
            .addClass('odd');
    };

    // Called by JQuery UI "Sortable" when a song has been reordered
    // @event - original browser event
    // @ui - prepared ui object (see: http://jqueryui.com/demos/sortable/)
    this.onReorder = function(event, ui) {
        this.reorderedSong = true; // mark the song as reordered so we don't think it was clicked
    
        var oldId = parseInt(ui.item.attr('id').substring(4));
        var songItem = $('#song'+oldId);
        var newId = songItem.prevAll().length;
    
        if (newId == oldId) {
            return; // song didn't move
        }

        controller.moveSong(oldId, newId);
    
        songItem.attr('id', ''); // Remove the reordered song's id to avoid overlap during update
    
        // Update all DOM ids to be sequential
    
        if (newId < oldId) { // Moved up
            songItem
                .nextUntil('#song'+(oldId+1))
                .each(function(index, element) {
                    $(element).attr('id', 'song' + (newId+index+1) );
                });
            
        } else { // Moved down
            songItem
                .prevUntil('#song'+(oldId-1))
                .each(function(index, element) {
                    $(element).attr('id', 'song' + (newId-index-1) );
                });
        }
    
        songItem.attr('id', 'song'+newId); // Add back the reordered song's id
    
        // If we move the current song, keep our position in the playlist up to date
        if (oldId == controller.songIndex) {
            controller.songIndex = newId;
        }
    
        this.renderRowColoring();
    };


    /* Player */

    // Initialize the YouTube player
    this.initPlayer = function(firstVideoId) {
        this.isPlayerInit = true;
    
        var params = {
            allowScriptAccess: "always",
            wmode : 'opaque' // Allow lightboxes to cover player
        };
        var atts = {
            id: 'ytPlayer',
            allowFullScreen: 'true'
        };
        swfobject.embedSWF('http://www.youtube.com/v/' + firstVideoId +
        '&enablejsapi=1&playerapiid=ytPlayer&rel=0&autoplay=1&egm=0&loop=0' +
        '&fs=1&hd=1&showsearch=0&showinfo=0&iv_load_policy=3&cc_load_policy=1' +
        '&color1=0xFFFFFF&color2=0xFFFFFF',
        'player', '480', '295', '8', null, null, params, atts);
    };

    // Play video with given id
    this.playVideoById = function(id) {
        if (this.player) {
            this.player.loadVideoById(id);
        } else {
            !this.isPlayerInit && this.initPlayer(id);
        }
    };

    this.play = function() {
        this.player && this.player.playVideo();
    };

    this.pause = function() {
        this.player && this.player.pauseVideo();
    };

    this.playPause = function() {
        if (!this.player) {
            return;
        }
        if (this.isPlaying()) {
            this.pause();
        } else {
            this.play();
        }
    };

    this.isPlaying = function() {
        return this.player && (this.player.getPlayerState() == 1);
    };

    this.isPaused = function() {
        return this.player && (this.player.getPlayerState() == 2);
    };


    /* Misc */

    // Open dialog that shows keyboard shortcuts
    this.showHelpDialog = function() {
        event.preventDefault();
        controller.showDialog($('#help'), 'Keyboard Shortcuts');
    };

};


/* Utility functions */

// Make an image that opens a fancyzoom lightbox when clicked on
// @thumbId - id of the thumbnail image
// @src - src of the image (is same for thumbnail and large)
// @alt - image alt text
// Note: This function expects an empty div in the page with the id thumbId+'Zoom'
function makeFancyZoomImg(thumbId, src, alt) {
    var imgZoom = $('<img alt="'+alt+'" src="'+src+'" />');
    $('#'+thumbId+'Zoom').empty().append(imgZoom);
    
    return $('<a class="reflect" href="#'+thumbId+'Zoom" id="'+thumbId+'"> \
                <img alt="'+alt+'" src="'+src+'" /> \
                <span class="zoomIcon" /> \
              </a>')
               .fancyZoom($.extend({}, settings.fancyZoom, { closeOnClick: true, scaleImg: true }));
}

function makeSeeMoreLink(title, content) {
    return $('<span> </span><a class="seeMore" href="#seeMore">(see more)</a>')
        .data('content', content)
        .click(view.showSeeMoreText);
}

