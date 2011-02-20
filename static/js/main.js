var model;
var player;
var nowplaying;
var browser;

var songIndex; // Current position in the playlist
var keyEvents = true; // Used to disable keyboard shortuts

var appSettings = {
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
    },
    fbAppId: '114871205247916'
};

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
        window.location = playlist.url;
    });
}

function onloadPlaylist() {
    model = new Model();
    player = new Player();
    nowplaying = new NowPlaying();
    browser = new MiniBrowser();
    
    setupAutogrowInputType();
    player.loadPlaylist(initial_playlist);
    
    updateDisplay();
    $(window).resize(updateDisplay);
    
    // Gets called when there is a browser history change event (details: http://goo.gl/rizNN)
    // If there is saved state, load the correct playlist.
    window.onpopstate = function(event) {
        var state = event.state;
        log(state);
        if (state && state.url != model.playlist.url) {
            player.loadPlaylistByUrl(state.url);
        }
    };
    
    setupKeyboardShortcuts();
    setupFBML(initial_playlist);
    setupSignup();
    setupLogin();
    setupLogout();
    setupNewPlaylist();
   
    setupDragDropUploader('p', player.loadPlaylist);
}
