/* --------------------------- MINI BROWSER --------------------------- */

// Animated image slider code from: http://goo.gl/t3vPZ
var MiniBrowser = function() {
    this.closedCSSTop; // The top position of the browser in it's closed state.
    this.isOpen = false;
    
    // Setup vendor prefix
    this.vP = '';
    if ($.browser.webkit) {
    	this.vP = "-webkit-";
    } else if ($.browser.msie) {
    	this.vP = "-ms-";
    } else if ($.browser.mozilla) {
    	this.vP = "-moz-";
    } else if ($.browser.opera) {
    	this.vP = "-o-";
    }

    this.setupHandlers();
    this.sliderWidth = $('#FS_slider').width() + 50;
};

MiniBrowser.prototype.setupHandlers = function() {
    // Link handlers for loading partials.
    $('a[rel~="partial"]').live('click', function(event) {
        event.preventDefault();
        browser.pushPartial($(this).attr('href'), $(this).attr('rel'), $(this).attr('title'), {link: $(this)});
    });
    
    // Link handlers for the back button.
    $('a[href="#back"]').live('click', function(event) {
        event.preventDefault();
		event.stopPropagation(); // Not sure why, but without this, clicking back causes two pops.
        browser.pop();
    });
    
    //     $('#nowPlayingHeader .right').click(function(event) {
    //         event.preventDefault();
    //         event.stopPropagation();
    //  $('#browserDisplay').addClass('flip');
    //  
    //  if (!Modernizr.csstransforms && !Modernizr.csstransforms3d) {
    //      log('No CSS tranform support. Using jQuery fallback.');
    //  }
    // });
    // $('#browserHeader .right').click(function(event) {
    //     event.preventDefault();
    //         event.stopPropagation();
    //  $('#browserDisplay').removeClass('flip');
    //  
    //  if (!Modernizr.csstransforms && !Modernizr.csstransforms3d) {
    //      log('No CSS tranform support. Using jQuery fallback.');
    //  }
    // });
};

// Fetch a partial from the server, push it onto the minibrowser.
MiniBrowser.prototype.pushPartial = function(path, type, title, _options) {
    	
	var delimeter = (path.indexOf('?') == -1) ? '?' : '&';
	var newPath = path + delimeter + 'partial=true';
	
	// Push matching "view" onto minibrowser
	var view;
	switch(type) {
		case 'partial search':
			view = new SearchView();
			break;
		case 'partial artist':
			view = new ArtistView(title);
			break;
		case 'partial album':
		    view = new BaseView();
			log('push album ' + title);
			break;
		case 'partial lyric':
		    var $link = $(_options.link);
		    view = new LyricView($link.attr('data-title'), $link.attr('data-artist'));
		    break;
		default:
		    view = new BaseView();
		    log('Warning: All partials must create a view and push it onto the viewStack. Did you define a createView function? ('+_title+')');
		    break;
	}
	
	this.pushStatic(newPath, title, view);
};

// Push a static HTML file onto the browser.
MiniBrowser.prototype.pushStatic = function(path, title, view) {
    $.get(path, null, function(data, textStatus, xhr) {
        var partial = $(data);
        browser.push(partial, title, view);
    });
};

// Push a new element onto the browser. If a title is specified, then we'll show
// a title header with a back button.
MiniBrowser.prototype.push = function(elem, title, view) {    
    var prevView = getTopView();
    prevView && prevView.willSleep();

    $(elem).appendTo('#FS_holder');

	view.content = elem;
	view.title = title;
	viewStack.push(view);
	view.willSlide();  // Tell the view to do anything it has to now that content is in DOM	
        
    this._slideTo(viewStack.length);
    
    this._updateHeader();
    
    if (browser.isOpen) {
        window.setTimeout(function() {
            view && view.didSlide();
        }, 300);
    } else {
        view && view.didSlide();
    }
};

// Pop the top-most page off of the browser.
MiniBrowser.prototype.pop = function() {
    if (!getTopView() || viewStack.length <= 1) {
        return;
    }
    
    // Tell the view controller it's going to be popped, then pop it
	var view = getTopView();
    view.willSleep();
    view.willPop();
    viewStack.pop();
    
    // Tell the new top view that it's about to be awoken
    getTopView().willAwake();
    
    browser._slideTo(viewStack.length);
	window.setTimeout(function() {
		$(view.content).remove();
	}, 300);
};

// Private function used to animate the transition between pages in the browser.
MiniBrowser.prototype._slideTo = function(slide) {
    $('#FS_holder').toggleClass('animate', browser.isOpen);

	var pixels = this.sliderWidth * (slide - 1);

    if (Modernizr.csstransforms3d && Modernizr.csstransforms && Modernizr.csstransitions) {
        $('#FS_holder').css(this.vP+"transform","translate3d(-"+pixels+"px, 0px, 0px)");
        $('#FS_holder').css("transform","translate3d(-"+pixels+"px, 0px, 0px)");
    } else if (Modernizr.csstransforms && Modernizr.csstransitions) {
        $('#FS_holder').css(this.vP+"transform","translate(-"+pixels+"px, 0px)");
        $('#FS_holder').css("transform","translate(-"+pixels+"px, 0px)");
    } else if (Modernizr.csstransitions) {
        $('#FS_holder').css("margin-left","-"+pixels+"px");
    } else {
        // If you animate left, IE breaks.
	    var css = {"margin-left":"-"+pixels+"px"};
	    
	    if ($('#FS_holder').hasClass('animate')) {
	        $('#FS_holder').animate(css, 300);
	    } else {
	        $('#FS_holder').css(css);
	    }
    }        
};

MiniBrowser.prototype._updateHeader = function() {
    var title = getTopView().title || '';
    $('#browserHeader h1').text(title);
    
    var leftButton;
    if (viewStack.length > 1) {
        leftButton = $('<a class="left prev" href="#back">Back</a>');
    } else {
        leftButton = $('<span class="left"></span>');
    }
    $('#browserHeader .left').replaceWith(leftButton);
};

MiniBrowser.prototype.toggle = function(toggle) {
    this.isOpen = (toggle !== undefined) ? toggle : !this.isOpen;
    
    if (this.isOpen) {
        var pixels = 0;
    } else {
        var pixels = browser.closedCSSTop;
    }
        
    if (Modernizr.csstransforms3d && Modernizr.csstransforms && Modernizr.csstransitions) {
        $('#modal').css(this.vP+"transform","translate3d(0px, "+pixels+"px, 0px)");
        $('#modal').css("transform","translate3d(0px, "+pixels+"px, 0px)");
    } else if (Modernizr.csstransforms && Modernizr.csstransitions) {
        $('#modal').css(this.vP+"transform","translate(0px, "+pixels+"px)");
        $('#modal').css("transform","translate(0px, "+pixels+"px)");
    } else if (Modernizr.csstransitions) {
        $('#modal').css("margin-top",pixels+"px");
    } else {
        // If you animate left, IE breaks.
        var css = {"margin-top":pixels+"px"};

        if ($('#FS_holder').hasClass('animate')) {
            $('#modal').animate(css, 1000);
        } else {
            $('#modal').css(css);
        }
    }
};