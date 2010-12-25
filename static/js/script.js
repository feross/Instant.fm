var model;
var view;
var controller;

var settings = {
    fancyZoom : { directory: '/images/fancyzoom' },
};

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
    var newHeight = $(window).height() - $('#videoDiv').height();
    newHeight = (newHeight < 100) ? 100 : newHeight;
    
    $('#playlist').height(newHeight);
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

