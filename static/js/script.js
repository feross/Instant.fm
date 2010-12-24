var model;
var view;
var controller;

var settings = {
    fancyZoom : { closeOnClick: true, directory: '/images/fancyzoom' },
};

// Onload event
$(function() {
    view = new View();
    model = new Model();
    controller = new Controller();
    
    controller.loadPlaylist(initial_playlist);
    
    setupScrollingListeners();
    setupKeyboardListeners();

    $('#helpLink').fancyZoom(settings.fancyZoom);
    
    window.onpopstate = controller.onPopState;
     
    new uploader('container', null, '/upload', null, controller.loadPlaylist); // HTML5 dragdrop upload
});

function setupScrollingListeners() {
    var videoDiv = $('#videoDiv');
    var videoDivOffset = $('#outerVideoDiv').offset().top;
    $(window).scroll(function(){
        if ($(window).scrollTop() > videoDivOffset) {
            videoDiv.css('top', 0);
        } else {
            videoDiv.css('top', videoDivOffset - $(window).scrollTop());
        }        
    });
}

function setupKeyboardListeners() {
    var SHIFT = 16;
    $(window).keydown(function(event) {
        var k = event.keyCode;
        controller.pressedKeys.push(k);
        
        if (k == 39 || k == 40) { // down, right
            controller.playNextSong();
        } else if (k == 37 || k == 38) { // up, left
            controller.playPrevSong();
        } else if (k == 32) { // space
            playPause();
        } else if (k == 191 && $.inArray(SHIFT, controller.pressedKeys) > -1) { // ?
            $('#helpLink').click();
        } else {
            return true; // default event
        }
        event.preventDefault(); // prevent default event
    });
    $(window).keyup(function(event) {
        $.grep(controller.pressedKeys, function(element, index) {
            return element != event.keyCode;
        });
    });
}

