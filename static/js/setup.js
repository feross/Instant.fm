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


/* ------------------ JQUERY TOOLS VALIDATOR  ------------------ */

// adds an effect called "wall" to the validator
// TODO: Feross, I just copied and pasted this from JQuery Tools's page.
//       I'm not sure what effect we want here, but this is how the error
//       effects are implemented.
$.tools.validator.addEffect('wall', function(errors, event) {
    // get the message wall
    var wall = $(this.getConf().container).fadeIn();
    
    // remove all existing messages
    wall.find("p").remove();
    
    // add new ones
    $.each(errors, function(index, error) {
        wall.append(
            //"<p><strong>" +error.input.attr("name")+ "</strong> " +error.messages[0]+ "</p>"
            '<p>' +error.messages[0]+ ' <strong>' +error.input.attr('name')+ '</strong></p>'
        );    
    });

// the effect does nothing when all inputs are valid  
}, function(inputs)  {
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
    $('#helpLink').colorbox({inline: true, href: '#helpBox', returnFocus: false});
    
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
                    player.playNextSong();
                    break;
                case 37: case 38: // up, left
                    player.playPrevSong();
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
                case 76: // l
                    player.highlightSong('.playing');
                    break;
                case 66: // b
                    showHideUI();
                    break;
                case 191: // ?
                    $('#helpLink').trigger('click');
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
          //appId: appSettings.fbAppId, // 'Instant.fm' API Key
          appId: '186788488008637',   // 'Wikileaks: The Musical' API Key
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

function setupDragDropUploader(dropId, callback) {
    if (Modernizr.draganddrop) {
        new uploader(dropId, null, '/upload', null, callback);
    }
}

function setupNewPlaylist() {
    $('a[href="#new"]').colorbox({
        inline: true,
        href: "#newPlaylistBox",
        returnFocus: false,
        onComplete: function() {
            $('textarea[name=title]', '#newPlaylistForm').focus();
        },
        scrolling: false
    });
    
    $('textarea', '#newPlaylistForm')
        .autogrow($.extend({}, appSettings.autogrow,
            {onResize: function(elem) {
                // Ensure that elem had focus before re-setting the focus
                var elemHadFocus = $(elem).is(':focus');
                log(elemHadFocus);
                
                if (elemHadFocus) {
                    $.colorbox.resize();
                    $(elem).focus();
                }
            },
            lineHeight: 18
        })
    );
    
    // initialize validator and add a custom form submission logic
    var form = $("form#newPlaylistForm");
    form.submit(function(e) {
        // prevent default form submission logic
        e.preventDefault();
        $('#submitNewPlaylist').attr('disabled', 'disabled'); // so the user can only submit the form once
      
        log(formToDictionary(form));
        instantfm.new_playlist({
            params: formToDictionary(form),
            onSuccess: function(response) {
                if (response && response.success)  {
                    var playlist = response.result;
                    $.colorbox.close();
                    player.loadPlaylist(playlist);
                    browser.pushSearchPartial(true);
                    
                    // Clear form fields (after colorbox closes)
                    window.setTimeout(function() {
                        $('textarea', '#newPlaylistForm').val('');
                    }, 300);
                    
                } else {
                    // server-side validation failed.
                    if (response && response.errors) {
                        // TODO: Display validation errors
                        $.colorbox.resize();
                    }
                }
                $('#submitNewPlaylist').removeAttr('disabled');
            },
            onError: function() {
                log('Error posting new playlist form ;_;');
                $('#submitNewPlaylist').removeAttr('disabled');
            },
        });
    });
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
            onError: function() {
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
    $('#navSignup').colorbox({
        inline: true,
        href: '#signupBox',
        returnFocus: false,
        onComplete: function() {
            // If step 2 form is hidden, that means there was a bad error during last sign up attempt, so do reset.
            if (!$('#fbSignupForm').is(':visible')) {
                $('#fbSignupForm').show();
                $('#signupStep1').show();
                $('#signupStep2').hide();
                $('#signupBox > header > .subtitle').text('(1 of 2)');
            }

            $('#fbFacepile')
                .removeClass('like')
                .empty()
                .append('<fb:facepile width="390" max_rows="1"></fb:facepile>');
            FB.XFBML.parse($('#fbFacepile').get(0), function(response) {
                // If none of the user's friends have connected to Instant.fm, then lets fallback to showing the users
                // who have liked our page (including non-friends). We show the like box, but use CSS trickery to just show the faces. 
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
        },
        scrolling: false,
        width: 450
    });
    
    $('#fbConnectButton').click(function(event) {

        // remove old form errors and message
        $('#registrationErrors').empty();
        $('#registrationMsg').empty();

        FB.login(function(login_response) {
            if (!login_response.session) {
                log('FB login failed.'); // user cancelled login
            }
          
            FB.api('/me', function(response) {
                var form = $('#fbSignupForm');
                
                // Check that they're not already registered
                instantfm.is_registered_fbid({
                    "params": [response.id],
                    onSuccess: function(is_registered) {
                        if (is_registered) {
                            form.hide();
                            $('#registrationMsg').text('This Facebook user is already registered on Instant.fm. Try logging in instead.');
                        }
                    }
                });
                
                $('input[name=name]', form).val(response.name);
                $('input[name=email]', form).val(response.email);
                $('input[name=fb_user_id]', form).val(response.id);
                $('input[name=auth_token]', form).val(login_response.session.access_token);
                $('#fbProfileImage').css('background-image', 'url("http://graph.facebook.com/' + response.id + '/picture?type=square")');
                
                $('#signupStep1').fadeOut(function() {
                    $('#signupBox > header > .subtitle').text('(2 of 2)');
                    
                    $('#signupStep2').fadeIn(function() {
                        $.colorbox.resize();
                        $('input[name=password]', form).focus();
                    });
                });
            });  
        }, {perms:'email'});
    });
    
    // initialize validator and add a custom form submission logic
    $("#fbSignupForm").validator({
        effect: 'wall', 
        container: '#registrationErrors',
   
        // do not validate inputs when they are edited
        errorInputEvent: null
    }).submit(function(e) {
        var form = $(this);
        
        $('#submitFbSignupForm').attr('disabled', 'disabled'); // so the user can only submit the form once
      
        // client-side validation OK.
        if (!e.isDefaultPrevented()) {
      
            // submit with AJAX
            $.ajax({
                url: '/signup/fb',
                data: form.serialize(), 
                type: 'POST',
                dataType: 'json',
                success: function(json) {
                    // everything is ok. (server returned true)
                    if (json === true)  {
                      log("Registration posted successfully.")
                      loginStatusChanged();
                      $.colorbox.close();
                      $('#signupStep2').fadeOut(function() {
                          $('#signupStep1').fadeIn();
                      });
              
                    // server-side validation failed. use invalidate() to show errors
                    } else {
                        if (json && json.success === false && json.errors) {
                            form.data("validator").invalidate(json.errors);
                            log('Registration failt.');
                            $.colorbox.resize();
                        }
                        $('#submitFbSignupForm').removeAttr('disabled');
                    }
                },
                error: function() {
                    log('Error posting form ;_;');
                    $('#submitFbSignupForm').removeAttr('disabled');
                },
            });
            
            // prevent default form submission logic
            e.preventDefault();
        } else {
            $.colorbox.resize();
            $('#submitFbSignupForm').removeAttr('disabled');
        }
    });
}

function setupRpc() {
    var methods = ['update_songlist', 'update_title', 'update_description', 
    	'is_registered_fbid', 'set_image_from_url', 'login', 'logout', 
    	'new_playlist', 'signup_with_fbid'];
        
    instantfm = new rpc.ServiceProxy("/json-rpc?_xsrf=" + getCookie('_xsrf'), {
                                     "sanitize": true,
                                     "protocol": 'JSON-RPC',
                                     "methods": methods,
    }); 
}
