/* -------------------- UTILITY FUNCTIONS ----------------------- */

// Show a popup window
function showPop(url, _name, _height, _width) {
    var name = _name || 'name';
    var height = _height || 450;
    var width = _width || 550;
    var newwindow = window.open(url, name, 'height='+height+',width='+width);
    if (window.focus) {
        newwindow.focus();
    }
}

// Scroll element into view
function scrollTo(selectedElem, _container, options) {
    var container = _container || 'html,body';
    
    var relativeScrollDistance = $(selectedElem).position().top - $(container).position().top;
    var absScrollTop = $(container).scrollTop() + relativeScrollDistance;
    
    if (options.scrollAtBottom) {
        var selectedElemHeight = $(selectedElem).height() + $(selectedElem).margin().top + $(selectedElem).margin().bottom + $(selectedElem).padding().top + $(selectedElem).padding().bottom;
        var containerHeight = $(container).height() + $(container).margin().top + $(container).margin().bottom + $(container).padding().top + $(container).padding().bottom;
        
        absScrollTop += (selectedElemHeight - containerHeight);
    }
    
    if (options.noAnimation) {
        $(container).scrollTop(absScrollTop);
        options.callback && options.callback();
    } else {
        $(container).animate({scrollTop: absScrollTop}, 500, options.callback);
    }
}

// Make an image that opens a fancyzoom lightbox when clicked on
// @thumbId - id of the thumbnail image
// @src - src of the image (is same for thumbnail and large)
// @alt - image alt text
// Note: This function expects an empty div in the page with the id thumbId+'Zoom'
function makeFancyZoomImg(thumbId, src, alt) {
    var imgZoom = $('<img alt="'+alt+'" src="'+src+'" />');
    $('#'+thumbId+'Zoom').empty().append(imgZoom);
    
    return $('<a class="reflect" href="#'+thumbId+'Zoom" id="'+thumbId+'"></a>')
               .append('<img alt="'+alt+'" src="'+src+'">')
               .append('<span class="zoomIcon"></span>')
               .fancyZoom($.extend({}, appSettings.fancyZoom, {closeOnClick: true, scaleImg: true}));
}

function makeSeeMoreLink(onclick, _text) {
    _text = _text || 'see more';
    return $('<a class="seeMore" href="#seeMore">('+_text+')</a>').click(onclick);
}

function makeEditLink(onclick) {
    return $('<a class="editLink" href="#edit">Edit</a>')
        .click(onclick);
}

function showThrobber(show) {
    if (show) {
        $('<div id="throbber"><img src="/images/throbber.gif"></div>')
            .appendTo('#uploadDiv');
    } else {
        $('#throbber').remove();
    }
}

// Remove unecessary parenthesized text from song titles. It messes up YouTube/Last.fm searches.
function cleanSongTitle(title) {
    return title.replace(/[\(\[].*?(feat|ft|produce|dirty|clean|edit|mix).*?[\)\]]/gi, '');
}

// Prepare Remove all html tags
function cleanHTML(html) {
    var r = new RegExp('</?\\w+((\\s+\\w+(\\s*=\\s*(?:".*?"|\'.*?\'|[^\'">\\s]+))?)+\\s*|\\s*)/?>', 'gi');   
    return html
        .replace(r, '') // Remove HTML tags (http://bit.ly/DdoNo)
        .replace(new RegExp('[\n\r]', 'g'), '<br>'); // Convert newlines to <br>
}

// A bizarre function to make Javascript's inheritance less incomprehensible
function copyPrototype(descendant, parent) {
    var sConstructor = parent.toString();
    var aMatch = sConstructor.match( /\s*function (.*)\(/ );
    if ( aMatch != null ) { descendant.prototype[aMatch[1]] = parent; }
    for (var m in parent.prototype) {
        descendant.prototype[m] = parent.prototype[m];
    }
}

function getCookie(name) {
    var r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
    return r ? r[1] : undefined;
};

function htmlEncode(value){ 
  return $('<div/>').text(value).html(); 
} 

function htmlDecode(value){ 
  return $('<div/>').html(value).text(); 
}