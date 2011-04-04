#!/usr/bin/env python
# -*- coding: utf-8 -*-

import tornado.httpserver
import tornado.ioloop
import handlers
import options
import os


class Application(tornado.web.Application):
    
    """Custom application class for Instant.fm"""
    
    def __init__(self):
        url_handlers = [
            (r"/", handlers.HomeHandler),
            (r"/json-rpc/?$", handlers.JsonRpcHandler),
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
        tornado.web.Application.__init__(self, url_handlers, **settings)
        

def main():
    if not options.cli_args.debug:
        try:
            import daemon
            log = open('static/tornado.log', 'a+')
            context = daemon.DaemonContext(stdout=log, stderr=log, working_directory='.')
            context.open()
        except ImportError:
            print 'python-daemon not installed; not running as daemon'

    http_server = tornado.httpserver.HTTPServer(Application(), xheaders=True)
    http_server.listen(options.cli_args.port)

    # Start the main loop
    tornado.ioloop.IOLoop.instance().start()


if __name__ == "__main__":    
    main()
