# Make a copy of this file and call it options.py. Replace all params with their correct values.

import argparse
import os

def _parse_arguments():
    parser = argparse.ArgumentParser(description='The Instant.fm Tornado server')
    parser.add_argument("-d", "--daemonize", help="daemonize the server", action='store_true', default=False)
    parser.add_argument("--debug", help="debug mode (auto refreshes templates)", action='store_true', default=False)
    parser.add_argument("--port", default=7100, help="run on the given port", type=int)
    parser.add_argument("--mysql_host", default="CHANGE_ME_localhost:3306", help="database host")
    parser.add_argument("--mysql_database", default="CHANGE_ME_instantfm_db", help="database name")
    parser.add_argument("--mysql_user", default="CHANGE_ME_instantfm_user", help="database user")
    parser.add_argument("--mysql_password", default="CHANGE_ME_instantfm_password", help="database password")
    parser.add_argument("--lastfm_key", default="CHANGE_ME_instantfm_lastfm_key", help="lastfm API key")
    return parser.parse_args()
cli_args = _parse_arguments()

tornado_settings = dict(
    debug=cli_args.debug, # always refresh templates
    template_path=os.path.join(os.path.dirname(__file__), "templates"),
    xsrf_cookies=True,
    cookie_secret="CHANGE_ME_instantfm_cookie_secret"
)
