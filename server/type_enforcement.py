def types(**_params_):
    def check_types(_func_, _params_=_params_):
        def modified(*args, **kw):
            arg_names = _func_.func_code.co_varnames
            kw.update(zip(arg_names, args))
            for name, type in _params_.iteritems():
                param = kw[name]
                assert param is None or isinstance(param, type), "Parameter '%s' should be type '%s'" % (name, type.__name__)
            return _func_(**kw)
        return modified
    return check_types
