/* --------------------------- MINI BROWSER --------------------------- */

var MiniBrowser = Base.extend({
    constructor: function() {
        this.viewStack = []; // A view for each page in the browser

        this.setupHandlers();
        this.viewWidth = $('#browser').width() + 50;
        $('.iPhoneHeader').disableSelection();
    },
    
    setupHandlers: function() {
        // View links
        $('a[rel~="view"]').live('click', function(event) {
            event.preventDefault();
            browser.pushView({
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

    },

    getTopView: function() {
      return this.viewStack[this.viewStack.length - 1];
    },

    // Fetch a view from the server, push it onto the minibrowser.
    pushView: function(config) {
    	var view;
    	switch(config.type) {
    		case 'view search':
    			view = new SearchView(config);
    			break;
    		case 'view artist':
    			view = new ArtistView(config);
    			break;
    		case 'view album':
    		    view = new AlbumView(config);
    			break;
    		case 'view playlist':
    		    view = new PlaylistView(config);
    		    break;
    		case 'view profile':
    		    view = new ProfileView(config);
    		    break;
    		case 'view static': // all static views
    		    view = new View(config);
    		    break;
    		default:
    		    view = new View(config);
    		    log('Warning: All views must create a view and push it onto the viewStack. Did you define a createView function? ('+config.title+')');
    		    break;
    	}
    	
    	// Don't push duplicate views.
        var topPath = this.getTopView() && this.getTopView().config.path;
        if (topPath && topPath == config.path) {
            return;
        }

        $.get(view.getStaticPath(), null, function(data, textStatus, xhr) {
            var elem = $(data);
            browser.push(elem, view);
        });
    },

    // Push a new element onto the browser.
    push: function(elem, view) {    
        var prevView = this.getTopView();
        prevView && prevView.willSleep();

        $(elem).appendTo('#views');

    	view.content = elem;
    	this.viewStack.push(view);
    	view.willSlide();  // Tell the view to do anything it has to now that content is in DOM	

        this._slideTo(this.viewStack.length, function() {
            prevView && prevView.didSleep();
            view && view.didSlide();
        });
    },

    // Pop the top-most page off of the browser.
    pop: function() {
        if (!this.getTopView() || this.viewStack.length <= 1) {
            return;
        }

        // Tell the view controller it's going to be popped, then pop it
    	var view = this.getTopView();
        view.willPop();
        this.viewStack.pop();

        // Tell the new top view that it's about to be awoken
        this.getTopView().willAwake();

        this._slideTo(this.viewStack.length, function() {
            view.didPop();
    	    browser.getTopView().didAwake();
    		$(view.content).remove();
        });

    },

    // Private function used to animate the transition between pages in the browser.
    _slideTo: function(viewNum, callback) {
        callback = callback || $.noop;
        
    	var pixels = this.viewWidth * (viewNum - 1);
        $('#views').animate({
            left: '-'+pixels
        }, 300, callback);
    },

    updateHeader: function(title) {
        var title = title || '';

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
                elem.shorten({width: 100});
            });
            leftButton =
                $('<a class="left" href="#back"></a>').append(prevTitleElem.text('← '+prevTitleElem.text()));
        } else {
            leftButton = $('<span class="left"></span>');
        }
        $('#browserHeader .left').replaceWith(leftButton);
    },
        
    updateRightButtonText: function(text) {
        $('#browserHeader .right')
            .empty()
            .append(
                renderConditionalText(text, 'span', function(elem) {
                    elem.shorten({width: 125});
                })
            );  
    }
    
});