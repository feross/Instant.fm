'''
Created on Jan 16, 2011

@author: dinkydogg
'''

import server
import lastfm
import time

import sys
if sys.version < '2.6':
    import md5
    def md5hash(string):
        return md5.new(string).hexdigest()
else:
    from hashlib import md5
    def md5hash(string):
        return md5(string).hexdigest()
    
class ResultNotCachedException(Exception):
    pass

class LastfmCache(object):
    '''
    classdocs
    '''
    def __init__(self, db):
        self.db = db
        
    def Get(self, key):
        hashed_key = md5hash(key)
        result = self.db.get('SELECT xml FROM lastfm_cache WHERE hash = %s', hashed_key)
        if result:
            return result.xml
        else:
            """ Note the changed functionality here. Instead of returning None, we raise an exception.
                This is because we don't want to ever do a last.fm fetch and set in the IO loop. """
            self.db.execute('INSERT INTO lastfm_request_queue (request_url) VALUES (%s)', key)
            raise ResultNotCachedException
        
    def Set(self, key, data):
        hashed_key = md5hash(key)
        self.db.execute('INSERT INTO lastfm_cache VALUES (%s, %s, NOW()) ON DUPLICATE KEY UPDATE xml=VALUES(xml), cachedTime=NOW()', hashed_key, data)
        
    def GetCachedTime(self,key):
        hashed_key = md5hash(key)
        result = self.db.get('SELECT cachedTime FROM lastfm_cache WHERE hash = %s', hashed_key)
        if result:
            print result
            seconds = time.mktime(result.cachedTime.timetuple())
            print seconds
            return seconds
        else:
            self.db.execute('INSERT INTO lastfm_request_queue (request_url) VALUES (%s)', key)
            raise ResultNotCachedException

    def Remove(self, key):
        hashed_key = md5hash(key)
        self.db.query('DELETE FROM lastfm_cache WHERE hash = %s', hashed_key)