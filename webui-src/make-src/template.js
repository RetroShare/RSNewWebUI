(function() {
    'use strict';

    const globals = typeof window === 'undefined' ? global : window;
    if (typeof globals.require === 'function') return;

    let modules = {},
        cache = {},
        aliases = {},
        has = {}.hasOwnProperty;

    const unalias = function(alias, loaderPath) {
        const _cmp = 'components/';
        let start = 0;
        if (loaderPath) {
            if (loaderPath.startsWith(_cmp)) {
                start = _cmp.length;
            }
            if (loaderPath.indexOf('/', start) > 0) {
                loaderPath = loaderPath.substring(
                    start,
                    loaderPath.indexOf('/', start)
                );
            }
        }
        const result =
      aliases[alias + '/index.js'] ||
      aliases[loaderPath + '/deps/' + alias + '/index.js'];
        if (result) {
            return _cmp + result.substring(0, result.length - '.js'.length);
        }
        return alias;
    };

    const expand = function(root, name) {
        const _reg = /^\.\.?(\/|$)/;
        let results = [],
            parts = (_reg.test(name) ? root + '/' + name : name).split('/');
        for (let part of parts) {
            if (part === '..') {
                results.pop();
            } else if (part !== '.' && part !== '') {
                results.push(part);
            }
        }
        return results.join('/');
    };

    const dirname = function(path) {
        return path
            .split('/')
            .slice(0, -1)
            .join('/');
    };

    const localRequire = function(path) {
        return function(name) {
            let absolute = expand(dirname(path), name);
            return globals.require(absolute, path);
        };
    };

    const initModule = function(name, definition) {
        let module = { id: name, exports: {} };
        cache[name] = module;
        definition(module.exports, localRequire(name), module);
        return module.exports;
    };

    const require = function(name, loaderPath) {
        if (loaderPath === undefined) loaderPath = '/';
        let path = unalias(name, loaderPath);

        if (path in cache) return cache[path].exports;
        if (path in modules) return initModule(path, modules[path]);

        let dirIndex = expand(path, './index');
        if (dirIndex in cache) return cache[dirIndex].exports;
        if (dirIndex in modules) return initModule(dirIndex, modules[dirIndex]);

        throw new Error(
            'Cannot find module "' + name + '" from ' + '"' + loaderPath + '"'
        );
    };

    require.alias = function(from, to) {
        aliases[to] = from;
    };

    require.register = require.define = function(bundle, fn) {
        if (typeof bundle === 'object') {
            for (let key in bundle) {
                if (has.call(bundle, key)) {
                    modules[key] = bundle[key];
                }
            }
        } else {
            modules[bundle] = fn;
        }
    };

    require.list = function() {
        let result = [];
        for (let item in modules) {
            if (has.call(modules, item)) {
                result.push(item);
            }
        }
        return result;
    };

    require._cache = cache;
    globals.require = require;
})();
