(function () {
  const $context = this;
  let root; // root context

  const _helper = {

    /**
     * 
     * @param {String} s 
     * @returns {Boolean}
     */
    isTemplate: (s) => {
      if (debug) {
        console.log('[_helper].isTemplate')
        console.log('[_helper].isTemplate `param` :', s)
      }
      const _reTagTemplate = /\{\{(.+)\}\}/g;
      const _result = _reTagTemplate.test(s);
      if (debug) { console.log('[_helper].isTemplate `return` :', _result) }
      return _result
    },

    /**
     * A polyfil method to check wether the provided object is an array
     * TODO: do we need this for compatibility ?
     * @param {Any} v 
     * @returns {Boolean}
     */
    isArrayPoly: (v) => {
      if (debug) {
        console.log('[_helper].isArrayPoly')
        console.log('[_helper].isArrayPoly `param` :', v)
      }
      const _result = !!v &&
        typeof v === 'object' &&
        typeof v.length === 'number' &&
        (
          v.length === 0 ||
          (
            v.length > 0 &&
            (v.length - 1) in v
          )
        );

      if (debug) { console.log('[_helper].isArrayPoly `return` :', _result) }
      return _result
    },

    /**
     * A simple wrapper to check wether the type is an array.
     * Tries to use built-in Array.isArray, falls back to a polyfil function isArrayPoly
     * @param {*} v 
     * @returns {Boolean}
     */
    isArray: (v) => {
      // Using build-in Javascript check for arrays
      // or polyfil version in case it is not available
      if (debug) {
        console.log('[_helper].isArray')
        console.log('[_helper].isArray `param` :', v)
      }
      const _result = Array.isArray(v) || _helper.isArrayPoly(v);

      if (debug) { console.log('[_helper].isArray `return` :', _result) }
      return _result
    },

    /**
     * Assign a new value to an object property using keypath
     * Returns a new object
     * @param {Object} obj  
     * @param {String} path  
     * @param {Any} nv 
     * @returns {Object}
     */
    setPropByKeyPath: (obj = {}, path = '', nv) => {
      if (path.length === 0) return nv;
      const _setProp = new Function(['obj', 'nv'], `{ obj${path} = nv; return obj; }`);
      const _result = _setProp(obj, nv);
      return _result
    },

    /**
     * Checks type of JSON property
     * Returns a string 'object'|'array'|'string'
     * @param {Any} v 
     * @returns {String}
     */
    getJSONPropType: (v) => {
      const _result = typeof v === 'string' ? 'string' :
        Array.isArray(v) ? 'array' :
          Object.prototype.toString.call(v) === '[object Object]' ? 'object' :
            undefined;
      return _result
    },

  };

  /**
   * Handle conditional statements 
   * 
   */
  const Conditional = {

    /**
     * Parse conditional template
     * @param {[Object]} template 
     * @param {Object} data 
     * @returns Object | null
     */
    run: (template, data) => {
      for (const entry of template) {
        const [_key] = Object.keys(entry);
        const _token = TRANSFORM.tokenize(_key);
        // Process `#if` and `#elseif`
        if (_token.name === '#if' || _token.name === '#elseif') {
          const _expression = `{{ ${_token.expression} }}`;
          // Parse expression
          const _parsed = TRANSFORM.parse(data, _expression);
          // If 
          if (_parsed === _expression) {
            return template;
          } else {
            if (_parsed) {
              return TRANSFORM.run(entry[_key], data);
            }
          }
        } else {
          // Process `#else`
          return TRANSFORM.run(entry[_key], data);
        }
      }
      // If temlate is not valid return `null`
      return null;
    },

    /**
     * This function validates wether the statement is a proper conditional statement
     * In order to be valid the statement should match the following rules:
     * 1. Accept an array of objects as the only parameter
     * 2. Each object should contain '#if', '#elseif', 'else' as key
     * 3. item should be in the format of {'#if item': 'blahblah'}
     * If any of this conditions is not met the function returns `false`
     * @param {[Object]} template 
     * @returns {Boolean}
     */
    is: (template) => {
      if (!_helper.isArray(template) || template.length === 0) return false;

      const _hasOnlyObjects = template.some((e) => {
        return Object.prototype.toString.call(e) === '[object Object]' || Object.keys(e).length === 1
      });
      if (!_hasOnlyObjects) return false;

      // Get the first element of the array
      const [_firstElement] = template;
      for (const key in _firstElement) {
        // Tokenize each object key. Token format is { name: 'string', expression: 'string' }
        // Each token must be valid
        const _token = TRANSFORM.tokenize(key);
        // Validate _token using object destructuring
        const { name = false, expression = false } = _token ?? {}
        if (!name || !expression) { return false };
        if (name.toLowerCase() !== '#if') { return false };
      }

      // If the template has only one element then return true
      if (template.length === 1) return true;

      // Otherwise get all elements of the array except first one that we already validated
      const [, ..._elements] = template;
      // Remove the last element of the array for further processing as it must match different rules
      const _lastElement = _elements.pop();

      // Validate that all elements are `#elseif` tag
      const _hasOnlyElseIfs = !_elements.some((e) => {
        return Object.keys(e).some(key => {
          const _token = TRANSFORM.tokenize(key);
          return _token.name.toLowerCase() !== '#elseif';
        });
      });
      // If at least one element is not `#elseif` return false
      if (!_hasOnlyElseIfs) return false;

      // Closing tag must be either `#else` or `#elseif`
      const _hasValidClosingTag = Object.keys(_lastElement).some((key) => {
        const _token = TRANSFORM.tokenize(key);
        return ['#else', '#elseif'].includes(_token.name.toLowerCase());
      });
      // Return false if the closing tag does not match `#else` or `#elseif`
      if (!_hasValidClosingTag) return false;

      // Otherwise it is valid
      return true;
    },

  };

  /**
   * Hashmap of all valid tags
   * 
   */
  const $operators = {

    '#include': (options = {}) => {
      const { template, data, entry, token } = options
      const _data = entry ? template[entry] : data;
      const _result = token.expression ?
        TRANSFORM.parse(_data, '{{' + token.expression + '}}', true) :
        _data;
      return _result;
    },

    '#concat': (options = {}) => {
      const { template, data, entry } = options

      if (!_helper.isArray(template[entry])) return undefined;

      const _result = template[entry].reduce((acc, el) => {
        const _processed = TRANSFORM.run(el, data);
        return acc.concat(_processed);
      }, []);

      return /\{\{(.*?)\}\}/.test(JSON.stringify(_result)) ? template : _result;
    },

    '#merge': (options = {}) => {
      const { template, data, entry } = options

      if (!_helper.isArray(template[entry])) return undefined;

      const _result = template[entry].reduce((acc, el) => {
        const _processed = TRANSFORM.run(el, data);
        return { ...acc, ..._processed }
      }, {});

      if (typeof data === 'object') {
        delete _result.$index
        Object.keys(TRANSFORM.memory).forEach((key) => { delete _result[key] })
      } else {
        [String, Number, Function, Array, Boolean].forEach((c) => { delete c.prototype.$index })
        Object.keys(TRANSFORM.memory).forEach((key) => {
          [String, Number, Function, Array, Boolean].forEach((c) => { delete c.prototype[key] })
        })
      }

      return _result
    },

    '#each': (options = {}) => {
      const { template, data, entry, token } = options

      const newData = TRANSFORM.parse(data, '{{' + token.expression + '}}', true);
      if (!newData || !_helper.isArray(newData)) return template;

      const _result = newData.reduce((acc, el, idx) => {
        // setup metadata
        if (typeof el === 'object') {
          el.$index = idx
          Object.keys(TRANSFORM.memory).forEach((key) => { el[key] = TRANSFORM.memory[key] })
        } else {
          [String, Number, Function, Array, Boolean].forEach((c) => { c.prototype.$index = idx })
          Object.keys(TRANSFORM.memory).forEach((key) => {
            [String, Number, Function, Array, Boolean].forEach((c) => { c.prototype[key] = TRANSFORM.memory[key] })
          })
        }

        const _processed = TRANSFORM.run(template[entry], el);

        // remove metadata
        if (typeof el === 'object') {
          delete el.$index
          Object.keys(TRANSFORM.memory).forEach((key) => { delete el[key] })
        } else {
          [String, Number, Function, Array, Boolean].forEach((c) => { delete c.prototype.$index })
          Object.keys(TRANSFORM.memory).forEach((key) => {
            [String, Number, Function, Array, Boolean].forEach((c) => { delete c.prototype[key] })
          })
        }

        return _processed ? [...acc, _processed] : acc
      }, []);

      return _result;
    },

    '#let': (options = {}) => {
      const { template, data, entry } = options

      if (!_helper.isArray(template[entry]) || template[entry].length !== 2) return undefined

      const [_defs, _realTemplate] = template[entry];
      // 1. Parse the first item to assign variables
      const _parsedKeys = TRANSFORM.run(_defs, data);
      // 2. modify the data
      for (const key in _parsedKeys) {
        TRANSFORM.memory[key] = _parsedKeys[key];
        data[key] = _parsedKeys[key];
      }

      // 2. Pass it into TRANSFORM.run
      const _result = TRANSFORM.run(_realTemplate, data);
      return _result
    },

    '#?': (options = {}) => {
      const { data, token } = options

      const _template = '{{' + token.expression + '}}'
      const _result = TRANSFORM.parse(data, _template);
      if (!_result || (_result === _template)) {
      } else {
        return _result
      }
    }

  };

  const $transformations = {

    /**
     * 
     * @param {*} template 
     * @param {*} data 
     * @returns 
     */
    string: (template, data) => {
      if (!_helper.isTemplate(template)) {
        return template;
      }

      const _reInclude = /\{\{([ ]*#include)[ ]*([^ ]*)\}\}/;
      if (!_reInclude.test(template)) {
        const _parsed = TRANSFORM.parse(data, template);
        return _parsed
      }

      const _token = TRANSFORM.tokenize(template);

      return _token.expression ?
        TRANSFORM.parse(data, '{{' + _token.expression + '}}', true) :
        template;
    },

    /**
     * 
     * @param {*} template 
     * @param {*} data 
     * @returns 
     */
    array: (template, data) => {
      return Conditional.is(template) ?
        Conditional.run(template, data) :
        template.reduce((acc, entry) => {
          const _transform = TRANSFORM.run(entry, data);
          return _transform ? [...acc, _transform] : acc;
        }, []);
    },

    /**
     * 
     * @param {*} template 
     * @param {*} data 
     * @returns 
     */
    object: (template, data) => {
      let _result = {};

      const _reInclude = /\{\{([ ]*#include)[ ]*(.*)\}\}/;
      const _matchingEntries = Object.keys(template).filter(entry => _reInclude.test(entry));
      if (_matchingEntries.length > 0) {
        const _entry = _matchingEntries[0];
        const _token = TRANSFORM.tokenize(_entry);
        const _handler = $operators[_token?.name];
        const _processed = _handler && _handler({ template, data, entry: _entry, token: _token });
        _result = _processed
      }

      for (const entry in template) {
        const _isTemplate = _helper.isTemplate(entry);

        if (_isTemplate) {
          const _token = TRANSFORM.tokenize(entry);
          if (_token) {
            if (_token.name !== '#include') {
              const _handler = $operators[_token?.name];
              const _processed = _handler && _handler({ template, data, entry: entry, token: _token });
              if (_processed) {
                _result = _token.name === '#merge' ? { ..._result, ..._processed } : _processed
              }
            }
          } else {
            const _entry = TRANSFORM.parse(data, entry);
            const _value = TRANSFORM.parse(data, template[entry]);
            if (_entry !== undefined && _value !== undefined) {
              _result[_entry] = _value
            }
          };
        }

        const _isString = typeof template[entry] === 'string';

        if (!_isTemplate && _isString) {
          const _token = TRANSFORM.tokenize(template[entry])
          const _handler = $operators[_token?.name]
          if (_handler) {
            const _processed = _handler({ template, data, entry: entry, token: _token });
            if (_processed) {
              _result[entry] = _processed
            };
          } else {
            const _processed = TRANSFORM.run(template[entry], data);
            if (_processed !== undefined) {
              _result[entry] = _processed
            };
          }
        }

        if (!_isTemplate && !_isString) {
          const _processed = TRANSFORM.run(template[entry], data);
          if (_processed !== undefined) {
            _result[entry] = _processed
          };
        }
      }

      return _result
    },

  };

  /**
   *  Transformation core.
   *  `TRANSFORM` works 
   */
  const TRANSFORM = {

    memory: {},

    /**
     * 
     * @param {String} str 
     * @returns {Object|Null}
     */
    tokenize: (str) => {
      const _reTemplate = /\{\{(.+)\}\}/g;
      const _str = str.replace(_reTemplate, '$1');
      // str : '#each $jason.items'
      const _tokens = _str.trim().split(' ');
      // => tokens: ['#each', '$jason.items']
      // let _token
      if (_tokens.length > 0) {
        if (_tokens[0][0] === '#') {
          const _token = _tokens.shift();
          // => _token: '#each' or '#if'
          // => _tokens: ['$jason.items', '&&', '$jason.items.length', '>', '0']
          const _expression = _tokens.join(' ');
          // => _expression: '$jason.items && $jason.items.length > 0'
          return { name: _token, expression: _expression };
        }
      }
      return null;
    },

    /**
     * 
     * @param {*} template 
     * @param {Array|Object} context 
     * @param {Boolean} inject 
     * @param {Boolean} serialize 
     * @returns 
     */
    transform: (template, context, inject, serialize) => {
      const _selectorFn = /#include/.test(JSON.stringify(template)) ?
        (key, value) => /#include/.test(key) || /#include/.test(value) :
        null;

      const _resolvedTemplate = inject &&
        SELECT.select(template, _selectorFn, serialize)
          .transform(context, serialize)
          .root();

      const _result = inject ?
        SELECT.select(context, null, serialize)
          .inject(inject, serialize)
          .transformWith(_resolvedTemplate, serialize)
          .root() :
        SELECT.select(template, _selectorFn, serialize)
          .transform(context, serialize)
          .root();

      return serialize ? JSON.stringify(_result) : _result;
    },

    /**
     * `TRANSFORM `
     * @param {Object} template 
     * @param {Object} context 
     * @returns 
     */
    run: (template, context) => {
      const _entryType = _helper.getJSONPropType(template);
      if (!_entryType) return template;
      const _handler = $transformations[_entryType];
      return _handler ? _handler(template, context) : template;
    },

    /**
     * 
     * @param {*} data 
     * @param {*} template 
     * @param {Boolean} raw 
     * @returns 
     */
    parse: (data, template, raw) => {
      // Run `parse` only if it's a valid template. Otherwise just return the original
      if (!_helper.isTemplate(template)) return template;

      // Create a local copy for parsing
      let _template = template;

      const _reTemplate = /\{\{(.*?)\}\}/g;
      const _variables = template.match(_reTemplate);
      // Stop processing if no variables
      if (!_variables) return template;

      if (raw) {
        const [_variable] = _variables;
        _template = TRANSFORM._parse({ variable: _variable, data: data, template: null });
      } else {
        _variables.forEach(_variable => {
          _template = TRANSFORM._parse({ variable: _variable, data, template: _template });
        });
      }

      return _template;
    },

    /**
     * 
     * @param {Object} options = { data, template, variable } 
     * @returns 
     */
    _parse: (options) => {
      // Given a template and fill it out with passed slot and its corresponding data
      const _reTemplate = /\{\{(.*?)\}\}/g;
      const _reFull = /^\{\{((?!\}\}).)*\}\}$/;

      const { data, template, variable } = options;
      const makeNewFunction = (fnBody, context) => {
        return /\breturn [^;]+;?[ ]*$/.test(fnBody) &&
          /return[^}]*$/.test(fnBody) ?
          new Function('with(this) {' + fnBody + '}').bind(context) :
          new Function('with(this) {return (' + fnBody + ')}').bind(context);
      }

      try {
        // 1. Evaluate the variable
        const slot = variable.replace(_reTemplate, '$1');

        // data must exist. Otherwise replace with blank
        if (!data) { return template }

        const _dataType = typeof data;
        if (!['number', 'string', 'array', 'boolean', 'function'].includes(_dataType)) {
          // Attach $root to each node so that we can reference it from anywhere
          data.$root = root;
        }

        // If the pattern ends with a return statement, but is NOT wrapped inside another function ([^}]*$), it's a function expression
        const _hasFunction = /function\([ ]*\)[ ]*\{(.*)\}[ ]*$/g.exec(slot);
        const _resolver = _hasFunction ?
          makeNewFunction(_hasFunction[1], data) :
          makeNewFunction(slot, data)

        const _resolvedVal = _resolver();
        const _isFalsy = !_resolvedVal
        delete data.$root; // remove $root now that the parsing is over

        // it tried to evaluate since the variable existed, but ended up evaluating to undefined
        // (example: var a = [1,2,3,4]; var b = a[5];)
        if (typeof _resolvedVal === 'undefined') { return template; }

        // If template is not defined then return either resolved value or in case of falsy 
        if (!template) return !_isFalsy ? _resolvedVal.valueOf(): ''
        // Check if the template pure
        return (_reFull.test(template)) ?
          // Processing pure template
          !_isFalsy ? _resolvedVal.valueOf() : _resolvedVal :
          !_isFalsy ? template.replace(variable, _resolvedVal.valueOf()) : template.replace(variable, '')

      } catch (_err) {
        return template;
      }
    },

  };

  /**
   *  Selection and filtering core.
   *  `SELECT` takes 
   */
  const SELECT = {
    // current: currently accessed object
    // path: the path leading to this item
    // filter: The filter function to decide whether to select or not
    $val: null,
    $selected: [],
    $injected: [],
    $progress: null,

    /**
     * 
     * @param {String|Array|Object} entry 
     * @param {String} keyPath 
     * @param {Function} filter 
     */
    exec: function (entry, keyPath, filter) {
      // if current matches the pattern, put it in the selected array
      if (typeof entry === 'string') {
        // leaf node should be ignored
        // we're lookin for keys only
      } else if (_helper.isArray(entry)) {
        entry.forEach((el, idx) => SELECT.exec(el, keyPath.concat('[', idx, ']'), filter))
      } else {
        // object
        Object.keys(entry).forEach((key) => {
          if (key !== '$root') {
            if (filter && filter(key, entry[key])) {
              const idx = SELECT.$selected.length
              SELECT.$selected.push({ index: idx, key: key, path: keyPath, object: entry, value: entry[key] })
            }
            SELECT.exec(entry[key], keyPath.concat('["', key, '"]'), filter)
          }
        })
      }
    },

    /**
     * 
     * @param {*} obj 
     * @param {Boolean} serialize 
     * @returns 
     */
    inject: (obj, serialize) => {
      SELECT.$injected = obj;

      try {
        if (serialize) SELECT.$injected = JSON.parse(obj);
        // `JSON.parse` throws an exception processing templates however this can be safely ignored
      } catch (_err) { }

      if (Object.keys(SELECT.$injected).length > 0) SELECT.select(SELECT.$injected);

      return SELECT;
    },

    /**
     * `SELECT.select`
     * @param {Object|String} obj 
     * @param {Function} filter 
     * @param {Boolean} serialize 
     * @returns 
     */
    select: (obj, filter, serialize) => {
      let _obj = obj;

      try {
        if (serialize) _obj = JSON.parse(obj);
        // `JSON.parse` throws an exception processing templates however this can be safely ignored
      } catch (_err) { }

      if (filter) {
        SELECT.$selected = [];
        SELECT.exec(_obj, '', filter);
      } else {
        SELECT.$selected = null;
      }

      if (_obj && (_helper.isArray(_obj) || typeof _obj === 'object')) {
        if (!SELECT.$progress) {
          if (_helper.isArray(_obj)) {
            SELECT.$val = [];
            SELECT.$selectedRoot = [];
          } else {
            SELECT.$val = {};
            SELECT.$selectedRoot = {};
          }
        }
        Object.keys(_obj).forEach((key) => {
          SELECT.$val[key] = _obj[key];
          SELECT.$selectedRoot[key] = _obj[key];
        });
      } else {
        SELECT.$val = _obj;
        SELECT.$selectedRoot = _obj;
      }

      SELECT.$progress = true;

      return SELECT;
    },

    /**
     * 
     * @param {*} obj 
     * @param {Boolean} serialize 
     * @returns 
     */
    transformWith: (obj, serialize) => {
      SELECT.$parsed = [];
      SELECT.$progress = null;

      let _obj = obj;
      try {
        if (serialize) _obj = JSON.parse(obj);
        // `JSON.parse` throws an exception processing templates however this can be safely ignored
      } catch (_err) { }

      SELECT.$templateRoot = _obj;
      // Copy to global root varaible
      root = SELECT.$selectedRoot;

      [String, Number, Function, Array, Boolean].forEach((c) => { c.prototype.$root = SELECT.$selectedRoot });

      if (SELECT.$selected && SELECT.$selected.length > 0) {
        SELECT.$selected
          .sort((a, b) => b.path.length - a.path.length)
          .forEach((item) => {
            const _parsed = TRANSFORM.run(_obj, item.object);
            SELECT.$selectedRoot = _helper.setPropByKeyPath(SELECT.$selectedRoot, item.path, _parsed);
            item.object = _parsed;
          });
        SELECT.$selected.sort((a, b) => a.index - b.index);
      } else {
        const _parsed = TRANSFORM.run(_obj, SELECT.$selectedRoot);
        SELECT.$selectedRoot = _helper.setPropByKeyPath(SELECT.$selectedRoot, '', _parsed);
      }

      [String, Number, Function, Array, Boolean].forEach((c) => { delete c.prototype.$root });

      return SELECT;
    },

    /**
     * 
     * @param {*} obj 
     * @param {Boolean} serialize 
     * @returns 
     */
    transform: (obj, serialize) => {
      SELECT.$parsed = [];
      SELECT.$progress = null;

      let _obj = obj;
      try {
        if (serialize) _obj = JSON.parse(obj);
        // `JSON.parse` throws an exception processing templates however this can be safely ignored
      } catch (_err) { }

      SELECT.$templateRoot = SELECT.$selectedRoot;
      // Copy to global root varaible
      root = _obj;

      [String, Number, Function, Array, Boolean].forEach((c) => { c.prototype.$root = _obj });

      if (SELECT.$selected && SELECT.$selected.length > 0) {
        SELECT.$selected
          .sort((a, b) => b.path.length - a.path.length)
          .forEach((item) => {
            const _parsed = TRANSFORM.run(item.object, _obj);
            SELECT.$templateRoot = _helper.setPropByKeyPath(SELECT.$templateRoot, item.path, _parsed);
            SELECT.$selectedRoot = SELECT.$templateRoot;
            item.object = _parsed;
          });
        SELECT.$selected.sort((a, b) => a.index - b.index);
      } else {
        const _parsed = TRANSFORM.run(SELECT.$selectedRoot, _obj);
        SELECT.$templateRoot = _helper.setPropByKeyPath(SELECT.$templateRoot, '', _parsed);
        SELECT.$selectedRoot = SELECT.$templateRoot;
      }

      [String, Number, Function, Array, Boolean].forEach((c) => { delete c.prototype.$root });

      return SELECT;
    },

    // Terminal methods
    /**
     * 
     * @returns {[Objects]}
     */
    objects: () => {
      SELECT.$progress = null;
      return SELECT.$selected ?
        SELECT.$selected.map(entry => entry.object) :
        [SELECT.$selectedRoot];
    },

    /**
     * 
     * @returns {}
     */
    keys: () => {
      SELECT.$progress = null;
      return SELECT.$selected ?
        SELECT.$selected.map(entry => entry.key) :
        Array.isArray(SELECT.$selectedRoot) ?
          Object.keys(SELECT.$selectedRoot).map(entry => parseInt(entry)) :
          Object.keys(SELECT.$selectedRoot);
    },

    /**
     * 
     * @returns {[String]}
     */
    paths: () => {
      SELECT.$progress = null;
      return SELECT.$selected ?
        SELECT.$selected.map(entry => entry.path) :
        Array.isArray(SELECT.$selectedRoot) ?
          // key is integer
          Object.keys(SELECT.$selectedRoot).map(entry => '[' + entry + ']') :
          // key is string
          Object.keys(SELECT.$selectedRoot).map(entry => '["' + entry + '"]');
    },

    /**
     * 
     * @returns {}
     */
    values: () => {
      SELECT.$progress = null;
      return SELECT.$selected ?
        SELECT.$selected.map(entry => entry.value) :
        Object.values(SELECT.$selectedRoot);
    },

    /**
     * 
     * @returns 
     */
    root: () => {
      SELECT.$progress = null;
      return SELECT.$selectedRoot;
    },

  };

  // Native JSON object override
  const _stringify = JSON.stringify;
  // Syntax: JSON.stringify(value, replacer, space)
  // @value: The value to convert to a JSON string.
  // @replacer [Optional]: A function that alters the behavior of the stringification process
  // @space [Optional]: A String or Number object that's used to insert white space into the 
  // output JSON string for readability purposes.

  JSON.stringify = (value, replacer, spaces) => {
    const _t = typeof value;
    if (['number', 'string', 'boolean'].includes(_t)) {
      return _stringify(value, replacer, spaces);
    }
    if (!replacer) {
      return _stringify(value, (key, val) => {

        if (SELECT.$injected && SELECT.$injected.length > 0 &&
          SELECT.$injected.indexOf(key) !== -1) { return undefined; }

        if (key === '$root' || key === '$index') { return undefined; }

        if (key in TRANSFORM.memory) { return undefined; }

        if (typeof val === 'function') {
          return '(' + val.toString() + ')';
        } else {
          return val;
        }

      }, spaces);
    } else {
      return _stringify(value, replacer, spaces);
    }
  };

  // Export
  if (typeof exports !== 'undefined') {
    const x = {
      TRANSFORM: TRANSFORM,
      SELECT: SELECT,
      Conditional: Conditional,
      Helper: _helper,
      inject: SELECT.inject,
      select: SELECT.select,
      transform: TRANSFORM.transform,
    };
    if (typeof module !== 'undefined' && module.exports) { exports = module.exports = x; }
    exports = x;
  } else {
    $context.ST = {
      select: SELECT.select,
      inject: SELECT.inject,
      transform: TRANSFORM.transform,
    };
  }

}());