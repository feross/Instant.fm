/* -------------------- UTILITY FUNCTIONS ----------------------- */

// Hide element without removing it from the DOM.
function hideElement(elem, duration) {
    duration = (duration == null) ? 500 : duration;

    elem.data('original-position', elem.css('position')); // save position
    elem.animate({opacity: 0}, duration, function() {
        elem.css({
            position: 'relative',
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

function tts(text) {
    if (!soundManagerLoaded) {
        return;
    }
    
    var hash = hex_sha1(text);
    var soundObj = soundManager.createSound({
        id: hash,
        url: '/tts/'+hash+'.mp3?q='+encodeURIComponent(text)
    });
    soundObj.play({
        onfinish:function() {
            // once sound has loaded and played, unload and destroy it.
            this.destruct(); // will also try to unload before destroying.
        }
    });
}

// Scroll element into view
function scrollTo(selectedElem, _container, _options) {
    var container = _container || 'html,body',
        options = _options || {};
    
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
    return title.replace(/[\(\[].*?(feat|ft|produce|dirty|clean|edit|mix|version).*?[\)\]]/gi, '');
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
    words = name
        .toLowerCase()
        .replace(r, '-')
        .split('-');
    if (words[words.length - 1] === '') {
        words.splice(words.length - 1, 1);
    }
    for (var i = 0; i < words.length; i++) {
        words[i] = words[i].charAt(0).toUpperCase() + words[i].slice(1);
    }
    return words.join('-');
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

function setSession(session) {
    if (session === undefined) {
        log("Attempted to set empty session");
        return;
    }
    
    model.session = session;
    if (session.user) {
        $('html').addClass('loggedIn');
        $('html').removeClass('loggedOut');
        $('.username').text(session.user.name);
        $('.profileLink').attr('href', session.user.profile_url);
    }
    ownershipStatusChanged();
}

function isLoggedIn() {
    return model.session.user != undefined;
}

function ownershipStatusChanged() {
    if (isOwner()) {
        $('html').addClass('isOwner');
        $('html').removeClass('isNotOwner');
        
        $('#playlist').sortable('enable');
    } else {
        $('html').addClass('isNotOwner');
        $('html').removeClass('isOwner');
        
        $('#playlist').sortable('disable');
    }
}

function isOwner() {
    if (model.playlist === undefined || model.session === undefined) {
        return false;
    }
    
    if (model.playlist.session_id && model.session.id && model.session.id == model.playlist.session_id) {
        return true;
    }
    if (model.session.user && model.playlist.user && model.session.user.id == model.playlist.user.id) {
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

function formToDictionary(form) {
    var params = {};
    $('input[type!=submit],textarea', $(form)).each(function(idx, input) {
        if (input.type == "checkbox") {
            params[input.name] = (input.value == 'on' ? true : false);
        } else if (input.type == "number") {
            params[input.name] = parseInt(input.value);
        } else {
            params[input.name] = input.value;
        }
    });
    return params;
}
