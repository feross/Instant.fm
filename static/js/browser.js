/* --------------------------- MINI BROWSER --------------------------- */

// Animated image slider code from: http://goo.gl/t3vPZ
var MiniBrowser = function() {
    this.viewStack = []; // A view for each page in the browser
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
    // Partial links
    $('a[rel~="partial"]').live('click', function(event) {
        event.preventDefault();
        browser.pushPartial({
            path: $(this).attr('href'),
            type: $(this).attr('rel'),
            title: $(this).attr('title'),
            linkElem: $(this)
        });
    });
    
    // Mini-browser back button
    $('a[href="#back"]').live('click', function(event) {
        // Not sure why, but without stopPropagation(), clicking back causes two pops.
        event.preventDefault();	event.stopPropagation();
        browser.pop();
    });
    
    // Open minibrowser
    $('a[href="#open"]').live('click', function(event) {
        event.preventDefault(); event.stopPropagation();
        if (browser.viewStack.length > 0) {
            browser.toggle(true, true);
        } else {
            browser.pushSearchPartial();
        }
    });
    
    // Close minibrowser
    $('a[href="#close"]').live('click', function(event) {
        event.preventDefault(); event.stopPropagation();
        browser.toggle(false);
    });
};

MiniBrowser.prototype.pushSearchPartial = function(noAnimateModal) {
    browser.pushPartial({
        path: '/search',
        type: 'partial search',
        linkElem: $(this),
        noAnimateModal: noAnimateModal
    });
};

MiniBrowser.prototype.getTopView = function() {
  return this.viewStack[this.viewStack.length - 1];
};

// Fetch a partial from the server, push it onto the minibrowser.
MiniBrowser.prototype.pushPartial = function(config) {
	var delimeter = (config.path.indexOf('?') == -1) ? '?' : '&';
	var newPath = config.path + delimeter + 'partial=true';
	
	// Push matching "view" onto minibrowser
	var view;
	switch(config.type) {
		case 'partial search':
			view = new SearchView(config);
			break;
		case 'partial artist':
			view = new ArtistView(config);
			break;
		case 'partial album':
		    view = new AlbumView(config);
			break;
		case 'partial static': // all static partials
		    view = new BaseView(config);
		    break;
		default:
		    view = new BaseView(config);
		    log('Warning: All partials must create a view and push it onto the viewStack. Did you define a createView function? ('+_title+')');
		    break;
	}
	view.config = config;
	this.pushStatic(newPath, view);
};

// Push a static HTML file onto the browser.
MiniBrowser.prototype.pushStatic = function(path, view) {
    // Don't push duplicate views.
    var topPath = this.getTopView() && this.getTopView().config.path;
    if (topPath && (topPath == path || topPath == view.config.path)) {
        
        if (view.config.noAnimateModal) {
            browser.preventModalAnimate();
        }
        browser.toggle(true, true);
        return;
    }
    
    $.get(path, null, function(data, textStatus, xhr) {
        var partial = $(data);
        browser.push(partial, view);
    });
};

// Push a new element onto the browser.
MiniBrowser.prototype.push = function(elem, view) {    
    var prevView = this.getTopView();
    prevView && prevView.willSleep();

    $(elem).appendTo('#FS_holder');

	view.content = elem;
	this.viewStack.push(view);
	view.willSlide();  // Tell the view to do anything it has to now that content is in DOM	
    
    this._slideTo(this.viewStack.length);
    
    var slideAnimationDuration;
    if (browser.isOpen) {
        slideAnimationDuration = 300;
    } else {
        slideAnimationDuration = 500;
        
        if (view.config.noAnimateModal) {
            browser.preventModalAnimate();
        }
        this.toggle(true, false);
    }
    window.setTimeout(function() {
        view && view.didSlide();
    }, slideAnimationDuration);
};

// Pop the top-most page off of the browser.
MiniBrowser.prototype.pop = function() {
    if (!this.getTopView() || this.viewStack.length <= 1) {
        return;
    }
    
    // Tell the view controller it's going to be popped, then pop it
	var view = this.getTopView();
    view.willSleep();
    view.willPop();
    this.viewStack.pop();
    
    // Tell the new top view that it's about to be awoken
    this.getTopView().willAwake();
    
    this._slideTo(this.viewStack.length);
	window.setTimeout(function() {
	    browser.getTopView().didAwake();
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
    var title = this.getTopView().config.title || '';
    
    $('#browserHeader .title')
        .empty()
        .append(
            renderConditionalText(title, 'h1', function(elem) {
                elem.shorten({width: 275});
            })
        );
    
    var leftButton;
    if (this.viewStack.length > 1) {
        var prevTitle = this.viewStack[this.viewStack.length-2].config.title;
        var prevTitleElem = renderConditionalText(prevTitle, 'span', function(elem) {
            elem.shorten({width: 70});
        });
        leftButton =
            $('<a class="left prev blue" href="#back"></a>').append(prevTitleElem);
    } else {
        leftButton = $('<span class="left"></span>');
    }
    $('#browserHeader .left').replaceWith(leftButton);
};

// Show or hide the modal browser.
// @param awaken = true if the browser is just being re-opened (nothing has been pushed)
MiniBrowser.prototype.toggle = function(toggle, awaken) {
    toggle = (toggle === undefined) ? !this.isOpen : toggle;
    awaken = (awaken === undefined) ? false : awaken;
    
    var animationDuration = 500;
    
    if (toggle) {
        var pixels = 0;
        
        if (awaken) {
            this.getTopView() && this.getTopView().willAwake();
            
            if (this.isOpen) { // was already open
                browser.getTopView() && browser.getTopView().didAwake();
                
            } else { // was closed
                window.setTimeout(function() {
                    browser.getTopView() && browser.getTopView().didAwake();
                }, animationDuration);
            }
        }
        
        $('#altPlaylistTitle').slideDown(animationDuration);
        
    } else {
        var pixels = browser.closedCSSTop;
        this.getTopView() && this.getTopView().willSleep();
        
        $('#altPlaylistTitle').slideUp(animationDuration);
    }
    
    this.isOpen = toggle;
        
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
            $('#modal').animate(css, animationDuration);
        } else {
            $('#modal').css(css);
        }
    }
};

MiniBrowser.prototype.preventModalAnimate = function() {
    $('#modal').removeClass('animate');
    window.setTimeout(function() {
        $('#modal').addClass('animate');
    }, 500);
};