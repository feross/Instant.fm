var playlist; // ??

var model;
var view;
var controller;

var settings = {
    fancyZoom : {
        closeOnClick: true,
        directory: '/images/fancyzoom',
    },
};

/* Onload Event */
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


/* Utility functions */

// Remove unecessary parenthesized text from song titles. It messes up YouTube/Last.fm searches.
function cleanSongTitle(title) {
    return title.replace(/[\(\[]((feat|ft|produce|dirty|clean)|.*?(version|edit)).*?[\)\]]/gi, '');
}

// Prepare Remove all html tags
function cleanHTML(html) {
    var r = new RegExp('</?\\w+((\\s+\\w+(\\s*=\\s*(?:".*?"|\'.*?\'|[^\'">\\s]+))?)+\\s*|\\s*)/?>', 'gi');   
    return html
        .replace(r, '') // Remove HTML tags (http://bit.ly/DdoNo)
        .replace(new RegExp('[\n\r]', 'g'), '<br>'); // Convert newlines to <br>
}

// Highlight all occurances of given search strings in HTML code
// @html - the HTML to search
// @searchArr - the array of strings to search for
// @highlight - html element to surround the matches with (defaults to 'strong')
function highlightHTML(html, searchArr, highlight) {
    highlight = highlight || 'strong';
    $.each(searchArr, function(index, value) {
        if (value) {
            html = html.replace(value, '<'+highlight+'>'+value+'</'+highlight+'>');
        }
    });
    return html;
}

function makeSeeMoreLink(title, content) {
    return $('<a class="seeMore" href="#seeMore"> (see more)</a>')
        .data('content', content)
        .click(view.showSeeMoreText);
}

function makeFancyZoomLink() {
    
}

// Make a fancyZoom image
// @thumbId - id of the thumbnail image
// @src - src of the image (same for thumbnail and large)
// @alt - image alt text
// Note: This function expects an empty div in the page with the id thumbId+'Large'
function makeFancyZoomImg(thumbId, src, alt) {
    var imgLarge = $('<img alt="'+alt+'" src="'+src+'" />');
    $('#'+thumbId+'Large').empty().append(imgLarge);
    
    var img = $('<a href="#'+thumbId+'Large" title="'+alt+'"></a>')
        .append('<img alt="'+alt+'" id="'+thumbId+'" src="'+src+'" />')
        .fancyZoom($.extend({}, settings.fancyZoom, { scaleImg: true }));
    
    return img;
}





