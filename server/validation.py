'''
Created on Apr 8, 2011

@author: dinkydogg
'''

import re
import functools
import jsonrpclib

import rpc


class InvalidParameterException(Exception):
    def __init__(self, errors):
        self._errors = errors


def async_and_validated(method):
    """ Wraps a method. Method will return dictionary with validation results.
    
    This is the hackiest function I ever wrote, but the results are actually 
    quite nice. It is intended for use as a decorator on RPC methods in a JSON
    RPC handler. It overrides the handler's result method so that calling 
    result will actually send a dictionary with a flag indicating whether
    validation was succesful as well as the result. Also catches any exceptions
    thrown by a validator in order to return error messages to the client. This
    is for methods that can return errors that should be displayed to the user.
    """
    @functools.wraps(method)
    def wrapper(self, *args, **kwargs):
        def result_with_validation(result):
            if (result.__class__ is not jsonrpclib.jsonrpc.Fault
                and (result.__class__ is not dict or "success" not in result)):
                result = {"success": True, "result": result}
            super(rpc.JsonRpcHandler, self).result(result)
        self.result = result_with_validation
        try:
            method(self, *args, **kwargs)
        except InvalidParameterException as e:
            result = {
                 "success": False,
                 "errors": e._errors
            }
            self.result(result)
    wrapper.async = True
    return wrapper


class Validator(object):
    def __init__(self, immediate_exceptions=False):
        self._immediate_exceptions = immediate_exceptions
        self._errors = {}

    def has_errors(self):
        return len(self._errors) > 0

    def validate(self):
        if self.has_errors():
            raise InvalidParameterException(self._errors)

    def error(self, message, name=''):
        self._errors[name] = message
        if self._immediate_exceptions:
            raise InvalidParameterException(self._errors)

    def add_rule(self, value, name='', min_length=None, max_length=None, email=None):
        if email is not None:
            self._check_email(value, name)
        if min_length is not None:
            self._check_min_length(value, name, min_length)
        if max_length is not None:
            self._check_max_length(value, name, max_length)

    def _check_email(self, value, name):
        email_regex = re.compile('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$')
        if None == email_regex.match(value):
            self.error("Must be a valid email.", name)

    def _check_min_length(self, value, name, min_length):
        if len(value) < min_length:
            self.error("Must be at least {0} characters.".format(min_length), name)

    def _check_max_length(self, value, name, max_length):
        if len(value) > max_length:
            self.error("Must be at most {0} characters.".format(max_length), name)
