var player;
var browser;
var model;

var playlistview; // TODO: Generalize this so it is part of the view stack
var viewStack = [];

var songIndex; // Current position in the playlist
var keyEvents = true; // Used to disable keyboard shortuts

var appSettings = {
    fancyZoom: {directory: '/images/fancyzoom'},
    jeditable: {
        event: 'editable', // custom jQuery event
        onblur: 'ignore',
        submit: 'Update',
        tooltip: 'Click to edit',
        type: 'autogrow',
        autogrow: {
            maxHeight: 512
        }
    },
    sortable: {
        axis: 'y',
        scrollSensitivity: 25,
        tolerance: 'pointer'
    }
};


/* --------------------------- ON LOAD --------------------------- */

function onloadHome() {
    $('.file').change(function(event) {
        var val = $(this).val();
        if (val.length) {
            $('#uploadForm').submit();
        }
    });
    setupDragDropUploader('home', function(response) {
        // Redirect to playlist with the given id
        var playlist = $.parseJSON(response);
        if(playlist.status != 'ok') {
            log('Error loading playlist: ' + playlist.status);
            return;
        }
        var id = playlist.playlist_id;
        window.location = '/p/'+id;
    });
}


function onloadPlaylist() {
    model = new Model();
    player = new Player();
    browser = new MiniBrowser();
    playlistview = new PlaylistView();
    
    setupAutogrowInputType();
    player.loadPlaylist(initial_playlist);
    
    updateDisplay();
    $(window).resize(updateDisplay);
    
    // Gets called when there is a browser history change event (details: http://goo.gl/rizNN)
    // If there is saved state, load the correct playlist.
    window.onpopstate = function(event) {
        var state = event.state;
        if (state && state.playlistId != model.playlistId) {
            player.loadPlaylistById(state.playlistId);
        }
    };
    
    setupKeyboardShortcuts();
    setupFBML(initial_playlist);
    setupRegistration();
    setupLogin();
    setupLogout();
    $('#helpLink').fancyZoom(appSettings.fancyZoom);
   
    setupDragDropUploader('p', player.loadPlaylist);
}
