Instant.fm Readme
=================

Developed by [Feross Aboukhadijeh](http://feross.org), [Jake Becker](http://quora.com/Jake-Becker), and John Hiesey.


Overview
--------

We built Instant.fm upon a solid foundation of awesome. All of our tools are free software with great documentation and easily hackable code. We tried out lots of new tech on this project -- playing with new frameworks and libraries is fun!

We learned a ton during this project. We hope that the source code here helps you. If you found this useful, send us a note to say thanks!

Evolution of the codebase
-------------------------

Check out this awesome video of this repo's commit history, generated using [Gource](https://github.com/acaudwell/Gource): [http://www.youtube.com/watch?v=IV3BcvJcxK0]

Features
--------

### Playlist Creation

- No login required.
- Build your playlist on site, or upload a .m3u, .txt, or .pls file from iTunes, Windows Media Player, or WinAmp.
- Each playlist gets a unique, shareable, short URL.
- Allow background image uploading. (TODO)

### Playlist Editing

- Drag and drop to re-order songs.
- Buttons to Move To Top, and Kill Song.
- Change playlist name/title with an inline edit (no refresh).
- Playlist Viewing

### Use YouTube as audio source.

- Shuffle, repeat, show/hide video.
- Suggest songs to be added to playlist. (TODO)
- Keyboard shortcuts for power users.
- Social Features

### Share playlist on Facebook, Twitter.

- See what your friends are listening to. (TODO)

### Mini-browser

- Pane which behaves like an iOS navigation view, with a stack of ‘views’.
- Allows searching and browsing artist/album information without stopping the - music.
- Clicking links doesn’t cause user’s browser to leave the page.
- Uses fancy animations, which look great.

### Non-stop Music

- On most music sites, clicking something stops the music (very jarring).
- On Instant.fm, everything is AJAX, so nothing stops the music.
- Even logging in/out works without a page refresh (the correct playlist edit tools are shown/hidden).

### Browser Support

- All modern browsers.
- Internet Explorer 8. (TODO)


How We Built It
---------------

HTML5 Boilerplate, CSS3, jQuery, jQuery UI, Modernizr, YepNope, Tornado, Nginx, Supervisor, SQL Alchemy, Python, Apache Ant, Last.fm API, Facebook API, YouTube API, and more...

Read more here: http://www.feross.org/instant-fm-tech-stack/ 


Installation Instructions
=========================

The following instructions assume that you're installing on Ubuntu 12.04 server edition. If you're using a different OS, then you may need to follow a different process.

Python Setup
------------

Install Python environment:

    sudo aptitude install python-pip python-dev
    sudo pip install virtualenv

This creates a global "pip" command to install Python packages. Don't use it, because packages will be installed globally. Instead, use virtualenv.

Create new virtualenv Python environments:

    virtualenv --distribute instantfm.com

The `--distribute` option tells virtualenv to use `distribute` instead of the obselete `setuptools`

Switch to the new environment with:
  
    cd instantfm.com
    source bin/activate


Install Dependencies
--------------------

### OS dependencies

Unfortunately, some of the Python packages we use have OS-level package dependencies.

    sudo aptitude install mysql-server libmysqlclient-dev  # mysql development libraries
    sudo aptitude install python-dev  # python development header files
    sudo aptitude install build-essential  # gcc compiler

### PIP dependencies

We use pip to manage Python package dependencies. You call install all the dependencies with one command:

    pip install -r requirements.txt

Read more about [pip requirement files](http://www.pip-installer.org/en/latest/requirements.html). They are awesome!


MySQL Setup
-----------

Make a database for instant.fm.

Set up the database by running the commands in schema.sql:

    mysql db_name < schema.sql

Update the database credentials in tornado/options.py.


(Optionally) Build the static resources
---------------------------------------

We use Apache Ant to run a build process to minify CSS and JavaScript, and compress images to decrease size.

You will probably need to modify the build script to work in your environment. The build script stops the server, pulls the latest from git, builds the site, and starts the server.

Install Apache Ant:
    
    sudo aptitude install ant

The installation installs openjdk-6-jre which is missing "tools.jar", so we will remove it and intall the full JDK instead.

Install "openjdk-7-jdk" package:

    sudo aptitude install openjdk-7-jdk
    sudo update-alternatives --config java  # select java-7-openjdk from the list
    sudo aptitude remove openjdk-6-jre-lib openjdk-6-jre-headless

One last thing before building the site. To compress the images, the build script relies on a few libraries:

    sudo aptitude install libjpeg-progs optipng

Build the site:

    cd build-site/
    sudo ant   # sudo is needed to start and stop the server


Nginx Setup
------------

Install nginx:

    sudo aptitude install nginx

Create a symlink to our nginx.conf:

    cd /etc/nginx/sites-enabled/
    ln -s /path/to/instantfm.com/nginx.conf instantfm.com.conf

If you built static resources (above) then make sure all the relevant paths in the nginx.conf file point to the /publish/ folder, since that's where all the minified files exist.

Restart nginx:
  
    sudo service nginx restart


Start the server
----------------

Start Nginx:

    sudo service nginx start

Start app server (from instantfm.com virtualenv):

    python server/server.py --port=7000

Start app server (daemonized):

    python server/server.py --port=7000 -d


Use Supervisor to daemonize the site
------------------------------------

[Supervisor](http://supervisord.org/) is a client/server system that allows its users to monitor and control a number of processes on UNIX-like operating systems.

Install supervisord:

    sudo aptitude install supervisor

More install options here: http://supervisord.org/installing.html

Create a symlink to our supervisor conf file:

    cd /etc/supervisor/conf.d/
    ln -s /path/to/instantfm.com/supervisor.conf instantfm.com.conf

Start the supervisor command line interface:

    sudo supervisorctl
    
Run the following supervisor commands:

    reload
    start instantfm:


MIT License
-----------

Copyright (c) 2011 Feross Aboukhadijeh and Jake Becker

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
