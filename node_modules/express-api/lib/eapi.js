'use strict';
var npath = require('path');
var _ = require('lodash');
var cson = require('cson-safe');
var yaml = require('js-yaml');
var fs = require('fs');
var env = process.env.NODE_ENV || 'development';
var U = require('./utils');
var crypto = require('crypto');

function EApi(options) {
  this.options = options;
  var express = options.express;
  if (!express) throw new Error('express is required to route resources');

  // routes operation actions
  this.apiRouter = express.Router();

  // routes for json schemas
  this.docsRouter = express.Router();

  // routes for documentation
  this.schemaRouter = express.Router();

  // file directory containg read schemas
  this.docsDir = options.docsDir;
  if (!this.docsDir) throw new Error('docsDir is required to read schema files.');

  this.apiUrl = options.apiUrl;
  if (!this.apiUrl) throw new Error('apiUrl is required option to route resources.');

  this.docsUrl = options.docsUrl;
  if (!this.docsUrl) this.docsUrl = this.apiUrl + '/docs';

  this.schemaUrl = options.schemaUrl;
  if (!this.schemaUrl) this.schemaUrl = this.apiUrl + '/schema';

  // the logger
  this.log = options.logger || console;
  this.extname = options.extname || '.cson';

  // middleware to wrap actions
  this.actionWrapper = options.actionWrapper;

  this.company = options.company;

  this.apis = {};
  this._pipeline = [];
  this.cache = {};
}

EApi.prototype.use = function(middleware) {
  this._pipeline.push(middleware);
  return this;
};


EApi.prototype._parseSchemaFile = function(filename) {
  filename = npath.resolve(this.docsDir, filename);
  var result, useCache = env !== 'development';
  if (useCache) result =  this.cache[filename];
  if (result) return result;

  if (!fs.existsSync(filename)) return null;

  var extname = npath.extname(filename);
  var content = fs.readFileSync(filename, 'utf8');
  var json;
  if (extname === '.cson')
    json = cson.parse(content);
  else if (extname === '.json')
    json = JSON.parse(content);
  else if (extname === '.yaml')
    json = yaml.safeLoad(content);
  else
    throw new Error('Unrecognized schema file extension: ' + extname);

  if (useCache) this.cache[filename] = json;
  return json;
};


/**
 * Exposes a resource.
 *
 * @param {String} schema  The filename of the schema.
 * @param {Object} implementation The object which realizes the APIs.
 * @param {Object} options.cors.allowOrigin CORS access control allow origin.
 *
 * @example
 *  swag.addApi('pets.cson', require('./resources/pets'), { cors: {allowOrigin: '*' } });
 */
EApi.prototype.addApi = function(schema, implementation, options) {
  var self = this;
  if (!options) options = {};

  // mark where an ACTION is inserted into the pipeline effectively allowing
  // pre and post middleware
  if (this._pipeline.indexOf('ACTION') < 0) {
    this._pipeline.push('ACTION');
  }

  if (!schema) throw new Error('Invalid required argument: schema');
  if (!implementation) throw new Error('Invalid required argument: implementation');

  var router = this.apiRouter;
  if (typeof schema === 'string') {
    var filename = schema;
    var extname = npath.extname(schema);
    if (!extname) filename += this.extname;
    schema = this._parseSchemaFile(filename);
  }
  if (!schema.apis) {
    console.error('error schema:', schema);
    throw new Error('Invalid schema. `apis` property not found in object|file');
  }

  schema.apis.forEach(function processApi(api) {
    var path = api.path || '/';
    if (path.length > 1) path = U.chompRight(path, '/');

    api.operations.forEach(function processOperation(operation) {
      var name = operation.nickname;
      if (!name) {
        console.error('Error:', operation);
        throw new Error('`nickname` not found');
      }
      var method = operation.method;
      if (!method) {
        console.error('Error:', operation);
        throw new Error('`method` not found');
      }

      var impl = implementation[name];
      if (!impl) throw new Error('Could not find implementation function: ' + name);

      // impl can be a `function` or object { action: function(){} }
      // An object can pass along other metadata to middleware
      var action = typeof impl === 'function' ?  impl : impl.action;
      var pipeline = _.clone(self._pipeline);

      if (impl.cors) {
        pipeline.unshift(cors(impl.cors.allowOrigin));
      } else if (options.cors) {
        pipeline.unshift(cors(options.cors.allowOrigin));
      }

      // user middleware uses req.__api
      function __eapi(req, res, next) {
        req.__eapi = { resource: schema, operation: operation, implementation: impl };
        next();
      }

      // convert swagger params from {prop} to  express :prop
      path = path.replace(/\{(\w+)\}/, function(match, name) {
        return ':' + name;
      });
      path = U.chompRight(path, '/');

      if (self.actionWrapper) {
        action = self.actionWrapper(action);
      }

      pipeline[pipeline.indexOf('ACTION')] = action;
      // first middleware needs to set __eapi for other middleware
      pipeline.unshift(__eapi);
      pipeline = _.flatten(pipeline);
      self.log.info(method + ' ' + path + ' -> ' + name);
      router[method.toLowerCase()](path, pipeline);
    });
  });

  return this;
};

function cors(origin) {
  return function cors(req, res, next) {
    console.log('EAPI CORS');
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    // // intercept OPTIONS method
    // if ('OPTIONS' === req.method)
    //   res.send(204);
    // else
    //   next();
    next();
  };
}

/**
 * Creates a router that returns JSON for each schema file.
 *
 * @notes
 * An empty schema basePath is set to apiUrl in development  mode.
 *
 * The resource listings file is assumed to be `index.json`. The
 * extension can be overriden by `extname` options.
 */
EApi.prototype._configureDocs = function() {
  var self = this;
  var schemaRouter = this.schemaRouter;
  var docsRouter = this.docsRouter;
  var basePath = this.apiUrl;
  var indexFile = 'index' + this.extname;
  var serveStatic = require('serve-static');
  var publicDir = npath.join(__dirname,  '../public');

  var index = self._parseSchemaFile(indexFile);
  var title;
  if (!index || !index.info || !index.info.title) {
    console.warn('Resource listing missing `info.title` property');
    title = 'Express API';
  } else {
    title = index.info.title;
  }

  var content = fs.readFileSync(npath.join(publicDir, 'index.html.tpl'), 'utf8');
  content = _.template(content, {
    schemaUrl: this.schemaUrl,
    docsUrl: this.DocsUrl,
    title: title,
    company: this.company || 'Express API'
  });
  var uniqueIndex = crypto.createHash('sha1').update(this.apiUrl).digest('hex');
  uniqueIndex = 'index-temp-' + uniqueIndex + '.html';
  fs.writeFileSync(npath.join(publicDir,  uniqueIndex), content, 'utf8');

  docsRouter.use(serveStatic(publicDir, {'index': [uniqueIndex]}));

  schemaRouter.get('/', cors('*'), function(req, res) {
    var json = self.options.indexFile || self._parseSchemaFile(indexFile);
    return json ? res.json(json) : res.send(404);
  });

  schemaRouter.get('/:name', cors('*'), function(req, res) {
    var name = req.params.name;
    if (!name) res.send(404);
    var json = self._parseSchemaFile(name + self.extname);
    if (!json.basePath) json.basePath = basePath;
    return json ? res.json(json) : res.send(404);
  });
};

EApi.prototype.end = function() {
  this._configureDocs();
};

module.exports = EApi;

