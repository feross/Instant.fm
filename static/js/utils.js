/* -------------------- UTILITY FUNCTIONS ----------------------- */

// Hide element without removing it from the DOM.
function hideElement(elem, duration) {
    duration = (duration == null) ? 500 : duration;

    elem.data('original-position', elem.css('position')); // save position
    elem.animate({opacity: 0}, duration, function() {
        elem.css({
            position: 'absolute',
            left: -9999
        });
    });
}

// Show element that's been hidden offscreen.
function showElement(elem, duration) {
    duration = (duration == null) ? 500 : duration;

    elem.show().css({
        position: elem.data('original-position'),
        left: 0
    })
    .animate({opacity: 1}, duration);
}

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

// Remove unecessary parenthesized text from song titles. It messes up YouTube/Last.fm searches.
function cleanSongTitle(title) {
    return title.replace(/[\(\[].*?(feat|ft|produce|dirty|clean|edit|mix).*?[\)\]]/gi, '');
}

// Remove all html tags
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

function canonicalize(name) {
    // Copied and modified from the canonicalize() function on the server-side.
    var r = new RegExp('[^a-z0-9]+', 'gi');
    return name
        .replace(r, '-')
        .toLowerCase();
}


// These functions came for free with HTML5 Boilerplate

window.log = function(){
    log.history = log.history || [];   
    log.history.push(arguments);
    if(this.console){
        console.log( Array.prototype.slice.call(arguments) );
    }
};
(function(doc){
    var write = doc.write;
    doc.write = function(q){ 
        log('document.write(): ',arguments); 
        if (/docwriteregexwhitelist/.test(q)) {
            write.apply(doc,arguments);  
        }
    };
})(document);


/* ------------------------ LOGIN ------------------------------*/

/* The following three functions are from QuirksMode.org */
function createCookie(name,value,days) {
  if (days) {
    var date = new Date();
    date.setTime(date.getTime()+(days*24*60*60*1000));
    var expires = "; expires="+date.toGMTString();
  }
  else var expires = "";
  document.cookie = name+"="+value+expires+"; path=/";
}

function readCookie(name) {
  var nameEQ = name + "=";
  var ca = document.cookie.split(';');
  for(var i=0;i < ca.length;i++) {
    var c = ca[i];
    while (c.charAt(0)==' ') c = c.substring(1,c.length);
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
  }
  return null;
}

function eraseCookie(name) {
  createCookie(name,"",-1);
}

/* Call this right after the user is logged in or out to update
 * display. 
 */
function loginStatusChanged() {
    var user_id = readCookie('user_id');
    var user_name = readCookie('user_name');
    if (isLoggedIn()) {
        $('html').addClass('loggedIn');
        $('html').removeClass('loggedOut');
        $('.username').html(unescape(user_name));
    } else {
        $('html').addClass('loggedOut');
        $('html').removeClass('loggedIn');
    }
    ownershipStatusChanged();
}

function isLoggedIn() {
    var user_id = readCookie('user_id');
    var user_name = readCookie('user_name');
    var session_num = readCookie('session_num');
    var session_id = readCookie('session_id');
    return (user_id && user_name && session_num && session_id);
}

function ownershipStatusChanged() {
    if (isOwner()) {
        $('html').addClass('isOwner');
        $('html').removeClass('isNotOwner');
  	    var user_name = readCookie('user_name');
        $('.username').html(unescape(user_name));
        
        // If we own the playlist, make sure user_id is set
        var user_id = readCookie('user_id');
        if (user_id) {
          model.playlist.user_id = user_id;
        }
        
        $('#playlist').sortable('enable');
        
    } else {
        $('html').addClass('isNotOwner');
        $('html').removeClass('isOwner');
        
        $('#playlist').sortable('disable');
    }
}

function isOwner() {
    var user_id = readCookie('user_id');
    var session_num = readCookie('session_num');
    if ((user_id && user_id == model.playlist.user_id) ||
        (session_num && session_num == model.playlist.session_id)) {
        
        return true;
    }
    
    return false;
}

// Accepts a an object, where keys correspond to span classes,
// and values correspond to the text within. Useful for rendering
// text that will change based on the user's state.
function renderConditionalText(obj, tagType, callback) {
    var result = $('<div></div>');
    if ($.isPlainObject(obj)) {
        $.each(obj, function(key, value) {
            result.append('<'+tagType+' class="'+key+'">'+value+'</'+tagType+'>');
        });
    } else {
        result.append('<'+tagType+'>'+obj+'</'+tagType+'>');
    }
    
    result = result.children();
    result.hide();
    window.setTimeout(function() {
        result.each(function(index, elem) {
             callback($(elem));
             $(elem).fadeIn();
        });
    }, 0);

    return result;
}
