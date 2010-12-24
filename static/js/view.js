var View = function() {
    this.isPlayerInit = false; // have we initialized the player?
    this.player; // YouTube DOM element
    this.reorderedSong = false; // Used to distinguish between dragging and clicking
};

/* Info Display */

// Update album art to point to given src url
// @src - Image src url. Pass null to show the Unknown Album image.
// @alt - Image alt text. (required, when src != null)
View.prototype.updateAlbumImg = function(src, alt) {
    if (!src) {
        src = '/images/unknown.png';
        alt = 'Unknown album';
    }
    var img = View.makeFancyZoomImg('curAlbumImg', src, alt);  
    $('#curAlbumImg').replaceWith(img);
};

// Update artist img to point to given src url
// @src - Image src url. Pass null to show nothing.
// @alt - Image alt text. (required, when src != null)
View.prototype.updateArtistImg = function(src, alt) {    
    if (src) {
        var img = View.makeFancyZoomImg('curArtistImg', src, alt);  
        $('#curArtistImg').replaceWith(img);
        
    } else {
        $('#curArtistImg').replaceWith($('<span id="curArtistImg"></span>'));
    }
};

// Open dialog that shows more information about a song, album, or artist
// @event - the triggering event
View.prototype.showSeeMoreText = function(event) {
    event.preventDefault();

    var elem = $(this);
    var content = elem.data('content');
    
    $(this).parent().html(content);
};


/* Playlist */

// Updates the playlist table
View.prototype.renderPlaylist = function(playlist) {
    $('#curPlaylistTitle').text(playlist.title);
    $('#curPlaylistDesc').text(playlist.description);
    
    $('#playlist li').remove(); // clear the playlist
    
    $.each(playlist.songs, function(i, v) {
        $('<li id="song'+i+'"><span class="title">'+v.t+'</span><span class="artist">'+v.a+'</span><span class="handle">&nbsp;</span></li>').appendTo('#playlist');
    });
    
    $('#playlist li').click(function(event) {
        var songId = parseInt($(this).attr('id').substring(4));
        this.reorderedSong || controller.playSong(songId);
    });
    
    $('#playlist').sortable({
        axis: 'y',
        stop: function(event, ui) { view.onReorder(event, ui); },
        tolerance: 'pointer'
    }).disableSelection();
    
    $('#playlist').mouseup(function(event) {
        view.reorderedSong = null; // we're done dragging now
    });
    
    this.renderRowColoring();
};

// Recolors the playlist rows
View.prototype.renderRowColoring = function() {
    $('#playlist li')
        .removeClass('odd')
        .filter(':odd')
        .addClass('odd');
};

// Called by JQuery UI "Sortable" when a song has been reordered
// @event - original browser event
// @ui - prepared ui object (see: http://jqueryui.com/demos/sortable/)
View.prototype.onReorder = function(event, ui) {
    this.reorderedSong = true; // mark the song as reordered so we don't think it was clicked
    
    var oldId = parseInt(ui.item.attr('id').substring(4));
    var songItem = $('#song'+oldId);
    var newId = songItem.prevAll().length;
    
    if (newId == oldId) {
        return; // song didn't move
    }

    // Tell the model that a song moved
    // Note: It's acceptable that the View talks to the Model here.
    model.moveSong(oldId, newId);
    
    songItem.attr('id', ''); // Remove the reordered song's id to avoid overlap during update
    
    // Update all DOM ids to be sequential
    
    if (newId < oldId) { // Moved up
        songItem
            .nextUntil('#song'+(oldId+1))
            .each(function(index, element) {
                $(element).attr('id', 'song' + (newId+i+1) );
            });
            
    } else { // Moved down
        songItem
            .prevUntil('#song'+(oldId-1))
            .each(function(index, element) {
                $(element).attr('id', 'song' + (newId-i-1) );
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
View.prototype.initPlayer = function(firstVideoId) {
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
View.prototype.playVideoById = function(id) {
    if (this.player) {
        this.player.loadVideoById(id);
    } else {
        !this.isPlayerInit && this.initPlayer(id);
    }
};

View.prototype.play = function() {
    this.player && this.player.playVideo();
};

View.prototype.pause = function() {
    this.player && this.player.pauseVideo();
};

View.prototype.playPause = function() {
    if (!this.player) {
        return;
    }
    if (this.isPlaying()) {
        this.pauseVideo();
    } else {
        this.playVideo();
    }
};

View.prototype.isPlaying = function() {
    return this.player && (this.player.getPlayerState() == 1);
};

View.prototype.isPaused = function() {
    return this.player && (this.player.getPlayerState() == 2);
};


/* Misc */

// Open dialog that shows keyboard shortcuts
View.prototype.showHelpDialog = function() {
    event.preventDefault();
    controller.showDialog($('#help'), 'Keyboard Shortcuts');
};


/* Static functions */

// Make an image that opens a fancyzoom lightbox when clicked on
// @thumbId - id of the thumbnail image
// @src - src of the image (is same for thumbnail and large)
// @alt - image alt text
// Note: This function expects an empty div in the page with the id thumbId+'Large'
View.makeFancyZoomImg = function(thumbId, src, alt) {
    var imgLarge = $('<img alt="'+alt+'" src="'+src+'" />');
    $('#'+thumbId+'Large').empty().append(imgLarge);
    
    var img = $('<a href="#'+thumbId+'Large"></a>')
        .append('<img alt="'+alt+'" id="'+thumbId+'" src="'+src+'" />')
        .fancyZoom($.extend({}, settings.fancyZoom, { scaleImg: true }));
    
    return img;
}

