/* -------------------- JQUERY EXTENSIONS ----------------------- */

// Detect if an input/textarea has focus.
// Usage:
// if ($("...").is(":focus")) {
//   ...
// }
jQuery.extend(jQuery.expr[':'], {
    focus: function(element) { 
        return element == document.activeElement; 
    }
});

$.ajaxSetup({
    beforeSend: function(xhr, settings) {
        if (!(/^http:.*/.test(settings.url) || /^https:.*/.test(settings.url))) {
            // Only send the token to relative URLs i.e. locally.
            xhr.setRequestHeader("X-CSRFToken", getCookie('_xsrf'));
        }
    }
});


/* ---------------- JEDITABLE - CUSTOM TEXTAREA WITH AUTOGROW ----------------- */

$.editable.addInputType('autogrow', {
    element: function(settings, original) {
        var textarea = $('<textarea />');
        if (settings.rows) {
            textarea.attr('rows', settings.rows);
        } else {
            textarea.height(settings.height);
        }
        if (settings.cols) {
            textarea.attr('cols', settings.cols);
        } else {
            textarea.width(settings.width);
        }
        $(this).append(textarea);
        return(textarea);
    },
    plugin: function(settings, original) {
        var elemId = $(this).parent().attr('id');
        var width;
        switch(elemId) {
            case 'curPlaylistTitle':
                width = 390;
                break;
            case 'curPlaylistDesc':
                width = 470;
                break;
            default:
                width = $(this).width();
                break;
        }
        $('textarea', this).width(width).autogrow(settings.autogrow);
    }
});


/* --------------------------- SETUP FUNCTIONS --------------------------- */

// Set up keyboard shortcuts in a cross-browser manner
// Tested in Firefox, Chrome, Safari.
// Keyboard events are a mess: http://www.quirksmode.org/js/keys.html
function setupKeyboardShortcuts() {
    $('#navShortcuts').colorbox({inline: true, href: '#helpBox', returnFocus: false});
    
    $('input, textarea').live('focus', function(event) {
        keyEvents = false; 
    });
    $('input, textarea').live('blur', function(event) {
        keyEvents = true;
    });
    
    $(document).bind('cbox_open', function() {
        colorboxOpen = true;
    });
    $(document).bind('cbox_closed', function() {
        colorboxOpen = false;
    });
    
    $(window).keydown(function(event) {
        var k = event.which;
        var pressed1 = true;
        var pressed2 = true;

        // Disablable events
        if (keyEvents && !event.altKey && !event.ctrlKey && !event.metaKey) {
            switch(k) {                
                // Playback control
                case 39: case 40: // down, right
                    player.playNextSong(true);
                    break;
                case 37: case 38: // up, left
                    player.playPrevSong(true);
                    break;
                case 32: // space
                    player.playPause();
                    break;
                case 187: case 61: // +, + on Fx
                    player.increaseVolume();
                    break;
                case 189: case 109: // -, - on Fx
                    player.decreaseVolume();
                    break;
                case 86: // v
                    player.toggleVideo();
                    break;
                case 83: // s
                    player.toggleShuffle();
                    break;
                case 82: // r
                    player.toggleRepeat();
                    break;

                // Playlist editing
                case 74: // j
                    player.moveCurSongDown();
                    break;
                case 75: // k
                    player.moveCurSongUp();
                    break;

                // Navigation
                case 78: // n
                    $('#navNewPlaylist').click();
                    break;
                case 70: // f
                    browser.pushSearchPartial();
                    break;
                case 191: // ?
                    $('#navShortcuts').trigger('click');
                    break;
                    
                // Fun
                case 76: // l
                	if ($('#playlist .playing').length) {
                	    player.highlightSong('.playing', '#playlistDiv');
                	}
                    break;
                case 66: // b
                    showHideUI();
                    break;
                case 65: // a
                    var song = model.playlist.songs[player.songIndex];
                    this.tts(cleanSongTitle(song.t)+', by '+song.a);
                    break;
                    
                default:
                    pressed1 = false;
                    break;
            }

        } else {
            pressed1 = false;
        }

        // Non-disablable events
        // These keyboard events will always get captured (even when textboxes are focused)
        switch (k) {
            case 27: // escape
                if (!browser.isOpen || colorboxOpen) {
                    return;
                }    
                if (browser.viewStack.length > 1) {
                    browser.pop();
                } else {
                    browser.toggle(false);
                }
                break;
            default:
                pressed2 = false;
                break;
        }

        // If we executed a keyboard shortcut, prevent the browser default event from happening
        if (pressed1 || pressed2) {
            event.preventDefault();
        }
    });
}

function setupFBML() {
    window.fbAsyncInit = function() {
        FB.init({
          appId: appSettings.fbAppId,
          status: true,
          cookie: true,
          xfbml: true
        });
         
        model.playlist && nowplaying.tryLoadComments(model.playlist.url);
    };
    
    (function() {
      var e = document.createElement('script');
      e.type = 'text/javascript';
      e.src = document.location.protocol +
        '//connect.facebook.net/en_US/all.js#appId='+appSettings.fbAppId+'&amp;xfbml=1';
      e.async = true;
      document.getElementById('fb-root').appendChild(e);
    }());
}

function setupUploader(formElem) {
    $(formElem).fileUpload({
        url: '/upload',
        onProgress: function (event, files, index, xhr, handler) { }, // TODO: Show upload progress
        onLoad: function (event, files, index, xhr, handler) {
            log('onload');
            var json;
            if (typeof xhr.responseText !== undefined) {
                json = $.parseJSON(xhr.responseText);
            } else {
                // Instead of an XHR object, an iframe is used for legacy browsers:
                json = $.parseJSON(xhr.contents().text());
            }
            onNewPlaylistResponse(json);
        },
        initUpload: function (event, files, index, xhr, handler, callBack) {
            // Don't perform an upload immediately.
            // We call callBack() once the user submits the form.
            $(formElem).data('callBack', callBack);
            
            // Update UI to show that file is ready to be uploaded
            $('#dragDrop').text(files[index].name);
            $('.file_upload')
                .addClass('dropped')
                .removeClass('drag')
                .removeClass('documentDrag');
        },
        onError: function() {}, // TODO: Add error handling
        onDragOver: function() {
            $('.file_upload').addClass('drag');
        },
        onDragLeave: function() {
            $('.file_upload').removeClass('drag');
        }
    });
    
    // Improve UI for clients without draganddrop support.
    if(!Modernizr.draganddrop) {
        $('#normalUpload span').contents().first().remove(); // Remove the "Or, " text
        $('#normalUpload span').contents().last().remove(); // Remove the ending "."
        
        // Turn upload link into button
        $('#normalUpload span').contents().first()
            .addClass('blue large awesome')
            .css({'text-transform': 'capitalize'});
    }
}

function setupNewPlaylist() {
    $('a[href="#new"]').colorbox({
        inline: true,
        href: "#newPlaylistBox",
        returnFocus: false,
        onComplete: function() {
            $('input[name=title]', '#newPlaylistForm').focus();
        },
        scrolling: false
    });
    
    $('#showPlaylistUpload').click(function() {
        $('#playlistUpload').show();
        $('#showPlaylistUpload').hide();
        $('#newPlaylistForm .colorboxSubmitButtons em').hide();
        
        $.colorbox.resize();
    });

    $('textarea', '#newPlaylistForm')
        .autogrow($.extend({}, appSettings.autogrow,
            {onResize: function(elem) {
                // Ensure that elem had focus before re-setting the focus
                var elemHadFocus = $(elem).is(':focus');
                
                if (elemHadFocus) {
                    $.colorbox.resize();
                    $(elem).focus();
                }
            },
            lineHeight: 18
        })
    );
    
    log(setupUploader('#newPlaylistForm'));
    
    var form = $("#newPlaylistForm");
    form.submit(function(e) {
        e.preventDefault();
        $('#submitNewPlaylist').attr('disabled', 'disabled'); // only submit form once
      
        // Use the jQuery File Upload plugin to submit the new playlist.
        // We tack on the form parameters to the request that the plugin sends.
        if (form.data('callBack')) {
            form.data('callBack')();
            $('#submitNewPlaylist').removeAttr('disabled');
        } else {
            // No file selected, do normal xhr.
            $.post('/upload', formToDictionary(form), 'json')
                .success(function(data, textStatus, jqXHR) {
                    onNewPlaylistResponse(data);
                })
                .error(function(data, textStatus, jqXHR) {
                    alert('Form submission failed. Try reloading the page.');
                })
                .complete(function() {
                    $('#submitNewPlaylist').removeAttr('disabled');
                });
        }
    });
}

function onNewPlaylistResponse(data) {
    if (data && data.success) {
        var playlist = data.result;
        console.log(playlist);
        player.loadPlaylist(playlist);
        $.colorbox.close();
        if (playlist.songs.length == 0) {
            browser.pushSearchPartial(true);
        }
    } else {
        errors = data && data.errors;
        if (errors) {
            // TODO: Display validation errors.
        }
    }    
}

function setupLogin() {
    $('a[href="#login"]').colorbox({
        inline: true,
        href: "#loginBox",
        returnFocus: false,
        onComplete: function() {
            $('input[name=email]', '#login').focus();
        },
        scrolling: false
    });
    
    $('#loginSignup a').click(function() {
        $('#navSignup').click();
    });
    
    var form = $('form#login');
    form.submit(function(e) {
        e.preventDefault();
        $('#submitLogin').attr('disabled', 'disabled'); // so the user can only submit the form once
        
        instantfm.login({
            params: formToDictionary(form),
            onSuccess: function(response) {
                // everything is ok. (server returned true)
                if (response && response.success)  {
                    var session = response.result;
                    setSession(session);
                    console.log('Login succeeded.');
                    $.colorbox.close();
                // server-side validation failed.
                } else if (response && response.errors) {
                    console.log(response.errors)
                    $.colorbox.resize();
                    $('input[name=password]', '#login').focus();
                }
                $('#submitLogin').removeAttr('disabled');
            },
            onException: function() {
                log('Error posting login ;_;');
                $('#submitLogin').removeAttr('disabled');
            },
        });
    });
}

function setupLogout() {
	$('a[href="#logout"]').click(function(event) {
        event.preventDefault();
		instantfm.logout({
		    onSuccess: function(newSession) { setSession(newSession); }
		});
		$('html').removeClass('loggedIn')
		$('html').addClass('loggedOut')
    });
}

function setupSignup() {
    $('a[href="#signUp"]').click(function(e) {
        e.preventDefault();
        $.get('/static/colorbox_signup.html').success(function(markup) {    
            $('#navSignup').colorbox({
                html: markup,
                open: true,
                returnFocus: false,
                scrolling: false,
                width: 450,
                onComplete: function() {
                    var form = $('#fbSignupForm');

                    // Facepile
                    FB.XFBML.parse($('#fbFacepile').get(0), function(response) {
                        // If none of the user's friends have connected to Instant.fm,
                        // then lets fallback to showing the users who have liked our
                        // page (including non-friends). We show the like box, but
                        // use CSS trickery to just show the faces. 
                        window.setTimeout(function() {
                            if ($('#fbFacepile').height() < 20) {
                                $('#fbFacepile')
                                    .empty()
                                    .addClass('like')
                                    .append('<fb:like-box href="'+appSettings.fbPageURL+'" width="410" show_faces="true" stream="false" header="false"></fb:like-box>');
                                FB.XFBML.parse($('#fbFacepile').get(0));
                            }
                            $.colorbox.resize();
                        }, 1000);
                    });

                    // Connect button
                    $('#fbConnectButton').click(onFBConnect);
                }
            });

        });
    });
}

function onFBConnect(event) {
    var form = $('#fbSignupForm');
    
    FB.login(function(login_response) {
        if (!login_response.session) {
            log('FB login failed.'); // user cancelled login
            return;
        }

        // Check that they're not already registered
        FB.api('/me', function (response) {
            var fb_id = response.id,
                auth_token = login_response.session.access_token;

            instantfm.is_registered_fbid({
                params: [fb_id],
                onSuccess: function(is_registered) {
                    if (is_registered) {
                        form.hide();
                        showErrors(form, {'': 'This Facebook user is already registered on Instant.fm. Try logging in instead.'});
                        return;
                    }
                }
            });

            // Populate Signup Step 2 form
            $('input[name=name]', form).val(response.name);
            $('input[name=email]', form).val(response.email);
            $('#fbProfileImage').css('background-image', 'url("http://graph.facebook.com/' + response.id + '/picture?type=square")');

            $('#signupStep1').fadeOut(function() {
                $('#signupBox > header > .subtitle').text('(2 of 2)');

                $('#signupStep2').fadeIn(function() {
                    $.colorbox.resize();
                    $('input[name=password]', form).focus();
                });
            });

            // Setup event handlers for Signup Step 2 form
            form.submit(function(e) {
                e.preventDefault();
                $('#submitFbSignupForm').attr('disabled', 'disabled');

                params = formToDictionary(form);
                params["auth_token"] = auth_token;
                params["fb_id"] = parseInt(fb_id);
                instantfm.signup_with_fbid({
                    params: params,
                    onSuccess: function(response) {
                        if (response && response.success) {
                            session = response.result;
                            setSession(session);
                            $.colorbox.close();
                            log("Registration posted successfully.");

                        } else if (response && response.errors) {
                            // server-side validation failed.
                            showErrors(form, response.errors);
                            $.colorbox.resize();
                        }
                        $('#submitFbSignupForm').removeAttr('disabled');
                    },
                    onException: function() {
                        log('Error posting form ;_;');
                        $('#submitFbSignupForm').removeAttr('disabled');
                    },
                });
            });

        });
    }, {perms:'email'});
}

function setupRpc() {
    var methods = ['update_songlist', 'update_title', 'update_description', 
    	'is_registered_fbid', 'set_image_from_url', 'login', 'logout', 
    	'new_playlist', 'signup_with_fbid', 'get_playlists_for_user'];
        
    instantfm = new rpc.ServiceProxy("/json-rpc?_xsrf=" + getCookie('_xsrf'), {
                                     "sanitize": true,
                                     "protocol": 'JSON-RPC',
                                     "methods": methods,
    }); 
}

function showErrors(form, errors) {
    var $errors = $(form).find('.errors');
    $.each(errors, function(i, v) {
        var $p = $('<p></p>').text(v);
        $errors.append($p);
    });
}









