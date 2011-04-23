var model;
var player;
var nowplaying;
var browser;

var keyEvents = true; // Are keyboard shortuts enabled?
var colorboxOpen = false; // Is a colorbox open?
var soundManagerLoaded = false; // Is SoundManager2 loaded?

soundManager.url = '/swf/';
soundManager.flashVersion = 8; // optional: shiny features (default = 8)
//soundManager.useHTML5Audio = true;
soundManager.onload = function() {
    soundManagerLoaded = true;
};

var appSettings = {
    autogrow: {
        expandTolerance: 0.001,
        lineHeight: 16,
    },
    fbAppId: window.location.host != 'localhost' ? '114871205247916' : '186788488008637',
    fbPageURL: 'http://www.facebook.com/pages/Instantfm/198137876872500',
    jeditable: {
        data: function(value, settings) {
            // Turn <br>s into newlines before user edits text.
            var retval = value.replace(/<br>/gi, '\n');
            
            // Decode HTML before the user edits text. (&amp; -> &)
            retval = htmlDecode(retval);
            return retval;
        },
        event: 'editable', // custom jQuery event
        onblur: 'submit',
        submit: 'Save',
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

function onloadHome(session) {
    model = new Model();
    player = new Player();

    setSession(session);
    
    // Gets called when there is a browser history change event (details: http://goo.gl/rizNN)
    // If there is saved state, load the correct playlist.
    window.onpopstate = function(event) {
        var state = event.state;
        if (state && state.url != model.playlist.url) {
            player.loadPlaylistByUrl(state.url);
        }
    };

    setupFBML();
    setupSignup();
    setupLogin();
    setupLogout();
    setupNewPlaylist();
    setupRpc();
}

function onloadPlaylist(session) {
    model = new Model();
    player = new Player();
    nowplaying = new NowPlaying();
    browser = new MiniBrowser();
    
    setSession(session);
    
    updateDisplay();
    $(window).resize(updateDisplay);
    
    // Gets called when there is a browser history change event (details: http://goo.gl/rizNN)
    // If there is saved state, load the correct playlist.
    window.onpopstate = function(event) {
        var state = event.state;
        if (state && state.url != model.playlist.url) {
            player.loadPlaylistByUrl(state.url);
        }
    };
    
    // Page may scroll in odd circumstances, like when selecting text.
    // Don't allow page to scroll.
    $(window).scroll(function(event) {
        window.setTimeout(function() {
            $('body').scrollTop(0);
        }, 0);
    });
    $('#main').scroll(function(event) {
        window.setTimeout(function() {
            $('#main').scrollTop(0);
        }, 0);
    });
    
    setupKeyboardShortcuts();
    setupFBML();
    setupSignup();
    setupLogin();
    setupLogout();
    setupNewPlaylist();
    setupRpc();
}
