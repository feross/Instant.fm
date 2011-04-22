import re
import functools
import jsonrpclib
import json


class ValidationFailedException(Exception):
    def __init__(self, errors):
        self.errors = errors
        
        
def validated(method):
    """ Wraps a method. Method will return dictionary with validation results.
    
    The wrapped function MUST NOT be async and MUST NOT be RPC.
    """
    @functools.wraps(method)
    def wrapper(self, *args, **kwargs):
        try:
            returned = method(self, *args, **kwargs)
            result = {
                "success": True,
                "result": returned
            }
        except ValidationFailedException as e:
            result = {
                "success": False,
                "errors": e.errors
            }
        self.write(json.dumps(result))
    return wrapper


class Validator(object):
    def __init__(self, immediate_exceptions=False):
        self._immediate_exceptions = immediate_exceptions
        self._errors = {}

    def has_errors(self):
        return len(self._errors) > 0

    def validate(self):
        if self.has_errors():
            raise ValidationFailedException(self._errors)

    def error(self, message, name=''):
        self._errors[name] = message
        if self._immediate_exceptions:
            raise ValidationFailedException(self._errors)

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
            self.error("must be a valid email address.", name)

    def _check_min_length(self, value, name, min_length):
        if len(value) < min_length:
            self.error("must be at least {0} characters.".format(min_length), name)

    def _check_max_length(self, value, name, max_length):
        if len(value) > max_length:
            self.error("must be at most {0} characters.".format(max_length), name)
