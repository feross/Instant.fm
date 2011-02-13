/* --------------------------- SETUP  --------------------------- */

function setupAutogrowInputType() {
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
                    width = 380;
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
}

// Set up keyboard shortcuts in a cross-browser manner
// Tested in Firefox, Chrome, Safari.
// Keyboard events are a mess: http://www.quirksmode.org/js/keys.html
function setupKeyboardShortcuts() {
    $('input, textarea').live('focus', function(event) {
        keyEvents = false; 
    });
    $('input, textarea').live('blur', function(event) {
        keyEvents = true;
    });
    
    $(window).keydown(function(event) {
        var k = event.which;
        var pressed1 = true;
        var pressed2 = true;

        // Disablable events
        if (keyEvents && !event.altKey && !event.ctrlKey && !event.metaKey) {
            switch(k) {
                // TODO: Remove this. For testing.
                case 87: // w
                    browser.toggle(undefined, true);
                    break;
                
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
                case 187: // +
                case 61: // + on Fx
                    player.increaseVolume();
                    break;
                case 189: // -
                case 109: // - on Fx
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
                    player.moveSongDown(songIndex);
                    break;
                case 75: // k
                    player.moveSongUp(songIndex);
                    break;

                // Navigation
                case 70: // f
                    browser.pushSearchPartial();
                    break;
                case 76: // l
                    player.highlightSong('.playing');
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
                browser.pop();
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

function setupFBML(playlist) {
    window.fbAsyncInit = function() {
        FB.init({
          //appId: '114871205247916', // 'Instant.fm' API Key
          appId: '186788488008637',   // 'Wikileaks: The Musical' API Key
          status: true,
          cookie: true,
          xfbml: true
        });
        
        $('#fbConnectButton').click(function(event) {
          FB.login(function(login_response) {
            if (login_response.session) {
              // user successfully logged in
              log('FB login succesful.');
              FB.api('/me', function(response) {
                var form = $('#fbAccountCreation');
                
                // Check that they're not already registered
                $.ajax({
                  'url': '/signup/fb-check',
                  'dataType': 'json',
                  'data': {'fb_id': response.id},
                  'success': function(is_registered) {
                    if (is_registered) {
                      form.hide();
                      $('#alreadyRegistered').show();
                    }
                  }
                })
                $('input[name=name]', form).val(response.name);
                $('input[name=email]', form).val(response.email);
                $('input[name=fb_user_id]', form).val(response.id);
                $('input[name=auth_token]', form).val(login_response.session.access_token);
                $('img#fbProfileImage').attr('src', 'http://graph.facebook.com/' + response.id + '/picture?type=square');
                
                $('#fbConnectButton').hide();
                form.show();
              });
              

            } else {
              // user cancelled login
              log('FB login failed.');
            }
          }, {perms:'email,publish_stream'});
        });
         
        playlist && nowplaying.tryLoadComments(playlist.playlist_id, playlist.title);
    };
    
    (function() {
      var e = document.createElement('script');
      e.type = 'text/javascript';
      e.src = document.location.protocol +
        '//connect.facebook.net/en_US/all.js';
      e.async = true;
      document.getElementById('fb-root').appendChild(e);
    }());
}

function setupRegistration() {
    $('#navSignup').colorbox({inline: true, href: "#registrationBox"});
     
    // adds an effect called "wall" to the validator
    // TODO: Feross, I just copied and pasted this from JQuery Tools's page.
    //       I'm not sure what effect we want here, but this is how the error
    //       effects are implemented.
    $.tools.validator.addEffect("wall", function(errors, event) {
        // get the message wall
        var wall = $(this.getConf().container).fadeIn();
        
        // remove all existing messages
        wall.find("p").remove();
        
        // add new ones
        $.each(errors, function(index, error) {
            wall.append(
                "<p><strong>" +error.input.attr("name")+ "</strong> " +error.messages[0]+ "</p>"
            );    
        });
  
    // the effect does nothing when all inputs are valid  
    }, function(inputs)  {
    });
    
    // initialize validator and add a custom form submission logic
    $("form#fbRegistration").validator({
        effect: 'wall', 
        container: '#registrationErrors',
   
        // do not validate inputs when they are edited
        errorInputEvent: null
    }).submit(function(e) {
    
        var form = $(this);
      
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
                    if (json && json.success && json.success === true)  {
                      log("Registration posted successfully.")
                      $('#registrationErrors').html('Registration postd succesfully.');
              
                    // server-side validation failed. use invalidate() to show errors
                    } else {
                        if (json && json.success === false && json.errors) {
                            form.data("validator").invalidate(json.errors);
                            log('Registration failt.');
                        }
                    }
                },
                error: function() { log('Error posting form ;_;'); },
            });
            
            // prevent default form submission logic
            e.preventDefault();
        }
    });
}

function setupLogin() {
    $('a[href="#login"]').colorbox({inline: true, href: "#loginBox"});
    $("form#login").validator({
        effect: 'wall', 
        container: '#loginErrors',
   
        // do not validate inputs when they are edited
        errorInputEvent: null
    }).submit(function(e) {
    
        var form = $(this);
      
        // client-side validation OK.
        if (!e.isDefaultPrevented()) {
      
            // submit with AJAX
            $.ajax({
                url: '/login',
                data: form.serialize(), 
                type: 'POST',
                dataType: 'json',
                success: function(json) {
                    // everything is ok. (server returned true)
                    if (json && json === true)  {
                        log('Login succeeded.');
                        loginStatusChanged();
                    // server-side validation failed. use invalidate() to show errors
                    } else {
                        if (json && json.success === false && json.errors) {
                            form.data("validator").invalidate(json.errors);
                            log('Login failt.');
                        }
                    }
                },
                error: function() { log('Error posting form ;_;'); },
            });
            
            // prevent default form submission logic
            e.preventDefault();
        }
    });
}

function setupLogout() {
	$('a[href="#logout"]').click(function(event) {
      event.preventDefault();
    	$.post('/logout', function() {
        	loginStatusChanged();
            log('Logged out.');
        });
    });
}

function setupNewPlaylist() {
    $('a[href="#new"]').colorbox({inline: true, href: "#newPlaylistBox"});
}

function setupDragDropUploader(dropId, callback) {
    if (Modernizr.draganddrop) {
        new uploader(dropId, null, '/upload', null, callback);
    }
}