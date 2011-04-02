#!/usr/bin/env python
# -*- coding: utf-8 -*-

import tornado.httpserver
import tornado.ioloop
import argparse
import handlers
import os


class Application(tornado.web.Application):
    
    """Custom application class that keeps a database connection"""
    
    def __init__(self):
        handlers = [
            (r"/", handlers.HomeHandler),
            (r"/json-rpc/?$", handlers.JsonRpcHandler),
            (r"/upload-img/?$", handlers.ImageUploadHandler),
            (r"/upload/?$", handlers.UploadHandler),
            (r"/p/([a-zA-Z0-9]+)/?$", handlers.PlaylistHandler),
            (r"/terms/?$", handlers.TermsHandler),
            (r"/suggest/?$", handlers.ArtistAutocompleteHandler),
            (r"/search/?$", handlers.SearchHandler),
            (r"/signup/fb", handlers.FbSignupHandler),
            (r"/login", handlers.LoginHandler),
            (r"/new-list", handlers.NewPlaylistHandler),
            (r"/logout", handlers.LogoutHandler),
            (r"/get-images", handlers.GetImagesHandler),
            (r"/([^/]+)/album/([^/]+)/?", handlers.AlbumHandler),
            (r"/([^/]+)/?", handlers.ArtistHandler),
            (r".*", handlers.ErrorHandler),
        ]
        settings = dict(
            debug=True, # always refresh templates
            template_path=os.path.join(os.path.dirname(__file__), "templates"),
            xsrf_cookies=True,
            cookie_secret="SkxQTluCp02hm5k0zbiAJmgg2M3HOS7",
        )
        tornado.web.Application.__init__(self, handlers, **settings)
        
        # TODO: Change this to use UNIX domain sockets?
        self.db = tornado.database.Connection(
            host=options.mysql_host, database=options.mysql_database,
            user=options.mysql_user, password=options.mysql_password)


def main():
    if options.debug:
        try:
            import daemon
            log = open('static/tornado.log', 'a+')
            context = daemon.DaemonContext(stdout=log, stderr=log, working_directory='.')
            context.open()
        except ImportError:
            print 'python-daemon not installed; not running as daemon'

    http_server = tornado.httpserver.HTTPServer(Application(), xheaders=True)
    http_server.listen(7000)

    # Start the main loop
    tornado.ioloop.IOLoop.instance().start()


_parser = argparse.ArgumentParser(description='The Instant.fm Tornado server')
_parser.add_argument("-d", "--debug", help="don't daemonize (debug mode)", action='store_true', default=False)
_parser.add_argument("--port", default=7000, help="run on the given port", type=int)
_parser.add_argument("--mysql_host", default="instant.fm:3306", help="database host")
_parser.add_argument("--mysql_database", default="instantfm", help="database name")
_parser.add_argument("--mysql_user", default="instantfm", help="database user")
_parser.add_argument("--mysql_password", default="CXZrPkkJEgk7lAZMnzbk5hb9g", help="database password")
_parser.add_argument("--lastfm_key", default="386402dfcfeedad35dd7debb343a05d5", help="lastfm API key")
options = _parser.parse_args()
        
if __name__ == "__main__":    
    main()
